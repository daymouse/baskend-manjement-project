import { supabase } from "../supabaseClient.js";

/* ======================================================
1. 📅 PROJECT CALENDAR VIEW
====================================================== */
export const getProjectCalendarView = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("projects")
      .select("project_id, project_name, deadline, status");

    if (error) throw error;

    res.json({
      success: true,
      message: "Project deadlines fetched successfully.",
      data,
    });
  } catch (err) {
    console.error("Calendar View Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ======================================================
2. 📊 PROJECT SUMMARY
====================================================== */
export const getProjectSummary = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("projects")
      .select("status, deadline");

    if (error) throw error;

    const total_projects = data.length;
    const active_projects = data.filter((p) => p.status === "in_progress").length;
    const review_projects = data.filter((p) => p.status === "review").length;
    const completed_projects = data.filter((p) => p.status === "done").length;

    const nearing_deadline = data.filter(
      (p) =>
        p.status !== "done" &&
        p.deadline &&
        new Date(p.deadline) - new Date() <= 3 * 24 * 60 * 60 * 1000
    ).length;

    res.json({
      success: true,
      message: "Project summary fetched successfully.",
      data: {
        total_projects,
        active_projects,
        review_projects,
        completed_projects,
        nearing_deadline,
      },
    });
  } catch (err) {
    console.error("Project Summary Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ======================================================
3. 👥 USER ACTIVITY SUMMARY
====================================================== */
export const getUserActivitySummary = async (req, res) => {
  try {
    // Hitung total users
    const { count: total_users, error: userErr } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true });
    if (userErr) throw userErr;

    // Hitung user aktif (current_task_status = 'working')
    const { count: active_users, error: activeErr } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true })
      .eq("current_task_status", "working")
      .eq("is_admin", false);
    if (activeErr) throw activeErr;

    // Ambil top 5 user paling aktif berdasarkan time_logs
    const { data: timeLogData, error: timeErr } = await supabase
      .from("time_logs")
      .select("user_id, users(full_name)")
      .not("user_id", "is", null)
    if (timeErr) throw timeErr;

    const userActivityMap = {};
    for (const log of timeLogData) {
      const name = log.users?.full_name || "Unknown";
      userActivityMap[name] = (userActivityMap[name] || 0) + 1;
    }

    const top_users = Object.entries(userActivityMap)
      .map(([name, total_logs]) => ({ full_name: name, total_logs }))
      .sort((a, b) => b.total_logs - a.total_logs)
      .slice(0, 5);

    res.json({
      success: true,
      total_users,
      active_users,
      top_users,
    });
  } catch (err) {
    console.error("User Activity Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ======================================================
4. 📈 PROJECT PROGRESS OVERVIEW
====================================================== */
export const getProjectProgressOverview = async (req, res) => {
  try {
    const { data: projects, error: projErr } = await supabase
      .from("projects")
      .select("project_id, project_name, boards(board_id, cards(status))");

    if (projErr) throw projErr;

    const progressData = projects.map((p) => {
      const cards = p.boards?.flatMap((b) => b.cards || []) || [];
      const total = cards.length;
      const done = cards.filter((c) => c.status === "done").length;
      const progress = total > 0 ? ((done / total) * 100).toFixed(2) : 0;

      return {
        project_id: p.project_id,
        project_name: p.project_name,
        progress_percentage: Number(progress),
      };
    });

    res.json({
      success: true,
      message: "Project progress overview fetched successfully.",
      data: progressData,
    });
  } catch (err) {
    console.error("Project Progress Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};
