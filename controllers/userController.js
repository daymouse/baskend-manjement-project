import { supabase } from "../supabaseClient.js";

// ✅ GET ALL USER (Non-admin)
export const getAllUsers = async (req, res) => {
  try {
    const { data: UserData, error } = await supabase
      .from("users")
      .select("*")
      .neq("is_admin", true)
      .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    res.json({
      message: "Menampilkan semua data",
      data: UserData,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// ✅ UPDATE ROLE
export const updateUserRole = async (req, res) => {
  const { id } = req.params;
  const { aturRole } = req.body;

  try {
    const { data, error } = await supabase
      .from("users")
      .update({ role_id: aturRole })
      .eq("user_id", id);

    if (error) return res.status(500).json({ error: error.message });

    return res.json({
      message: "Role berhasil diperbarui",
      data,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ✅ UPDATE USERNAME
export const updateUsername = async (req, res) => {
  const { id } = req.params;
  const { aturUsername } = req.body;

  try {
    const { data, error } = await supabase
      .from("users")
      .update({ username: aturUsername })
      .eq("user_id", id);

    if (error) return res.status(500).json({ error: error.message });

    return res.json({
      message: "Username berhasil diperbarui",
      data,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ✅ UPDATE FULLNAME
export const updateFullName = async (req, res) => {
  const { id } = req.params;
  const { aturFullName } = req.body;

  try {
    const { data, error } = await supabase
      .from("users")
      .update({ full_name: aturFullName })
      .eq("user_id", id);

    if (error) return res.status(500).json({ error: error.message });

    return res.json({
      message: "Nama Lengkap berhasil diperbarui",
      data,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ✅ DELETE USER
export const deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await supabase.from("users").delete().eq("user_id", id);

    if (error) return res.status(500).json({ error: error.message });

    return res.json({ message: "User deleted successfully" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ✅ FILTER LEADER
export const getLeaders = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("users")
      .select(`
        user_id,
        full_name,
        current_task_status,
        roles_user!inner (
          role_id
        )
      `)
      .eq("roles_user.role_id", "5")
      .eq("current_task_status", "available");

    if (error) throw error;

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ✅ FILTER MEMBER
export const getMembers = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("users")
      .select(`
        user_id,
        full_name,
        current_task_status,
        roles_user!inner(
          role_id,
          role_name
        )
      `)
      .eq("current_task_status", "available");


    if (error) throw error;

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
