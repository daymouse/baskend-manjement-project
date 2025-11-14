import express from "express";
import { getHomeDashboard } from "../controllers/dashboardUser.js";
import { authenticateToken } from "../authToken/AuthToken.js";

const router = express.Router();

router.get("/home", authenticateToken, getHomeDashboard);



export default router;
