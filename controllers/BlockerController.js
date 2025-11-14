import { supabase } from "../supabaseClient.js";
import { io } from "../server.js";

/**
 * 🧱 Melaporkan blocker baru
 * POST /blocker/report
 */
export const reportBlocker = async (req, res) => {
  console.log("➡️ [REPORT BLOCKER] Request diterima:", req.body);

  const { type, id, reason, board_id, card_id } = req.body;
  const user_id = req.user?.user_id;

  console.log("👤 User ID:", user_id);

  // 🔸 Validasi input
  if (!type || !id || !reason) {
    console.warn("⚠️ Validasi gagal:", { type, id, reason });
    return res.status(400).json({ error: "type, id, dan reason wajib diisi" });
  }

  const table = type === "card" ? "card_blockers" : "subtask_blockers";
  const column = type === "card" ? "card_id" : "subtask_id";
  const room = type === "card" ? `board_${board_id}` : `card_${card_id}`;

  console.log(`🧩 Menyimpan blocker ke tabel '${table}' (${column}=${id})`);

  try {
    const { data, error } = await supabase
      .from(table)
      .insert({
        [column]: id,
        reported_by: user_id,
        blocker_reason: reason,
        is_resolved: false,
      })
      .select()
      .single();

    if (error) throw error;

    console.log("✅ Blocker berhasil disimpan:", data);

    // 🔔 Emit realtime socket dengan payload lengkap
    const payload = {
      type,
      reporter_id: user_id,
      board_id,
      card_id,
      blocker_id: data.blocker_id,
      blocker_reason: data.blocker_reason,
      subtask_id: data.subtask_id, // akan undefined untuk card_blockers (aman)
      created_at: data.created_at,
      is_resolved: data.is_resolved,
    };

    io.to(room).emit("blocker_reported", payload);

    console.log(`📡 [SOCKET EMIT] blocker_reported -> ${room}`, payload);

    return res.status(201).json({
      message: "✅ Blocker dilaporkan dan dikirim ke socket",
      data: payload,
    });
  } catch (err) {
    console.error("🔥 [REPORT BLOCKER] Error:", err);
    return res.status(500).json({ error: err.message });
  }
};

/**
 * 🔧 Menyelesaikan blocker
 * PATCH /blocker/solve
 */
export const solveBlocker = async (req, res) => {
  console.log("➡️ [SOLVE BLOCKER] Request diterima:", req.body);

  const { type, blocker_id, solution, board_id, card_id } = req.body;
  const user_id = req.user?.user_id;

  if (!type || !blocker_id || !solution) {
    console.warn("⚠️ Validasi gagal:", { type, blocker_id, solution });
    return res
      .status(400)
      .json({ error: "type, blocker_id, dan solution wajib diisi" });
  }

  const table = type === "card" ? "card_blockers" : "subtask_blockers";
  const room = type === "card" ? `board_${board_id}` : `card_${card_id}`;

  console.log(`🛠️ Memperbarui blocker di tabel '${table}' (id=${blocker_id})`);

  try {
    const { data, error } = await supabase
      .from(table)
      .update({
        is_resolved: true,
        solution,
        resolved_by: user_id,
        resolved_at: new Date(),
      })
      .eq("blocker_id", blocker_id)
      .select()
      .single();

    if (error) throw error;

    console.log("✅ Blocker diselesaikan:", data);

    // 🔔 Emit realtime socket
    const payload = {
      type,
      resolver_id: user_id,
      board_id,
      card_id,
      blocker_id: data.blocker_id,
      subtask_id: data.subtask_id,
      solution: data.solution,
      resolved_at: data.resolved_at,
    };

    io.to(room).emit("blocker_solved", payload);

    console.log(`📡 [SOCKET EMIT] blocker_solved -> ${room}`, payload);

    return res.json({
      message: "✅ Blocker diselesaikan dan dikirim ke socket",
      data: payload,
    });
  } catch (err) {
    console.error("🔥 [SOLVE BLOCKER] Error:", err);
    return res.status(500).json({ error: err.message });
  }
};

export const getBlockersByCard = async (req, res) => {
  const { card_id } = req.params;

  try {
    if (!card_id) {
      return res.status(400).json({ error: "card_id wajib dikirim" });
    }

    // 🔹 Ambil semua blocker berdasarkan card
    const { data, error } = await supabase
      .from("blockers")
      .select(`
        blocker_id,
        type,
        subtask_id,
        card_id,
        blocker_reason,
        is_resolved,
        solution,
        created_at,
        updated_at,
        subtasks (
          subtask_name
        )
      `)
      .eq("card_id", card_id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return res.status(200).json({
      message: "Daftar laporan blocker",
      data,
    });
  } catch (err) {
    console.error("❌ Gagal ambil blockers:", err.message);
    res.status(500).json({ error: "Gagal mengambil data blockers" });
  }
};

// GET /blocker/subtask/:subtask_id
export const getBlockersBySubtask = async (req, res) => {
  const { subtask_id } = req.params;

  try {
    const { data, error } = await supabase
      .from("subtask_blockers")
      .select(`
        blocker_id,
        subtask_id,
        blocker_reason,
        solution,
        is_resolved,
        created_at,
        resolved_at,
        reported_by:users!subtask_blockers_reported_by_fkey(full_name),
        resolved_by:users!subtask_blockers_resolved_by_fkey(full_name)
      `)
      .eq("subtask_id", subtask_id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json({ data });
  } catch (err) {
    console.error("❌ getBlockersBySubtask error:", err.message);
    res.status(500).json({ error: err.message });
  }
};
