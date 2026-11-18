import { Router } from "express";
import { pool } from "./db";
import { requireStoreAuth } from "./auth";
import { encrypt, decrypt } from "./encryption";
import { getInventoryAdapter } from "./inventory";

export const inventoryIntegrationsRouter = Router();

inventoryIntegrationsRouter.post(
  "/stores/me/inventory-integration",
  requireStoreAuth,
  async (req, res) => {
    const { provider, credentials } = req.body;
    const allowed = ["shopify", "woocommerce", "other"];
    if (!allowed.includes(provider) || typeof credentials !== "object" || credentials === null) {
      return res
        .status(400)
        .json({ error: `provider moet een van deze zijn: ${allowed.join(", ")}, en credentials een object` });
    }

    const existing = await pool.query(
      "SELECT id FROM store_inventory_integrations WHERE store_id = $1",
      [req.storeId]
    );
    const encrypted = encrypt(JSON.stringify(credentials));

    if (existing.rows.length > 0) {
      const result = await pool.query(
        `UPDATE store_inventory_integrations
         SET provider = $1, api_credentials = $2, status = 'connected', last_synced_at = NULL
         WHERE store_id = $3
         RETURNING id, store_id, provider, status, last_synced_at`,
        [provider, encrypted, req.storeId]
      );
      return res.json(result.rows[0]);
    }

    const result = await pool.query(
      `INSERT INTO store_inventory_integrations (store_id, provider, api_credentials, status)
       VALUES ($1, $2, $3, 'connected')
       RETURNING id, store_id, provider, status, last_synced_at`,
      [req.storeId, provider, encrypted]
    );
    res.status(201).json(result.rows[0]);
  }
);

inventoryIntegrationsRouter.get(
  "/stores/me/inventory-integration",
  requireStoreAuth,
  async (req, res) => {
    const result = await pool.query(
      "SELECT id, store_id, provider, status, last_synced_at FROM store_inventory_integrations WHERE store_id = $1",
      [req.storeId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Geen voorraadkoppeling ingesteld" });
    }
    res.json(result.rows[0]);
  }
);

/** Dit roept de webshop-plugin aan bij checkout om te bepalen of Zenddy getoond mag worden. */
inventoryIntegrationsRouter.get("/stores/me/inventory-check", requireStoreAuth, async (req, res) => {
  const { sku } = req.query;
  if (typeof sku !== "string" || sku.length === 0) {
    return res.status(400).json({ error: "Query-parameter sku is verplicht" });
  }

  const integration = await pool.query(
    "SELECT * FROM store_inventory_integrations WHERE store_id = $1",
    [req.storeId]
  );
  if (integration.rows.length === 0) {
    return res.status(404).json({ error: "Geen voorraadkoppeling ingesteld" });
  }
  const row = integration.rows[0];

  try {
    const credentials = JSON.parse(decrypt(row.api_credentials));
    const adapter = getInventoryAdapter(row.provider);
    const inStock = await adapter.isInStock(credentials, sku);

    await pool.query(
      "UPDATE store_inventory_integrations SET status = 'connected', last_synced_at = now() WHERE id = $1",
      [row.id]
    );
    res.json({ sku, in_stock: inStock });
  } catch (error) {
    await pool.query("UPDATE store_inventory_integrations SET status = 'error' WHERE id = $1", [
      row.id,
    ]);
    console.error(error);
    res.status(502).json({ error: "Kon voorraad niet controleren bij het platform" });
  }
});
