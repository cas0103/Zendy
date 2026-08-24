import { Router } from "express";
import { pool } from "./db";

export const ordersRouter = Router();

ordersRouter.post("/orders", async (req, res) => {
  const {
    store_id,
    external_order_ref,
    customer_name,
    customer_phone,
    delivery_address,
    delivery_latitude,
    delivery_longitude,
    item_description,
    item_value,
    delivery_fee_paid_by_customer,
    store_fee,
  } = req.body;

  const requiredFields = {
    store_id,
    external_order_ref,
    customer_name,
    customer_phone,
    delivery_address,
    delivery_latitude,
    delivery_longitude,
    delivery_fee_paid_by_customer,
    store_fee,
  };
  const missing = Object.entries(requiredFields)
    .filter(([, value]) => value === undefined || value === null)
    .map(([key]) => key);
  if (missing.length > 0) {
    return res.status(400).json({ error: `Ontbrekende velden: ${missing.join(", ")}` });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const orderResult = await client.query(
      `INSERT INTO orders (
        store_id, external_order_ref, status, customer_name, customer_phone,
        delivery_address, delivery_latitude, delivery_longitude,
        item_description, item_value, delivery_fee_paid_by_customer, store_fee,
        payment_status
      ) VALUES ($1, $2, 'AANGEMAAKT', $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending')
      RETURNING *`,
      [
        store_id,
        external_order_ref,
        customer_name,
        customer_phone,
        delivery_address,
        delivery_latitude,
        delivery_longitude,
        item_description ?? null,
        item_value ?? null,
        delivery_fee_paid_by_customer,
        store_fee,
      ]
    );
    const order = orderResult.rows[0];

    await client.query(
      `INSERT INTO order_status_history (order_id, status, changed_by)
       VALUES ($1, 'AANGEMAAKT', 'store')`,
      [order.id]
    );

    await client.query("COMMIT");
    res.status(201).json(order);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ error: "Kon bestelling niet aanmaken" });
  } finally {
    client.release();
  }
});

ordersRouter.patch("/orders/:id/pay", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const current = await client.query("SELECT status FROM orders WHERE id = $1 FOR UPDATE", [
      req.params.id,
    ]);
    if (current.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Bestelling niet gevonden" });
    }
    if (current.rows[0].status !== "AANGEMAAKT") {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error: `Bestelling kan niet betaald worden vanuit status ${current.rows[0].status}`,
      });
    }

    const orderResult = await client.query(
      `UPDATE orders
       SET status = 'BETAALD', payment_status = 'paid', updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [req.params.id]
    );

    await client.query(
      `INSERT INTO order_status_history (order_id, status, changed_by)
       VALUES ($1, 'BETAALD', 'store')`,
      [req.params.id]
    );

    await client.query("COMMIT");
    res.json(orderResult.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ error: "Kon betaling niet verwerken" });
  } finally {
    client.release();
  }
});

ordersRouter.get("/orders/:id", async (req, res) => {
  const result = await pool.query("SELECT * FROM orders WHERE id = $1", [req.params.id]);
  if (result.rows.length === 0) {
    return res.status(404).json({ error: "Bestelling niet gevonden" });
  }
  res.json(result.rows[0]);
});
