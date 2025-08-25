import express from "express";
import sqlite3 from "better-sqlite3";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const app = express();
const port = process.env.PORT || 3000;

// Configuração de paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware para parsing JSON
app.use(express.json());
app.use(express.static(__dirname));

// Função para inicializar banco de dados
function initDatabase() {
  try {
    // Cria a pasta data se não existir
    const dataDir = path.join(__dirname, "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Conecta ou cria banco com configurações otimizadas
    const dbPath = path.join(dataDir, "db.sqlite");
    const db = sqlite3(dbPath);

    // Configurações do SQLite para melhor performance
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('cache_size = 10000');
    db.pragma('temp_store = memory');

    // Cria tabela se não existir
    db.prepare(`CREATE TABLE IF NOT EXISTS keys (
      key TEXT PRIMARY KEY,
      expiresAt INTEGER,
      createdAt INTEGER DEFAULT (strftime('%s','now') * 1000)
    )`).run();

    console.log('✅ Database initialized successfully');
    return db;
  } catch (error) {
    console.error("❌ Erro ao inicializar banco:", error);
    throw error;
  }
}

// Inicializa banco
let db;
try {
  db = initDatabase();
} catch (error) {
  console.error("Falha ao inicializar banco de dados:", error);
  process.exit(1);
}

// Função para gerar Key
function generateKey() {
  return crypto.randomBytes(8).toString("hex").toUpperCase();
}

// Função para limpar keys expiradas
function cleanExpiredKeys() {
  try {
    const now = Date.now();
    const result = db.prepare("DELETE FROM keys WHERE expiresAt < ?").run(now);
    if (result.changes > 0) {
      console.log(`${result.changes} keys expiradas removidas`);
    }
  } catch (error) {
    console.error("Erro ao limpar keys expiradas:", error);
  }
}

// Limpar keys expiradas a cada hora
setInterval(cleanExpiredKeys, 60 * 60 * 1000);

// Middleware para checar Referer
function checkReferer(req, res, next) {
  const referer = req.get("Referer") || "";
  const origin = req.get("Origin") || "";
  
  // Permite localhost para desenvolvimento
  if (req.hostname === 'localhost' || req.hostname === '127.0.0.1') {
    return next();
  }
  
  // Verifica se vem do site oficial
  if (!referer.includes("shrt.liink.uk") && !origin.includes("shrt.liink.uk")) {
    return res.status(403).json({ 
      error: "Acesso negado. Vá pelo site oficial." 
    });
  }
  
  next();
}

// Middleware de log para debugging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Servir gerar.html na raiz
app.get("/", (req, res) => {
  try {
    res.sendFile(path.join(__dirname, "gerar.html"));
  } catch (error) {
    console.error("Erro ao servir página:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// Rota para gerar Key
app.get("/api/gerar", checkReferer, (req, res) => {
  try {
    // Limpa keys expiradas antes de gerar nova
    cleanExpiredKeys();
    
    const key = generateKey();
    const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 horas
    const createdAt = Date.now();
    
    // Insere nova key
    db.prepare("INSERT INTO keys (key, expiresAt, createdAt) VALUES (?, ?, ?)")
      .run(key, expiresAt, createdAt);
    
    console.log(`Nova key gerada: ${key}`);
    
    res.json({ 
      key, 
      expiresAt,
      message: "Key gerada com sucesso! Válida por 24 horas."
    });
    
  } catch (error) {
    console.error("Erro ao gerar key:", error);
    res.status(500).json({ 
      error: "Erro ao gerar key. Tente novamente." 
    });
  }
});

// Rota para validar Key
app.get("/api/validar", (req, res) => {
  try {
    const key = req.query.key;
    
    if (!key) {
      return res.json({ 
        valid: false, 
        message: "Key não fornecida" 
      });
    }

    // Busca a key no banco
    const row = db.prepare("SELECT * FROM keys WHERE key = ?").get(key);
    
    if (!row) {
      return res.json({ 
        valid: false, 
        message: "Key não encontrada" 
      });
    }

    // Verifica se expirou
    if (Date.now() > row.expiresAt) {
      // Remove key expirada
      db.prepare("DELETE FROM keys WHERE key = ?").run(key);
      return res.json({ 
        valid: false, 
        message: "Key expirada" 
      });
    }

    // Key válida
    res.json({ 
      valid: true, 
      message: "Key válida",
      expiresAt: row.expiresAt
    });
    
  } catch (error) {
    console.error("Erro ao validar key:", error);
    res.status(500).json({ 
      valid: false, 
      message: "Erro interno do servidor" 
    });
  }
});

// Health check para o Render
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    database: 'connected'
  });
});

// Ping endpoint
app.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

// Rota para estatísticas (opcional)
app.get("/api/stats", (req, res) => {
  try {
    const totalKeys = db.prepare("SELECT COUNT(*) as count FROM keys").get();
    const activeKeys = db.prepare("SELECT COUNT(*) as count FROM keys WHERE expiresAt > ?")
      .get(Date.now());
    
    res.json({
      total: totalKeys.count,
      active: activeKeys.count,
      expired: totalKeys.count - activeKeys.count
    });
  } catch (error) {
    console.error("Erro ao obter estatísticas:", error);
    res.status(500).json({ error: "Erro ao obter estatísticas" });
  }
});

// Middleware de tratamento de erros
app.use((err, req, res, next) => {
  console.error("Erro não tratado:", err);
  res.status(500).json({ 
    error: "Erro interno do servidor" 
  });
});

// Rota 404
app.use("*", (req, res) => {
  res.status(404).json({ 
    error: "Endpoint não encontrado" 
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Recebido SIGTERM, fechando servidor...');
  if (db) {
    db.close();
  }
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Recebido SIGINT, fechando servidor...');
  if (db) {
    db.close();
  }
  process.exit(0);
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Servidor rodando na porta ${port}`);
  console.log(`📊 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  
  // Limpa keys expiradas na inicialização
  cleanExpiredKeys();
});
