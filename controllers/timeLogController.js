import { supabase } from "../supabaseClient.js";
import { io } from "./../server.js";

// 🔹 Ambil timestamp waktu lokal Asia/Jakarta (tanpa double offset)
function getJakartaTimestamp() {
  const now = new Date();
  const localString = now.toLocaleString("en-CA", {
    timeZone: "Asia/Jakarta",
    hour12: false,
  });
  return localString.replace(",", "");
}

/* ==========================================================
   🔹 1️⃣ CREATE TIME LOG — User mulai mengerjakan subtask
   ========================================================== */
export const createTimeLog = async (req, res) => {
  const { card_id, subtask_id, description } = req.body;

  try {
    const start_time = getJakartaTimestamp();
    const userId = req.user?.user_id;

    if (!userId)
      return res.status(400).json({ error: "User ID tidak ditemukan" });

    // 🔸 1. Cek subtask aktif lain
    const { data: existingSubtask, error: existingErr } = await supabase
      .from("subtasks")
      .select("subtask_id, status")
      .eq("assigned_to", userId)
      .in("status", ["in_progress"]);

    if (existingErr) throw existingErr;

    if (
      existingSubtask?.length &&
      !existingSubtask.some((s) => s.subtask_id === subtask_id)
    ) {
      return res.status(400).json({
        error:
          "Kamu masih memiliki subtask lain yang sedang dikerjakan. Selesaikan dulu sebelum memulai yang baru.",
      });
    }

    // 🔸 2. Cek card lain yang sedang aktif
    const { data: activeCard, error: activeCardErr } = await supabase
      .from("card_assignments")
      .select("card_id")
      .eq("user_id", userId)
      .eq("assignment_status", "in_progress");

    if (activeCardErr) throw activeCardErr;

    if (
      activeCard?.length &&
      !activeCard.some((a) => a.card_id === card_id)
    ) {
      return res.status(400).json({
        error: "Kamu masih mengerjakan card lain. Selesaikan dulu card itu.",
      });
    }

    // 🔸 3. Buat log baru (setiap mulai/revisi)
    const { data: timeLog, error: timeLogErr } = await supabase
      .from("time_logs")
      .insert([
        {
          card_id,
          subtask_id,
          user_id: userId,
          start_time,
          description: description || "Mulai mengerjakan subtask",
        },
      ])
      .select()
      .single();

    if (timeLogErr) throw timeLogErr;

    // 🔸 4. Update subtask → in_progress
    const { error: subtaskErr } = await supabase
      .from("subtasks")
      .update({
        status: "in_progress",
        assigned_to: userId,
      })
      .eq("subtask_id", subtask_id);

    if (subtaskErr) throw subtaskErr;

    // 🔸 5. Update card → in_progress
    const { error: cardErr } = await supabase
      .from("cards")
      .update({ status: "in_progress" })
      .eq("card_id", card_id);

    if (cardErr) throw cardErr;

    // 🔸 6. Update card_assignments
    const { error: assignErr } = await supabase
      .from("card_assignments")
      .update({
        assignment_status: "in_progress",
        started_at: start_time,
      })
      .eq("card_id", card_id)
      .eq("user_id", userId);

    if (assignErr) throw assignErr;

    // 🔸 7. Update status user
    const { error: userErr } = await supabase
      .from("users")
      .update({ current_task_status: "working" })
      .eq("user_id", userId);

    io.to(`card_${card_id}`).emit("subtask_status_changed",{
      type: "start",
      subtask_id,
      card_id,
      user_id: userId,
      status: "in_progress",
      started_at: start_time,
    });

    if (userErr) throw userErr;

    // 🔹 Ambil board_id dari card agar bisa emit ke room board
    const { data: cardData } = await supabase
      .from("cards")
      .select("board_id")
      .eq("card_id", card_id)
      .single();

    if (cardData?.board_id) {
      io.to(`board_${cardData.board_id}`).emit("card_status_inProgres", {
        board_id: cardData.board_id,
        card_id,
        new_status: "in_progress",
        user_id: userId,
        type: "start",
        updated_at: start_time,
      });
    }

    return res.status(201).json({
      message: "⏱ Time log baru dibuat & status diperbarui",
      data: timeLog,
    });
  } catch (err) {
    console.error("❌ createTimeLog error:", err);
    return res.status(500).json({ error: err.message });
  }
};

