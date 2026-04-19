const express = require("express");
const bcrypt = require("bcrypt");
const { body } = require("express-validator");
const { query } = require("../db");
const { ensureAuth } = require("../middleware/auth");
const { validate } = require("../middleware/validate");

function createAuthRouter({ io }) {
  const router = express.Router();

  router.post(
    "/admin/login",
    [body("email").isEmail(), body("password").isLength({ min: 1 })],
    validate,
    async (req, res) => {
      const { email, password } = req.body;
      const rows = await query("SELECT * FROM admins WHERE email = ?", [email.toLowerCase().trim()]);
      const admin = rows[0];
      if (!admin || !(await bcrypt.compare(password, admin.password))) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      req.session.user = { id: admin.id, role: "admin", name: admin.name };
      return res.json({ user: req.session.user });
    }
  );

  router.post(
    "/agent/login",
    [body("username").isLength({ min: 1 }), body("password").isLength({ min: 1 })],
    validate,
    async (req, res) => {
      const { username, password } = req.body;
      const rows = await query("SELECT * FROM agents WHERE username = ?", [username.trim()]);
      const agent = rows[0];
      if (!agent || !(await bcrypt.compare(password, agent.password))) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      req.session.user = { id: agent.id, role: "agent", name: agent.name, adminId: agent.admin_id };
      await query("UPDATE agents SET status = 'online' WHERE id = ?", [agent.id]);
      return res.json({ user: req.session.user });
    }
  );

  router.post("/logout", ensureAuth, async (req, res) => {
    if (req.session.user.role === "agent") {
      await query("UPDATE agents SET status = 'offline' WHERE id = ?", [req.session.user.id]);
      io.emit("agent_status_change", { agentId: req.session.user.id, status: "offline" });
    }
    req.session.destroy(() => res.json({ ok: true }));
  });

  router.get("/me", ensureAuth, (req, res) => res.json({ user: req.session.user }));
  return router;
}

module.exports = { createAuthRouter };
