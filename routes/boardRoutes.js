import express from "express";
import {
  createBoard,
  updateBoardName,
  getAllBoards,
  getBoardById
} from "../controllers/boardController.js";
import { authenticateToken } from "../authToken/AuthToken.js";

const router = express.Router();

// GET ALL BOARDS
router.get("/boards", authenticateToken, getAllBoards);
// CREATE BOARD
router.post("/projects/:project_id/boards", authenticateToken, createBoard);
// UPDATE BOARD NAME
router.patch("/update-boards/:id", authenticateToken, updateBoardName);

router.get("/:board_id", authenticateToken, getBoardById);



export default router;
