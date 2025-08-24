import express from "express";
import sqlite3 from "better-sqlite3";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const port = process.env.PORT || 3000;
const db = sqlite3("./db.sqlite");

// Caminho para servir gerar.html
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

db.prepare(`CREATE TABLE IF NOT EXISTS keys (
  key TEXT PRIMARY KEY,
  expiresAt INTEGER
)`).run();

// Função gerar Key
function generateKey() {
  return crypto.randomBytes(6).toString("hex").toUpperCase();
}

// Middleware para checar Referer (Liink)
function checkReferer(req,res,next){
    const referer = req.get("Referer") || "";
    if(!referer.includes("shrt.liink.uk")){
        return res.json({error:"Vá pelo site oficial"});
    }
    next();
}

// Servir gerar.html na raiz
app.get("/", (req,res)=>{
    res.sendFile(path.join(__dirname,"gerar.html"));
});

// Rota gerar Key
app.get("/api/gerar", checkReferer, (req,res)=>{
    const key = generateKey();
    const expiresAt = Date.now() + 24*60*60*1000; // 24h
    db.prepare("INSERT INTO keys (key, expiresAt) VALUES (?, ?)").run(key, expiresAt);
    res.json({ key, expiresAt });
});

// Rota validar Key
app.get("/api/validar", (req,res)=>{
    const key = req.query.key;
    if(!key) return res.json({ valid:false });
    const row = db.prepare("SELECT * FROM keys WHERE key=?").get(key);
    if(!row) return res.json({ valid:false });
    if(Date.now() > row.expiresAt){
        db.prepare("DELETE FROM keys WHERE key=?").run(key);
        return res.json({ valid:false });
    }
    res.json({ valid:true });
});

app.listen(port, ()=>console.log(`Servidor rodando na porta ${port}`));
