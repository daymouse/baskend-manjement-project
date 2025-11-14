// routes/commentRoutes.js
import express from "express";
import {
  createComment,
  getCommentsByCard,
  updateComment,
  deleteComment,
  createRejectComment,
} from "../controllers/commentController.js";
import { authenticateToken } from "../authToken/AuthToken.js";


const router = express.Router();

router.post("/", authenticateToken, createComment);
router.post("/reject", authenticateToken, createRejectComment);
router.get("/card/:card_id", authenticateToken, getCommentsByCard);
router.patch("/:comment_id", authenticateToken, updateComment);
router.delete("/:comment_id",authenticateToken, deleteComment);

export default router;
