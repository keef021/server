import { Database } from "@replit/database";
import { randomBytes } from "crypto";

const db = new Database(process.env.REPLIT_DB_URL); // 🔑 URL do Replit DB no .env

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  // Gerar uma key única
  const key = randomBytes(16).toString("hex");
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // expira em 24h

  // Salvar no Replit DB
  await db.set(key, { valid: true, expiresAt });

  return res.status(200).json({ key, expiresAt });
}
