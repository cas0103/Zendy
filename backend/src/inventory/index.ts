import { InventoryAdapter } from "./types";
import { shopifyAdapter } from "./shopifyAdapter";
import { woocommerceAdapter } from "./woocommerceAdapter";
import { mockAdapter } from "./mockAdapter";

export function getInventoryAdapter(provider: string): InventoryAdapter {
  switch (provider) {
    case "shopify":
      return shopifyAdapter;
    case "woocommerce":
      return woocommerceAdapter;
    default:
      return mockAdapter;
  }
}
