const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
const STORE_API_KEY = process.env.STORE_API_KEY ?? "";

const authHeaders = { Authorization: `Bearer ${STORE_API_KEY}` };

export type Order = {
  id: string;
  external_order_ref: string;
  status: string;
  customer_name: string;
  delivery_address: string;
  payment_status: string;
  created_at: string;
  updated_at: string;
};

export type OrderHistoryEntry = {
  id: string;
  status: string;
  changed_by: string;
  changed_at: string;
};

export async function getOrders(): Promise<Order[]> {
  const res = await fetch(`${API_URL}/orders`, { cache: "no-store", headers: authHeaders });
  if (!res.ok) throw new Error("Kon bestellingen niet ophalen");
  return res.json();
}

export async function getOrder(id: string): Promise<Order | null> {
  const res = await fetch(`${API_URL}/orders/${id}`, { cache: "no-store", headers: authHeaders });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Kon bestelling niet ophalen");
  return res.json();
}

export async function getOrderHistory(id: string): Promise<OrderHistoryEntry[]> {
  const res = await fetch(`${API_URL}/orders/${id}/history`, {
    cache: "no-store",
    headers: authHeaders,
  });
  if (!res.ok) throw new Error("Kon geschiedenis niet ophalen");
  return res.json();
}

export type CourierLocation =
  | { available: false }
  | { available: true; latitude: number | null; longitude: number | null; order_status: string };

export async function getCourierLocation(id: string): Promise<CourierLocation> {
  const res = await fetch(`${API_URL}/orders/${id}/courier-location`, {
    cache: "no-store",
    headers: authHeaders,
  });
  if (!res.ok) throw new Error("Kon locatie niet ophalen");
  return res.json();
}
