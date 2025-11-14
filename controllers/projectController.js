import { supabase } from "../supabaseClient.js";
import { io } from "../server.js";

// ✅ CREATE PROJECT
export const createProject = async (req, res) => {
  console.log("📥 Incoming body:", req.body);

  const { project_name, description, deadline, members } = req.body;
  const userId = req.user.user_id; 
  if (!userId) {
    return res.status(400).json({ error: "User ID tidak ditemukan. Pastikan token login valid." });
  }

  try {
    const { data: projectData, error: projectError } = await supabase
      .from("projects")
      .insert([
        {
          project_name,
          description,
          created_by: userId,
          created_at: new Date(),
          deadline,
        },
      ])
      .select()
      .single();

    if (projectError) throw projectError;

    const project_id = projectData.project_id;

    // 🔹 Insert members
    const membersData = (members || []).map((m) => ({
      project_id,
      user_id: Number(m.user_id), // pastikan number
      role: m.role,
      joined_at: new Date(),
    }));

    const { data: membersInserted, error: membersError } = await supabase
      .from("project_members")
      .insert(membersData)
      .select();

    if (membersError) throw membersError;

    // 🔹 Update status pembuat project
    const { error: creatorStatusError } = await supabase
      .from("users")
      .update({ current_task_status: "working" })
      .eq("user_id", userId);

    if (creatorStatusError) throw creatorStatusError;

    // 🔹 Update semua anggota
    const memberIds = members.map((m) => Number(m.user_id));
    if (memberIds.length > 0) {
      const { error: membersStatusError } = await supabase
        .from("users")
        .update({ current_task_status: "working" })
        .in("user_id", memberIds);

      if (membersStatusError) throw membersStatusError;
    }

    res.status(201).json({
      message:
        "✅ Project created successfully & all related users status updated to 'working'",
      project: projectData,
      members: membersInserted,
    });
  } catch (error) {
    console.error("🔥 Project creation failed:", error);
    res.status(500).json({ error: error.message });
  }
};



