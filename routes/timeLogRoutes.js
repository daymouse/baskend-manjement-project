import express from "express";
import { authenticateToken } from "../authToken/AuthToken.js";
import { createTimeLog, endTimeLog } from "../controllers/timeLogController.js";
const router = express.Router();

router.post("/time-logs", authenticateToken, createTimeLog);

// PUT: catat waktu selesai
router.put("/time-logs/end", authenticateToken, endTimeLog);

export default router;
