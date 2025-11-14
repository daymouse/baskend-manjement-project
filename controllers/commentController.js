// server/controllers/commentController.js
import { supabase } from "../supabaseClient.js";
import { io } from "../server.js"; // ✅ gunakan io global

/**
 * Helper: deteksi subtask via hashtag #namaSubtask
 */
async function detectSubtask(commentText) {
  const match = commentText.match(/#(\w+)/);
  if (!match) return null;

  const subtaskName = match[1];
  const { data: subtask } = await supabase
    .from("subtasks")
    .select("subtask_id, assigned_to")
    .ilike("subtask_title", subtaskName)
    .single();

  return subtask || null;
}

/**
 * CREATE Comment
 */
export const createComment = async (req, res) => {
  try {
    const { card_id, user_id, comment_text, comment_type, parent_comment_id } = req.body;
    let subtask_id = null;

    const subtask = await detectSubtask(comment_text);
    if (subtask) subtask_id = subtask.subtask_id;

    const { data, error } = await supabase
      .from("comments")
      .insert([
        {
          card_id,
          subtask_id,
          user_id,
          comment_text,
          comment_type,
          parent_comment_id,
        },
      ])
      .select("*, users(username)");

    if (error) throw error;
    const newComment = data[0];

    // ✅ Emit ke room card saja (bukan global)
    io.to(`card_${card_id}`).emit("comment:new", newComment);

    // Jika terkait subtask → kirim notifikasi ke assigned user
    if (subtask?.assigned_to) {
      io.to(`user_${subtask.assigned_to}`).emit("subtask_commented", {
        subtask_id,
        message: `Subtask kamu dikomentari: ${comment_text}`,
      });
    }

    res.json(newComment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal menambahkan komentar" });
  }
};

/**
 * READ - Ambil komentar di card (beserta balasan)
 */
export const getCommentsByCard = async (req, res) => {
  try {
    const { card_id } = req.params;
    const { data, error } = await supabase
      .from("comments")
      .select(
        `
        comment_id, card_id, subtask_id, user_id, parent_comment_id,
        comment_text, comment_type, comment_category, created_at,
        users(username),
        replies:comments!parent_comment_id(*, users(username))
        `
      )
      .eq("card_id", card_id)
      .is("parent_comment_id", null)
      .order("created_at", { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal memuat komentar" });
  }
};

/**
 * UPDATE Comment
 */
export const updateComment = async (req, res) => {
  try {
    const { comment_id } = req.params;
    const { comment_text } = req.body;

    const { data, error } = await supabase
      .from("comments")
      .update({ comment_text })
      .eq("comment_id", comment_id)
      .select();

    if (error) throw error;

    const updated = data[0];
    io.to(`card_${updated.card_id}`).emit("comment:updated", updated);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal memperbarui komentar" });
  }
};

/**
 * DELETE Comment
 */
export const deleteComment = async (req, res) => {
  try {
    const { comment_id } = req.params;

    // ambil card_id sebelum hapus
    const { data: existing } = await supabase
      .from("comments")
      .select("card_id")
      .eq("comment_id", comment_id)
      .single();

    const { error } = await supabase.from("comments").delete().eq("comment_id", comment_id);
    if (error) throw error;

    io.to(`card_${existing.card_id}`).emit("comment:deleted", { comment_id });
    res.json({ message: "Komentar berhasil dihapus" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal menghapus komentar" });
  }
};
export const createRejectComment = (io) => async (req, res) => {
  try {
    const { card_id, user_id, subtask_id, reason } = req.body;

    const { data, error } = await supabase
      .from("comments")
      .insert([{
        card_id,
        subtask_id,
        user_id,
        comment_text: `❌ Subtask #${subtask_id} ditolak: ${reason}`,
        comment_type: "feedback",
        comment_category: "reject",
      }])
      .select("*, users(username)");

    const rejectComment = data[0];

    // Emit hanya ke room card
    io.to(`card_${card_id}`).emit("comment:reject", rejectComment);

    // Opsional: notif ke assignee
    const { data: subtask } = await supabase.from('subtasks').select('assigned_to').eq('subtask_id', subtask_id).single();
    if (subtask?.assigned_to) {
      io.to(`user_${subtask.assigned_to}`).emit("subtask_rejected", {
        subtask_id,
        reason,
        comment: rejectComment,
      });
    }

    res.json(rejectComment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal menambahkan komentar reject" });
  }
};
