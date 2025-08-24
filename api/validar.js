import express from "express";
import sqlite3 from "better-sqlite3";

const app = express();
const db = sqlite3("./db.sqlite");

// Cria tabela se não existir
db.prepare(`CREATE TABLE IF NOT EXISTS keys (
  key TEXT PRIMARY KEY,
  expiresAt INTEGER
)`).run();

app.get("/", (req,res) => {
  const key = req.query.key;
  if(!key) return res.json({ valid: false });

  const row = db.prepare("SELECT * FROM keys WHERE key=?").get(key);

  if(!row) return res.json({ valid: false });

  if(Date.now() > row.expiresAt){
    // Key expirada → remove do DB
    db.prepare("DELETE FROM keys WHERE key=?").run(key);
    return res.json({ valid: false });
  }

  res.json({ valid: true });
});

export default app;
