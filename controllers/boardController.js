import { supabase } from "../supabaseClient.js";

// =================== CREATE BOARD ===================
export const createBoard = async (req, res) => {
  const { project_id } = req.params;
  const { board_name } = req.body;

  try {
    // 🔹 1. Cek apakah sudah ada board untuk project ini
    const { data: existingBoards, error: checkError } = await supabase
      .from("boards")
      .select("*")
      .eq("project_id", project_id);

    if (checkError) throw checkError;

    if (existingBoards && existingBoards.length > 0) {
      return res.status(200).json({
        message: "Board already exists",
        board: existingBoards[0],
      });
    }

    // 🔹 2. Insert board baru
    const { data: newBoard, error: insertError } = await supabase
      .from("boards")
      .insert([{ project_id, board_name }])
      .select()
      .single();

    if (insertError) throw insertError;

    // 🔹 3. Update project jadi "in_progress"
    const { error: updateProjectError } = await supabase
      .from("projects")
      .update({ status: "in_progress" })
      .eq("project_id", project_id);

    if (updateProjectError) throw updateProjectError;

    // 🔹 4. Update posisi default sesuai ID
    const { data: updatedBoard, error: updateError } = await supabase
      .from("boards")
      .update({ position: newBoard.board_id })
      .eq("board_id", newBoard.board_id)
      .select()
      .single();

    if (updateError) throw updateError;

    res.status(201).json({
      message: "Board created successfully",
      board: updatedBoard,
    });
  } catch (err) {
    console.error("Error createBoard:", err.message);
    res.status(500).json({ error: err.message });
  }
};


// =================== UPDATE BOARD NAME ===================
export const updateBoardName = async (req, res) => {
  const { id } = req.params;
  const { aturNameBoard } = req.body;

  try {
    // Catatan: Tabel kamu seharusnya bernama "boards" bukan "board"
    const { data, error } = await supabase
      .from("boards")
      .update({ board_name: aturNameBoard })
      .eq("board_id", id);

    if (error) return res.status(500).json({ error: error.message });

    res.json({
      message: "Nama board berhasil diperbarui",
      data,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// =================== GET ALL BOARDS ===================
export const getAllBoards = async (req, res) => {
  try {
    const { data, error } = await supabase.from("boards").select("*");
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getBoardById = async (req, res) => {
  const { board_id } = req.params;

  try {
    // Ambil data board + project yang terkait
    const { data, error } = await supabase
      .from("boards")
      .select(`
          board_id,
          board_name,
          project_id,
          projects (
            project_name,
            status,
            deadline
          )
      `)
      .eq("board_id", board_id)
      .single();

    if (error) throw error;

    res.json({ success: true, data });
  } catch (err) {
    console.error("❌ Gagal ambil data board:", err.message);
    res.status(500).json({ success: false, message: "Gagal memuat board", error: err.message });
  }
};
