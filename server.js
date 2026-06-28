import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import db from './src/db.js';
import ingredientesRouter from './src/routes/ingredientes.js';
import receitasRouter from './src/routes/receitas.js';
import { calcularPrecificacao } from './src/precificacao.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// API
app.use('/api/ingredientes', ingredientesRouter);
app.use('/api/receitas', receitasRouter);

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

  res.json({
    total_ingredientes: totalIngredientes,
    total_receitas: receitas.length,
    custo_total_receitas: round(custoTotalGeral),
    receita_potencial: round(receitaPotencial),
    lucro_potencial: round(receitaPotencial - custoTotalGeral),
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
