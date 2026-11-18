import { Router } from "express";
import { pool } from "./db";
import { generateApiKey, hashApiKey, requireAdminAuth, requireStoreAuth } from "./auth";

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

  const apiKey = generateApiKey();
  const result = await pool.query(
    `INSERT INTO stores (name, address, latitude, longitude, contact_email, contact_phone, webshop_platform, api_key_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [name, address, latitude, longitude, contact_email, contact_phone, webshop_platform, hashApiKey(apiKey)]
  );

  const { api_key_hash, ...store } = result.rows[0];
  res.status(201).json({
    ...store,
    api_key: apiKey,
    api_key_notice:
      "Bewaar deze API-sleutel goed, hij wordt maar één keer getoond en is nodig voor alle verdere aanroepen namens deze winkel.",
  });
});

storesRouter.get("/stores", requireAdminAuth, async (_req, res) => {
  const result = await pool.query(
    "SELECT id, name, address, latitude, longitude, contact_email, contact_phone, is_active, webshop_platform, created_at FROM stores ORDER BY created_at DESC"
  );
  res.json(result.rows);
});

storesRouter.get("/stores/me", requireStoreAuth, async (req, res) => {
  const result = await pool.query(
    "SELECT id, name, address, latitude, longitude, contact_email, contact_phone, is_active, webshop_platform, created_at FROM stores WHERE id = $1",
    [req.storeId]
  );
  res.json(result.rows[0]);
});
