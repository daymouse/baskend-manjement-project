// server/sockets/index.js
import { handleSubtaskSocket } from "./subtaskSocket.js";
// import { handleCardSocket } from "./cardSocket.js"; // kalau nanti ada
import { handleBoardSocket } from "./boardSocket.js";
import { handleBlockerSocket } from "./blockerSocket.js";
import { handleAnalyticsSocket } from "./analyticsSocket.js";
import { handleCommentSocket } from "./commentSocket.js";

export const setupSocket = (io) => {
  io.on("connection", (socket) => {
    console.log("🔌 Client connected:", socket.id);

    // Jalankan semua handler modular
    handleSubtaskSocket(io, socket);
    // handleCardSocket(io, socket); // jika ada
    handleBoardSocket(io, socket);
    
    handleBlockerSocket(io, socket);
    handleAnalyticsSocket(io, socket);
    handleCommentSocket(io, socket);

    socket.on("disconnect", () => {
      console.log("❌ Client disconnected:", socket.id);
    });
  });
};
