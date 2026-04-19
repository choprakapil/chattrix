const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const session = require("express-session");
const rateLimit = require("express-rate-limit");
const { isProd } = require("./db");
const { CORS_ORIGIN } = require("./config/env");
const { createAuthRouter } = require("./routes/auth");
const { createAdminRouter } = require("./routes/admin");
const { createAgentRouter } = require("./routes/agent");
const { createChatRouter } = require("./routes/chat");
const { createWidgetRouter } = require("./routes/widget");

function createApp({ io, onlineAgents, WIDGET_CDN_URL }) {
  const app = express();

  // ── Dynamic CORS Configuration ──
  const allowedOrigins = [
    CORS_ORIGIN, 
    "https://knyxsports.com", 
    "http://localhost:4000", 
    "http://127.0.0.1:4000"
  ];
  
  app.use(cors({
    origin: function (origin, callback) {
      console.log("[CORS Check] Origin:", origin);
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);
      
      const isAllowed = allowedOrigins.indexOf(origin) !== -1 || origin.startsWith("http://localhost:");
      console.log("[CORS Check] Allowed:", isAllowed);
      
      if (isAllowed) {
        callback(null, origin); // Return the origin itself to be used as Access-Control-Allow-Origin
      } else {
        console.warn("[CORS] Blocked origin:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true
  }));

  app.set("trust proxy", 1);
  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false }));
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "dev_secret_change_me",
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? "lax" : "lax",
        maxAge: 1000 * 60 * 60 * 12,
      },
    })
  );

  const publicLimiter = rateLimit({ windowMs: 60 * 1000, max: 120 });
  const authLimiter = rateLimit({ windowMs: 1 * 60 * 1000, max: 1000 }); // Extremely relaxed for dev
  app.use("/api/chat", publicLimiter);
  app.use("/api/widget", publicLimiter);
  app.use("/api/auth", authLimiter);

  app.get("/health", (_, res) => res.json({ ok: true }));
  app.use(express.static(path.join(__dirname, "../public")));
  app.use("/api/auth", createAuthRouter({ io }));
  app.use("/api/admin", createAdminRouter({ io, onlineAgents, WIDGET_CDN_URL }));
  app.use("/api/agent", createAgentRouter({ io }));
  app.use("/api/chat", createChatRouter({ io }));
  app.use("/api/widget", createWidgetRouter());
  
  // Dashboard SPA catch-all
  app.get(/\/dashboard/, (req, res) => {
    res.sendFile(path.join(__dirname, "../public/dashboard/index.html"));
  });

  app.use((err, _req, res, _next) => {
    io.emit("server_error", { message: err.message || "Server error" });
    return res.status(500).json({ error: "Server error" });
  });
  return app;
}

module.exports = { createApp };
