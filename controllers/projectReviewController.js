import { supabase } from "../supabaseClient.js"; // sesuaikan path

// REQUEST REVIEW (by Leader) – input: board_id
// PUT /project-review/:boardId/request-review
export const requestReviewProject = async (req, res) => {
  const { boardId } = req.params;

  try {
    // 🔍 Ambil project_id berdasarkan board_id
    const { data: board, error: boardError } = await supabase
      .from("boards")
      .select("project_id")
      .eq("board_id", boardId)
      .single();

    if (boardError || !board) {
      console.error("Error get project_id from board:", boardError);
      return res.status(400).json({ error: "Board not found" });
    }

    const projectId = board.project_id;

    // 🔄 Update status project menjadi review
    const { data, error } = await supabase
      .from("projects")
      .update({ status: "review" })
      .eq("project_id", projectId);

    if (error) return res.status(400).json({ error });

    res.json({ message: "Project sent to review", data });

  } catch (e) {
    res.status(500).json({ error: "Server error", detail: e.message });
  }
};


// REJECT PROJECT (by Admin)
export const rejectProject = async (req, res) => {
  const project_id = req.params.id;
  const { reason } = req.body;
  const user_id = req.user?.user_id;

  try {
    // Insert log reject
    const { error: logError } = await supabase.from("project_reviews").insert({
      project_id,
      reviewed_by: user_id,
      review_status: "rejected",
      reason,
    });

    if (logError) {
      console.error("Error inserting reject log:", logError);
      return res.status(400).json({ message: "Failed to log reject", error: logError });
    }

    // Update status jadi in_progress
    const { error: updateError } = await supabase
      .from("projects")
      .update({ status: "in_progress" })
      .eq("project_id", project_id);

    if (updateError) {
      console.error("Error updating project status:", updateError);
      return res.status(400).json({ message: "Failed to update project", error: updateError });
    }

    return res.json({ message: "Project rejected successfully" });

  } catch (err) {
    console.error("Unhandled reject error:", err);
    return res.status(500).json({ message: "Internal Server Error", detail: err.message });
  }
};

// APPROVE PROJECT (by Admin)
export const approveProject = async (req, res) => {
  const project_id = req.params.id;
  const user_id = req.user?.user_id;

  try {
    // Create approve log
    const { error: logError } = await supabase.from("project_reviews").insert({
      project_id,
      reviewed_by: user_id,
      review_status: "approved",
    });

    if (logError) {
      console.error("Error inserting approve log:", logError);
      return res.status(400).json({ message: "Failed to log approval", error: logError });
    }

    // Update project to done
    const { error: projectError } = await supabase
      .from("projects")
      .update({ status: "done" })
      .eq("project_id", project_id);

    if (projectError) {
      console.error("Error updating project status:", projectError);
      return res.status(400).json({ message: "Failed to update project", error: projectError });
    }

    // Set member users status -> available
        // Ambil semua member project
    const { data: members, error: membersError } = await supabase
    .from("project_members")
    .select("user_id")
    .eq("project_id", project_id);

    if (membersError) {
    console.error("Error fetching project members:", membersError);
    return res.status(400).json({ message: "Failed to fetch project members", error: membersError });
    }

    // Buat array user_id
    const userIds = members.map(m => m.user_id);

    if (userIds.length > 0) {
    const { error: updateUserError } = await supabase
        .from("users")
        .update({ current_task_status: "available" })
        .in("user_id", userIds);

    if (updateUserError) {
        console.error("Error updating member statuses:", updateUserError);
        return res.status(400).json({ message: "Failed to update members", error: updateUserError });
    }
    }


    return res.json({ message: "Project approved and marked as done" });

  } catch (err) {
    console.error("Unhandled approve error:", err);
    return res.status(500).json({ message: "Internal Server Error", detail: err.message });
  }
};
