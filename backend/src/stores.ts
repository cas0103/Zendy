import { Router } from "express";
import { pool } from "./db";

export const storesRouter = Router();

storesRouter.post("/stores", async (req, res) => {
  const { name, address, latitude, longitude, contact_email, contact_phone, webshop_platform } =
    req.body;
  const required = { name, address, latitude, longitude, contact_email, contact_phone, webshop_platform };
  const missing = Object.entries(required)
    .filter(([, value]) => value === undefined || value === null)
    .map(([key]) => key);
  if (missing.length > 0) {
    return res.status(400).json({ error: `Ontbrekende velden: ${missing.join(", ")}` });
  }

  const result = await pool.query(
    `INSERT INTO stores (name, address, latitude, longitude, contact_email, contact_phone, webshop_platform)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [name, address, latitude, longitude, contact_email, contact_phone, webshop_platform]
  );
  res.status(201).json(result.rows[0]);
});

storesRouter.get("/stores", async (_req, res) => {
  const result = await pool.query("SELECT * FROM stores ORDER BY created_at DESC");
  res.json(result.rows);
});

storesRouter.get("/stores/:id", async (req, res) => {
  const result = await pool.query("SELECT * FROM stores WHERE id = $1", [req.params.id]);
  if (result.rows.length === 0) {
    return res.status(404).json({ error: "Winkel niet gevonden" });
  }
  res.json(result.rows[0]);
});
