import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Iniciando configuração...');

try {
  // Criar diretório data se não existir
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('✅ Diretório data criado');
  } else {
    console.log('✅ Diretório data já existe');
  }

  // Verificar se os arquivos necessários existem
  const requiredFiles = ['index.js', 'gerar.html'];
  const missingFiles = [];

  for (const file of requiredFiles) {
    if (!fs.existsSync(path.join(__dirname, file))) {
      missingFiles.push(file);
    }
  }

  if (missingFiles.length > 0) {
    console.log('❌ Arquivos obrigatórios não encontrados:', missingFiles.join(', '));
    process.exit(1);
  }

  console.log('✅ Todos os arquivos necessários encontrados');
  console.log('✅ Configuração concluída com sucesso!');

} catch (error) {
  console.error('❌ Erro durante a configuração:', error.message);
  process.exit(1);
}
