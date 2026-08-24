import "dotenv/config";
import express from "express";
import { pool } from "./db";
import { ordersRouter } from "./orders";

const app = express();
const port = process.env.PORT ?? 3000;

app.use(express.json());
app.use(ordersRouter);

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
