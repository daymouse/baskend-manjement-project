import { supabase } from "../supabaseClient.js";
import { io } from "./../server.js";

// =================== SHOW ALL CARDS BY BOARD ===================
export const getCardsByBoard = async (req, res) => {
  const { board_id } = req.params;

  try {
    const { data, error } = await supabase
      .from("cards")
      .select(`
        card_id,
        card_title,
        description,
        status,
        priority,
        due_date,
        card_assignments (assignment_id),
        card_blockers:card_blockers!card_blockers_card_id_fkey (
          blocker_id,
          is_resolved
        )
      `)
      .eq("board_id", board_id)
      .order("card_id", { ascending: true });

    if (error) return res.status(400).json({ error: error.message });

    // Tambahkan flag has_assignment
    const processed = data.map((card) => ({
      ...card,
      has_assignment: card.card_assignments && card.card_assignments.length > 0,
    }));

    res.status(200).json({ cards: processed });
  } catch (err) {
    console.error("❌ getCardsByBoard Error:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
};


// =================== CREATE CARD ===================
export const createCard = async (req, res) => {
  const boardId = parseInt(req.params.board_id, 10);
  const {
    card_title,
    description,
    due_date,
    status = "todo",
    priority = "medium",
    estimated_hours,
    task_owner_id,
    contributor_ids = [],
    subtasks = [],
  } = req.body;

  const created_by = req.user?.id; // dari middleware authenticateToken

  try {
    // 1️⃣ Insert card utama
    const { data: newCard, error: insertError } = await supabase
      .from("cards")
      .insert([
        {
          board_id: boardId,
          card_title,
          description,
          created_by,
          due_date,
          status,
          priority,
          estimated_hours: estimated_hours || null,
        },
      ])
      .select()
      .single();

    if (insertError) throw insertError;

    // 2️⃣ Update posisi card
    const { data: updatedCard, error: updateError } = await supabase
      .from("cards")
      .update({ position: newCard.card_id })
      .eq("card_id", newCard.card_id)
      .select()
      .single();

    if (updateError) throw updateError;

    // 3️⃣ Tambahkan task_owner ke card_assignments
    let assignments = [];
    if (task_owner_id) {
      const { data: insertedAssignments, error: assignmentError } = await supabase
        .from("card_assignments")
        .insert([
          {
            card_id: updatedCard.card_id,
            user_id: task_owner_id,
            assignment_status: "assigned",
          },
        ])
        .select();

      if (assignmentError) throw assignmentError;
      assignments = insertedAssignments;
    }

    // 4️⃣ Tambahkan contributors ke task_contributors
    let contributors = [];
    if (Array.isArray(contributor_ids) && contributor_ids.length > 0) {
      const contributorData = contributor_ids.map((user_id) => ({
        card_id: updatedCard.card_id,
        user_id,
        added_by: created_by,
        role: "contributor",
      }));

      const { data: insertedContributors, error: contributorError } = await supabase
        .from("task_contributors")
        .insert(contributorData)
        .select();

      if (contributorError) throw contributorError;
      contributors = insertedContributors;
    }

    // 5️⃣ Tambahkan subtasks, assigned_to = task_owner_id
    let createdSubtasks = [];
    if (Array.isArray(subtasks) && subtasks.length > 0) {
      const subtaskData = subtasks.map((title, idx) => ({
        card_id: updatedCard.card_id,
        subtask_title: title,
        assigned_to: task_owner_id || null,
        position: idx + 1,
        status: "todo",
        created_by,
      }));

      const { data: insertedSubtasks, error: subtaskError } = await supabase
        .from("subtasks")
        .insert(subtaskData)
        .select();

      if (subtaskError) throw subtaskError;
      createdSubtasks = insertedSubtasks;
    }

    // ✅ Response sukses
    res.status(201).json({
      message: "Card berhasil dibuat",
      card: updatedCard,
      assignments,
      contributors,
      subtasks: createdSubtasks,
    });
  } catch (err) {
    console.error("🔥 ERROR create card:", err);
    res.status(500).json({ error: err.message, details: err });
  }
};


export const getBoardMembers = async (req, res) => {
  const { board_id } = req.params;

  try {
    const { data: board, error: boardError } = await supabase
      .from("boards")
      .select("project_id")
      .eq("board_id", board_id)
      .single();

    if (boardError) throw boardError;
    if (!board) return res.json({ data: [] });

    const { data: members, error } = await supabase
      .from("project_members")
      .select(`
        member_id,
        role,
        user_id,
        users (
          full_name,
          username
        )
      `)
      .eq("project_id", board.project_id)
      .eq("role", "member");

    if (error) throw error;
    const formatted = members.map((m) => ({
      member_id: m.member_id,
      role: m.role,
      user_id: m.user_id,
      full_name: m.users?.full_name,
      username: m.users?.username,
    }));

    res.json({ data: formatted });
  } catch (err) {
    console.error("❌ Error fetch members:", err.message);
    res.status(500).json({ error: "Gagal mengambil members" });
  }
};

//card detail
export const getCardDetail = async (req, res) => {
  const { id } = req.params;

  try {
    const { data: card, error: cardError } = await supabase
    .from("cards")
    .select(`
      card_id,
      card_title,
      description,
      status,
      priority,
      due_date,
      estimated_hours,
      actual_hours,
      created_at,

      created_by:users!cards_created_by_fkey (full_name, email),

      card_blockers:card_blockers!card_blockers_card_id_fkey (
        blocker_id,
        blocker_reason,
        is_resolved,
        created_at
      )
    `)
    .eq("card_id", id)
    .single();


    if (cardError || !card) {
      return res.status(404).json({ message: "Card not found" });
    }

    const { data: assignments, error: assignmentError } = await supabase
      .from("card_assignments")
      .select(`
        assignment_id,
        assignment_status,
        assigned_at,
        started_at,
        completed_at,
        user:users(user_id, full_name, email)
      `)
      .eq("card_id", id);

    if (assignmentError) {
      console.error("Assignment Error:", assignmentError);
    }

    const { data: subtasks, error: subtaskError } = await supabase
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
        assignee:assigned_to (user_id, full_name, email),
        subtask_blockers (
            blocker_id,
            blocker_reason,
            is_resolved,
            created_at
          )
      `)
      .eq("card_id", id)
      .order("position", { ascending: true });

    if (subtaskError) {
      console.error("Subtask Error:", subtaskError);
    }

    // 4️⃣ Gabungkan semua data
    const result = {
      ...card,
      assignments: assignments || [],
      subtasks: subtasks || [],
    };

    return res.status(200).json(result);
  } catch (err) {
    console.error("❌ Error getCardDetail:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateCardStatus = async (req, res) => {
  const { id } = req.params;
  const { new_status } = req.body;

  console.log("📥 [BACKEND] PUT /card/:id/status diterima:", { id, new_status });

  try {
    // 🔹 1. Ambil data card dulu
    const { data: card, error: cardErr } = await supabase
      .from("cards")
      .select("card_id, status, card_title, board_id")
      .eq("card_id", id)
      .single();

    console.log("🔎 [BACKEND] Hasil query card:", { card, cardErr });

    if (cardErr || !card) {
      return res.status(404).json({ error: "Card tidak ditemukan" });
    }

    // 🔹 2. Pastikan status valid
    if (card.status !== "in_progress") {
      return res.status(400).json({
        error: "Card harus dalam status 'in_progress' untuk diubah ke 'review'",
      });
    }

    // 🔹 3. Cek semua subtask
    const { data: subtasks, error: subErr } = await supabase
      .from("subtasks")
      .select("subtask_id, status")
      .eq("card_id", id);

    if (subErr) {
      return res.status(500).json({ error: "Gagal memeriksa subtask" });
    }

    const unfinished = subtasks.filter((s) => s.status !== "done");
    if (unfinished.length > 0) {
      return res.status(400).json({
        error:
          "Tidak bisa mengubah status ke 'review', masih ada subtask yang belum selesai",
        unfinished_subtasks: unfinished.map((s) => s.subtask_id),
      });
    }

    // 🔹 4. Update status card
    const { error: updateErr } = await supabase
      .from("cards")
      .update({ status: "review" })
      .eq("card_id", id);

    if (updateErr) {
      return res.status(500).json({ error: "Gagal memperbarui status card" });
    }

    // 🔹 5. Emit event socket ke semua member di board
    io.to(`board_${card.board_id}`).emit("card_status_review", {
      board_id: card.board_id,
      card_id: card.card_id,
      new_status: "review",
      type: "move_to_review",
      message: `📢 Card "${card.card_title}" telah dipindahkan ke Review`,
    });


    console.log(
      `📡 [SOCKET] Emit card_status_inProgres ke board ${card.board_id}`
    );

    // 🔹 6. Kirim respon sukses
    return res.json({
      message: "Status card berhasil diubah menjadi 'review'",
      emitted: true,
    });
  } catch (err) {
    console.error("🔥 Error updateCardStatus:", err);
    return res.status(500).json({ error: "Terjadi kesalahan server" });
  }
};

// POST /card/:card_id/approve
export const approveCard = async (req, res) => {
  const { card_id } = req.params;

  try {
    // 1️⃣ Ambil data card
    const { data: card, error: cardError } = await supabase
      .from("cards")
      .select("*, board_id")
      .eq("card_id", card_id)
      .single();

    if (cardError) throw cardError;
    if (!card) return res.status(404).json({ error: "Card tidak ditemukan" });

    // 2️⃣ Validasi status
    if (card.status !== "review") {
      return res.status(400).json({
        error: `Card hanya bisa di-approve saat status 'review' (status sekarang: '${card.status}')`,
      });
    }

    // 3️⃣ Hitung total waktu aktual
    const { data: timeData, error: timeError } = await supabase
      .from("time_logs")
      .select("duration_seconds")
      .eq("card_id", card_id);

    if (timeError) throw timeError;

    let totalSeconds = 0;

    if (timeData && timeData.length > 0) {
      totalSeconds = timeData.reduce(
        (acc, log) => acc + (log.duration_seconds || 0),
        0
      );
    } else {
      const { data: subtaskData, error: subtaskError } = await supabase
        .from("subtasks")
        .select("actual_hours")
        .eq("card_id", card_id);

      if (subtaskError) throw subtaskError;
      totalSeconds = subtaskData.reduce(
        (acc, st) => acc + ((st.actual_hours || 0) * 3600),
        0
      );
    }

    const totalHours = totalSeconds / 3600;

    // 4️⃣ Update card
    const { error: updateError } = await supabase
      .from("cards")
      .update({
        status: "done",
        actual_hours: totalHours.toFixed(2),
      })
      .eq("card_id", card_id);

    if (updateError) throw updateError;

    // 5️⃣ Update assignment
    const { error: assignmentError } = await supabase
      .from("card_assignments")
      .update({
        assignment_status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("card_id", card_id);

    if (assignmentError) throw assignmentError;

    // ✅ 6️⃣ Emit Socket.IO event ke board yang sama
    io.to(`board_${card.board_id}`).emit("card_status_done", {
      card_id,
      board_id: card.board_id,
      new_status: "done",
      total_actual_hours: totalHours.toFixed(2),
    });

    return res.json({
      message: "✅ Card berhasil di-approve dan assignment diselesaikan",
      new_status: "done",
      total_actual_hours: totalHours.toFixed(2),
    });

  } catch (err) {
    console.error("❌ Error approveCard:", err);
    res.status(500).json({ error: err.message || "Gagal approve card" });
  }
};


// ✅ REVISE CARD
export const reviseCard = async (req, res) => {
  const { card_id } = req.params;

  try {
    // 1️⃣ Ambil data card
    const { data: card, error: cardError } = await supabase
      .from("cards")
      .select("*, board_id")
      .eq("card_id", card_id)
      .single();

    if (cardError) throw cardError;
    if (!card) return res.status(404).json({ error: "Card tidak ditemukan" });

    // 2️⃣ Validasi status
    if (card.status !== "review") {
      return res.status(400).json({
        error: `Card hanya bisa direvisi saat status 'review' (status sekarang: '${card.status}')`,
      });
    }

    // 3️⃣ Update ke in_progress
    const { error: updateError } = await supabase
      .from("cards")
      .update({ status: "in_progress" })
      .eq("card_id", card_id);

    if (updateError) throw updateError;

    // ✅ 4️⃣ Emit ke socket board
    io.to(`board_${card.board_id}`).emit("card_status_revisi", {
      card_id,
      board_id: card.board_id,
      new_status: "in_progress",
    });

    return res.json({
      message: "🔁 Card dikembalikan untuk revisi",
      new_status: "in_progress",
    });
  } catch (err) {
    console.error("❌ Error reviseCard:", err);
    res.status(500).json({ error: "Gagal revisi card" });
  }
};

export const updateCard = async (req, res) => {
  const { card_id } = req.params;

  // ✅ hanya izinkan field tertentu
  const allowedFields = ["card_title", "description", "due_date", "priority", "estimated_hours"];
  const updates = Object.fromEntries(
    Object.entries(req.body).filter(([key]) => allowedFields.includes(key))
  );

  try {
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "Tidak ada field yang valid untuk diupdate" });
    }

    const { data, error } = await supabase
      .from("cards")
      .update(updates)
      .eq("card_id", card_id)
      .single();

    if (error) throw error;

    return res.json({ message: "✅ Card updated", data });
  } catch (err) {
    console.error("❌ updateCard:", err);
    return res.status(500).json({ error: "Gagal update card" });
  }
};


export const getAssignableMembers = async (req, res) => {
  const { project_id } = req.params;

  try {
    const { data, error } = await supabase
      .from("project_members")
      .select(`
        member_id,
        role,
        users:user_id (
          user_id,
          full_name
        )
      `)
      .eq("project_id", project_id)
      .eq("role", "member");

    if (error) throw error;

    return res.json(data);
  } catch (err) {
    console.error("❌ getAssignableMembers:", err);
    return res.status(500).json({ error: "Gagal ambil daftar anggota" });
  }
};

export const updateCardAssignment = async (req, res) => {
  const { card_id } = req.params;
  const { user_id } = req.body; // user yang dipilih

  try {
    // Hapus assignment lama
    await supabase.from("card_assignments").delete().eq("card_id", card_id);

    // Set assignment baru
    const { data, error } = await supabase
      .from("card_assignments")
      .insert({ card_id, user_id, assignment_status: "assigned" })
      .single();

    if (error) throw error;

    return res.json({ message: "✅ Assignment updated", data });
  } catch (err) {
    console.error("❌ updateCardAssignment:", err);
    return res.status(500).json({ error: "Gagal update assignment card" });
  }
};