// server/sockets/boardSocket.js
export const handleBoardSocket = (io, socket) => {
  // 🔹 Join board room
  socket.on("join_board", (board_id) => {
    socket.join(`board_${board_id}`);
    console.log(`👥 ${socket.id} joined board_${board_id}`);
  });

  // 🔹 Leave board room
  socket.on("leave_board", (board_id) => {
    socket.leave(`board_${board_id}`);
    console.log(`👋 ${socket.id} left board_${board_id}`);
  });

  // (Opsional) Kirim pesan broadcast tes
  socket.on("board_message", ({ board_id, message }) => {
    io.to(`board_${board_id}`).emit("board_message", {
      from: socket.id,
      message,
    });
  });
};
