import { supabase } from "../supabaseClient.js";

// ✅ GET ALL ROLE
export const getAllRoles = async (req, res) => {
  try {
    const { data, error } = await supabase.from("roles_user").select("*");

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ✅ CREATE ROLE
export const createRole = async (req, res) => {
  const { NameRole } = req.body;

  try {
    const { data, error } = await supabase
      .from("roles_user")
      .insert([{ role_name: NameRole }])
      .select();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(201).json({
      message: "Role berhasil ditambahkan",
      data,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
