const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const PORT = Number(process.env.PORT || 3001);
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";
const WIDGET_CDN_URL = process.env.WIDGET_CDN_URL; // Let it be null if not in env

module.exports = { PORT, CORS_ORIGIN, WIDGET_CDN_URL };
