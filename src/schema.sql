-- Esquema do banco de dados da confeitaria
-- Todas as quantidades de ingredientes são armazenadas na unidade base do ingrediente
-- (g para sólidos, ml para líquidos, un para unidades).

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ingredientes (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  nome              TEXT    NOT NULL,
  unidade           TEXT    NOT NULL DEFAULT 'g',   -- g | ml | un
  preco_compra      REAL    NOT NULL,               -- valor pago pela embalagem
  quantidade_compra REAL    NOT NULL,               -- quantidade (na unidade base) que vem na embalagem
  fornecedor        TEXT,
  estoque           REAL    NOT NULL DEFAULT 0,      -- quantidade em estoque (unidade base)
  criado_em         TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  atualizado_em     TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS receitas (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  nome                   TEXT    NOT NULL,
  categoria              TEXT,                            -- bolo, torta, doce, salgado, etc.
  rendimento             REAL    NOT NULL DEFAULT 1,      -- nº de porções/unidades produzidas
  unidade_rendimento     TEXT    NOT NULL DEFAULT 'porções',
  modo_preparo           TEXT,
  tempo_preparo          INTEGER,                         -- minutos
  -- Parâmetros de precificação
  custo_mao_obra         REAL    NOT NULL DEFAULT 0,      -- custo de mão de obra para o lote inteiro
  custo_embalagem        REAL    NOT NULL DEFAULT 0,      -- custo de embalagem para o lote inteiro
  percentual_custos_fixos REAL   NOT NULL DEFAULT 0,      -- % de custos fixos (gás, luz, água) sobre o subtotal
  margem_lucro           REAL    NOT NULL DEFAULT 100,    -- margem de lucro (markup) em %
  criado_em              TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  atualizado_em          TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS receita_ingredientes (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  receita_id     INTEGER NOT NULL,
  ingrediente_id INTEGER NOT NULL,
  quantidade     REAL    NOT NULL,                        -- quantidade usada (unidade base do ingrediente)
  FOREIGN KEY (receita_id)     REFERENCES receitas(id)     ON DELETE CASCADE,
  FOREIGN KEY (ingrediente_id) REFERENCES ingredientes(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_receita_ingredientes_receita
  ON receita_ingredientes(receita_id);
CREATE INDEX IF NOT EXISTS idx_receita_ingredientes_ingrediente
  ON receita_ingredientes(ingrediente_id);
