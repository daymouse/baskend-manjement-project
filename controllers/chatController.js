import { supabase } from "../supabaseClient.js";
import { io } from "../server.js";

export const getBoardChats = async (req, res) => {
  const { board_id } = req.params;
  try {
    const { data, error } = await supabase
      .from("board_chats")
      .select("*, users(full_name, username)")
      .eq("board_id", board_id)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return res.json({ chats: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

export const createChat = async (req, res) => {
  const { board_id } = req.params;
  const { message, reply_to, mentions } = req.body;
  const user_id = req.user?.user_id;


  try {
    // Insert + return chat basic
    const { data: chat, error } = await supabase
      .from("board_chats")
      .insert([{ board_id, user_id, message, reply_to, mentions }])
      .select("*, users(full_name, username)")  // join sender user
      .single();

    if (error) throw error;

    // Fetch mention user details
    let mentionUsers = [];
    if (mentions?.length) {
      const { data: mentionData } = await supabase
        .from("users")
        .select("user_id, full_name, username")
        .in("user_id", mentions);

      mentionUsers = mentionData;
    }

    const fullChatPayload = {
      ...chat,
      mention_users: mentionUsers      // <---- kirim detail user
    };

    io.to(`board_${board_id}`).emit("new_chat_message", fullChatPayload);

    return res.json({ chat: fullChatPayload });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};



export const deleteChat = async (req, res) => {
  const { chat_id } = req.params;

  try {
    const { data, error } = await supabase
      .from("board_chats")
      .update({ is_deleted: true, message: "[deleted]" })
      .eq("chat_id", chat_id)
      .select()
      .single();

    if (error) throw error;

    io.to(`board_${data.board_id}`).emit("chat_deleted", data);

    return res.json({ message: "Chat deleted", chat: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

export const getProjectMembers = async (req, res) => {
  const { board_id } = req.params;

  try {
    // 1️⃣ Ambil project_id berdasarkan board_id
    const { data: boardData, error: boardError } = await supabase
      .from("boards")
      .select("project_id")
      .eq("board_id", board_id)
      .single();

    if (boardError) throw boardError;

    console.log("📌 Board Project ID:", boardData);

    const project_id = boardData.project_id;

    // 2️⃣ Ambil member berdasarkan project_id
    const { data, error } = await supabase
      .from("project_members")
      .select("user_id, role, users(full_name, username)")
      .eq("project_id", project_id);

    if (error) throw error;

    console.log("📥 Project Members:", data);

    return res.json({ members: data });

  } catch (err) {
    console.error("❌ ERROR getProjectMembers:", err.message);
    return res.status(500).json({ error: err.message });
  }
};

export const getProjectDetailByBoard = async (req, res) => {
  const { board_id } = req.params;

  try {
    // 1. Ambil project_id dari board
    const { data: board, error: boardError } = await supabase
      .from('boards')
      .select('project_id')
      .eq('board_id', board_id)
      .single();

    if (boardError || !board) {
      return res.status(404).json({ error: 'Board not found' });
    }

    const project_id = board.project_id;

    // 2. Ambil detail project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('project_id', project_id)
      .single();

    if (projectError || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    return res.json({ project });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};



