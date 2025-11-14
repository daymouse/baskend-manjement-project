import express from "express";
import { body } from "express-validator";
import {
  registerUser,
  loginUser,
  checkAuth,
  getAuthMe,
  updateUseradmin
} from "../controllers/authController.js";
import { authenticateToken } from "../authToken/AuthToken.js";

const router = express.Router();

// =================== REGISTER ===================
router.post(
  "/register",
  [
    body("username")
      .notEmpty().withMessage("Username wajib diisi")
      .trim()
      .isLength({ min: 3, max: 20 }).withMessage("Username 3-20 karakter")
      .matches(/^[a-zA-Z0-9_]+$/).withMessage("Username hanya boleh huruf/angka/_"),

    body("password")
      .notEmpty().withMessage("password wajib diisi")
      .isLength({ min: 8 }).withMessage("Password minimal 8 karakter")
      .matches(/[0-9]/).withMessage("Password harus mengandung angka")
      .matches(/[A-Z]/).withMessage("Password harus ada huruf besar"),

    body("full_name")
      .notEmpty().withMessage("full name wajib diisi")
      .trim()
      .isLength({ min: 3 }).withMessage("Nama lengkap minimal 3 karakter"),

    body("email")
      .notEmpty().withMessage("email wajib diisi")
      .isEmail().withMessage("Format email salah")
      .normalizeEmail(),
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
router.patch("/update-user", updateUseradmin);

export default router;
