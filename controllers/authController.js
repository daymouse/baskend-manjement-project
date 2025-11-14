import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { supabase } from "../supabaseClient.js";
import { validationResult } from "express-validator";

// =================== REGISTER ===================
export const registerUser = async (req, res) => {
  // 🔍 Validasi input dari express-validator
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  // 🧩 Ambil data dari body
  const { username, password, confirm_password, full_name, email } = req.body;
  const is_admin = false;
  const role = "";
  const current_task_status = "available";

  try {
    // ✅ Cek kecocokan password dan konfirmasi
    if (password !== confirm_password) {
      return res
        .status(400)
        .json({ error: "Password dan konfirmasi password tidak cocok." });
    }

    // 🔐 Enkripsi password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 💾 Simpan user baru ke tabel Supabase
    const { data, error } = await supabase
      .from("users")
      .insert([
        {
          username,
          password: hashedPassword,
          full_name,
          email,
          is_admin,
          current_task_status,
        },
      ])
      .select();

    if (error) return res.status(500).json({ error: error.message });

    // 🎉 Respons sukses
    res.status(201).json({ message: "User berhasil didaftarkan", data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// =================== LOGIN ===================
export const loginUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { email, password } = req.body;

  try {
    // 🔹 Ambil user dari database
    const { data: users, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .limit(1);

    if (error) return res.status(500).json({ error: error.message });
    if (!users || users.length === 0)
      return res.status(401).json({ error: "Email tidak ditemukan" });

    const user = users[0];

    // 🔹 Cek password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: "Password salah" });

    // 🔹 Buat token JWT
    const token = jwt.sign(
      {
        user_id: user.user_id,
        email: user.email,
        role: user.role,
        is_admin: user.is_admin,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // 🔹 Simpan token ke cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 1000,
    });

    // 🔹 Hapus password dari respon
    const { password: _, ...userData } = user;

    // 🧠 Tambahkan log user yang login
    console.log("👤 User berhasil login:");
    console.log({
      user_id: user.user_id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      is_admin: user.is_admin,
      current_task_status: user.current_task_status,
    });

    // 🔹 Kirim respon
    res.json({ message: "Login berhasil", user: userData });
  } catch (err) {
    console.error("🔥 Login gagal:", err);
    res.status(500).json({ error: err.message });
  }
};

// =================== CHECK AUTH ===================
export const checkAuth = (req, res) => {
  if (!req.user) return res.status(401).json({ authenticated: false });
  res.json({ authenticated: true, user: req.user });
};

// =================== GET ME ===================
export const getAuthMe = async (req, res) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: "Not authenticated" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 🔹 Ambil data user dari database
    const { data: user, error } = await supabase
      .from("users")
      .select("user_id, full_name, email")
      .eq("user_id", decoded.user_id)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: "User not found" });
    }

    console.log("🔑 Authenticated user:", user);
    return res.json(user);
  } catch (err) {
    console.error("❌ Auth error:", err);
    return res.status(403).json({ error: "Invalid token" });
  }
};


export const updateUseradmin = async (req, res) => {
  const { id, username, full_name, email } = req.body;

  try {
    if (req.body.password) {
      return res.status(400).json({ error: "Password tidak dapat diubah melalui endpoint ini." });
    }
    
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Format email tidak valid." });
    }

    // 🔍 Cek apakah user ada
    const { data: existingUser, error: findError } = await supabase
      .from("users")
      .select("*")
      .eq("user_id", id)
      .single();

    if (findError || !existingUser) {
      return res.status(404).json({ error: "User tidak ditemukan." });
    }

    // 🔄 Update data (kecuali password)
    const { data, error } = await supabase
      .from("users")
      .update({
        username,
        full_name,
        email,
      })
      .eq("user_id", id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      message: "Data user berhasil diperbarui.",
      user: data,
    });
  } catch (err) {
    console.error("Error updating user:", err);
    res.status(500).json({ error: "Terjadi kesalahan pada server." });
  }
};

