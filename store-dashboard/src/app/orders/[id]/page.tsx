import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrder, getOrderHistory, getCourierLocation } from "@/lib/api";
import { ConfirmPickupButton } from "./ConfirmPickupButton";

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const order = await getOrder(params.id);
  if (!order) notFound();
  const history = await getOrderHistory(params.id);
  const location = await getCourierLocation(params.id);

  return (
    <div>
      <Link href="/" style={{ color: "#0077cc" }}>
        ← Alle bestellingen
      </Link>
      <h1 style={{ fontSize: 22, margin: "12px 0" }}>{order.external_order_ref}</h1>

      <div style={{ background: "#fff", border: "1px solid #ddd", borderRadius: 8, padding: 16, marginBottom: 24 }}>
        <p>
          <strong>Status:</strong> {order.status}
        </p>
        <p>
          <strong>Klant:</strong> {order.customer_name}
        </p>
        <p>
          <strong>Bezorgadres:</strong> {order.delivery_address}
        </p>
        <p>
          <strong>Betaalstatus:</strong> {order.payment_status}
        </p>

        {location.available && location.latitude != null && (
          <p>
            <strong>Live locatie koerier:</strong> {location.latitude.toFixed(5)},{" "}
            {location.longitude?.toFixed(5)}
          </p>
        )}

        {order.status === "KLAARSTAAN_VOOR_OPHALEN" && <ConfirmPickupButton orderId={order.id} />}
      </div>

      <h2 style={{ fontSize: 18, marginBottom: 8 }}>Statusgeschiedenis</h2>
      <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {history.map((entry) => (
          <li
            key={entry.id}
            style={{
              background: "#fff",
              border: "1px solid #ddd",
              borderRadius: 8,
              padding: "10px 16px",
              marginBottom: 6,
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>{entry.status}</span>
            <span style={{ color: "#777", fontSize: 13 }}>
              {new Date(entry.changed_at).toLocaleString("nl-NL")} — {entry.changed_by}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
