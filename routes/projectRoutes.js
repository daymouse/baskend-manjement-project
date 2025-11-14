import express from "express";
import { authenticateToken } from "../authToken/AuthToken.js";
import {
  createProject,
  getAllProjects,
  getProjectById,
  updateProject,
  deleteProject,
  getProjectBoard,
  getMemberRoleByBoard,
  doneProject,
  getProjectMembers,
  reviewProject,
  getProjectMembersByBoard,
  addProjectMember,
  removeProjectMember
} from "../controllers/projectController.js";

const router = express.Router();

router.post("/projects", authenticateToken, createProject);
router.get("/projects", authenticateToken, getAllProjects);
router.get("/project-board", authenticateToken, getProjectBoard);
router.get("/projects/:id", authenticateToken, getProjectById);
router.get("/project-members/:project_id", authenticateToken, getProjectMembers);
router.put("/projects/:id", authenticateToken, updateProject);
router.delete("/project/:id", authenticateToken, deleteProject);
router.patch("/projects/:board_id/done", authenticateToken, doneProject);
router.patch("/projects/:board_id/review", authenticateToken, reviewProject);
router.get("/:board_id/member-role", authenticateToken, getMemberRoleByBoard);
router.get("/board-members/:board_id", authenticateToken, getProjectMembersByBoard);
router.post("/:board_id/add", authenticateToken, addProjectMember);
router.delete("/:projectId/remove/:userId", authenticateToken, removeProjectMember);

export default router;
