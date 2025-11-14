// controllers/analyticsController.js
import { supabase } from "../supabaseClient.js";
import { io } from "./../server.js"; // pastikan file index.js export io dari setupSocket()

// 🧠 Analisis per board
export const getBoardAnalytics = async (req, res) => {
  const { board_id } = req.params;
  const user = req.user;

  try {
    const { data: member, error: memberError } = await supabase
      .from("project_members")
      .select("role, project_id")
      .eq("user_id", user.user_id)
      .single();

    if (memberError) throw memberError;

    if (!member || !["admin", "super_admin", "team_lead"].includes(member.role)) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const { data, error } = await supabase.rpc("get_board_analytics", { board_id_param: board_id });
    if (error) throw error;

    // 🔥 Emit ke room board tertentu saja
    io.to(`board_analytics_${board_id}`).emit("analytics_refetch", {
      board_id,
      data,
    });

    res.json(data);
  } catch (err) {
    console.error("❌ [getBoardAnalytics] Error:", err);
    res.status(500).json({ error: err.message });
  }
};

export const getUserAnalyticsByBoard = async (req, res) => {
  const { user_id } = req.user;
  const { board_id } = req.params;

  console.log("🔍 [DEBUG] getUserAnalyticsByBoard called with:", {
    user_id,
    board_id
  });

  try {
    console.log("🔄 [DEBUG] Calling Supabase RPC...");
    
    const { data, error } = await supabase.rpc("get_user_analytics_by_board_simple", {
      uid: user_id,
      board_id_param: board_id
    });

    console.log("📦 [DEBUG] Supabase RPC Response:", {
      data: data ? 'Data received' : 'No data',
      error: error ? error.message : 'No error'
    });

    if (error) {
      console.error("❌ [DEBUG] Supabase RPC Error:", error);
      throw error;
    }

    // Handle data format
    let analyticsData;
    
    if (data && typeof data === 'object') {
      if (Array.isArray(data)) {
        analyticsData = data.length > 0 ? data[0] : createDefaultData();
      } else {
        analyticsData = data;
      }
    } else {
      analyticsData = createDefaultData();
    }

    // Ensure all fields exist and handle null values
    analyticsData = {
      ...createDefaultData(),
      ...analyticsData
    };

    // Handle null values in time_metrics
    if (analyticsData.time_metrics) {
      analyticsData.time_metrics = {
        avg_subtask_duration_minutes: analyticsData.time_metrics.avg_subtask_duration_minutes || 0,
        avg_card_duration_minutes: analyticsData.time_metrics.avg_card_duration_minutes || 0,
        total_work_minutes: analyticsData.time_metrics.total_work_minutes || 0,
        max_subtask_duration_minutes: analyticsData.time_metrics.max_subtask_duration_minutes || 0,
        max_card_duration_minutes: analyticsData.time_metrics.max_card_duration_minutes || 0,
        total_work_sessions: analyticsData.time_metrics.total_work_sessions || 0,
        avg_session_duration_minutes: analyticsData.time_metrics.avg_session_duration_minutes || 0
      };
    }

    // Handle efficiency_metrics
    if (analyticsData.efficiency_metrics) {
      analyticsData.efficiency_metrics = {
        subtasks_per_hour: analyticsData.efficiency_metrics.subtasks_per_hour || 0,
        productive_time_percentage: analyticsData.efficiency_metrics.productive_time_percentage || 0
      };
    }

    // Handle productivity_trend
    if (analyticsData.productivity_trend && Array.isArray(analyticsData.productivity_trend)) {
      analyticsData.productivity_trend = analyticsData.productivity_trend.map(item => ({
        date: item.date,
        completed_tasks: item.completed_tasks || 0,
        completed_cards: item.completed_cards || 0,
        work_minutes: item.work_minutes || 0,
        work_sessions: item.work_sessions || 0
      }));
    }

    console.log("🎁 [DEBUG] Final analyticsData summary:", {
      cardProgress: analyticsData.card_progress,
      subtaskBreakdown: analyticsData.subtask_breakdown,
      timeMetrics: analyticsData.time_metrics,
      efficiencyMetrics: analyticsData.efficiency_metrics,
      productivityTrendLength: analyticsData.productivity_trend?.length || 0
    });

    // Emit socket event
    io.to(`board_analytics_${board_id}`).emit("analytics_refetch", {
      board_id,
      user_id,
      data: analyticsData,
    });

    console.log("✅ [DEBUG] Sending response to frontend");
    res.json(analyticsData);

  } catch (err) {
    console.error("❌ [DEBUG] getUserAnalyticsByBoard Error:", err);
    res.status(500).json({ 
      error: err.message,
      debug: { user_id, board_id }
    });
  }
};

