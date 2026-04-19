const express = require("express");
const { query } = require("../db");
const { ensureRole } = require("../middleware/auth");

function createAgentRouter({ io }) {
  const router = express.Router();
  router.use(ensureRole("agent"));

  router.get("/assignments", async (req, res) => {
    const rows = await query(
      `SELECT pa.id, pa.property_id property_db_id, pa.status, pa.custom_greeting, p.name property_name, p.property_id,
              pa.agent_id agent_id, a.name agent_name
       FROM property_agents pa 
       JOIN properties p ON pa.property_id = p.id
       JOIN agents a ON pa.agent_id = a.id
       WHERE pa.agent_id = ? ORDER BY pa.assigned_at DESC`,
      [req.session.user.id]
    );
    res.json(rows);
  });

  router.post("/assignments/:id/respond", async (req, res) => {
    const status = req.body.accept ? "accepted" : "declined";
    await query("UPDATE property_agents SET status = ?, accepted_at = IF(?='accepted', NOW(), NULL) WHERE id = ? AND agent_id = ?", [
      status,
      status,
      req.params.id,
      req.session.user.id,
    ]);
    const row = (
      await query(
        `SELECT p.admin_id, p.name property_name FROM property_agents pa
         JOIN properties p ON pa.property_id = p.id WHERE pa.id = ?`,
        [req.params.id]
      )
    )[0];
    io.emit(status === "accepted" ? "assignment_accepted" : "assignment_declined", {
      assignmentId: Number(req.params.id),
      agentId: req.session.user.id,
      agentName: req.session.user.name,
      propertyName: row?.property_name,
      adminId: row?.admin_id,
    });
    res.json({ ok: true });
  });

  router.post("/status", async (req, res) => {
    const status = req.body.status === "online" ? "online" : "offline";
    await query("UPDATE agents SET status = ? WHERE id = ?", [status, req.session.user.id]);
    io.emit("agent_status_change", { agentId: req.session.user.id, status });
    res.json({ ok: true });
  });

  router.get("/chats", async (req, res) => {
    const chats = await query(
      `SELECT c.*, c.assigned_agent_id agent_id, p.name property_name, a.name agent_name,
        (SELECT COUNT(*) FROM messages m WHERE m.chat_id = c.id AND m.sender = 'visitor' AND m.is_read = 0) unread_count
       FROM chats c 
       JOIN properties p ON c.property_id = p.id
       LEFT JOIN agents a ON c.assigned_agent_id = a.id
       JOIN property_agents pa ON pa.property_id = c.property_id AND pa.agent_id = ?
       ORDER BY c.created_at DESC`,
      [req.session.user.id]
    );
    console.log("[Agent API] Fetching chats, sample object:", JSON.stringify(chats[0] || {}, null, 2));
    res.json(chats);
  });

  router.post("/chats/:id/join", async (req, res) => {
    await query("UPDATE chats SET assigned_agent_id = ?, status = IF(status='waiting','active',status) WHERE id = ?", [
      req.session.user.id,
      req.params.id,
    ]);
    res.json({ ok: true });
  });

  router.post("/chats/:id/end", async (req, res) => {
    await query("UPDATE chats SET status = 'closed' WHERE id = ?", [req.params.id]);
    io.to(`chat_${req.params.id}`).emit("chat_ended", { chatId: Number(req.params.id) });
    res.json({ ok: true });
  });

  router.post("/greeting", async (req, res) => {
    const { propertyDbId, greeting } = req.body;
    await query("UPDATE property_agents SET custom_greeting = ? WHERE property_id = ? AND agent_id = ?", [
      greeting || "",
      propertyDbId,
      req.session.user.id,
    ]);
    res.json({ ok: true });
  });

  router.get("/notifications", async (req, res) => {
    const rows = await query("SELECT * FROM notifications WHERE agent_id = ? ORDER BY created_at DESC LIMIT 100", [req.session.user.id]);
    res.json(rows);
  });

  router.post("/notifications/read", async (req, res) => {
    await query("UPDATE notifications SET is_read = 1 WHERE agent_id = ?", [req.session.user.id]);
    res.json({ ok: true });
  });

  return router;
}

module.exports = { createAgentRouter };
