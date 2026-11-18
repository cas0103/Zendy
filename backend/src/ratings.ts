import { Router } from "express";
import { pool } from "./db";
import { requireStoreAuth } from "./auth";

export const ratingsRouter = Router();

ratingsRouter.post("/orders/:id/rating", requireStoreAuth, async (req, res) => {
  const { score, comment } = req.body;
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    return res.status(400).json({ error: "score moet een geheel getal tussen 1 en 5 zijn" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const order = await client.query("SELECT * FROM orders WHERE id = $1 FOR UPDATE", [
      req.params.id,
    ]);
    if (order.rows.length === 0 || order.rows[0].store_id !== req.storeId) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Bestelling niet gevonden" });
    }
    if (order.rows[0].status !== "AFGELEVERD") {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Alleen afgeleverde bestellingen kunnen beoordeeld worden" });
    }
    if (!order.rows[0].courier_id) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Geen koerier gekoppeld aan deze bestelling" });
    }

    const existing = await client.query(
      "SELECT id FROM ratings WHERE order_id = $1 AND rated_by = 'store'",
      [req.params.id]
    );
    if (existing.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Deze bestelling is al beoordeeld" });
    }

    await client.query(
      `INSERT INTO ratings (order_id, rated_by, courier_id, score, comment)
       VALUES ($1, 'store', $2, $3, $4)`,
      [req.params.id, order.rows[0].courier_id, score, comment ?? null]
    );

    const average = await client.query(
      "SELECT AVG(score)::numeric(3,2) AS avg FROM ratings WHERE courier_id = $1",
      [order.rows[0].courier_id]
    );
    await client.query("UPDATE couriers SET rating_average = $1 WHERE id = $2", [
      average.rows[0].avg,
      order.rows[0].courier_id,
    ]);

    await client.query("COMMIT");
    res.status(201).json({ ok: true, courier_rating_average: average.rows[0].avg });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ error: "Kon beoordeling niet opslaan" });
  } finally {
    client.release();
  }
});