function createDefaultData() {
  return {
    card_progress: { 
      total_assigned: 0, 
      completed: 0, 
      in_progress: 0, 
      todo: 0, 
      completion_rate: 0 
    },
    subtask_breakdown: { 
      total: 0, 
      completed: 0, 
      in_progress: 0, 
      todo: 0, 
      review: 0, 
      completion_rate: 0 
    },
    time_metrics: { 
      avg_subtask_duration_minutes: 0,
      avg_card_duration_minutes: 0,
      total_work_minutes: 0,
      max_subtask_duration_minutes: 0,
      max_card_duration_minutes: 0,
      total_work_sessions: 0,
      avg_session_duration_minutes: 0
    },
    efficiency_metrics: {
      subtasks_per_hour: 0,
      productive_time_percentage: 0
    },
    blocker_metrics: {
      unresolved_blockers: 0,
      resolved_this_period: 0,
      avg_resolution_hours: 0
    },
    productivity_trend: [],
    time_breakdown: {
      subtask_time_details: [],
      card_time_details: []
    }
  };
}

// 🌍 Analitik personal global (semua board)
export const getUserAnalyticsGlobal = async (req, res) => {
  const { user_id } = req.user;

  try {
    const { data, error } = await supabase.rpc("get_user_analytics_global", { uid: user_id });
    if (error) throw error;

    io.to("global_analytics").emit("analytics_refetch_global", {
      user_id,
      data,
    });

    res.json(data);
  } catch (err) {
    console.error("❌ [getUserAnalyticsGlobal] Error:", err);
    res.status(500).json({ error: err.message });
  }
};

// 🧑‍💼 Analitik Team Lead
export const getTeamLeadAnalyticsByBoard = async (req, res) => {
  const userId = req.user.user_id;
  const { board_id } = req.params;

  try {
    // 1. Ambil project_id dari board
    const { data: board } = await supabase
      .from("boards")
      .select("project_id, board_name")
      .eq("board_id", board_id)
      .single();

    if (!board) {
      return res.status(404).json({ success: false, error: "Board not found" });
    }

    // 2. Cek apakah user bagian dari project tersebut (admin / super_admin / leader / member)
    const { data: projectAccess } = await supabase
      .from("project_members")
      .select("role")
      .eq("user_id", userId)
      .eq("project_id", board.project_id)
      .maybeSingle();

    if (!projectAccess) {
      return res.status(403).json({
        success: false,
        error: "You do not have access to this board"
      });
    }

    // 3. Jika butuh khusus team lead, tambahkan disini:
    // if (projectAccess.role !== "leader") return res.status(403).json({ error: "Only team lead allowed" });

    // 4. Panggil analytics
    const { data: performanceData, error: performanceError } = await supabase
      .rpc("get_team_lead_board_performance", {
        p_user_id: userId,
        p_board_id: parseInt(board_id)
      })
      .single();

    if (performanceError) throw performanceError;

    const { data: pendingBlockers } = await supabase.rpc("get_pending_blockers_board", {
      p_user_id: userId,
      p_board_id: parseInt(board_id)
    });

    const { data: attentionCards } = await supabase.rpc("get_attention_cards_board", {
      p_user_id: userId,
      p_board_id: parseInt(board_id)
    });

    return res.status(200).json({
      success: true,
      data: {
        performance: performanceData,
        pending_blockers: pendingBlockers || [],
        attention_cards: attentionCards || [],
        board_info: board
      }
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: err.message });
  }
};



// 🧠 Analitik Global (Super Admin)
export const getGlobalAnalytics = async (req, res) => {
  const user = req.user;

  if (user.role !== "super_admin") {
    return res.status(403).json({ error: "Only super admin can view global analytics" });
  }

  try {
    const { data, error } = await supabase.rpc("get_global_analytics");
    if (error) throw error;

    // 🔥 Emit hanya ke global room
    io.to("global_analytics").emit("analytics_refetch_global", data);
    res.json(data);
  } catch (err) {
    console.error("❌ [getGlobalAnalytics] Error:", err);
    res.status(500).json({ error: err.message });
  }
};

