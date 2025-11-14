import { supabase } from "../supabaseClient.js";
import dayjs from "dayjs";

/* ==================================================
   1. GET PROJECT DETAIL + ANALYTICS
   ================================================== */
// ✅ FIXED getProjectDetail
export const getProjectDetail = async (req, res) => {
  const { project_id } = req.params;

  try {
    // 🧩 1. Detail proyek
    const { data: project, error: projectErr } = await supabase
      .from("projects")
      .select("*")
      .eq("project_id", project_id)
      .single();

    if (projectErr || !project)
      return res.status(404).json({ success: false, message: "Project not found" });

    // 🧩 2. Anggota proyek
    const { data: members, error: memberErr } = await supabase
      .from("project_members")
      .select(`
        member_id,
        role,
        users:user_id (user_id, full_name, email)
      `)
      .eq("project_id", project_id);

    if (memberErr) throw memberErr;

    const projectMembers = members.map((m) => ({
      member_id: m.member_id,
      role: m.role,
      user_id: m.users?.user_id,
      full_name: m.users?.full_name,
      email: m.users?.email,
    }));

    // 🧩 3. Ambil semua board dalam project
    const { data: boards, error: boardErr } = await supabase
      .from("boards")
      .select("board_id")
      .eq("project_id", project_id);

    if (boardErr) throw boardErr;
    const boardIds = boards.map((b) => b.board_id);
    if (boardIds.length === 0)
      return res.json({
        success: true,
        project,
        project_members: projectMembers,
        total_cards: 0,
        cards_by_status: {},
        done_subtasks: [],
        subtask_time_logs: [],
      });

    // 🧩 4. Ambil cards
    const { data: cards, error: cardErr } = await supabase
      .from("cards")
      .select("card_id, status")
      .in("board_id", boardIds);

    if (cardErr) throw cardErr;

    const totalCards = cards.length;
    const cardsByStatus = cards.reduce((acc, c) => {
      acc[c.status] = (acc[c.status] || 0) + 1;
      return acc;
    }, {});

    const cardIds = cards.map((c) => c.card_id);

    // 🧩 5. Ambil subtask yang sudah selesai + siapa yang mengerjakan
    const { data: subtasks, error: subErr } = await supabase
      .from("subtasks")
      .select(`
        subtask_id,
        subtask_title,
        card_id,
        status,
        assigned_to,
        users:assigned_to (user_id, full_name)
      `)
      .in("card_id", cardIds)
      .eq("status", "done");

    if (subErr) throw subErr;

    const doneSubtasks = subtasks.map((s) => ({
      subtask_id: s.subtask_id,
      subtask_title: s.subtask_title,
      card_id: s.card_id,
      status: s.status,
      assigned_to: s.assigned_to,
      assigned_user: s.users ? s.users.full_name : "Tidak diketahui",
    }));

    const subtaskIds = doneSubtasks.map((s) => s.subtask_id);

    // 🧩 6. Ambil time logs dan konversi durasi
    const { data: timeLogsRaw, error: logErr } = await supabase
      .from("time_logs")
      .select(`
        log_id,
        subtask_id,
        user_id,
        start_time,
        end_time,
        duration_seconds,
        description,
        users:user_id (full_name)
      `)
      .in("subtask_id", subtaskIds);

    if (logErr) throw logErr;

    // 🔄 Group log berdasarkan subtask_id
    const subtaskTimeLogs = Object.values(
      timeLogsRaw.reduce((acc, log) => {
        if (!acc[log.subtask_id]) {
          acc[log.subtask_id] = {
            subtask_id: log.subtask_id,
            subtask_title:
              doneSubtasks.find((s) => s.subtask_id === log.subtask_id)?.subtask_title || "",
            assigned_user:
              doneSubtasks.find((s) => s.subtask_id === log.subtask_id)?.assigned_user || "",
            total_duration_minutes: 0,
            logs: [],
          };
        }

        const durationMinutes = log.duration_seconds
          ? parseFloat((log.duration_seconds / 60).toFixed(2))
          : 0;

        acc[log.subtask_id].logs.push({
          log_id: log.log_id,
          user_id: log.user_id,
          user_name: log.users?.full_name || "Tidak diketahui",
          description: log.description,
          duration_minutes: durationMinutes,
          start_time: log.start_time,
          end_time: log.end_time,
        });

        acc[log.subtask_id].total_duration_minutes += durationMinutes;
        return acc;
      }, {})
    );

    // 🧩 7. Response akhir
    res.json({
      success: true,
      project_id: project.project_id,
      project_name: project.project_name,
      description: project.description,
      deadline: project.deadline,
      status: project.status,
      created_by: project.created_by,
      created_at: project.created_at,

      project_members: projectMembers,
      total_cards: totalCards,
      cards_by_status: cardsByStatus,

      done_subtasks: doneSubtasks,
      subtask_time_logs: subtaskTimeLogs,
    });
  } catch (err) {
    console.error("getProjectDetail error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};



/* ==================================================
   2. UPDATE PROJECT INLINE
   ================================================== */
export const updateProject = async (req, res) => {
  const { project_id } = req.params;
  const updateData = req.body;

  try {
    const { error } = await supabase
      .from("projects")
      .update(updateData)
      .eq("project_id", project_id);

    if (error) throw error;
    res.json({ success: true, message: "Project updated successfully." });
  } catch (err) {
    console.error("updateProject error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ==================================================
   3. ADD MEMBER
   ================================================== */
export const addMember = async (req, res) => {
  const { project_id } = req.params;
  const { user_id, role } = req.body;

  try {
    if (!project_id || !user_id) {
      return res.status(400).json({
        success: false,
        error: "project_id dan user_id wajib diisi.",
      });
    }

    // 🔍 Cegah duplikasi member
    const { data: existingMember, error: checkError } = await supabase
      .from("project_members")
      .select("member_id") // ubah ke "*" jika tidak ada member_id
      .eq("project_id", project_id)
      .eq("user_id", user_id)
      .maybeSingle();

    if (checkError) throw checkError;
    if (existingMember) {
      return res.status(400).json({
        success: false,
        error: "User sudah menjadi member proyek ini.",
      });
    }

    // 🧩 Tambah member baru
    const { error } = await supabase.from("project_members").insert({
      project_id,
      user_id,
      role,
    });
    if (error) throw error;

    // 🔄 Update status user
    const { error: updateStatusError } = await supabase
      .from("users")
      .update({ current_task_status: "working" })
      .eq("user_id", user_id);
    if (updateStatusError) throw updateStatusError;

    res.json({ success: true, message: "Member added successfully." });
  } catch (err) {
    console.error("❌ addMember error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};


/* ==================================================
   4. UPDATE MEMBER ROLE
   ================================================== */
export const updateMemberRole = async (req, res) => {
  const { member_id } = req.params;
  const { role } = req.body;

  try {
    const { error } = await supabase
      .from("project_members")
      .update({ role })
      .eq("member_id", member_id);

    if (error) throw error;
    res.json({ success: true, message: "Member role updated." });
  } catch (err) {
    console.error("updateMemberRole error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ==================================================
   5. GENERATE REPORT
   ================================================== */
export const generateReport = async (req, res) => {
  const { project_id } = req.params;
  const { start_date, end_date } = req.query;

  try {
    // === 1. Ambil data project
    const { data: project } = await supabase
      .from("projects")
      .select("project_id, project_name, status")
      .eq("project_id", project_id)
      .single();

    // === 2. Ambil boards & cards dalam project
    const { data: boards } = await supabase
      .from("boards")
      .select("board_id, board_name")
      .eq("project_id", project_id);

    const boardIds = boards.map((b) => b.board_id);

    const { data: cards } = await supabase
      .from("cards")
      .select(
        `
        card_id,
        card_title,
        board_id,
        status,
        priority,
        due_date,
        created_by,
        created_at
      `
      )
      .in("board_id", boardIds);

    const cardIds = cards.map((c) => c.card_id);

    // === 3. Ambil assignment dan subtask
    const { data: assignments } = await supabase
      .from("card_assignments")
      .select("card_id, user_id, assignment_status");

    const { data: subtasks } = await supabase
      .from("subtasks")
      .select("subtask_id, subtask_title, card_id, assigned_to, status, review_status");

    // === 4. Ambil time_logs untuk menghitung durasi
    let logQuery = supabase.from("time_logs").select(`
      user_id,
      card_id,
      subtask_id,
      duration_seconds,
      start_time
    `);

    if (cardIds.length) logQuery = logQuery.in("card_id", cardIds);
    if (start_date && end_date)
      logQuery = logQuery.gte("start_time", start_date).lte("start_time", end_date);

    const { data: logs } = await logQuery;

    // === 5. Ambil data user
    const { data: users } = await supabase.from("users").select("user_id, full_name");

    // === 6. Hitung total jam per user dan subtask
    const memberMap = {};
    for (const log of logs) {
      if (!memberMap[log.user_id]) {
        memberMap[log.user_id] = { total_seconds: 0, total_cards: new Set(), total_subtasks: new Set() };
      }
      memberMap[log.user_id].total_seconds += log.duration_seconds || 0;
      if (log.card_id) memberMap[log.user_id].total_cards.add(log.card_id);
      if (log.subtask_id) memberMap[log.user_id].total_subtasks.add(log.subtask_id);
    }

    const members_activity = Object.entries(memberMap).map(([uid, data]) => {
      const user = users.find((u) => u.user_id == uid);
      return {
        user_id: uid,
        user_name: user?.full_name || "Unknown",
        total_hours: (data.total_seconds / 3600).toFixed(2),
        total_cards: data.total_cards.size,
        total_subtasks: data.total_subtasks.size,
      };
    });

    // === 7. Susun report_details (berisi board -> card -> subtask)
    const report_details = cards.map((card) => {
      const board = boards.find((b) => b.board_id === card.board_id);
      const creator = users.find((u) => u.user_id === card.created_by);
      const cardAssignments = assignments
        .filter((a) => a.card_id === card.card_id)
        .map((a) => {
          const u = users.find((x) => x.user_id === a.user_id);
          return {
            user_id: u?.user_id || null,
            user_name: u?.full_name || "Unknown",
            assignment_status: a.assignment_status || "unknown",
          };
        });

      const cardSubtasks = subtasks
        .filter((s) => s.card_id === card.card_id)
        .map((s) => {
          const assignedUser = users.find((u) => u.user_id === s.assigned_to);
          const relatedLogs = logs.filter((l) => l.subtask_id === s.subtask_id);
          const totalSubtaskSeconds = relatedLogs.reduce((a, l) => a + (l.duration_seconds || 0), 0);
          return {
            subtask_id: s.subtask_id,
            subtask_title: s.subtask_title,
            status: s.status,
            assigned_to: assignedUser?.full_name || "Unknown",
            review_status: s.review_status,
            actual_hours: (totalSubtaskSeconds / 3600).toFixed(2),
          };
        });

      return {
        project_id: project.project_id,
        project_name: project.project_name,
        board_name: board?.board_name || "Unknown Board",
        card_id: card.card_id,
        card_title: card.card_title,
        status: card.status,
        priority: card.priority,
        due_date: card.due_date,
        created_by: creator?.full_name || "Unknown",
        created_at: card.created_at,
        assigned_users: cardAssignments,
        subtasks: cardSubtasks,
      };
    });

    // === 8. Hitung ringkasan
    const total_hours = (logs.reduce((a, l) => a + (l.duration_seconds || 0), 0) / 3600).toFixed(2);
    const cards_done = cards.filter((c) => c.status === "done").length;
    const cards_in_progress = cards.filter((c) => c.status === "in_progress").length;
    const total_members = members_activity.length;

    // === 9. Buat response flat
    const result = {
      success: true,
      project_id: project.project_id,
      project_name: project.project_name,
      project_status: project.status,
      total_cards: cards.length,
      cards_done,
      cards_in_progress,
      total_hours,
      total_members,
      date_range: { start_date, end_date },
      members_activity,
      report_details,
    };

    console.log("===== 📤 DATA DIKIRIM KE FRONTEND =====");
    console.dir(result, { depth: null });

    res.json(result);
  } catch (err) {
    console.error("generateReport error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};



/* ==================================================
   6. REQUEST REVIEW PROJECT
   ================================================== */
export const requestReview = async (req, res) => {
  const { project_id } = req.params;
  const { requested_by } = req.body;

  try {
    const { error } = await supabase.from("projects").update({
      status: "review",
      requested_by,
    }).eq("project_id", project_id);

    if (error) throw error;
    res.json({ success: true, message: "Review request sent." });
  } catch (err) {
    console.error("requestReview error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ==================================================
   7. APPROVE / REJECT REVIEW PROJECT
   ================================================== */
export const reviewProject = async (req, res) => {
  const { project_id } = req.params;
  const { reviewer_id, status, note } = req.body;

  try {
    if (!["approved", "rejected"].includes(status))
      return res.status(400).json({ success: false, error: "Invalid review status" });

    const newStatus = status === "approved" ? "done" : "in_progress";

    const { error } = await supabase
      .from("projects")
      .update({
        status: newStatus,
        reviewed_by: reviewer_id,
        review_note: note,
        reviewed_at: new Date(),
      })
      .eq("project_id", project_id);

    if (error) throw error;
    res.json({ success: true, message: `Project ${status} successfully.` });
  } catch (err) {
    console.error("reviewProject error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};
