import express from "express";
import { body } from "express-validator";
import {
  registerUser,
  loginUser,
  checkAuth,
  getAuthMe,
  updateUseradmin,
  checkPassword,
  changePassword,
} from "../controllers/authController.js";
import { authenticateToken } from "../authToken/AuthToken.js";

const router = express.Router();

// =================== REGISTER ===================
router.post(
  "/register",
  [
    body("username").notEmpty().withMessage("Username wajib diisi"),
    body("password").notEmpty().withMessage("Password wajib diisi"),
    body("full_name").notEmpty().withMessage("Full name wajib diisi"),
    body("email").isEmail().withMessage("Email tidak valid"),
  ],
  registerUser
);

// =================== LOGIN ===================
router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Email tidak valid"),
    body("password").notEmpty().withMessage("Password wajib diisi"),
  ],
  loginUser
);

// =================== CHECK AUTH ===================
router.get("/check-auth", authenticateToken, checkAuth);

// =================== GET AUTH ME ===================
router.get("/auth/me", getAuthMe);
router.patch("/update-user", authenticateToken, updateUseradmin);
router.post("/check-password", authenticateToken, checkPassword);
router.put("/change-password", authenticateToken, changePassword);

export default router;
