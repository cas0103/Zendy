import { Router } from "express";
import { pool } from "./db";
import {
  hashPassword,
  requireAdminAuth,
  requireCourierAuth,
  signCourierToken,
  verifyPassword,
} from "./auth";

export const couriersRouter = Router();

couriersRouter.post("/couriers", async (req, res) => {
  const { name, phone, vehicle_type, password } = req.body;
  if (!name || !phone || !vehicle_type || !password) {
    return res
      .status(400)
      .json({ error: "Ontbrekende velden: name, phone, vehicle_type, password" });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Wachtwoord moet minstens 8 tekens zijn" });
  }

  const passwordHash = await hashPassword(password);
  const result = await pool.query(
    `INSERT INTO couriers (name, phone, vehicle_type, password_hash) VALUES ($1, $2, $3, $4) RETURNING *`,
    [name, phone, vehicle_type, passwordHash]
  );
  const { password_hash, ...courier } = result.rows[0];
  res.status(201).json({ ...courier, token: signCourierToken(courier.id) });
});

couriersRouter.post("/auth/courier/login", async (req, res) => {
  const { phone, password } = req.body;
  if (!phone || !password) {
    return res.status(400).json({ error: "Ontbrekende velden: phone, password" });
  }
  const result = await pool.query("SELECT * FROM couriers WHERE phone = $1", [phone]);
  if (result.rows.length === 0 || !result.rows[0].password_hash) {
    return res.status(401).json({ error: "Onjuiste inloggegevens" });
  }
  const valid = await verifyPassword(password, result.rows[0].password_hash);
  if (!valid) {
    return res.status(401).json({ error: "Onjuiste inloggegevens" });
  }
  res.json({ token: signCourierToken(result.rows[0].id) });
});

couriersRouter.patch("/couriers/me/status", requireCourierAuth, async (req, res) => {
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
     RETURNING id, name, phone, vehicle_type, status, current_latitude, current_longitude, balance, rating_average, created_at`,
    [status, current_latitude ?? null, current_longitude ?? null, req.courierId]
  );
  res.json(result.rows[0]);
});

couriersRouter.get("/couriers/me", requireCourierAuth, async (req, res) => {
  const result = await pool.query(
    "SELECT id, name, phone, vehicle_type, status, current_latitude, current_longitude, balance, rating_average, created_at FROM couriers WHERE id = $1",
    [req.courierId]
  );
  res.json(result.rows[0]);
});

couriersRouter.get("/couriers", requireAdminAuth, async (_req, res) => {
  const result = await pool.query(
    "SELECT id, name, phone, vehicle_type, status, current_latitude, current_longitude, balance, rating_average, created_at FROM couriers ORDER BY created_at DESC"
  );
  res.json(result.rows);
});
