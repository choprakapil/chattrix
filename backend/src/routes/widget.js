const express = require("express");
const { query } = require("../db");

function createWidgetRouter() {
  const router = express.Router();
  router.get("/property/:propertyId", async (req, res) => {
    const rows = await query(
      `SELECT p.id, p.name, pa.custom_greeting
       FROM properties p
       LEFT JOIN property_agents pa ON pa.property_id = p.id AND pa.status='accepted'
       WHERE p.property_id = ?
       LIMIT 1`,
      [req.params.propertyId]
    );
    if (!rows[0]) return res.status(404).json({ error: "Property not found" });
    res.json(rows[0]);
  });
  return router;
}

module.exports = { createWidgetRouter };
