const { query } = require("../db");

function registerSocketHandlers(io, onlineAgents) {
  function mapUserSocket(socket, user) {
    socket.data.user = user;
    if (user.role === "agent") {
      onlineAgents.set(user.id, socket.id);
      io.emit("agent_status_change", { agentId: user.id, status: "online" });
    }
  }

  io.on("connection", (socket) => {
    socket.on("register_user", (payload) => mapUserSocket(socket, payload));

    socket.on("join_property", async ({ propertyId, agentId }) => {
      socket.join(`property_${propertyId}`);
      if (agentId) {
        await query("INSERT INTO notifications (agent_id, type, message) VALUES (?, ?, ?)", [
          agentId,
          "visitor_entered_site",
          `A visitor just entered property ${propertyId}`,
        ]);
        io.to(onlineAgents.get(agentId)).emit("visitor_entered_site", { propertyId });
      }
    });

    socket.on("visitor_opened_chat", async ({ propertyId, agentId }) => {
      if (agentId) {
        await query("INSERT INTO notifications (agent_id, type, message) VALUES (?, ?, ?)", [
          agentId,
          "visitor_opened_chat",
          `Visitor opened chat on ${propertyId}`,
        ]);
        io.to(onlineAgents.get(agentId)).emit("visitor_opened_chat", { propertyId });
      }
    });

    socket.on("visitor_join", ({ chatId }) => socket.join(`chat_${chatId}`));
    socket.on("agent_join", ({ chatId }) => socket.join(`chat_${chatId}`));

    socket.on("new_message", async (data) => {
      const { chatId, sender, senderId, message } = data;
      // If agent is sending, we can enrich the data with their name from socket.data
      const enrichedData = { ...data };
      if (sender === "agent" && socket.data.user) {
        enrichedData.agentName = socket.data.user.name;
        enrichedData.agentId = socket.data.user.id;
      }

      await query("INSERT INTO messages (chat_id, sender, sender_id, message) VALUES (?, ?, ?, ?)", [chatId, sender, senderId || null, message]);
      io.to(`chat_${chatId}`).emit("new_message", { ...enrichedData, created_at: new Date().toISOString() });
    });

    socket.on("typing", ({ chatId, sender }) => io.to(`chat_${chatId}`).emit("typing", { chatId, sender }));
    socket.on("stop_typing", ({ chatId, sender }) => io.to(`chat_${chatId}`).emit("stop_typing", { chatId, sender }));

    socket.on("message_read", async ({ chatId, reader }) => {
      if (reader === "agent") await query("UPDATE messages SET is_read = 1 WHERE chat_id = ? AND sender = 'visitor'", [chatId]);
      if (reader === "visitor") await query("UPDATE messages SET is_read = 1 WHERE chat_id = ? AND sender = 'agent'", [chatId]);
      io.to(`chat_${chatId}`).emit("message_read", { chatId, reader });
    });

    socket.on("disconnect", async () => {
      if (socket.data.user?.role === "agent") {
        onlineAgents.delete(socket.data.user.id);
        await query("UPDATE agents SET status = 'offline' WHERE id = ?", [socket.data.user.id]);
        io.emit("agent_status_change", { agentId: socket.data.user.id, status: "offline" });
      }
    });
  });
}

module.exports = { registerSocketHandlers };
