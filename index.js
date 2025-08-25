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

// Middleware para parsing JSON e obter IP real
app.use(express.json());
app.use(express.static(__dirname));

// Middleware para obter IP real considerando proxies
app.use((req, res, next) => {
  // Pega o IP real considerando proxies/load balancers
  req.realIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
              req.headers['x-real-ip'] ||
              req.connection.remoteAddress ||
              req.socket.remoteAddress ||
              (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
              req.ip;
  
  console.log(`🔍 Real IP detected: ${req.realIP}`);
  next();
});

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

    // Cria tabela atualizada com IP
    db.prepare(`CREATE TABLE IF NOT EXISTS keys (
      key TEXT PRIMARY KEY,
      ip_address TEXT NOT NULL,
      expiresAt INTEGER NOT NULL,
      createdAt INTEGER DEFAULT (strftime('%s','now') * 1000),
      UNIQUE(ip_address)
    )`).run();

    // Migração para adicionar coluna ip_address se não existir
    try {
      db.prepare(`ALTER TABLE keys ADD COLUMN ip_address TEXT`).run();
      console.log('✅ Coluna ip_address adicionada à tabela existente');
    } catch (error) {
      // Coluna já existe ou tabela já foi criada com a nova estrutura
      console.log('✅ Estrutura da tabela já está atualizada');
    }

    // Cria índice para IP para melhor performance
    try {
      db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_ip_address ON keys(ip_address)`).run();
      console.log('✅ Índice de IP criado');
    } catch (error) {
      console.log('✅ Índice de IP já existe');
    }

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

// Função para verificar se o referer é válido
function isValidReferer(referer) {
  if (!referer) return false;
  
  const allowedDomains = [
    "liink.uk",
    "shrt.liink.uk", 
    "go.liink.uk"
  ];
  
  return allowedDomains.some(domain => referer.includes(domain));
}

// Middleware de log para debugging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - IP: ${req.realIP}`);
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

// Rota para gerar Key (APENAS com referer do liink.uk e uma key por IP)
app.get("/api/gerar", (req, res) => {
  try {
    const referer = req.get("Referer") || "";
    const userIP = req.realIP;
    
    // Log para debug
    console.log(`🔍 Geração de Key:`, {
      referer,
      ip: userIP,
      userAgent: req.get("User-Agent")?.substring(0, 50)
    });
    
    // VERIFICAÇÃO OBRIGATÓRIA: Deve vir do encurtador liink.uk
    if (!isValidReferer(referer)) {
      console.log(`❌ Blocked - Invalid referer: ${referer} for IP: ${userIP}`);
      return res.status(403).json({ 
        error: "Acesso negado. Use apenas o link oficial do encurtador." 
      });
    }
    
    // Limpa keys expiradas antes de verificar
    cleanExpiredKeys();
    
    // Verifica se o IP já possui uma key válida
    const existingKey = db.prepare("SELECT * FROM keys WHERE ip_address = ? AND expiresAt > ?")
      .get(userIP, Date.now());
    
    if (existingKey) {
      const timeRemaining = existingKey.expiresAt - Date.now();
      const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
      const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
      
      console.log(`⚠️ IP ${userIP} já possui key válida: ${existingKey.key}`);
      
      return res.status(429).json({ 
        error: `Seu IP já possui uma key válida. Tempo restante: ${hours}h ${minutes}m`,
        existingKey: existingKey.key,
        expiresAt: existingKey.expiresAt,
        timeRemaining: `${hours}h ${minutes}m`
      });
    }
    
    // Gera nova key
    const key = generateKey();
    const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 horas
    const createdAt = Date.now();
    
    try {
      // Insere nova key (UNIQUE constraint garante apenas uma key por IP)
      db.prepare("INSERT OR REPLACE INTO keys (key, ip_address, expiresAt, createdAt) VALUES (?, ?, ?, ?)")
        .run(key, userIP, expiresAt, createdAt);
      
      console.log(`✅ Nova key gerada: ${key} para IP: ${userIP} (expires: ${new Date(expiresAt).toLocaleString()})`);
      
      res.json({ 
        key, 
        expiresAt,
        message: "Key gerada com sucesso! Válida por 24 horas para seu IP."
      });
      
    } catch (error) {
      console.error("❌ Erro ao inserir key no banco:", error);
      res.status(500).json({ 
        error: "Erro ao gerar key. Tente novamente." 
      });
    }
    
  } catch (error) {
    console.error("❌ Erro ao gerar key:", error);
    res.status(500).json({ 
      error: "Erro interno. Tente novamente." 
    });
  }
});

// Rota para validar Key
app.get("/api/validar", (req, res) => {
  try {
    const key = req.query.key;
    const userIP = req.realIP;
    
    if (!key) {
      return res.json({ 
        valid: false, 
        message: "Key não fornecida" 
      });
    }

    // Busca a key no banco verificando também o IP
    const row = db.prepare("SELECT * FROM keys WHERE key = ? AND ip_address = ?").get(key, userIP);
    
    if (!row) {
      // Verifica se a key existe mas é de outro IP
      const keyExists = db.prepare("SELECT * FROM keys WHERE key = ?").get(key);
      
      if (keyExists) {
        console.log(`❌ Key ${key} existe mas IP não confere. Key IP: ${keyExists.ip_address}, Request IP: ${userIP}`);
        return res.json({ 
          valid: false, 
          message: "Key não pertence ao seu IP" 
        });
      }
      
      return res.json({ 
        valid: false, 
        message: "Key não encontrada" 
      });
    }

    // Verifica se expirou
    if (Date.now() > row.expiresAt) {
      // Remove key expirada
      db.prepare("DELETE FROM keys WHERE key = ?").run(key);
      console.log(`🗑️ Key expirada removida: ${key} (IP: ${userIP})`);
      return res.json({ 
        valid: false, 
        message: "Key expirada" 
      });
    }

    // Key válida
    console.log(`✅ Key válida: ${key} (IP: ${userIP})`);
    res.json({ 
      valid: true, 
      message: "Key válida",
      expiresAt: row.expiresAt,
      ip: userIP
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
    version: '1.1.0',
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
    
    // Stats por IP (não exibe IPs por privacidade)
    const uniqueIPs = db.prepare("SELECT COUNT(DISTINCT ip_address) as count FROM keys WHERE expiresAt > ?")
      .get(Date.now());
    
    res.json({
      total: totalKeys.count,
      active: activeKeys.count,
      expired: totalKeys.count - activeKeys.count,
      uniqueActiveIPs: uniqueIPs.count
    });
  } catch (error) {
    console.error("Erro ao obter estatísticas:", error);
    res.status(500).json({ error: "Erro ao obter estatísticas" });
  }
});

// Nova rota para verificar status do IP atual
app.get("/api/status", (req, res) => {
  try {
    const userIP = req.realIP;
    const existingKey = db.prepare("SELECT * FROM keys WHERE ip_address = ? AND expiresAt > ?")
      .get(userIP, Date.now());
    
    if (existingKey) {
      const timeRemaining = existingKey.expiresAt - Date.now();
      const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
      const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
      
      res.json({
        hasKey: true,
        key: existingKey.key,
        expiresAt: existingKey.expiresAt,
        timeRemaining: `${hours}h ${minutes}m`,
        ip: userIP
      });
    } else {
      res.json({
        hasKey: false,
        ip: userIP
      });
    }
  } catch (error) {
    console.error("Erro ao verificar status:", error);
    res.status(500).json({ error: "Erro ao verificar status" });
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
  console.log(`🔒 Sistema de Key por IP ativado`);
  console.log(`🌐 Apenas referers liink.uk permitidos`);
  
  // Limpa keys expiradas na inicialização
  cleanExpiredKeys();
});
