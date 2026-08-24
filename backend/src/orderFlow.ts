import { PoolClient } from "pg";

const SEARCH_TIMEOUT_MINUTES = 5;
const CUSTOMER_CHOICE_MINUTES = 5;

async function logHistory(
  client: PoolClient,
  orderId: string,
  status: string,
  changedBy: "system" | "store" | "courier" | "customer"
) {
  await client.query(
    `INSERT INTO order_status_history (order_id, status, changed_by) VALUES ($1, $2, $3)`,
    [orderId, status, changedBy]
  );
}

/**
 * Past verlopen timers toe (koerier-zoektijd, klant-bedenktijd) voordat een
 * bestelling wordt teruggegeven of bewerkt. Zo hebben we geen aparte
 * achtergrondtaak nodig om deze klok te bewaken.
 */
export async function applyExpiry(client: PoolClient, orderId: string) {
  const { rows } = await client.query("SELECT * FROM orders WHERE id = $1 FOR UPDATE", [orderId]);
  if (rows.length === 0) return null;
  let order = rows[0];

  if (order.status === "ZOEKEN_KOERIER" && new Date(order.courier_search_expires_at) < new Date()) {
    await client.query(
      `UPDATE courier_offers SET response = 'expired', responded_at = now()
       WHERE order_id = $1 AND response = 'pending'`,
      [orderId]
    );
    const expiresAt = new Date(Date.now() + CUSTOMER_CHOICE_MINUTES * 60 * 1000);
    const updated = await client.query(
      `UPDATE orders SET status = 'KEUZE_VEREIST_GEEN_KOERIER', customer_choice_expires_at = $2, updated_at = now()
       WHERE id = $1 RETURNING *`,
      [orderId, expiresAt]
    );
    order = updated.rows[0];
    await logHistory(client, orderId, "KEUZE_VEREIST_GEEN_KOERIER", "system");
  }

  if (
    order.status === "KEUZE_VEREIST_GEEN_KOERIER" &&
    new Date(order.customer_choice_expires_at) < new Date()
  ) {
    const updated = await client.query(
      `UPDATE orders SET status = 'GEANNULEERD', updated_at = now() WHERE id = $1 RETURNING *`,
      [orderId]
    );
    order = updated.rows[0];
    await logHistory(client, orderId, "GEANNULEERD", "system");

    const refunded = await client.query(
      `UPDATE orders SET status = 'TERUGBETAALD', payment_status = 'refunded', updated_at = now()
       WHERE id = $1 RETURNING *`,
      [orderId]
    );
    order = refunded.rows[0];
    await logHistory(client, orderId, "TERUGBETAALD", "system");
  }

  return order;
}

export async function startCourierSearch(client: PoolClient, orderId: string) {
  const expiresAt = new Date(Date.now() + SEARCH_TIMEOUT_MINUTES * 60 * 1000);
  const updated = await client.query(
    `UPDATE orders
     SET status = 'ZOEKEN_KOERIER', courier_search_started_at = now(), courier_search_expires_at = $2, updated_at = now()
     WHERE id = $1 RETURNING *`,
    [orderId, expiresAt]
  );
  await logHistory(client, orderId, "ZOEKEN_KOERIER", "system");
  return updated.rows[0];
}

/** Zoekt de dichtstbijzijnde beschikbare koerier zonder al een openstaand aanbod voor deze bestelling. */
export async function offerToNextCourier(client: PoolClient, order: any) {
  const candidate = await client.query(
    `SELECT c.* FROM couriers c
     WHERE c.status = 'online_available'
       AND c.id NOT IN (
         SELECT courier_id FROM courier_offers WHERE order_id = $1
       )
     ORDER BY (
       (c.current_latitude - $2)^2 + (c.current_longitude - $3)^2
     ) ASC NULLS LAST
     LIMIT 1
     FOR UPDATE`,
    [order.id, order.delivery_latitude, order.delivery_longitude]
  );
  if (candidate.rows.length === 0) return null;

  const courier = candidate.rows[0];
  const expiresAt = order.courier_search_expires_at;
  const offer = await client.query(
    `INSERT INTO courier_offers (order_id, courier_id, expires_at) VALUES ($1, $2, $3) RETURNING *`,
    [order.id, courier.id, expiresAt]
  );
  return offer.rows[0];
}

export { logHistory };
