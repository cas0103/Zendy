import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { pool } from "./db";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET ontbreekt. Zet deze in je .env bestand.");
}

/** Genereert een nieuwe, willekeurige API-sleutel voor een winkel (alleen bij aanmaak te zien). */
export function generateApiKey(): string {
  return crypto.randomBytes(32).toString("hex");
}

/** API-sleutels zijn zelf al willekeurig en hoog-entropie, dus een gewone sha256-hash volstaat als opzoeksleutel. */
export function hashApiKey(apiKey: string): string {
  return crypto.createHash("sha256").update(apiKey).digest("hex");
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signCourierToken(courierId: string): string {
  return jwt.sign({ courierId }, JWT_SECRET!, { expiresIn: "12h" });
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      storeId?: string;
      courierId?: string;
    }
  }
}

/** Herkent de winkel aan de API-sleutel in de Authorization-header en zet req.storeId. */
export async function requireStoreAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization");
  const apiKey = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!apiKey) {
    return res.status(401).json({ error: "Ontbrekende API-sleutel (Authorization: Bearer <key>)" });
  }
  const result = await pool.query("SELECT id FROM stores WHERE api_key_hash = $1", [
    hashApiKey(apiKey),
  ]);
  if (result.rows.length === 0) {
    return res.status(401).json({ error: "Ongeldige API-sleutel" });
  }
  req.storeId = result.rows[0].id;
  next();
}

/** Herkent de koerier aan het JWT-token in de Authorization-header en zet req.courierId. */
export function requireCourierAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) {
    return res.status(401).json({ error: "Ontbrekend token (Authorization: Bearer <token>)" });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET!) as { courierId: string };
    req.courierId = payload.courierId;
    next();
  } catch {
    return res.status(401).json({ error: "Ongeldig of verlopen token" });
  }
}

/** Voor interne/beheer-endpoints (bijv. alle winkels of koeriers opvragen). */
export function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization");
  const key = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!process.env.ADMIN_API_KEY || key !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: "Geen toegang" });
  }
  next();
}

/**
 * Voor endpoints die zowel door de winkel (API-sleutel) als door de koerier
 * (token) bekeken mogen worden, bijv. een bestelling opvragen. Zet req.storeId
 * of req.courierId, afhankelijk van wie er inlogt; de route zelf bepaalt of
 * deze specifieke bestelling ook echt bij die winkel/koerier hoort.
 */
export async function identifyStoreOrCourier(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) {
    return res.status(401).json({ error: "Ontbrekende Authorization-header" });
  }

  const storeResult = await pool.query("SELECT id FROM stores WHERE api_key_hash = $1", [
    hashApiKey(token),
  ]);
  if (storeResult.rows.length > 0) {
    req.storeId = storeResult.rows[0].id;
    return next();
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET!) as { courierId: string };
    req.courierId = payload.courierId;
    return next();
  } catch {
    return res.status(401).json({ error: "Ongeldige API-sleutel of ongeldig token" });
  }
}
