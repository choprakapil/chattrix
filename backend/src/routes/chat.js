const express = require("express");
const { body } = require("express-validator");
const { query } = require("../db");
const { validate } = require("../middleware/validate");

function createChatRouter({ io }) {
  const router = express.Router();

  router.post(
    "/start",
    [
      body("property_id").isLength({ min: 1 }).withMessage("property_id is required"),
      body("name").isLength({ min: 1 }).withMessage("name is required"),
      body("email").isEmail().withMessage("valid email is required"),
      body("phone").isLength({ min: 4 }).withMessage("phone must be at least 4 chars"),
      body("message").isLength({ min: 1 }).withMessage("message is required"),
    ],
    validate,
    async (req, res) => {
      console.log("[Chat/start] ── Incoming request body:", JSON.stringify(req.body));
      console.log("[Chat/start] property_id received:", req.body.property_id);

      try {
        // Step 1: Look up property by its UUID property_id
        const propRows = await query(
          "SELECT id, name FROM properties WHERE property_id = ?",
          [req.body.property_id]
        );
        console.log("[Chat/start] Property lookup result:", JSON.stringify(propRows));

        if (!propRows[0]) {
          console.error("[Chat/start] ✗ Property NOT FOUND for property_id:", req.body.property_id);
          return res.status(404).json({ error: "Property not found. Check your property_id." });
        }

        const prop = propRows[0];
        console.log("[Chat/start] ✓ Property found:", prop.name, "(db id:", prop.id, ")");

        // Step 2: Create the chat record with tracking metadata
        const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || "").split(',')[0].trim();
        const url = req.body.url || "";
        const browser = req.body.browser || "";
        const os = req.body.os || "";

        const result = await query(
          "INSERT INTO chats (property_id, visitor_name, visitor_email, visitor_phone, visitor_ip, visitor_url, visitor_browser, visitor_os) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [prop.id, req.body.name.trim(), req.body.email.trim(), req.body.phone.trim(), ip, url, browser, os]
        );
        const chatId = result.insertId;
        console.log("[Chat/start] ✓ Chat created, chatId:", chatId);

        // Async Geo-lookup so it doesn't block the request
        if (ip && ip !== "::1" && ip !== "127.0.0.1") {
          fetch(`http://ip-api.com/json/${ip}`)
            .then(r => r.json())
            .then(d => {
              if (d.status === "success") {
                const loc = `${d.city}, ${d.country}`;
                query("UPDATE chats SET visitor_location = ? WHERE id = ?", [loc, chatId]).catch(()=>{});
              }
            }).catch(()=>{});
        }

        // Step 3: Save opening message
        await query(
          "INSERT INTO messages (chat_id, sender, message) VALUES (?, 'visitor', ?)",
          [chatId, req.body.message.trim()]
        );
        console.log("[Chat/start] ✓ Initial message saved");

        // Step 4: Look up assigned agents for this property
        const agentRows = await query(
          "SELECT a.id, a.name FROM agents a " +
          "INNER JOIN property_agents pa ON pa.agent_id = a.id " +
          "WHERE pa.property_id = ? AND pa.status = 'accepted'",
          [prop.id]
        );
        console.log("[Chat/start] Assigned agents:", JSON.stringify(agentRows));

        // Step 5: Notify agents via socket
        io.to(`property_${req.body.property_id}`).emit("visitor_opened_chat", {
          propertyId: req.body.property_id,
          chatId,
        });
        console.log("[Chat/start] ✓ Socket event emitted to property room");

        console.log("[Chat/start] ✓ Success → chat_id:", chatId);
        return res.json({ chat_id: chatId });
      } catch (err) {
        console.error("[Chat/start] ✗ EXCEPTION:", err.message);
        console.error("[Chat/start] Stack:", err.stack);
        return res.status(500).json({ error: "Internal server error: " + err.message });
      }
    }
  );

  router.get("/:chatId/messages", async (req, res) => {
    try {
      const rows = await query(
        `SELECT m.*, a.name agent_name, a.id agent_id 
         FROM messages m 
         LEFT JOIN agents a ON m.sender = 'agent' AND m.sender_id = a.id
         WHERE m.chat_id = ? ORDER BY m.created_at ASC`,
        [req.params.chatId]
      );
      console.log("[Chat/messages] chatId:", req.params.chatId, "→", rows.length, "messages");
      res.json(rows);
    } catch (err) {
      console.error("[Chat/messages] error:", err.message);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.get("/:chatId/status", async (req, res) => {
    try {
      const row = (await query(
        `SELECT c.status, c.assigned_agent_id agent_id, a.name agent_name 
         FROM chats c 
         LEFT JOIN agents a ON c.assigned_agent_id = a.id 
         WHERE c.id = ?`, 
        [req.params.chatId]
      ))[0];
      if (!row) return res.status(404).json({ error: "Chat not found" });
      res.json(row);
    } catch (err) {
      console.error("[Chat/status] error:", err.message);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}

module.exports = { createChatRouter };
