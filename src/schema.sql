-- PostgreSQL schema — aplicado via Supabase MCP (migration: confeitaria_schema)
-- Todas as quantidades são armazenadas na unidade base (g, ml ou un).

CREATE SCHEMA IF NOT EXISTS confeitaria;

CREATE TABLE IF NOT EXISTS confeitaria.ingredientes (
  id                SERIAL PRIMARY KEY,
  nome              TEXT    NOT NULL,
  unidade           TEXT    NOT NULL DEFAULT 'g',
  preco_compra      REAL    NOT NULL,
  quantidade_compra REAL    NOT NULL,
  fornecedor        TEXT,
  estoque           REAL    NOT NULL DEFAULT 0,
  estoque_minimo    REAL    NOT NULL DEFAULT 0,
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS confeitaria.receitas (
  id                      SERIAL PRIMARY KEY,
  nome                    TEXT    NOT NULL,
  categoria               TEXT,
  rendimento              REAL    NOT NULL DEFAULT 1,
  unidade_rendimento      TEXT    NOT NULL DEFAULT 'porções',
  modo_preparo            TEXT,
  tempo_preparo           INTEGER,
  custo_mao_obra          REAL    NOT NULL DEFAULT 0,
  custo_embalagem         REAL    NOT NULL DEFAULT 0,
  percentual_custos_fixos REAL    NOT NULL DEFAULT 0,
  margem_lucro            REAL    NOT NULL DEFAULT 100,
  criado_em               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS confeitaria.receita_ingredientes (
  id             SERIAL PRIMARY KEY,
  receita_id     INTEGER NOT NULL REFERENCES confeitaria.receitas(id) ON DELETE CASCADE,
  ingrediente_id INTEGER NOT NULL REFERENCES confeitaria.ingredientes(id) ON DELETE RESTRICT,
  quantidade     REAL    NOT NULL
);

CREATE TABLE IF NOT EXISTS confeitaria.clientes (
  id          SERIAL PRIMARY KEY,
  nome        TEXT    NOT NULL,
  documento   TEXT,
  telefone    TEXT,
  email       TEXT,
  observacoes TEXT,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS confeitaria.pedidos (
  id               SERIAL PRIMARY KEY,
  cliente_id       INTEGER REFERENCES confeitaria.clientes(id) ON DELETE SET NULL,
  data_entrega     DATE,
  status           TEXT    NOT NULL DEFAULT 'pendente',
  observacoes      TEXT,
  estoque_baixado  BOOLEAN NOT NULL DEFAULT FALSE,
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS confeitaria.pedido_itens (
  id             SERIAL PRIMARY KEY,
  pedido_id      INTEGER NOT NULL REFERENCES confeitaria.pedidos(id) ON DELETE CASCADE,
  receita_id     INTEGER REFERENCES confeitaria.receitas(id) ON DELETE SET NULL,
  descricao      TEXT    NOT NULL,
  quantidade     REAL    NOT NULL,
  preco_unitario REAL    NOT NULL
);
