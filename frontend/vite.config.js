const { defineConfig } = require("vite");
const react = require("@vitejs/plugin-react");

module.exports = defineConfig(({ mode }) => ({
  base: mode === "production" ? "/chat/dashboard/" : "/",
  plugins: [react()],
  server: {
    port: 3000,
  },
}));
