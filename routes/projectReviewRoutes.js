import express from "express";
import {
  requestReviewProject,
  approveProject,
  rejectProject,
} from "../controllers/projectReviewController.js";
import { authenticateToken } from "../authToken/AuthToken.js";

const router = express.Router();

router.put("/:boardId/request-review", authenticateToken, requestReviewProject);
router.post("/:id/approve", authenticateToken, approveProject);
router.post("/:id/reject", authenticateToken, rejectProject);

export default router;
