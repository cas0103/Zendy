import { InventoryAdapter } from "./types";

/**
 * Verwacht credentials: { siteUrl: "https://mijnwinkel.nl", consumerKey: "ck_...", consumerSecret: "cs_..." }
 * Gebruikt de WooCommerce REST API (v3).
 */
export const woocommerceAdapter: InventoryAdapter = {
  async isInStock(credentials, sku) {
    const { siteUrl, consumerKey, consumerSecret } = credentials;
    if (!siteUrl || !consumerKey || !consumerSecret) {
      throw new Error("WooCommerce-koppeling mist siteUrl, consumerKey of consumerSecret");
    }

    const url = new URL(`${siteUrl.replace(/\/$/, "")}/wp-json/wc/v3/products`);
    url.searchParams.set("sku", sku);
    url.searchParams.set("consumer_key", consumerKey);
    url.searchParams.set("consumer_secret", consumerSecret);

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`WooCommerce API-fout: ${response.status}`);
    }
    const products = (await response.json()) as any[];
    const product = products[0];
    if (!product) return false;
    return product.stock_status === "instock";
  },
};
