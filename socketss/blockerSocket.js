export const handleBlockerSocket = (io, socket) => {
  console.log("🧱 [blockerSocket] active on:", socket.id);

  // Ketika ada laporan blocker baru
  socket.on("blocker_reported", ({ type, data }) => {
    if (!data?._room) return;
    io.to(data._room).emit("blocker_reported", { type, data });
    console.log(`📡 blocker_reported broadcasted to ${data._room}`);
  });

  // Ketika blocker diselesaikan
  socket.on("blocker_solved", ({ type, data }) => {
    if (!data?._room) return;
    io.to(data._room).emit("blocker_solved", { type, data });
    console.log(`✅ blocker_solved broadcasted to ${data._room}`);
  });
};
