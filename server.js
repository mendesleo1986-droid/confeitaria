import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { query } from './src/db.js';
import { runSeed } from './src/seed.js';
import ingredientesRouter from './src/routes/ingredientes.js';
import receitasRouter from './src/routes/receitas.js';
import clientesRouter from './src/routes/clientes.js';
import pedidosRouter from './src/routes/pedidos.js';
import { calcularPrecificacao } from './src/precificacao.js';
import { ingredientesEstoqueBaixo } from './src/estoque.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

app.use('/api/ingredientes', ingredientesRouter);
app.use('/api/receitas',     receitasRouter);
app.use('/api/clientes',     clientesRouter);
app.use('/api/pedidos',      pedidosRouter);

app.get('/api/resumo', async (req, res) => {
  try {
    const [{ n: totalIngredientes }] = await query('SELECT COUNT(*) AS n FROM ingredientes');
    const receitas = await query('SELECT * FROM receitas');

    let custoTotalGeral = 0;
    let receitaPotencial = 0;

    for (const r of receitas) {
      const itens = (await query(
        `SELECT ri.quantidade, i.* FROM receita_ingredientes ri
         JOIN ingredientes i ON i.id = ri.ingrediente_id WHERE ri.receita_id = $1`,
        [r.id]
      )).map(({ quantidade, ...ingrediente }) => ({ quantidade, ingrediente }));
      const p = calcularPrecificacao(r, itens);
      custoTotalGeral  += p.custo_total;
      receitaPotencial += p.preco_venda_sugerido;
    }

    const [{ n: totalClientes }]  = await query('SELECT COUNT(*) AS n FROM clientes');
    const [{ n: pedidosAbertos }] = await query(
      "SELECT COUNT(*) AS n FROM pedidos WHERE status IN ('pendente','em_producao')"
    );
    const estoqueBaixo = await ingredientesEstoqueBaixo();

    res.json({
      total_ingredientes:   Number(totalIngredientes),
      total_receitas:       receitas.length,
      total_clientes:       Number(totalClientes),
      pedidos_abertos:      Number(pedidosAbertos),
      custo_total_receitas: round(custoTotalGeral),
      receita_potencial:    round(receitaPotencial),
      lucro_potencial:      round(receitaPotencial - custoTotalGeral),
      estoque_baixo:        estoqueBaixo,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro interno do servidor.', detalhe: e.message });
  }
});

// Endpoint de diagnóstico temporário
app.get('/api/debug', async (req, res) => {
  const info = { versao: 'debug-3', temDatabaseUrl: !!process.env.DATABASE_URL };
  try {
    const r = await query('SELECT current_schema() AS schema, current_database() AS db');
    info.conexao = 'ok';
    info.schema = r[0]?.schema;
    info.db = r[0]?.db;
  } catch (e) {
    info.conexao = 'falhou';
    info.erro = e.message;
  }
  try {
    const t = await query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'confeitaria' ORDER BY table_name"
    );
    info.tabelas_confeitaria = t.map((x) => x.table_name);
  } catch (e) {
    info.erro_tabelas = e.message;
  }
  res.json(info);
});

// Semeia dados de exemplo na primeira execução (banco vazio)
async function inicializar() {
  try {
    const [{ n }] = await query('SELECT COUNT(*) AS n FROM ingredientes');
    if (Number(n) === 0) await runSeed();
  } catch (e) {
    console.error('Erro ao inicializar banco:', e.message);
  }
}

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed')
    return res.status(400).json({ erro: 'JSON inválido no corpo da requisição.' });
  console.error(err);
  res.status(500).json({ erro: 'Erro interno do servidor.' });
});

function round(v) { return Math.round((v + Number.EPSILON) * 100) / 100; }

// Em Vercel o módulo é importado como handler — não sobe listen()
if (!process.env.VERCEL) {
  inicializar().then(() => {
    app.listen(PORT, () => console.log(`🍰 Confeitaria rodando em http://localhost:${PORT}`));
  });
} else {
  inicializar();
}

export default app;
