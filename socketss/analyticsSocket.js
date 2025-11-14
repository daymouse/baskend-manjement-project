// server/sockets/analyticsSocket.js
export const handleAnalyticsSocket = (io, socket) => {
  console.log("📊 [AnalyticsSocket] Connected:", socket.id);

  // 🧠 User bergabung ke ruang analitik board
  socket.on("join_board_analytics", (board_id) => {
    if (!board_id) return;
    socket.join(`board_analytics_${board_id}`);
    console.log(`👥 User joined analytics room: board_analytics_${board_id}`);
  });

  // 🌀 Emit ke semua client yang bergabung di board tertentu
  socket.on("analytics_update", (data) => {
    const { board_id } = data;
    if (!board_id) return;
    io.to(`board_analytics_${board_id}`).emit("analytics_refetch", data);
    console.log(`🔁 Emit analytics_refetch to board_analytics_${board_id}`);
  });

  // 🌍 Untuk super admin atau dashboard global
  socket.on("join_global_analytics", () => {
    socket.join("global_analytics");
    console.log("🌐 User joined global analytics room");
  });

  // 🔔 Emit ke semua client global
  socket.on("analytics_update_global", (data) => {
    io.to("global_analytics").emit("analytics_refetch_global", data);
    console.log("🌍 Emit analytics_refetch_global to all global clients");
  });

  socket.on("disconnect", () => {
    console.log("🔴 [AnalyticsSocket] Disconnected:", socket.id);
  });
};
