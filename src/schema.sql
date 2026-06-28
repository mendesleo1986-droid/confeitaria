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
  estoque_minimo    REAL    NOT NULL DEFAULT 0,      -- nível mínimo para alerta de estoque baixo
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

-- ====== Clientes e Pedidos ======

CREATE TABLE IF NOT EXISTS clientes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nome        TEXT    NOT NULL,
  telefone    TEXT,
  email       TEXT,
  observacoes TEXT,
  criado_em   TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS pedidos (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id       INTEGER,
  data_entrega     TEXT,
  status           TEXT    NOT NULL DEFAULT 'pendente', -- pendente | em_producao | concluido | cancelado
  observacoes      TEXT,
  estoque_baixado  INTEGER NOT NULL DEFAULT 0,          -- 0/1: se já houve baixa de estoque
  criado_em        TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS pedido_itens (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  pedido_id      INTEGER NOT NULL,
  receita_id     INTEGER,
  descricao      TEXT    NOT NULL,             -- snapshot do nome da receita
  quantidade     REAL    NOT NULL,             -- nº de unidades da receita pedidas
  preco_unitario REAL    NOT NULL,             -- snapshot do preço de venda no momento do pedido
  FOREIGN KEY (pedido_id)  REFERENCES pedidos(id)  ON DELETE CASCADE,
  FOREIGN KEY (receita_id) REFERENCES receitas(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_pedido_itens_pedido ON pedido_itens(pedido_id);
