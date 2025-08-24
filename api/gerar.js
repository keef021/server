import express from "express";
import sqlite3 from "better-sqlite3";
import crypto from "crypto";

const app = express();
const db = sqlite3("./db.sqlite");

// Cria tabela se não existir
db.prepare(`CREATE TABLE IF NOT EXISTS keys (
  key TEXT PRIMARY KEY,
  expiresAt INTEGER
)`).run();

app.get("/", (req,res) => {
  // Gera key
  const key = crypto.randomBytes(6).toString("hex").toUpperCase();
  const expiresAt = Date.now() + 24*60*60*1000; // 24h

  // Salva no DB
  db.prepare("INSERT INTO keys (key, expiresAt) VALUES (?, ?)").run(key, expiresAt);

  res.json({ key, expiresAt });
});

export default app;
