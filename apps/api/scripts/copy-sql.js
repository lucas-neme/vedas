// Copia os arquivos .sql de migração para o diretório de build.
const fs = require('node:fs');
const path = require('node:path');

const from = path.resolve(__dirname, '..', 'src', 'db', 'migrations');
const to = path.resolve(__dirname, '..', 'dist', 'db', 'migrations');

fs.mkdirSync(to, { recursive: true });
for (const file of fs.readdirSync(from)) {
  if (file.endsWith('.sql')) {
    fs.copyFileSync(path.join(from, file), path.join(to, file));
  }
}
console.log(`[build] migrations copiadas para ${to}`);
