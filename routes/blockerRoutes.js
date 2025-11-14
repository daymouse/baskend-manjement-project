import express from "express";
import { reportBlocker, solveBlocker, getBlockersBySubtask } from "../controllers/BlockerController.js";
import { authenticateToken } from "../authToken/AuthToken.js";// jika kamu pakai JWT auth

const router = express.Router();


router.post("/report", authenticateToken, reportBlocker);
router.patch("/solve", authenticateToken, solveBlocker);
router.get("/blocker/subtask/:subtask_id", authenticateToken, getBlockersBySubtask);


export default router;
