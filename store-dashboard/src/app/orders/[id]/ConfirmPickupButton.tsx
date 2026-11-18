"use client";

import { useState, useTransition } from "react";
import { confirmPickup } from "@/lib/actions";

export function ConfirmPickupButton({ orderId }: { orderId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div style={{ marginTop: 12 }}>
      <button
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              await confirmPickup(orderId);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Onbekende fout");
            }
          });
        }}
        disabled={isPending}
        style={{
          background: "#111",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          padding: "10px 16px",
          fontWeight: 600,
          cursor: isPending ? "default" : "pointer",
        }}
      >
        {isPending ? "Bezig..." : "Bevestig ophalen door koerier"}
      </button>
      {error && <p style={{ color: "#c33", marginTop: 8 }}>{error}</p>}
    </div>
  );
}
