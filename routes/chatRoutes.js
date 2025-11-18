import express from "express";
import {
  getBoardChats,
  createChat,
  deleteChat,
  getProjectMembers,
  getProjectDetailByBoard,
} from "../controllers/chatController.js";
import { authenticateToken } from "../authToken/AuthToken.js";

const router = express.Router();

router.get("/board/:board_id", authenticateToken, getBoardChats);
router.get("/project/:board_id", authenticateToken, getProjectDetailByBoard);
router.post("/board/:board_id", authenticateToken, createChat);
router.delete("/:chat_id", authenticateToken, deleteChat);
router.get("/member/:board_id", authenticateToken, getProjectMembers);

export default router;
