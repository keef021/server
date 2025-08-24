import { Database } from "@replit/database";

const db = new Database(process.env.REPLIT_DB_URL);

export default async function handler(req, res) {
  const { key } = req.query;

  if (!key) {
    return res.status(400).json({ valid: false, error: "Key não fornecida" });
  }

  const data = await db.get(key);

  if (!data) {
    return res.status(200).json({ valid: false });
  }

  if (Date.now() > data.expiresAt) {
    // expirou → remove do banco
    await db.delete(key);
    return res.status(200).json({ valid: false, error: "Key expirada" });
  }

  return res.status(200).json({ valid: true });
}
