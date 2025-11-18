import express from "express";
import {
  getCardsByBoard,
  createCard,
  getBoardMembers,
  getCardDetail,
  updateCardStatus,
  approveCard,
  reviseCard,
  updateCard,
  updateCardAssignment,
  getAssignableMembers,
  deleteCard,
} from "../controllers/cardController.js";
import { authenticateToken } from "../authToken/AuthToken.js";

const router = express.Router();

// GET all cards by board
router.get("/board/:board_id", authenticateToken, getCardsByBoard);
router.post("/board/:board_id", authenticateToken, createCard);
router.get("/:id/detail", authenticateToken, getCardDetail);
router.put("/:id/status", authenticateToken, updateCardStatus);
router.post("/:card_id/approve", authenticateToken, approveCard);
router.post("/:card_id/revise", authenticateToken, reviseCard);
router.get("/board/:board_id/members", authenticateToken, getBoardMembers);
router.patch("/:card_id", authenticateToken, updateCard);
router.patch("/:card_id/assign", authenticateToken, updateCardAssignment);
router.delete("/card/:card_id", authenticateToken, deleteCard);
router.get("/project/:project_id/members", authenticateToken, getAssignableMembers);

export default router;
