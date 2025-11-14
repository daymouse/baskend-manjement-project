import express from "express";
import {
  getBoardAnalytics,
  getUserAnalyticsByBoard,
  getUserAnalyticsGlobal,
  getTeamLeadAnalyticsByBoard,
  getGlobalAnalytics,
  getProjectAnalytics,
} from "../controllers/analyticsController.js";
import { authenticateToken } from "../authToken/AuthToken.js";


const router = express.Router();

router.get("/board/:board_id", authenticateToken, getBoardAnalytics);
router.get("/user/global", authenticateToken, getUserAnalyticsGlobal);
router.get("/user/:board_id", authenticateToken, getUserAnalyticsByBoard);
router.get("/team-lead/:board_id", authenticateToken, getTeamLeadAnalyticsByBoard);
router.get("/project/:board_id", authenticateToken, getProjectAnalytics);
router.get("/global", authenticateToken, getGlobalAnalytics);

export default router;
