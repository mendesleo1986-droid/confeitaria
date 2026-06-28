import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Permite definir o caminho do banco via variável de ambiente (útil em testes/produção)
const DB_PATH = process.env.DB_PATH || join(__dirname, '..', 'confeitaria.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Aplica o esquema (idempotente — usa CREATE TABLE IF NOT EXISTS)
const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// Migrações simples para bancos criados em versões anteriores.
// Adiciona colunas que não existiam no esquema original.
function adicionarColunaSeFaltar(tabela, coluna, definicao) {
  const existe = db
    .prepare(`SELECT COUNT(*) AS n FROM pragma_table_info(?) WHERE name = ?`)
    .get(tabela, coluna).n;
  if (!existe) {
    db.exec(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${definicao}`);
  }
}

adicionarColunaSeFaltar('ingredientes', 'estoque_minimo', 'REAL NOT NULL DEFAULT 0');

export default db;
