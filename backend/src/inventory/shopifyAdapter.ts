import { InventoryAdapter } from "./types";

/**
 * Verwacht credentials: { shopDomain: "mijnwinkel.myshopify.com", accessToken: "shpat_..." }
 * Gebruikt de Shopify Admin GraphQL API (REST ondersteunt geen zoeken op SKU rechtstreeks).
 */
export const shopifyAdapter: InventoryAdapter = {
  async isInStock(credentials, sku) {
    const { shopDomain, accessToken } = credentials;
    if (!shopDomain || !accessToken) {
      throw new Error("Shopify-koppeling mist shopDomain of accessToken");
    }

    const response = await fetch(`https://${shopDomain}/admin/api/2024-01/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({
        query: `query($query: String!) {
          productVariants(first: 1, query: $query) {
            edges { node { inventoryQuantity } }
          }
        }`,
        variables: { query: `sku:${sku}` },
      }),
    });

    if (!response.ok) {
      throw new Error(`Shopify API-fout: ${response.status}`);
    }
    const body: any = await response.json();
    const edge = body?.data?.productVariants?.edges?.[0];
    if (!edge) return false;
    return (edge.node.inventoryQuantity ?? 0) > 0;
  },
};
