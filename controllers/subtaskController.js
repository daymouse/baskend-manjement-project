import { supabase } from "../supabaseClient.js";
import { io } from "../server.js"; 

// 🔹 GET /cards/:cardId/subtasks
export const getSubtasks = async (req, res) => {
  const { cardId } = req.params;

  try {
    const { data, error } = await supabase
      .from("subtasks")
      .select("*")
      .eq("card_id", cardId)
      .order("done", { ascending: true }) // 🔹 yang belum selesai di atas
      .order("created_at", { ascending: false }); // 🔹 yang baru dibuat di atas

    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error("❌ Gagal ambil subtasks:", err);
    res.status(500).json({ error: "Gagal ambil subtasks" });
  }
};


// 🔹 POST /cards/:cardId/subtasks
export const createSubtask = async (req, res) => {
  const { cardId } = req.params;
  const { subtask_title, description, estimated_hours } = req.body;
  const userId = req.user?.user_id;

  try {
    // 1️⃣ Validasi user
    if (!userId) {
      return res.status(400).json({
        error: "User ID tidak ditemukan. Pastikan token login valid.",
      });
    }

    if (!subtask_title || !subtask_title.trim()) {
      return res.status(400).json({ error: "subtask_title wajib diisi." });
    }

    // 2️⃣ Pastikan card valid & belum 'done'
    const { data: card, error: cardError } = await supabase
      .from("cards")
      .select("status")
      .eq("card_id", cardId)
      .single();

    if (cardError) {
      console.error("❌ Gagal cek status card:", cardError);
      return res.status(500).json({ error: "Gagal memeriksa status card." });
    }

    if (!card) {
      return res.status(404).json({ error: "Card tidak ditemukan." });
    }

    if (card.status === "done") {
      return res.status(400).json({
        error: "Card sudah berstatus 'done'. Tidak bisa menambah subtask baru.",
      });
    }

    // 3️⃣ Pastikan user ditugaskan di card
    const { data: assignedUser, error: assignedErr } = await supabase
      .from("card_assignments")
      .select("assignment_id")
      .eq("card_id", cardId)
      .eq("user_id", userId)
      .single();

    if (assignedErr && assignedErr.code !== "PGRST116") {
      console.error("❌ Gagal cek assignment:", assignedErr);
      return res.status(500).json({ error: "Gagal memeriksa assignment user." });
    }

    if (!assignedUser) {
      return res.status(403).json({
        error:
          "Kamu tidak ditugaskan pada card ini, jadi tidak bisa menambah subtask.",
      });
    }

    // 4️⃣ Tentukan posisi subtask berikutnya
    const { data: lastSub, error: posErr } = await supabase
      .from("subtasks")
      .select("position")
      .eq("card_id", cardId)
      .order("position", { ascending: false })
      .limit(1);

    if (posErr) {
      console.error("❌ Gagal ambil posisi terakhir:", posErr);
      return res.status(500).json({ error: "Gagal menentukan posisi subtask." });
    }

    const nextPosition = lastSub?.[0]?.position ? lastSub[0].position + 1 : 1;

    // 5️⃣ Insert subtask baru
    const { data: newSubtask, error: insertErr } = await supabase
      .from("subtasks")
      .insert([
        {
          card_id: cardId,
          subtask_title,
          description,
          estimated_hours,
          status: "todo",
          created_by: userId,
          assigned_to: userId,
          position: nextPosition,
        },
      ])
      .select("subtask_id")
      .single();

    if (insertErr) {
      console.error("❌ Gagal insert subtask:", insertErr);
      throw insertErr;
    }

    // 6️⃣ Ambil ulang data lengkap (termasuk relasi assignee)
    const { data: fullSubtask, error: fetchErr } = await supabase
      .from("subtasks")
      .select(`
        subtask_id,
        subtask_title,
        description,
        status,
        estimated_hours,
        actual_hours,
        position,
        created_at,
        assigned_to,
        assignee:users!subtasks_assigned_to_fkey (user_id, full_name, email)
      `)
      .eq("subtask_id", newSubtask.subtask_id)
      .single();

    if (fetchErr) {
      console.error("⚠️ Gagal ambil detail subtask setelah insert:", fetchErr);
    }

    // 7️⃣ Emit lewat Socket.IO
    try {
      io.to(`card_${cardId}`).emit("subtask_added", fullSubtask || newSubtask);
      console.log("✅ Emit socket subtask_added berhasil");
    } catch (socketErr) {
      console.warn("⚠️ Gagal emit socket:", socketErr);
    }

    // 8️⃣ Kirim response
    res.status(201).json({
      message: "✅ Subtask berhasil dibuat.",
      data: fullSubtask || newSubtask,
    });
  } catch (err) {
    console.error("❌ Gagal tambah subtask:", err);
    res.status(500).json({
      error: err.message || "Terjadi kesalahan saat menambah subtask",
    });
  }
};


// 🔹 PUT /subtasks/:subtaskId
export const updateSubtaskStatus = async (req, res) => {
  const { subtaskId } = req.params;
  const { status } = req.body;

  try {

    const { data, error } = await supabase
      .from("subtasks")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("subtask_id", subtaskId)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error("❌ Gagal update subtask:", err);
    res.status(500).json({ error: "Gagal update subtask" });
  }
};

