import express from "express";
import sqlite3 from "better-sqlite3";
import crypto from "crypto";

const app = express();
const port = process.env.PORT || 3000;

// Conecta ou cria banco SQLite
const db = sqlite3("./db.sqlite");

// Cria tabela se não existir
db.prepare(`CREATE TABLE IF NOT EXISTS keys (
  key TEXT PRIMARY KEY,
  expiresAt INTEGER
)`).run();

app.use(express.json());

// Rota para gerar key
app.get("/api/gerar", (req, res) => {
  const key = crypto.randomBytes(6).toString("hex").toUpperCase();
  const expiresAt = Date.now() + 24*60*60*1000; // 24h

  db.prepare("INSERT INTO keys (key, expiresAt) VALUES (?, ?)").run(key, expiresAt);

  res.json({ key, expiresAt });
});

// Rota para validar key
app.get("/api/validar", (req, res) => {
  const key = req.query.key;
  if (!key) return res.json({ valid: false });

  const row = db.prepare("SELECT * FROM keys WHERE key=?").get(key);

  if (!row) return res.json({ valid: false });

  if (Date.now() > row.expiresAt) {
    // key expirada → remove do DB
    db.prepare("DELETE FROM keys WHERE key=?").run(key);
    return res.json({ valid: false });
  }

  res.json({ valid: true });
});

// Start do servidor
app.listen(port, () => console.log(`Servidor rodando na porta ${port}`));