/* ==========================================================
   🔹 2️⃣ END TIME LOG — User selesai kerja (masuk review)
   ========================================================== */
export const endTimeLog = async (req, res) => {
  const { subtask_id, description } = req.body;

  try {
    const userId = req.user?.user_id;
    if (!userId)
      return res.status(400).json({ error: "User ID tidak ditemukan" });

    const end_time = getJakartaTimestamp();

    // 🔸 1. Validasi subtask ownership
    const { data: subtask, error: subtaskErr } = await supabase
      .from("subtasks")
      .select("assigned_to, card_id")
      .eq("subtask_id", subtask_id)
      .single();

    if (subtaskErr) throw subtaskErr;
    if (!subtask)
      return res.status(404).json({ error: "Subtask tidak ditemukan" });

    if (subtask.assigned_to !== userId) {
      return res.status(403).json({
        error: "Hanya user yang ditugaskan dapat menutup subtask ini.",
      });
    }

    // 🔸 2. Ambil log aktif (tanpa end_time)
    const { data: activeLog, error: logErr } = await supabase
      .from("time_logs")
      .select("*")
      .eq("subtask_id", subtask_id)
      .eq("user_id", userId)
      .is("end_time", null)
      .order("start_time", { ascending: false })
      .limit(1)
      .single();

    if (logErr) throw logErr;
    if (!activeLog)
      return res.status(404).json({ error: "Log aktif tidak ditemukan" });

    // 🔸 3. Hitung durasi
    const startTime = new Date(activeLog.start_time);
    const endTime = new Date(end_time);
    const durationSeconds = Math.floor((endTime - startTime) / 1000);
    const isoDuration = `${durationSeconds} seconds`;

    // 🔸 4. Tutup log
    const { data: updatedLog, error: updateLogErr } = await supabase
      .from("time_logs")
      .update({
        end_time,
        duration_seconds: durationSeconds,
        duration: isoDuration,
        description: description || "Selesai mengerjakan subtask",
      })
      .eq("log_id", activeLog.log_id)
      .select()
      .single();

    if (updateLogErr) throw updateLogErr;

    // 🔸 5. Update subtask → status = 'review'
    const { error: subtaskUpdateErr } = await supabase
      .from("subtasks")
      .update({
        status: "review",
        completed_by: userId,
      })
      .eq("subtask_id", subtask_id);

    if (subtaskUpdateErr) throw subtaskUpdateErr;

    // ✅ Perbaikan update card
    const { error: cardUpdateErr } = await supabase
      .from("cards")
      .update({ status: "review" })
      .eq("card_id", subtask.card_id); // ← gunakan card_id dari subtask

    if (cardUpdateErr) throw cardUpdateErr;


    // 🔸 6. Hitung total jam aktual dari semua log
    const { data: totalHours, error: totalErr } = await supabase.rpc(
      "calculate_total_hours",
      { subtask_id }
    );
    if (totalErr) throw totalErr;

    // 🔸 7. Simpan actual_hours ke subtasks
    const { error: updateActualErr } = await supabase
      .from("subtasks")
      .update({ actual_hours: totalHours })
      .eq("subtask_id", subtask_id);

    if (updateActualErr) throw updateActualErr;

    io.to(`card_${subtask.card_id}`).emit("subtask_status_changed", {
      type: "end",
      subtask_id,
      card_id: subtask.card_id,
      user_id: userId,
      status: "review",
      ended_at: end_time,
    });

    // 🔸 8. Beri respons sukses
    return res.status(200).json({
      message: "✅ Subtask selesai & masuk tahap review",
      data: {
        ...updatedLog,
        actual_hours: totalHours,
        duration_human: `${Math.floor(durationSeconds / 60)}m ${
          durationSeconds % 60
        }s`,
      },
    });
  } catch (err) {
    console.error("❌ endTimeLog error:", err);
    return res.status(500).json({ error: err.message });
  }
};

