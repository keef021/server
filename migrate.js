import sqlite3 from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔄 Iniciando migração do banco de dados...');

try {
  // Verifica se o diretório data existe
  const dataDir = path.join(__dirname, "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('📁 Diretório data criado');
  }

  // Conecta ao banco
  const dbPath = path.join(dataDir, "db.sqlite");
  const db = sqlite3(dbPath);

  console.log('📊 Verificando estrutura atual da tabela...');

  // Verifica se a tabela existe
  const tableInfo = db.prepare("PRAGMA table_info(keys)").all();
  
  if (tableInfo.length === 0) {
    console.log('🆕 Tabela não existe, criando nova estrutura...');
    
    // Cria tabela nova com a estrutura correta
    db.prepare(`CREATE TABLE keys (
      key TEXT PRIMARY KEY,
      ip_address TEXT NOT NULL,
      expiresAt INTEGER NOT NULL,
      createdAt INTEGER DEFAULT (strftime('%s','now') * 1000),
      UNIQUE(ip_address)
    )`).run();
    
    console.log('✅ Tabela criada com sucesso');
  } else {
    console.log('📋 Estrutura atual da tabela:');
    tableInfo.forEach(column => {
      console.log(`  - ${column.name}: ${column.type} ${column.pk ? '(PRIMARY KEY)' : ''}`);
    });

    // Verifica se a coluna ip_address existe
    const hasIpColumn = tableInfo.some(col => col.name === 'ip_address');
    
    if (!hasIpColumn) {
      console.log('🔧 Adicionando coluna ip_address...');
      
      // Backup da tabela antiga
      console.log('💾 Criando backup da tabela antiga...');
      db.prepare(`CREATE TABLE keys_backup AS SELECT * FROM keys`).run();
      
      // Remove todas as keys antigas já que não temos IP
      console.log('🗑️ Removendo keys antigas (sem IP)...');
      db.prepare(`DELETE FROM keys`).run();
      
      // Adiciona nova coluna
      db.prepare(`ALTER TABLE keys ADD COLUMN ip_address TEXT`).run();
      
      console.log('✅ Coluna ip_address adicionada');
    } else {
      console.log('✅ Coluna ip_address já existe');
    }

    // Verifica e atualiza constraint UNIQUE
    try {
      // Remove índice antigo se existir
      db.prepare(`DROP INDEX IF EXISTS idx_ip_address`).run();
      
      // Cria novo índice único para IP
      db.prepare(`CREATE UNIQUE INDEX idx_ip_address ON keys(ip_address)`).run();
      console.log('✅ Índice único para IP criado');
    } catch (error) {
      console.log('⚠️ Aviso: Não foi possível criar índice único (pode já existir)');
    }
  }

  // Limpa keys expiradas
  const now = Date.now();
  const expiredKeys = db.prepare("DELETE FROM keys WHERE expiresAt < ?").run(now);
  if (expiredKeys.changes > 0) {
    console.log(`🗑️ ${expiredKeys.changes} keys expiradas removidas`);
  }

  // Estatísticas finais
  const stats = db.prepare("SELECT COUNT(*) as total FROM keys").get();
  const activeStats = db.prepare("SELECT COUNT(*) as active FROM keys WHERE expiresAt > ?").get(now);
  
  console.log('\n📊 Estatísticas do banco:');
  console.log(`  - Total de keys: ${stats.total}`);
  console.log(`  - Keys ativas: ${activeStats.active}`);
  
  // Verifica estrutura final
  console.log('\n🔍 Estrutura final da tabela:');
  const finalStructure = db.prepare("PRAGMA table_info(keys)").all();
  finalStructure.forEach(column => {
    console.log(`  ✓ ${column.name}: ${column.type} ${column.pk ? '(PRIMARY KEY)' : ''} ${column.notnull ? '(NOT NULL)' : ''}`);
  });

  // Verifica índices
  const indexes = db.prepare("PRAGMA index_list(keys)").all();
  console.log('\n📇 Índices:');
  if (indexes.length > 0) {
    indexes.forEach(index => {
      console.log(`  ✓ ${index.name} ${index.unique ? '(UNIQUE)' : ''}`);
    });
  } else {
    console.log('  - Nenhum índice encontrado');
  }

  db.close();
  console.log('\n✅ Migração concluída com sucesso!');
  console.log('\n🔒 Sistema agora suporta:');
  console.log('  - Uma key por IP por 24 horas');
  console.log('  - Validação obrigatória de referer liink.uk');
  console.log('  - Verificação de IP na validação de keys');

} catch (error) {
  console.error('❌ Erro durante a migração:', error);
  process.exit(1);
                                                                                          }
