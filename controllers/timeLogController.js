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
      io.to(`board_${cardData.board_id}`).emit("card_status_inProgress", {
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
    if (!userId) return res.status(400).json({ error: "User ID tidak ditemukan" });

    const end_time = getJakartaTimestamp();

    // 🔸 1. Ambil subtask + card.board_id (join ke cards)
    const { data: subtask, error: subtaskErr } = await supabase
      .from("subtasks")
      // ambil assigned_to, card_id dan join ke cards untuk dapatkan board_id
      .select("assigned_to, card_id, cards(board_id)")
      .eq("subtask_id", subtask_id)
      .single();

    if (subtaskErr) throw subtaskErr;
    if (!subtask) return res.status(404).json({ error: "Subtask tidak ditemukan" });

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
    if (!activeLog) return res.status(404).json({ error: "Log aktif tidak ditemukan" });

    // 🔸 3. Hitung durasi
    const startTime = new Date(activeLog.start_time);
    const endTime = new Date(end_time);
    const durationSeconds = Math.max(0, Math.floor((endTime - startTime) / 1000));
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

    // ✅ 6. Update card → status = 'review' (pakai card_id dari subtask)
    const { error: cardUpdateErr } = await supabase
      .from("cards")
      .update({ status: "review" })
      .eq("card_id", subtask.card_id);

    if (cardUpdateErr) throw cardUpdateErr;

    // 🔸 7. Hitung total jam aktual dari semua log (RPC)
    const { data: totalHoursData, error: totalErr } = await supabase.rpc(
      "calculate_total_hours",
      { subtask_id }
    );
    if (totalErr) throw totalErr;

    // RPC bisa mengembalikan bentuk yang berbeda (number, array, object)
    let totalHours = 0;
    if (totalHoursData == null) {
      totalHours = 0;
    } else if (typeof totalHoursData === "number") {
      totalHours = totalHoursData;
    } else if (Array.isArray(totalHoursData) && totalHoursData.length > 0) {
      // mis. [{ calculate_total_hours: 3.5 }] atau [3.5]
      const first = totalHoursData[0];
      if (typeof first === "number") totalHours = first;
      else if (typeof first === "object") {
        // ambil value pertama yang ada dalam object
        const vals = Object.values(first);
        totalHours = vals.length ? vals[0] : 0;
      } else totalHours = 0;
    } else if (typeof totalHoursData === "object") {
      const vals = Object.values(totalHoursData);
      totalHours = vals.length ? vals[0] : 0;
    } else {
      totalHours = Number(totalHoursData) || 0;
    }

    // 🔸 8. Simpan actual_hours ke subtasks
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

    const boardId = subtask.cards?.board_id;

    if (boardId) {
      // broadcast subtask end event
      io.to(`board_${boardId}`).emit("card_status_changed", {
        type: "move_to_review",
        card_id: subtask.card_id,
        board_id: boardId,
        user_id: userId,
        new_status: "review",
      });

      // broadcast card move to review column
      io.to(`board_${boardId}`).emit("card_review_status", {
        board_id: boardId,
        card_id: subtask.card_id,
        new_status: "review",
        type: "move_to_review",
        message: `Card telah dipindahkan ke Review`,
      });
    }


    // 🔸 10. Respons sukses
    return res.status(200).json({
      message: "✅ Subtask selesai & masuk tahap review",
      data: {
        ...updatedLog,
        actual_hours: totalHours,
        duration_human: `${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s`,
      },
    });
  } catch (err) {
    console.error("❌ endTimeLog error:", err);
    // jika err bukan Error object biasa, pastikan ada message
    const message = err?.message || String(err);
    return res.status(500).json({ error: message });
  }
};

