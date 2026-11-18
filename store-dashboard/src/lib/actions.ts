"use server";

import { revalidatePath } from "next/cache";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
const STORE_API_KEY = process.env.STORE_API_KEY ?? "";

export async function confirmPickup(orderId: string) {
  const res = await fetch(`${API_URL}/orders/${orderId}/picked-up`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${STORE_API_KEY}` },
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error ?? "Kon ophalen niet bevestigen");
  }
  revalidatePath(`/orders/${orderId}`);
  return body;
}
