import { Router } from 'express';
import db from '../db.js';
import { custoUnitario } from '../precificacao.js';

const router = Router();

const UNIDADES_VALIDAS = ['g', 'ml', 'un'];

function comCustoUnitario(ing) {
  return { ...ing, custo_unitario: custoUnitario(ing) };
}

// Lista todos os ingredientes
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM ingredientes ORDER BY nome COLLATE NOCASE').all();
  res.json(rows.map(comCustoUnitario));
});

// Busca um ingrediente
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM ingredientes WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ erro: 'Ingrediente não encontrado' });
  res.json(comCustoUnitario(row));
});

// Cria ingrediente
router.post('/', (req, res) => {
  const { nome, unidade = 'g', preco_compra, quantidade_compra, fornecedor = null, estoque = 0 } = req.body;

  const erro = validar({ nome, unidade, preco_compra, quantidade_compra });
  if (erro) return res.status(400).json({ erro });

  const info = db
    .prepare(
      `INSERT INTO ingredientes (nome, unidade, preco_compra, quantidade_compra, fornecedor, estoque)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(nome.trim(), unidade, Number(preco_compra), Number(quantidade_compra), fornecedor, Number(estoque) || 0);

  const row = db.prepare('SELECT * FROM ingredientes WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(comCustoUnitario(row));
});

// Atualiza ingrediente
router.put('/:id', (req, res) => {
  const atual = db.prepare('SELECT * FROM ingredientes WHERE id = ?').get(req.params.id);
  if (!atual) return res.status(404).json({ erro: 'Ingrediente não encontrado' });

  const merged = { ...atual, ...req.body };
  const erro = validar(merged);
  if (erro) return res.status(400).json({ erro });

  db.prepare(
    `UPDATE ingredientes
     SET nome = ?, unidade = ?, preco_compra = ?, quantidade_compra = ?,
         fornecedor = ?, estoque = ?, atualizado_em = datetime('now','localtime')
     WHERE id = ?`
  ).run(
    merged.nome.trim(),
    merged.unidade,
    Number(merged.preco_compra),
    Number(merged.quantidade_compra),
    merged.fornecedor ?? null,
    Number(merged.estoque) || 0,
    req.params.id
  );

  const row = db.prepare('SELECT * FROM ingredientes WHERE id = ?').get(req.params.id);
  res.json(comCustoUnitario(row));
});

// Remove ingrediente (bloqueado se estiver em uso por alguma receita)
router.delete('/:id', (req, res) => {
  const emUso = db
    .prepare('SELECT COUNT(*) AS n FROM receita_ingredientes WHERE ingrediente_id = ?')
    .get(req.params.id);
  if (emUso.n > 0) {
    return res.status(409).json({ erro: `Ingrediente em uso por ${emUso.n} receita(s). Remova-o das receitas primeiro.` });
  }
  const info = db.prepare('DELETE FROM ingredientes WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ erro: 'Ingrediente não encontrado' });
  res.status(204).end();
});

function validar({ nome, unidade, preco_compra, quantidade_compra }) {
  if (!nome || !nome.trim()) return 'O nome é obrigatório.';
  if (!UNIDADES_VALIDAS.includes(unidade)) return `Unidade inválida. Use: ${UNIDADES_VALIDAS.join(', ')}.`;
  if (preco_compra == null || isNaN(Number(preco_compra)) || Number(preco_compra) < 0)
    return 'Preço de compra inválido.';
  if (quantidade_compra == null || isNaN(Number(quantidade_compra)) || Number(quantidade_compra) <= 0)
    return 'Quantidade da compra deve ser maior que zero.';
  return null;
}

export default router;
