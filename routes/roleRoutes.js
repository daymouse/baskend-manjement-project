import express from "express";
import { authenticateToken } from "../authToken/AuthToken.js";
import { getAllRoles, createRole } from "../controllers/roleController.js";

const router = express.Router();

// Routes
router.get("/role", authenticateToken, getAllRoles);
router.post("/role", authenticateToken, createRole);

export default router;
