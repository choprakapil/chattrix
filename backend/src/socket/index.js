const { query } = require("../db");

function registerSocketHandlers(io, onlineAgents) {
  async function mapUserSocket(socket, user) {
    socket.data.user = user;
    if (user.role === "agent") {
      onlineAgents.set(user.id, socket.id);
      await query("UPDATE agents SET status = 'online' WHERE id = ?", [user.id]);
      io.emit("agent_status_change", { agentId: user.id, status: "online" });
    }
  }

  io.on("connection", (socket) => {
    socket.on("register_user", (payload) => mapUserSocket(socket, payload));

    socket.on("join_property", async ({ propertyId, url }) => {
      socket.join(`property_${propertyId}`);
      socket.data.visitorPropertyId = propertyId;
      socket.data.visitorUrl = url || "Website";

      const agents = await query("SELECT agent_id FROM property_agents WHERE property_id = (SELECT id FROM properties WHERE property_id = ?) AND status = 'accepted'", [propertyId]);
      for (const row of agents) {
        await query("INSERT INTO notifications (agent_id, type, message) VALUES (?, ?, ?)", [
          row.agent_id,
          "visitor_entered_site",
          `A visitor just entered via ${socket.data.visitorUrl}`,
        ]);
        if (onlineAgents.has(row.agent_id)) {
          io.to(onlineAgents.get(row.agent_id)).emit("visitor_entered_site", { propertyId, url: socket.data.visitorUrl });
        }
      }
    });

    socket.on("visitor_opened_chat", async ({ propertyId, url }) => {
      const agents = await query("SELECT agent_id FROM property_agents WHERE property_id = (SELECT id FROM properties WHERE property_id = ?) AND status = 'accepted'", [propertyId]);
      for (const row of agents) {
        await query("INSERT INTO notifications (agent_id, type, message) VALUES (?, ?, ?)", [
          row.agent_id,
          "visitor_opened_chat",
          `Visitor just opened the chat panel on ${url || 'Website'}!`,
        ]);
        if (onlineAgents.has(row.agent_id)) {
          io.to(onlineAgents.get(row.agent_id)).emit("visitor_opened_chat", { propertyId, url: url || "Website" });
        }
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
      // 1. Agent disconnects
      if (socket.data.user?.role === "agent") {
        if (onlineAgents.get(socket.data.user.id) === socket.id) {
          onlineAgents.delete(socket.data.user.id);
          await query("UPDATE agents SET status = 'offline' WHERE id = ?", [socket.data.user.id]);
          io.emit("agent_status_change", { agentId: socket.data.user.id, status: "offline" });
        }
      }
      
      // 2. Visitor disconnects
      if (socket.data.visitorPropertyId) {
        const agents = await query("SELECT agent_id FROM property_agents WHERE property_id = (SELECT id FROM properties WHERE property_id = ?) AND status = 'accepted'", [socket.data.visitorPropertyId]);
        for (const row of agents) {
          await query("INSERT INTO notifications (agent_id, type, message) VALUES (?, ?, ?)", [
            row.agent_id,
            "visitor_left_site",
            `Visitor left ${socket.data.visitorUrl}`,
          ]);
          if (onlineAgents.has(row.agent_id)) {
            io.to(onlineAgents.get(row.agent_id)).emit("visitor_left_site", { propertyId: socket.data.visitorPropertyId, url: socket.data.visitorUrl });
          }
        }
      }
    });
  });
}

module.exports = { registerSocketHandlers };
