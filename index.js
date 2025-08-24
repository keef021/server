const express = require("express");
const sqlite3 = require("better-sqlite3");
const crypto = require("crypto");
const path = require("path");

const app = express();
const port = process.env.PORT || 3000;

// Conecta/cria banco SQLite
const db = sqlite3("./db.sqlite");

// Cria tabela se não existir
db.prepare(`CREATE TABLE IF NOT EXISTS keys (
  key TEXT PRIMARY KEY,
  expiresAt INTEGER
)`).run();

app.use(express.json());

// Serve página HTML bonita
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "gerar.html"));
});

// Rota gerar key (só permite se vier do Monetizzy)
app.get("/api/gerar", (req, res) => {
  const referer = req.get("referer") || "";

  if(!referer.includes("liink.uk")) {
    return res.status(403).json({ error: "Acesso negado! Abra pelo link oficial." });
  }

  const key = crypto.randomBytes(6).toString("hex").toUpperCase();
  const expiresAt = Date.now() + 24*60*60*1000; // 24h
  db.prepare("INSERT INTO keys (key, expiresAt) VALUES (?, ?)").run(key, expiresAt);

  res.json({ key, expiresAt });
});

// Rota validar key
app.get("/api/validar", (req, res) => {
  const key = req.query.key;
  if(!key) return res.json({ valid: false });

  const row = db.prepare("SELECT * FROM keys WHERE key=?").get(key);
  if(!row) return res.json({ valid: false });

  if(Date.now() > row.expiresAt){
    db.prepare("DELETE FROM keys WHERE key=?").run(key);
    return res.json({ valid: false });
  }

  res.json({ valid: true });
});

// Start do servidor
app.listen(port, () => console.log(`Servidor rodando na porta ${port}`));
