import { Router } from "express";
import { pool } from "./db";

export const couriersRouter = Router();

couriersRouter.post("/couriers", async (req, res) => {
  const { name, phone, vehicle_type } = req.body;
  if (!name || !phone || !vehicle_type) {
    return res.status(400).json({ error: "Ontbrekende velden: name, phone, vehicle_type" });
  }
  const result = await pool.query(
    `INSERT INTO couriers (name, phone, vehicle_type) VALUES ($1, $2, $3) RETURNING *`,
    [name, phone, vehicle_type]
  );
  res.status(201).json(result.rows[0]);
});

couriersRouter.patch("/couriers/:id/status", async (req, res) => {
  const { status, current_latitude, current_longitude } = req.body;
  const allowed = ["offline", "online_available", "on_delivery"];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: `status moet een van deze zijn: ${allowed.join(", ")}` });
  }
  const result = await pool.query(
    `UPDATE couriers
     SET status = $1,
         current_latitude = COALESCE($2, current_latitude),
         current_longitude = COALESCE($3, current_longitude)
     WHERE id = $4
     RETURNING *`,
    [status, current_latitude ?? null, current_longitude ?? null, req.params.id]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ error: "Koerier niet gevonden" });
  }
  res.json(result.rows[0]);
});

couriersRouter.get("/couriers/:id", async (req, res) => {
  const result = await pool.query("SELECT * FROM couriers WHERE id = $1", [req.params.id]);
  if (result.rows.length === 0) {
    return res.status(404).json({ error: "Koerier niet gevonden" });
  }
  res.json(result.rows[0]);
});

couriersRouter.get("/couriers", async (_req, res) => {
  const result = await pool.query("SELECT * FROM couriers ORDER BY created_at DESC");
  res.json(result.rows);
});