export const getProjectAnalytics = async (req, res) => {
  const { board_id } = req.params;

  try {
    // ===================== 1️⃣ Ambil info board + project =====================
    const { data: board, error: boardError } = await supabase
      .from("boards")
      .select(`
        board_id,
        board_name,
        project_id,
        position,
        projects (
          project_id,
          project_name,
          status,
          deadline,
          created_at
        )
      `)
      .eq("board_id", board_id)
      .single();

    if (boardError || !board)
      return res.status(404).json({ error: "Board not found" });

    const project_id = board.project_id;

    // ===================== 2️⃣ Hitung jumlah anggota proyek =====================
    const { count: memberCount } = await supabase
      .from("project_members")
      .select("member_id", { count: "exact", head: true })
      .eq("project_id", project_id);

    // ===================== 3️⃣ Statistik kartu di board =====================
    const { data: cardStats, error: cardError } = await supabase
      .from("cards")
      .select("card_id, status, priority, estimated_hours, actual_hours")
      .eq("board_id", board_id);

    if (cardError) throw cardError;

    const totalCards = cardStats.length;
    const cardsByStatus = cardStats.reduce((acc, c) => {
      acc[c.status] = (acc[c.status] || 0) + 1;
      return acc;
    }, {});
    const cardsByPriority = cardStats.reduce((acc, c) => {
      acc[c.priority] = (acc[c.priority] || 0) + 1;
      return acc;
    }, {});

    const estimationAccuracy = cardStats.length
      ? (
          cardStats
            .filter(c => c.estimated_hours && c.actual_hours)
            .map(c => c.actual_hours / c.estimated_hours)
            .reduce((a, b) => a + b, 0) /
          cardStats.filter(c => c.estimated_hours && c.actual_hours).length
        ).toFixed(2)
      : null;

   // ===================== 4️⃣ Statistik subtask =====================
    const { data: subtaskStats, error: subtaskError } = await supabase
      .from("subtasks")
      .select(`
        subtask_id,
        status,
        estimated_hours,
        actual_hours,
        completed_by,
        users:completed_by ( full_name )
      `)
      .in("card_id", cardStats.map(c => c.card_id) || []);

    if (subtaskError) throw subtaskError;

    const totalSubtasks = subtaskStats.length;
    const subtasksByStatus = subtaskStats.reduce((acc, s) => {
      acc[s.status] = (acc[s.status] || 0) + 1;
      return acc;
    }, {});

    // ===================== 5️⃣ Blockers =====================
    const { count: unresolvedCardBlockers } = await supabase
      .from("card_blockers")
      .select("blocker_id", { count: "exact", head: true })
      .in("card_id", cardStats.map(c => c.card_id) || [])
      .eq("is_resolved", false);

    const { count: unresolvedSubtaskBlockers } = await supabase
      .from("subtask_blockers")
      .select("blocker_id", { count: "exact", head: true })
      .in("subtask_id", subtaskStats.map(s => s.subtask_id) || [])
      .eq("is_resolved", false);

    // ===================== 6️⃣ Kinerja user =====================
    const performanceByUser = subtaskStats.reduce((acc, row) => {
      const fullName = row.profiles?.full_name || "Unassigned";
      acc[fullName] = (acc[fullName] || 0) + 1;
      return acc;
    }, {});


    // ===================== 7️⃣ Time logs =====================
    const { data: timeLogs } = await supabase
      .from("time_logs")
      .select("duration_minutes, start_time, end_time")
      .in("card_id", cardStats.map(c => c.card_id) || []);

    const totalTimeLogged = timeLogs.reduce(
      (a, b) => a + (b.duration_minutes || 0),
      0
    );
    const avgWorkDuration = timeLogs.length
      ? (totalTimeLogged / timeLogs.length).toFixed(2)
      : 0;

    // ===================== 8️⃣ Hitung progres =====================
    const completedCards = cardsByStatus["done"] || 0;
    const progressPercentage = totalCards
      ? ((completedCards / totalCards) * 100).toFixed(1)
      : 0;

    // ===================== ✅ Response akhir =====================
    res.json({
      success: true,
      board_info: {
        board_id: board.board_id,
        board_name: board.board_name,
        position: board.position,
        project: board.projects,
        total_members: memberCount || 0,
      },
      activity_stats: {
        total_cards: totalCards,
        cards_by_status: cardsByStatus,
        cards_by_priority: cardsByPriority,
        total_subtasks: totalSubtasks,
        subtasks_by_status: subtasksByStatus,
        estimation_accuracy: estimationAccuracy,
      },
      blockers: {
        unresolved_card_blockers: unresolvedCardBlockers || 0,
        unresolved_subtask_blockers: unresolvedSubtaskBlockers || 0,
      },
      performance: performanceByUser,
      time: {
        total_time_logged: totalTimeLogged,
        avg_work_duration: avgWorkDuration,
      },
      progress: {
        completed_cards: completedCards,
        progress_percentage: progressPercentage,
      },
    });
  } catch (err) {
    console.error("❌ Error in getBoardAnalytics:", err);
    res.status(500).json({ error: "Failed to fetch board analytics data" });
  }
};

