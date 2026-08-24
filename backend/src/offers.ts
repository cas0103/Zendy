import { Router } from "express";
import { pool } from "./db";
import { applyExpiry, offerToNextCourier, logHistory } from "./orderFlow";

export const offersRouter = Router();

offersRouter.patch("/courier-offers/:id/respond", async (req, res) => {
  const { response } = req.body;
  if (!["accepted", "declined"].includes(response)) {
    return res.status(400).json({ error: "response moet 'accepted' of 'declined' zijn" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const offerResult = await client.query("SELECT * FROM courier_offers WHERE id = $1 FOR UPDATE", [
      req.params.id,
    ]);
    if (offerResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Aanbod niet gevonden" });
    }
    const offer = offerResult.rows[0];

    let order = await applyExpiry(client, offer.order_id);
    if (offer.response !== "pending" || order.status !== "ZOEKEN_KOERIER") {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Dit aanbod is niet meer geldig" });
    }

    if (response === "declined") {
      await client.query(
        `UPDATE courier_offers SET response = 'declined', responded_at = now() WHERE id = $1`,
        [req.params.id]
      );

      const nextOffer = await offerToNextCourier(client, order);
      if (!nextOffer) {
        order = await applyExpiry(client, offer.order_id);
        // Geen koeriers meer over: laat de klok gewoon verlopen i.p.v. direct
        // te forceren, zodat de 5-minutenregel uit de flow gerespecteerd blijft.
      }

      await client.query("COMMIT");
      return res.json({ offer_response: "declined", next_offer: nextOffer ?? null, order });
    }

    await client.query(
      `UPDATE courier_offers SET response = 'accepted', responded_at = now() WHERE id = $1`,
      [req.params.id]
    );
    await client.query(
      `UPDATE courier_offers SET response = 'expired', responded_at = now()
       WHERE order_id = $1 AND id != $2 AND response = 'pending'`,
      [offer.order_id, req.params.id]
    );

    await client.query(`UPDATE couriers SET status = 'on_delivery' WHERE id = $1`, [offer.courier_id]);

    await client.query(
      `UPDATE orders SET courier_id = $1, status = 'KOERIER_TOEGEWEZEN', updated_at = now() WHERE id = $2`,
      [offer.courier_id, offer.order_id]
    );
    await logHistory(client, offer.order_id, "KOERIER_TOEGEWEZEN", "courier");

    const ready = await client.query(
      `UPDATE orders SET status = 'KLAARSTAAN_VOOR_OPHALEN', updated_at = now() WHERE id = $1 RETURNING *`,
      [offer.order_id]
    );
    await logHistory(client, offer.order_id, "KLAARSTAAN_VOOR_OPHALEN", "system");

    await client.query("COMMIT");
    res.json(ready.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ error: "Kon aanbod niet verwerken" });
  } finally {
    client.release();
  }
});

offersRouter.get("/orders/:orderId/offers", async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM courier_offers WHERE order_id = $1 ORDER BY offered_at ASC",
    [req.params.orderId]
  );
  res.json(result.rows);
});
