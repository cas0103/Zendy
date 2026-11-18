import { Router } from "express";
import { pool } from "./db";
import { requireAdminAuth, requireCourierAuth } from "./auth";

export const payoutsRouter = Router();

payoutsRouter.get("/couriers/me/payouts", requireCourierAuth, async (req, res) => {
  const result = await pool.query("SELECT * FROM payouts WHERE courier_id = $1 ORDER BY id DESC", [
    req.courierId,
  ]);
  res.json(result.rows);
});

payoutsRouter.get("/payouts", requireAdminAuth, async (_req, res) => {
  const result = await pool.query(
    `SELECT p.*, c.name AS courier_name FROM payouts p JOIN couriers c ON c.id = p.courier_id
     ORDER BY p.id DESC`
  );
  res.json(result.rows);
});

payoutsRouter.patch("/payouts/:id/mark-paid", requireAdminAuth, async (req, res) => {
  const result = await pool.query(
    `UPDATE payouts SET status = 'paid', paid_at = now() WHERE id = $1 AND status = 'pending' RETURNING *`,
    [req.params.id]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ error: "Uitbetaling niet gevonden of al betaald" });
  }
  res.json(result.rows[0]);
});
