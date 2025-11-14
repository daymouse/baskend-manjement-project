import express from "express";
import {
  getProjectDetail,
  updateProject,
  addMember,
  updateMemberRole,
  generateReport,
  requestReview,
  reviewProject,
} from "../controllers/projectDetailController.js";
import { authenticateToken } from "../authToken/AuthToken.js";

const router = express.Router();

router.get("/:project_id/detail", authenticateToken, getProjectDetail);
router.patch("/:project_id/detail", authenticateToken, updateProject);
router.post("/:project_id/members", authenticateToken, addMember);
router.patch("/:project_id/members/:member_id",authenticateToken, updateMemberRole);
router.get("/:project_id/report",authenticateToken, generateReport);
router.post("/:project_id/request-review",authenticateToken, requestReview);
router.post("/:project_id/review",authenticateToken, reviewProject);

export default router;
