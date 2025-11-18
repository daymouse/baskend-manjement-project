import express from "express";
import { authenticateToken } from "../authToken/AuthToken.js";
import { getSubtasks, createSubtask, updateSubtaskStatus, assignSubtask, getContributorsByCard, reviewSubtask, updateSubtask,
    deleteSubtask,
 } from "../controllers/subtaskController.js";
const router = express.Router();

router.put("/assign", authenticateToken, assignSubtask);
router.put("/review-subtask", authenticateToken, reviewSubtask);
router.get("/:cardId/task-contributors", authenticateToken, getContributorsByCard);
router.get("/cards/:cardId/subtasks", authenticateToken, getSubtasks);
router.post("/cards/:cardId/subtasks", authenticateToken, createSubtask);
router.put("/subtasks/:subtaskId", authenticateToken, updateSubtaskStatus);
router.patch("/update/:subtask_id", authenticateToken, updateSubtask);
router.delete("/delete/:subtask_id", authenticateToken, deleteSubtask);

export default router;
