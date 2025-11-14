import express from "express";
import {
  getProjectCalendarView,
  getProjectSummary,
  getUserActivitySummary,
  getProjectProgressOverview,
} from "../controllers/dashboardAdminController.js";
import { authenticateToken } from "../authToken/AuthToken.js";

const router = express.Router();

router.get("/calendar-view", authenticateToken, getProjectCalendarView);
router.get("/project-summary", authenticateToken, getProjectSummary);
router.get("/user-activity", authenticateToken, getUserActivitySummary);
router.get("/project-progress", authenticateToken, getProjectProgressOverview);

export default router;
