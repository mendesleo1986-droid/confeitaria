import { Router } from 'express';
import { query, queryOne, execute } from '../db.js';
import { custoUnitario } from '../precificacao.js';

const router = Router();
const UNIDADES_VALIDAS = ['g', 'ml', 'un'];

const comCustoUnitario = (ing) => ({ ...ing, custo_unitario: custoUnitario(ing) });

router.get('/', async (req, res) => {
  const rows = await query('SELECT * FROM ingredientes ORDER BY LOWER(nome)');
  res.json(rows.map(comCustoUnitario));
});

router.get('/:id', async (req, res) => {
  const row = await queryOne('SELECT * FROM ingredientes WHERE id = $1', [req.params.id]);
  if (!row) return res.status(404).json({ erro: 'Ingrediente não encontrado' });
  res.json(comCustoUnitario(row));
});

router.post('/', async (req, res) => {
  const { nome, unidade = 'g', preco_compra, quantidade_compra, fornecedor = null, estoque = 0, estoque_minimo = 0 } = req.body;
  const erro = validar({ nome, unidade, preco_compra, quantidade_compra });
  if (erro) return res.status(400).json({ erro });

  const row = await queryOne(
    `INSERT INTO ingredientes (nome, unidade, preco_compra, quantidade_compra, fornecedor, estoque, estoque_minimo)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [nome.trim(), unidade, Number(preco_compra), Number(quantidade_compra), fornecedor,
     Number(estoque) || 0, Number(estoque_minimo) || 0]
  );
  res.status(201).json(comCustoUnitario(row));
});

router.put('/:id', async (req, res) => {
  const atual = await queryOne('SELECT * FROM ingredientes WHERE id = $1', [req.params.id]);
  if (!atual) return res.status(404).json({ erro: 'Ingrediente não encontrado' });

  const merged = { ...atual, ...req.body };
  const erro = validar(merged);
  if (erro) return res.status(400).json({ erro });

  const row = await queryOne(
    `UPDATE ingredientes
     SET nome=$1, unidade=$2, preco_compra=$3, quantidade_compra=$4,
         fornecedor=$5, estoque=$6, estoque_minimo=$7, atualizado_em=NOW()
     WHERE id=$8 RETURNING *`,
    [merged.nome.trim(), merged.unidade, Number(merged.preco_compra), Number(merged.quantidade_compra),
     merged.fornecedor ?? null, Number(merged.estoque) || 0, Number(merged.estoque_minimo) || 0, req.params.id]
  );
  res.json(comCustoUnitario(row));
});

router.delete('/:id', async (req, res) => {
  const [{ n }] = await query(
    'SELECT COUNT(*) AS n FROM receita_ingredientes WHERE ingrediente_id = $1', [req.params.id]
  );
  if (Number(n) > 0)
    return res.status(409).json({ erro: `Ingrediente em uso por ${n} receita(s). Remova-o das receitas primeiro.` });
  const rowCount = await execute('DELETE FROM ingredientes WHERE id = $1', [req.params.id]);
  if (rowCount === 0) return res.status(404).json({ erro: 'Ingrediente não encontrado' });
  res.status(204).end();
});

function validar({ nome, unidade, preco_compra, quantidade_compra }) {
  if (!nome?.trim()) return 'O nome é obrigatório.';
  if (!UNIDADES_VALIDAS.includes(unidade)) return `Unidade inválida. Use: ${UNIDADES_VALIDAS.join(', ')}.`;
  if (preco_compra == null || isNaN(Number(preco_compra)) || Number(preco_compra) < 0) return 'Preço de compra inválido.';
  if (quantidade_compra == null || isNaN(Number(quantidade_compra)) || Number(quantidade_compra) <= 0)
    return 'Quantidade da compra deve ser maior que zero.';
  return null;
}

export default router;