// ✅ GET ALL PROJECTS
export const getAllProjects = async (req, res) => {
  try {
    const { data, error } = await supabase.from("projects").select("*");
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ GET DETAIL PROJECT
export const getProjectById = async (req, res) => {
  const { id } = req.params;

  try {
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("*")
      .eq("project_id", id)
      .single();
    if (projectError) throw projectError;

    const { data: members, error: memberError } = await supabase
      .from("project_members")
      .select("*")
      .eq("project_id", id);
    if (memberError) throw memberError;

    res.json({ project, members });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ UPDATE PROJECT
export const updateProject = async (req, res) => {
  const { id } = req.params;
  const { project_name, description, deadline, members } = req.body;

  try {
    const { data: updatedProject, error: projectError } = await supabase
      .from("projects")
      .update({
        project_name,
        description,
        deadline,
        updated_at: new Date(),
      })
      .eq("project_id", id)
      .select()
      .single();

    if (projectError) throw projectError;

    // update members
    let updatedMembers = [];
    if (Array.isArray(members) && members.length > 0) {
      await supabase.from("project_members").delete().eq("project_id", id);

      const membersData = members.map((m) => ({
        project_id: id,
        user_id: m.user_id,
        role: m.role,
        joined_at: new Date(),
      }));

      const { data, error: memberError } = await supabase
        .from("project_members")
        .insert(membersData)
        .select();

      if (memberError) throw memberError;
      updatedMembers = data;
    }

    res.json({
      message: "Project updated successfully",
      project: updatedProject,
      members: updatedMembers,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ DELETE PROJECT
export const deleteProject = async (req, res) => {
  const { id } = req.params;
  try {
    // Hapus anggota dulu
    await supabase.from("project_members").delete().eq("project_id", id);

    // Coba hapus project
    const { error } = await supabase.from("projects").delete().eq("project_id", id);

    if (error) {
      if (error.message.includes("masih memiliki board")) {
        return res.status(400).json({ error: "Project tidak bisa dihapus karena masih memiliki board." });
      }
      throw error;
    }

    res.json({ message: "Project deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ SHOW PROJECT TO BOARD
export const getProjectBoard = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { data: memberData, error: memberError } = await supabase
      .from("project_members")
      .select(`
        project_id,
        role,
        projects (
          project_id,
          project_name,
          description,
          created_by,
          created_at,
          deadline
        )
      `)
      .eq("user_id", userId);

    if (memberError) throw memberError;

    const { data: boards, error: boardsError } = await supabase
      .from("boards")
      .select("board_id, project_id");

    if (boardsError) throw boardsError;

    const projectWithBoard = new Set(boards.map((b) => b.project_id));

    const visibleProjects = memberData.filter((pm) => {
      const hasBoard = projectWithBoard.has(pm.project_id);
      return hasBoard || pm.role === "admin";
    });

    res.json({ success: true, projects: visibleProjects });
  } catch (err) {
    console.error("❌ getProjectBoard error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


export const getMemberRoleByBoard = async (req, res) => {
  try {
    const { board_id } = req.params;
    const user = req.user;

    console.log("🧩 board_id:", board_id);
    console.log("🧩 user dari token:", user);

    // 1️⃣ Ambil project_id dari board_id
    const { data: board, error: boardError } = await supabase
      .from("boards")
      .select("project_id")
      .eq("board_id", board_id)
      .maybeSingle();

    if (boardError) {
      console.error("❌ Gagal ambil board:", boardError.message);
      return res.status(500).json({ error: boardError.message });
    }

    if (!board) {
      console.warn("⚠️ Board tidak ditemukan");
      return res.status(404).json({ error: "Board not found" });
    }

    // 2️⃣ Ambil role user di project tersebut
    const { data, error } = await supabase
      .from("project_members")
      .select("role")
      .eq("project_id", board.project_id)
      .eq("user_id", user.user_id)
      .maybeSingle();

    console.log("🧩 Supabase hasil:", { data, error });

    if (error) {
      console.error("❌ Supabase error:", error.message);
      return res.status(500).json({ error: error.message });
    }

    if (!data) {
      console.warn("⚠️ User bukan member proyek ini");
      return res.status(403).json({ error: "User is not a member of this project" });
    }

    console.log("✅ Role ditemukan:", data.role);
    return res.json({ role: data.role });
  } catch (err) {
    console.error("🔥 Server error:", err);
    return res.status(500).json({ error: err.message });
  }
};

export const doneProject = async (req, res) => {
  const { board_id } = req.params; 

  try {
    if (!board_id) {
      return res.status(400).json({ error: "board_id wajib dikirim" });
    }

    const { data: board, error: boardError } = await supabase
      .from("boards")
      .select("project_id")
      .eq("board_id", board_id)
      .single();

    if (boardError) throw boardError;
    if (!board) {
      return res.status(404).json({ error: "Board tidak ditemukan" });
    }

    const project_id = board.project_id;
    if (!project_id) {
      return res
        .status(400)
        .json({ error: "Board ini tidak memiliki project terkait" });
    }

    // 🔹 2. Update status project jadi 'done'
    const { error: updateError } = await supabase
      .from("projects")
      .update({ status: "done" })
      .eq("project_id", project_id);

    if (updateError) throw updateError;

    // 🔹 3. Ambil semua user_id yang tergabung di project
    const { data: members, error: memberError } = await supabase
      .from("project_members")
      .select("user_id")
      .eq("project_id", project_id);

    if (memberError) throw memberError;

    // 🔹 4. Update current_task_status semua anggota jadi 'available'
    if (members && members.length > 0) {
      const userIds = members.map((m) => m.user_id);

      const { error: userError } = await supabase
        .from("users")
        .update({ current_task_status: "available" })
        .in("user_id", userIds);

      if (userError) throw userError;
    }

    io.to(`board_${board_id}`).emit("project_approved", {
      board_id,
      project_id,
      status: "done",
      message: "✅ Project disetujui dan diselesaikan oleh Admin",
    });

    return res.json({
      message: "✅ Project berhasil diselesaikan dan semua anggota menjadi available",
      project_id,
    });
  } catch (err) {
    console.error("Error doneProject:", err.message);
    return res.status(500).json({ error: err.message });
  }
};

export const reviewProject = async (req, res) => {
  const { board_id } = req.params; 

  try {
    if (!board_id) {
      return res.status(400).json({ error: "board_id wajib dikirim" });
    }

    // 🔹 1. Ambil project_id dari board
    const { data: board, error: boardError } = await supabase
      .from("boards")
      .select("project_id")
      .eq("board_id", board_id)
      .single();

    if (boardError) throw boardError;
    if (!board) {
      return res.status(404).json({ error: "Board tidak ditemukan" });
    }

    const project_id = board.project_id;
    if (!project_id) {
      return res
        .status(400)
        .json({ error: "Board ini tidak memiliki project terkait" });
    }

    // 🔹 2. Update status project jadi 'review'
    const { error: updateError } = await supabase
      .from("projects")
      .update({ status: "review" })
      .eq("project_id", project_id);

    if (updateError) throw updateError;

    io.to(`board_${board_id}`).emit("project_reviewed", {
      board_id,
      project_id,
      status: "review",
      message: "📋 Project masuk ke tahap review — menunggu persetujuan tim leader.",
    });

    return res.json({
      message: "📝 Project berhasil diubah menjadi status review",
      project_id,
    });
  } catch (err) {
    console.error("Error reviewProject:", err.message);
    return res.status(500).json({ error: err.message });
  }
};


export const getProjectMembers = async (req, res) => {
  const { project_id } = req.params;
  try {
    const { data, error } = await supabase
      .from("project_members")
      .select("user_id, role, users(full_name)")
      .eq("project_id", project_id);

    if (error) throw error;

    res.json({
      members: data.map((m) => ({
        user_id: m.user_id,
        full_name: m.users.full_name,
        role: m.role,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ Ambil semua member berdasarkan board_id
export const getProjectMembersByBoard = async (req, res) => {
  const { board_id } = req.params;

  try {
    if (!board_id) {
      return res.status(400).json({ error: "board_id wajib dikirim" });
    }

    // 🔹 1. Ambil project_id dari tabel boards
    const { data: board, error: boardError } = await supabase
      .from("boards")
      .select("project_id")
      .eq("board_id", board_id)
      .single();

    if (boardError || !board) {
      return res.status(404).json({ error: "Board tidak ditemukan" });
    }

    const project_id = board.project_id;

    // 🔹 2. Ambil daftar member berdasarkan project_id
    const { data: members, error: memberError } = await supabase
    .from("project_members")
    .select(`
      user_id,
      role,
      users (
        full_name,
        email,
        roles_user (
            role_name
          )
      )
    `)
    .eq("project_id", project_id);

    if (memberError) throw memberError;

    res.json({
      success: true,
      project_id,
      members: members || [],
    });
  } catch (err) {
    console.error("❌ Gagal fetch project members:", err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

// POST /api/project-members/:board_id/add
export const addProjectMember = async (req, res) => {
  const { board_id } = req.params;
  const { user_id, role = "member" } = req.body;

  try {
    if (!board_id || !user_id) {
      return res.status(400).json({ error: "board_id dan user_id wajib dikirim" });
    }

    // 🔹 1. Cari project_id dari board_id
    const { data: board, error: boardError } = await supabase
      .from("boards")
      .select("project_id")
      .eq("board_id", board_id)
      .single();

    if (boardError || !board) {
      return res.status(404).json({ error: "Board tidak ditemukan" });
    }

    const project_id = board.project_id;

    // 🔹 2. Cek apakah user sudah menjadi member project
    const { data: existing, error: existingError } = await supabase
      .from("project_members")
      .select("*")
      .eq("project_id", project_id)
      .eq("user_id", user_id)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existing) {
      return res.status(400).json({ error: "User sudah tergabung dalam project ini" });
    }

    // 🔹 3. Tambahkan member baru
    const { data, error } = await supabase
      .from("project_members")
      .insert([{ project_id, user_id, role }])
      .select();

    if (error) throw error;

    // 🔹 4. Ubah status user menjadi 'working'
    const { error: updateStatusError } = await supabase
      .from("users")
      .update({ current_task_status: "working" })
      .eq("user_id", user_id);

    if (updateStatusError) throw updateStatusError;

    res.json({
      success: true,
      message: "✅ Member berhasil ditambahkan dan status user menjadi 'working'.",
      data,
    });
  } catch (err) {
    console.error("❌ addProjectMember Error:", err);
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/project-members/:board_id/remove/:user_id
export const removeProjectMember = async (req, res) => {
  const { projectId, userId } = req.params;

  try {
    if (!projectId || !userId) {
      return res.status(400).json({ error: "project_id dan user_id wajib dikirim." });
    }

    // 🔹 1. Cek apakah user sedang mengerjakan subtask 'in_progress'
    const { data: workingSubtasks, error: subtaskError } = await supabase
      .from("subtasks")
      .select("subtask_id, subtask_title, status")
      .eq("assigned_to", userId)
      .eq("status", "in_progress");

    if (subtaskError) throw subtaskError;

    if (workingSubtasks && workingSubtasks.length > 0) {
      return res.status(400).json({
        error:
          "User tidak dapat dihapus karena sedang mengerjakan subtask yang masih in_progress.",
        activeSubtasks: workingSubtasks,
      });
    }

    // 🔹 2. Ambil semua board_id dalam project
    const { data: boardsInProject, error: boardsError } = await supabase
      .from("boards")
      .select("board_id")
      .eq("project_id", projectId);

    if (boardsError) throw boardsError;

    const boardIds = boardsInProject.map((b) => b.board_id);

    // 🔹 3. Ambil semua card aktif (belum done)
    const { data: activeCards, error: cardsError } = await supabase
      .from("cards")
      .select("card_id")
      .in("board_id", boardIds)
      .neq("status", "done");

    if (cardsError) throw cardsError;

    // 🔹 4. Jika ada card aktif, hapus assignment user di situ
    if (activeCards && activeCards.length > 0) {
      const activeCardIds = activeCards.map((c) => c.card_id);

      const { error: deleteAssignError } = await supabase
        .from("card_assignments")
        .delete()
        .in("card_id", activeCardIds)
        .eq("user_id", userId)
        .neq("assignment_status", "completed");

      if (deleteAssignError) throw deleteAssignError;
    }

    // 🔹 5. Hapus user dari project_members
    const { error: removeError } = await supabase
      .from("project_members")
      .delete()
      .eq("project_id", projectId)
      .eq("user_id", userId);

    if (removeError) throw removeError;

    // 🔹 6. Update status user jadi 'available'
    const { error: updateStatusError } = await supabase
      .from("users")
      .update({ current_task_status: "available" })
      .eq("user_id", userId);

    if (updateStatusError) throw updateStatusError;

    // 🔹 7. Kirim respon sukses
    res.json({
      success: true,
      message:
        "✅ Member berhasil dihapus dari project dan status user dikembalikan menjadi 'available'.",
    });
  } catch (err) {
    console.error("❌ removeProjectMember Error:", err);
    res.status(500).json({ error: err.message });
  }
};
