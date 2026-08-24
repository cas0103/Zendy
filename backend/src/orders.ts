import { Router } from "express";
import { pool } from "./db";
import { applyExpiry, offerToNextCourier, startCourierSearch, logHistory } from "./orderFlow";

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

    await client.query(
      `UPDATE orders
       SET status = 'BETAALD', payment_status = 'paid', updated_at = now()
       WHERE id = $1`,
      [req.params.id]
    );
    await client.query(
      `INSERT INTO order_status_history (order_id, status, changed_by)
       VALUES ($1, 'BETAALD', 'store')`,
      [req.params.id]
    );

    let order = await startCourierSearch(client, req.params.id);
    const offer = await offerToNextCourier(client, order);
    if (!offer) {
      order = await applyExpiry(client, req.params.id);
    }

    await client.query("COMMIT");
    res.json(order);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ error: "Kon betaling niet verwerken" });
  } finally {
    client.release();
  }
});

ordersRouter.patch("/orders/:id/customer-choice", async (req, res) => {
  const { choice } = req.body;
  if (!["other_shipping", "cancel"].includes(choice)) {
    return res.status(400).json({ error: "choice moet 'other_shipping' of 'cancel' zijn" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let order = await applyExpiry(client, req.params.id);
    if (!order) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Bestelling niet gevonden" });
    }
    if (order.status !== "KEUZE_VEREIST_GEEN_KOERIER") {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error: `Deze actie is alleen mogelijk vanuit status KEUZE_VEREIST_GEEN_KOERIER, huidige status: ${order.status}`,
      });
    }

    if (choice === "other_shipping") {
      const updated = await client.query(
        `UPDATE orders SET status = 'OMGEZET_ANDERE_VERZENDING', updated_at = now() WHERE id = $1 RETURNING *`,
        [req.params.id]
      );
      order = updated.rows[0];
      await logHistory(client, req.params.id, "OMGEZET_ANDERE_VERZENDING", "customer");
    } else {
      const cancelled = await client.query(
        `UPDATE orders SET status = 'GEANNULEERD', updated_at = now() WHERE id = $1 RETURNING *`,
        [req.params.id]
      );
      order = cancelled.rows[0];
      await logHistory(client, req.params.id, "GEANNULEERD", "customer");

      const refunded = await client.query(
        `UPDATE orders SET status = 'TERUGBETAALD', payment_status = 'refunded', updated_at = now() WHERE id = $1 RETURNING *`,
        [req.params.id]
      );
      order = refunded.rows[0];
      await logHistory(client, req.params.id, "TERUGBETAALD", "system");
    }

    await client.query("COMMIT");
    res.json(order);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ error: "Kon keuze niet verwerken" });
  } finally {
    client.release();
  }
});

ordersRouter.patch("/orders/:id/picked-up", async (req, res) => {
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
    if (current.rows[0].status !== "KLAARSTAAN_VOOR_OPHALEN") {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error: `Ophalen kan alleen vanuit status KLAARSTAAN_VOOR_OPHALEN, huidige status: ${current.rows[0].status}`,
      });
    }

    await client.query(
      `UPDATE orders SET status = 'OPGEHAALD', pickup_confirmed_by_store_at = now(), updated_at = now() WHERE id = $1`,
      [req.params.id]
    );
    await logHistory(client, req.params.id, "OPGEHAALD", "store");

    const underway = await client.query(
      `UPDATE orders SET status = 'ONDERWEG_NAAR_KLANT', updated_at = now() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    await logHistory(client, req.params.id, "ONDERWEG_NAAR_KLANT", "system");

    await client.query("COMMIT");
    res.json(underway.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ error: "Kon ophalen niet bevestigen" });
  } finally {
    client.release();
  }
});

ordersRouter.patch("/orders/:id/delivered", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query("SELECT * FROM orders WHERE id = $1 FOR UPDATE", [
      req.params.id,
    ]);
    if (current.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Bestelling niet gevonden" });
    }
    if (current.rows[0].status !== "ONDERWEG_NAAR_KLANT") {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error: `Afleveren kan alleen vanuit status ONDERWEG_NAAR_KLANT, huidige status: ${current.rows[0].status}`,
      });
    }

    const delivered = await client.query(
      `UPDATE orders SET status = 'AFGELEVERD', delivered_confirmed_by_courier_at = now(), updated_at = now() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    await logHistory(client, req.params.id, "AFGELEVERD", "courier");

    await client.query(
      `UPDATE couriers SET status = 'online_available' WHERE id = $1`,
      [current.rows[0].courier_id]
    );

    await client.query("COMMIT");
    res.json(delivered.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ error: "Kon aflevering niet bevestigen" });
  } finally {
    client.release();
  }
});

ordersRouter.get("/orders", async (_req, res) => {
  const result = await pool.query("SELECT * FROM orders ORDER BY created_at DESC");
  res.json(result.rows);
});

ordersRouter.get("/orders/:id", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const order = await applyExpiry(client, req.params.id);
    await client.query("COMMIT");
    if (!order) {
      return res.status(404).json({ error: "Bestelling niet gevonden" });
    }
    res.json(order);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ error: "Kon bestelling niet ophalen" });
  } finally {
    client.release();
  }
});

ordersRouter.get("/orders/:id/history", async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM order_status_history WHERE order_id = $1 ORDER BY changed_at ASC",
    [req.params.id]
  );
  res.json(result.rows);
});
