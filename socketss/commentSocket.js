// server/sockets/commentSocket.js
export const handleCommentSocket = (io, socket) => {
  console.log("💬 [commentSocket] connected:", socket.id);

  // User join card room untuk komentar realtime
  socket.on("join_card_comments", (card_id) => {
    socket.join(`card_${card_id}`);
    console.log(`💬 ${socket.id} joined comment room card_${card_id}`);
  });

  socket.on("leave_card_comments", (card_id) => {
    socket.leave(`card_${card_id}`);
    console.log(`🚪 ${socket.id} left comment room card_${card_id}`);
  });

  // Typing indicator (opsional)
  socket.on("comment_typing", ({ card_id, user_id }) => {
    socket.to(`card_${card_id}`).emit("comment_typing", { user_id });
  });

  socket.on("disconnect", () => {
    console.log("❌ [commentSocket] disconnected:", socket.id);
  });
};
