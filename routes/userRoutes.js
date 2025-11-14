import express from "express";
import { authenticateToken } from "../authToken/AuthToken.js";
import {
  getAllUsers,
  updateUserRole,
  updateUsername,
  updateFullName,
  deleteUser,
  getLeaders,
  getMembers,
} from "../controllers/userController.js";

const router = express.Router();

// Routes
router.get("/users", authenticateToken, getAllUsers);
router.get("/leader", authenticateToken, getLeaders);
router.get("/member", authenticateToken, getMembers);
router.patch("/update-role/:id", authenticateToken, updateUserRole);
router.patch("/update-username/:id", authenticateToken, updateUsername);
router.patch("/update-fullname/:id", authenticateToken, updateFullName);
router.delete("/user/:id", authenticateToken, deleteUser);


export default router;
