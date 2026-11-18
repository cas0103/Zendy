import { InventoryAdapter } from "./types";

/**
 * Voor testen zonder echte webshop: credentials = { mockStock: "true" | "false" }.
 * Ook wat gebruikt wordt als provider "other" is gekozen.
 */
export const mockAdapter: InventoryAdapter = {
  async isInStock(credentials) {
    return credentials.mockStock === "true";
  },
};