export const assignSubtask = async (req, res) => {
  const { subtask_id, assignee_id, socket_id } = req.body;
  const user_id = req.user?.user_id;

  try {
    if (!subtask_id || !assignee_id) {
      return res.status(400).json({ error: "subtask_id dan assignee_id wajib dikirim" });
    }

    const { data: subtask, error: subtaskError } = await supabase
      .from("subtasks")
      .select("subtask_id, card_id")
      .eq("subtask_id", subtask_id)
      .single();

    if (subtaskError || !subtask) throw new Error("Subtask tidak ditemukan");

    const { data: owner, error: ownerError } = await supabase
      .from("card_assignments")
      .select("user_id")
      .eq("card_id", subtask.card_id)
      .eq("user_id", user_id)
      .single();

    if (ownerError && ownerError.code !== "PGRST116") throw ownerError;
    if (!owner) return res.status(403).json({ error: "Tidak punya izin" });

    const { data: updated, error: updateError } = await supabase
      .from("subtasks")
      .update({ assigned_to: assignee_id })
      .eq("subtask_id", subtask_id)
      .select(`
        subtask_id,
        subtask_title,
        description,
        status,
        card_id,
        assigned_to,
        assignee:users!subtasks_assigned_to_fkey (user_id, full_name, email)
      `)
      .single();

    if (updateError) throw updateError;

    // Kirim ke semua di card room
    io.to(`card_${subtask.card_id}`).emit("subtask_assigned", updated);

    // Kirim ke user pengirim sendiri juga
    if (socket_id) io.to(socket_id).emit("subtask_assigned", updated);

    res.json({
      success: true,
      message: "Assignee subtask berhasil diperbarui",
      data: updated,
    });
  } catch (err) {
    console.error("❌ assignSubtask error:", err.message);
    res.status(500).json({ error: err.message });
  }
};


export const getContributorsByCard = async (req, res) => {
  const { cardId } = req.params;

  try {
    const { data, error } = await supabase
      .from("task_contributors")
      .select(`
        contributor_id,
        role,
        users:user_id (
          user_id,
          full_name,
          email
        )
      `)
      .eq("card_id", cardId);

    if (error) throw error;

    res.json({ success: true, data });
  } catch (err) {
    console.error("❌ Gagal ambil contributors:", err);
    res.status(500).json({ error: err.message });
  }
};

export const reviewSubtask = async (req, res) => {
  const { subtask_id, status } = req.body;
  const reviewer_id = req.user?.user_id;

  try {
    if (!subtask_id || !status) {
      return res.status(400).json({ success: false, error: "subtask_id dan status wajib dikirim." });
    }

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ success: false, error: "status harus 'approved' atau 'rejected'." });
    }

    // 1️⃣ Jalankan RPC untuk ubah status subtask
    const { data, error } = await supabase.rpc("review_subtask_tx", {
      _subtask_id: subtask_id,
      _reviewer_id: reviewer_id || null,
      _status: status,
    });
    if (error) throw error;

    // 2️⃣ Ambil info subtask (untuk tahu card_id)
    const { data: subtask, error: subErr } = await supabase
      .from("subtasks")
      .select("card_id, assigned_to")
      .eq("subtask_id", subtask_id)
      .single();
    if (subErr) throw subErr;

    const card_id = subtask.card_id;

    // 3️⃣ Ambil board_id dari card
    const { data: cardInfo, error: cardErr } = await supabase
      .from("cards")
      .select("board_id")
      .eq("card_id", card_id)
      .single();
    if (cardErr) throw cardErr;

    const board_id = cardInfo.board_id;

    // ==========================================================
    // ⭐ UPDATE STATUS CARD BERDASARKAN STATUS SUBTASK
    // ==========================================================
    let newCardStatus = "in_progress";

    if (status === "approved") {
      const { data: unfinished } = await supabase
        .from("subtasks")
        .select("subtask_id")
        .eq("card_id", card_id)
        .neq("status", "done");

      newCardStatus = unfinished.length === 0 ? "done" : "in_progress";
    }

    if (status === "rejected") {
      newCardStatus = "in_progress";
    }

    await supabase.from("cards").update({ status: newCardStatus }).eq("card_id", card_id);

    // ==========================================================
    // 🧩 Tambahan logika baru: update card_assignments jika card done
    // ==========================================================
    if (newCardStatus === "done") {
      const { error: assignErr } = await supabase
        .from("card_assignments")
        .update({
          assignment_status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("card_id", card_id);

      if (assignErr) throw assignErr;
    }

    // ==========================================================
    // 🔔 SOCKET BROADCAST
    // ==========================================================
    io.to(`card_${card_id}`).emit("subtask_status_changed", {
      type: "review_update",
      subtask_id,
      card_id,
      reviewer_id,
      assigned_to: subtask.assigned_to,
      status,
      reviewed_at: new Date().toISOString(),
    });

    io.to(`board_${board_id}`).emit("card_status_changed", {
      type: "card_status_update",
      card_id,
      board_id,
      new_status: newCardStatus,
      updated_at: new Date().toISOString(),
    });

    return res.json({
      success: true,
      message:
        status === "approved"
          ? "✅ Subtask telah disetujui!"
          : "❌ Subtask ditolak. Menunggu revisi dari assignee.",
      data,
    });
  } catch (err) {
    console.error("❌ reviewSubtask error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};


