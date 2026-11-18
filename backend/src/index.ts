import "dotenv/config";
import express from "express";
import cors from "cors";
import { pool } from "./db";
import { ordersRouter } from "./orders";
import { couriersRouter } from "./couriers";
import { offersRouter } from "./offers";
import { storesRouter } from "./stores";

const app = express();
const port = process.env.PORT ?? 3000;

app.use(cors());
app.use(express.json());
app.use(ordersRouter);
app.use(couriersRouter);
app.use(offersRouter);
app.use(storesRouter);

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
