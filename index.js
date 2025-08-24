import express from "express";
import sqlite3 from "better-sqlite3";
import crypto from "crypto";

const app = express();
const port = process.env.PORT || 3000;

// Conecta ou cria banco
const db = sqlite3("./db.sqlite");

// Cria tabela se não existir
db.prepare(`CREATE TABLE IF NOT EXISTS keys (
  key TEXT PRIMARY KEY,
  expiresAt INTEGER
)`).run();

// Armazenamento de tokens temporários (token -> timestamp)
const validTokens = new Map();

// Função para gerar Key
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

// Rota para gerar token temporário (chamada pelo link fixo do Liink)
app.get("/api/token", checkReferer, (req,res)=>{
    const token = crypto.randomBytes(8).toString("hex");
    const expiresAt = Date.now() + 5*60*1000; // 5 minutos
    validTokens.set(token, expiresAt);
    res.json({ token });
});

// Middleware para validar token
function validateToken(req,res,next){
    const token = req.query.token;
    if(!token || !validTokens.has(token)) return res.json({error:"Vá pelo site oficial"});
    const expiresAt = validTokens.get(token);
    if(Date.now() > expiresAt){
        validTokens.delete(token);
        return res.json({error:"Token expirado"});
    }
    // Token válido, remove para uso único
    validTokens.delete(token);
    next();
}

// Rota para gerar Key (usa token temporário)
app.get("/api/gerar", checkReferer, validateToken, (req,res)=>{
    const key = generateKey();
    const expiresAt = Date.now() + 24*60*60*1000; // 24h
    db.prepare("INSERT INTO keys (key, expiresAt) VALUES (?, ?)").run(key, expiresAt);
    res.json({ key, expiresAt });
});

// Rota para validar Key
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
