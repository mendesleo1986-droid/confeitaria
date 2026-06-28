import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import db from './src/db.js';
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

// Semeia dados de exemplo na primeira execução (banco vazio)
if (db.prepare('SELECT COUNT(*) AS n FROM ingredientes').get().n === 0) {
  runSeed();
}

// API
app.use('/api/ingredientes', ingredientesRouter);
app.use('/api/receitas', receitasRouter);
app.use('/api/clientes', clientesRouter);
app.use('/api/pedidos', pedidosRouter);

// Resumo para o painel inicial
app.get('/api/resumo', (req, res) => {
  const totalIngredientes = db.prepare('SELECT COUNT(*) AS n FROM ingredientes').get().n;
  const receitas = db.prepare('SELECT * FROM receitas').all();

  let custoTotalGeral = 0;
  let receitaPotencial = 0;
  const itensStmt = db.prepare(
    `SELECT ri.quantidade, i.* FROM receita_ingredientes ri
     JOIN ingredientes i ON i.id = ri.ingrediente_id WHERE ri.receita_id = ?`
  );

  for (const r of receitas) {
    const itens = itensStmt.all(r.id).map((row) => {
      const { quantidade, ...ingrediente } = row;
      return { quantidade, ingrediente };
    });
    const p = calcularPrecificacao(r, itens);
    custoTotalGeral += p.custo_total;
    receitaPotencial += p.preco_venda_sugerido;
  }

  const totalClientes = db.prepare('SELECT COUNT(*) AS n FROM clientes').get().n;
  const pedidosAbertos = db
    .prepare("SELECT COUNT(*) AS n FROM pedidos WHERE status IN ('pendente','em_producao')")
    .get().n;
  const estoqueBaixo = ingredientesEstoqueBaixo();

  res.json({
    total_ingredientes: totalIngredientes,
    total_receitas: receitas.length,
    total_clientes: totalClientes,
    pedidos_abertos: pedidosAbertos,
    custo_total_receitas: round(custoTotalGeral),
    receita_potencial: round(receitaPotencial),
    lucro_potencial: round(receitaPotencial - custoTotalGeral),
    estoque_baixo: estoqueBaixo,
  });
});

// Tratamento de erros JSON inválido
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'JSON inválido no corpo da requisição.' });
  }
  console.error(err);
  res.status(500).json({ erro: 'Erro interno do servidor.' });
});

function round(v) {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

app.listen(PORT, () => {
  console.log(`🍰 Confeitaria rodando em http://localhost:${PORT}`);
});

export default app;
