const express = require("express");
const bcrypt = require("bcrypt");
const { body, query: q } = require("express-validator");
const { v4: uuidv4 } = require("uuid");
const { query } = require("../db");
const { ensureRole } = require("../middleware/auth");
const { validate } = require("../middleware/validate");

function createAdminRouter({ io, onlineAgents, WIDGET_CDN_URL }) {
  const router = express.Router();
  router.use(ensureRole("admin"));

  router.post(
    "/agents",
    [body("name").isLength({ min: 1 }), body("username").isLength({ min: 3 }), body("password").isLength({ min: 6 })],
    validate,
    async (req, res) => {
      const { name, username, password } = req.body;
      const hashed = await bcrypt.hash(password, 10);
      try {
        await query("INSERT INTO agents (admin_id, name, username, password) VALUES (?, ?, ?, ?)", [
          req.session.user.id,
          name.trim(),
          username.trim(),
          hashed,
        ]);
        return res.json({ ok: true });
      } catch (_err) {
        return res.status(400).json({ error: "Agent username already exists" });
      }
    }
  );

  router.get("/agents", async (req, res) => {
    const rows = await query("SELECT id, name, username, status, created_at FROM agents WHERE admin_id = ?", [req.session.user.id]);
    res.json(rows);
  });

  router.post(
    "/properties",
    [body("name").isLength({ min: 1 }), body("url").isLength({ min: 1 })],
    validate,
    async (req, res) => {
      const propertyId = uuidv4();
      await query("INSERT INTO properties (admin_id, name, url, property_id) VALUES (?, ?, ?, ?)", [
        req.session.user.id,
        req.body.name.trim(),
        req.body.url.trim(),
        propertyId,
      ]);
      res.json({ ok: true, propertyId });
    }
  );

  router.get("/properties", async (req, res) => {
    const rows = await query("SELECT * FROM properties WHERE admin_id = ? ORDER BY id DESC", [req.session.user.id]);
    const cdnUrl = WIDGET_CDN_URL || `${req.protocol}://${req.get("host")}`;
    res.json(rows.map((p) => ({ 
      ...p, 
      embedScript: `<script async src="${cdnUrl}/widget.js" data-property-id="${p.property_id}"></script>` 
    })));
  });

  router.post(
    "/assign",
    [body("propertyDbId").isInt(), body("agentIds").isArray({ min: 1 })],
    validate,
    async (req, res) => {
      const { propertyDbId, agentIds } = req.body;
      const prop = (await query("SELECT * FROM properties WHERE id = ? AND admin_id = ?", [propertyDbId, req.session.user.id]))[0];
      if (!prop) return res.status(404).json({ error: "Property not found" });
      for (const agentId of agentIds) {
        await query(
          "INSERT INTO property_agents (property_id, agent_id, status) VALUES (?, ?, 'pending') ON DUPLICATE KEY UPDATE status='pending', accepted_at=NULL",
          [propertyDbId, agentId]
        );
        const socketId = onlineAgents.get(agentId);
        if (socketId) io.to(socketId).emit("agent_assigned", { propertyDbId, propertyName: prop.name, propertyUuid: prop.property_id });
      }
      res.json({ ok: true });
    }
  );

  router.get("/assignments", async (req, res) => {
    const rows = await query(
      `SELECT pa.id, p.name property_name, p.property_id, a.id agent_id, a.name agent_name, pa.status, pa.assigned_at, pa.accepted_at
       FROM property_agents pa
       JOIN properties p ON pa.property_id = p.id
       JOIN agents a ON pa.agent_id = a.id
       WHERE p.admin_id = ?
       ORDER BY pa.assigned_at DESC`,
      [req.session.user.id]
    );
    res.json(rows);
  });

  router.get(
    "/chats",
    [q("status").optional().isIn(["waiting", "active", "closed"]), q("q").optional().isLength({ max: 100 })],
    validate,
    async (req, res) => {
      const { status, q: search = "", agentId, from, to } = req.query;
      const params = [req.session.user.id];
      let where = "WHERE p.admin_id = ?";
      if (status) {
        where += " AND c.status = ?";
        params.push(status);
      }
      if (agentId) {
        where += " AND c.assigned_agent_id = ?";
        params.push(Number(agentId));
      }
      if (from) {
        where += " AND DATE(c.created_at) >= ?";
        params.push(from);
      }
      if (to) {
        where += " AND DATE(c.created_at) <= ?";
        params.push(to);
      }
      if (search) {
        where += " AND (c.visitor_name LIKE ? OR c.visitor_email LIKE ?)";
        params.push(`%${search}%`, `%${search}%`);
      }
      const rows = await query(
        `SELECT c.*, c.assigned_agent_id agent_id, p.name property_name, a.name agent_name,
          (SELECT message FROM messages m WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1) last_message
         FROM chats c
         JOIN properties p ON c.property_id = p.id
         LEFT JOIN agents a ON c.assigned_agent_id = a.id
         ${where}
         ORDER BY c.created_at DESC`,
        params
      );
      console.log("[Admin API] Fetching chats, sample object:", JSON.stringify(rows[0] || {}, null, 2));
      res.json(rows);
    }
  );

  router.get("/chats/:id/messages", async (req, res) => {
    const messages = await query("SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC", [req.params.id]);
    res.json(messages);
  });

  router.get("/stats", async (req, res) => {
    try {
      const adminId = req.session.user.id;
      const { from, to } = req.query;
      
      let where = "WHERE p.admin_id = ?";
      const params = [adminId];
      if (from) { where += " AND DATE(c.created_at) >= ?"; params.push(from); }
      if (to)   { where += " AND DATE(c.created_at) <= ?"; params.push(to);   }

      // 1. Avg Response Time
      const resTime = await query(
        `SELECT AVG(TIMESTAMPDIFF(SECOND, v.created_at, a.created_at)) as avg_seconds
         FROM (SELECT chat_id, MIN(created_at) as created_at FROM messages WHERE sender = 'visitor' GROUP BY chat_id) v
         JOIN (SELECT chat_id, MIN(created_at) as created_at FROM messages WHERE sender = 'agent' GROUP BY chat_id) a ON v.chat_id = a.chat_id
         JOIN chats c ON v.chat_id = c.id
         JOIN properties p ON c.property_id = p.id
         ${where} AND a.created_at >= v.created_at`,
        params
      );
      
      // 2. Total Visitors
      const visitors = await query(
        `SELECT COUNT(*) as count FROM chats c JOIN properties p ON c.property_id = p.id ${where}`,
        params
      );

      // 3. Active Chats
      const active = await query(
        `SELECT COUNT(*) as count FROM chats c JOIN properties p ON c.property_id = p.id ${where} AND c.status != 'closed'`,
        params
      );

      // 4. Agents Online
      const online = await query(
        "SELECT COUNT(*) as count FROM agents WHERE admin_id = ? AND status = 'online'",
        [adminId]
      );

      // 5. Volume Trend (Last 7 days or based on range)
      const trend = await query(
        `SELECT DATE_FORMAT(c.created_at, '%b %d') as name, COUNT(*) as chats
         FROM chats c
         JOIN properties p ON c.property_id = p.id
         ${where}
         GROUP BY DATE(c.created_at)
         ORDER BY DATE(c.created_at) ASC
         LIMIT 30`,
        params
      );

      const avgSec = Math.round(resTime[0]?.avg_seconds || 0);
      const minutes = Math.floor(avgSec / 60);
      const seconds = avgSec % 60;
      const avgFormatted = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

      res.json({
        totalVisitors: visitors[0]?.count || 0,
        activeChats: active[0]?.count || 0,
        agentsOnline: online[0]?.count || 0,
        avgResponse: avgFormatted || "0s",
        trend: trend || []
      });
    } catch (err) {
      console.error("[Admin API] Failed to fetch stats:", err);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  return router;
}

module.exports = { createAdminRouter };
