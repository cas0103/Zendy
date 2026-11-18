/** De interne standaard: elke adapter vertaalt dit naar de eigen taal van het platform. */
export interface InventoryAdapter {
  /** true = op voorraad, false = niet op voorraad. Gooit een fout als de koppeling niet werkt. */
  isInStock(credentials: Record<string, string>, sku: string): Promise<boolean>;
}
