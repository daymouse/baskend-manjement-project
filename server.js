import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";       
import { Server } from "socket.io"; 
import { setupSocket } from "./socketss/socketHandler.js";

import authRoutes from "./routes/authRoutes.js";
import project from "./routes/projectRoutes.js";
import User from "./routes/userRoutes.js";
import Boards from "./routes/boardRoutes.js";
import Card from "./routes/cardRoute.js";
import Role from "./routes/roleRoutes.js";
import Subtask from "./routes/subtaskRoutes.js";
import TimeLog  from "./routes/timeLogRoutes.js";
import solveBlocker from "./routes/blockerRoutes.js";
import Statistik from "./routes/analyticsRoutes.js";
import dashboardAdminRoutes from "./routes/dashboardAdminRoutes.js";
import DetailProject from "./routes/projectDetailRoutes.js";
import dashboardUserRoute from "./routes/dashboardUserRoute.js";
import Comment from "./routes/commentRoutes.js";
import Chat from "./routes/chatRoutes.js";
import ProjectReview from "./routes/projectReviewRoutes.js";

dotenv.config();

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

const app = express();
const PORT = process.env.PORT || 3000;

const server = http.createServer(app);
// Setup Socket.IO di atas HTTP server
export const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

setupSocket(io);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());
app.use((req, res, next) => {
  console.log("➡️ Request masuk:", req.method, req.url);
  next();
});

io.on("connection", (socket) => {
  console.log("🟢 User connected:", socket.id);

  // Contoh event kirim pesan
  socket.on("send_message", (data) => {
    console.log("📩 Pesan diterima:", data);
    // Kirim ke semua client lain
    socket.broadcast.emit("receive_message", data);
  });

  socket.on("disconnect", () => {
    console.log("🔴 User disconnected:", socket.id);
  });
});

// API routes
app.use("/auth", authRoutes);
app.use("/project", project);
app.use("/users", User);
app.use("/board", Boards);
app.use("/card", Card);
app.use("/roles", Role);
app.use("/subtask", Subtask);
app.use("/time", TimeLog);
app.use("/solve-blocker", solveBlocker);
app.use("/analytics", Statistik);
app.use("/home-admin", dashboardAdminRoutes);
app.use("/detail-projects", DetailProject);
app.use("/home-user", dashboardUserRoute);
app.use("/comment", Comment);
app.use("/chat", Chat);
app.use("/project-review", ProjectReview);


server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
