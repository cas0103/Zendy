import Link from "next/link";
import { getOrders, type Order } from "@/lib/api";

const STATUS_COLORS: Record<string, string> = {
  AANGEMAAKT: "#999",
  BETAALD: "#0077cc",
  ZOEKEN_KOERIER: "#e6a700",
  KOERIER_TOEGEWEZEN: "#e6a700",
  KLAARSTAAN_VOOR_OPHALEN: "#e6a700",
  OPGEHAALD: "#7a3fe0",
  ONDERWEG_NAAR_KLANT: "#7a3fe0",
  AFGELEVERD: "#1c8a3d",
  KEUZE_VEREIST_GEEN_KOERIER: "#cc3300",
  OMGEZET_ANDERE_VERZENDING: "#666",
  GEANNULEERD: "#cc3300",
  TERUGBETAALD: "#666",
};

export default async function OrdersPage() {
  let orders: Order[];
  let error: string | null = null;
  try {
    orders = await getOrders();
  } catch (e) {
    error = "Kan de backend niet bereiken. Draait de server op de juiste URL?";
    orders = [];
  }

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>Bestellingen</h1>
      {error && (
        <p style={{ background: "#fee", border: "1px solid #c33", padding: 12, borderRadius: 6 }}>
          {error}
        </p>
      )}
      {!error && orders.length === 0 && <p>Nog geen bestellingen.</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {orders.map((order) => (
          <Link
            key={order.id}
            href={`/orders/${order.id}`}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "#fff",
              border: "1px solid #ddd",
              borderRadius: 8,
              padding: "12px 16px",
              textDecoration: "none",
              color: "#111",
            }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>{order.external_order_ref}</div>
              <div style={{ fontSize: 14, color: "#555" }}>
                {order.customer_name} — {order.delivery_address}
              </div>
            </div>
            <span
              style={{
                background: STATUS_COLORS[order.status] ?? "#999",
                color: "#fff",
                fontSize: 12,
                fontWeight: 600,
                padding: "4px 10px",
                borderRadius: 999,
              }}
            >
              {order.status}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
