// server/sockets/subtaskSocket.js
export const handleSubtaskSocket = (io, socket) => {
  console.log("🧩 [subtaskSocket] Client connected:", socket.id);

  // User join room berdasarkan card yang dibuka
  socket.on("join_card", (cardId) => {
    socket.join(`card_${cardId}`);
    console.log(`👥 ${socket.id} joined room card_${cardId}`);
  });

  // Opsional: user keluar dari room
  socket.on("leave_card", (cardId) => {
    socket.leave(`card_${cardId}`);
    console.log(`👋 ${socket.id} left room card_${cardId}`);
  });

  // Opsional: event lain
  socket.on("user_typing", ({ cardId, userId }) => {
    socket.to(`card_${cardId}`).emit("user_typing", { userId });
  });

  socket.on("disconnect", () => {
    console.log("❌ [subtaskSocket] disconnected:", socket.id);
  });
};
