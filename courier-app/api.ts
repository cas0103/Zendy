import AsyncStorage from "@react-native-async-storage/async-storage";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";
const TOKEN_KEY = "zenddy_courier_token";

export type Courier = {
  id: string;
  name: string;
  phone: string;
  vehicle_type: string;
  status: "offline" | "online_available" | "on_delivery";
  balance: string;
  rating_average: string | null;
};

export type CourierOffer = {
  id: string;
  order_id: string;
  expires_at: string;
};

export type Order = {
  id: string;
  external_order_ref: string;
  status: string;
  delivery_address: string;
  item_description: string | null;
};

async function request(path: string, options: RequestInit = {}) {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Fout (${res.status})`);
  return body;
}

export async function login(phone: string, password: string) {
  const { token } = await request("/auth/courier/login", {
    method: "POST",
    body: JSON.stringify({ phone, password }),
  });
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function logout() {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

export async function hasToken() {
  return (await AsyncStorage.getItem(TOKEN_KEY)) !== null;
}

export async function getMe(): Promise<Courier> {
  return request("/couriers/me");
}

export async function setStatus(status: Courier["status"]): Promise<Courier> {
  return request("/couriers/me/status", {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function getMyOffers(): Promise<CourierOffer[]> {
  return request("/couriers/me/offers");
}

export async function respondToOffer(offerId: string, response: "accepted" | "declined") {
  return request(`/courier-offers/${offerId}/respond`, {
    method: "PATCH",
    body: JSON.stringify({ response }),
  });
}

export async function getOrder(orderId: string): Promise<Order> {
  return request(`/orders/${orderId}`);
}

export async function getActiveOrder(): Promise<Order | null> {
  return request("/couriers/me/active-order");
}

export async function markDelivered(orderId: string): Promise<Order> {
  return request(`/orders/${orderId}/delivered`, { method: "PATCH" });
}
