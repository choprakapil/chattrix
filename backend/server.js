const http = require("http");
const express = require("express");
const { Server } = require("socket.io");
const { PORT, CORS_ORIGIN, WIDGET_CDN_URL } = require("./src/config/env");
const { createApp } = require("./src/app");
const { onlineAgents } = require("./src/realtime/state");
const { registerSocketHandlers } = require("./src/socket");

// Create the Socket.io server first (we need it for createApp)
// We'll attach it to the HTTP server later
const io = new Server({
  path: "/socket.io",
  cors: {
    origin: function (origin, callback) {
      // Allow if origin matches localhost, is in allowed list, or is the production domain
      if (!origin || 
          origin.startsWith("http://localhost:") || 
          origin.startsWith("http://127.0.0.1:") ||
          origin === "https://knyxsports.com" ||
          origin.endsWith(".knyxsports.com")) {
        callback(null, true);
      } else {
        console.warn("[Socket CORS] Blocked origin:", origin);
        callback(null, false);
      }
    },
    credentials: true
  }
});

const app = createApp({ io, onlineAgents, WIDGET_CDN_URL });
const server = http.createServer(app);
io.attach(server);

registerSocketHandlers(io, onlineAgents);

server.listen(PORT, () => {
  console.log(`Live chat backend running on :${PORT}`);
});
