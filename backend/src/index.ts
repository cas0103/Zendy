import "dotenv/config";
import express from "express";
import cors from "cors";
import { pool } from "./db";
import { ordersRouter } from "./orders";
import { couriersRouter } from "./couriers";
import { offersRouter } from "./offers";
import { storesRouter } from "./stores";
import { payoutsRouter } from "./payouts";
import { ratingsRouter } from "./ratings";
import { inventoryIntegrationsRouter } from "./inventoryIntegrations";

const app = express();
const port = process.env.PORT ?? 3000;

const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "http://localhost:3000,http://localhost:3001")
  .split(",")
  .map((origin) => origin.trim());

app.use(
  cors({
    origin(origin, callback) {
      // Geen origin = aanroep zonder browser (bijv. de mobiele app of curl) — altijd toestaan.
      callback(null, !origin || allowedOrigins.includes(origin));
    },
  })
);
app.use(express.json());
app.use(ordersRouter);
app.use(couriersRouter);
app.use(offersRouter);
app.use(storesRouter);
app.use(payoutsRouter);
app.use(ratingsRouter);
app.use(inventoryIntegrationsRouter);

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", database: "connected" });
  } catch (error) {
    res.status(503).json({ status: "error", database: "unreachable" });
  }
});

app.listen(port, () => {
  console.log(`Zenddy backend luistert op http://localhost:${port}`);
});
