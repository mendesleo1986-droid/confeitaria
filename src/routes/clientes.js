import { Router } from 'express';
import { query, queryOne, execute } from '../db.js';

const router = Router();

router.get('/', async (req, res) => {
  const rows = await query(
    `SELECT c.*, (SELECT COUNT(*) FROM pedidos p WHERE p.cliente_id = c.id) AS total_pedidos
     FROM clientes c ORDER BY LOWER(c.nome)`
  );
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const row = await queryOne('SELECT * FROM clientes WHERE id = $1', [req.params.id]);
  if (!row) return res.status(404).json({ erro: 'Cliente não encontrado' });
  res.json(row);
});

router.post('/', async (req, res) => {
  const { nome, telefone = null, email = null, observacoes = null } = req.body;
  if (!nome?.trim()) return res.status(400).json({ erro: 'O nome é obrigatório.' });
  const row = await queryOne(
    'INSERT INTO clientes (nome, telefone, email, observacoes) VALUES ($1,$2,$3,$4) RETURNING *',
    [nome.trim(), telefone, email, observacoes]
  );
  res.status(201).json(row);
});

router.put('/:id', async (req, res) => {
  const atual = await queryOne('SELECT * FROM clientes WHERE id = $1', [req.params.id]);
  if (!atual) return res.status(404).json({ erro: 'Cliente não encontrado' });
  const m = { ...atual, ...req.body };
  if (!m.nome?.trim()) return res.status(400).json({ erro: 'O nome é obrigatório.' });
  const row = await queryOne(
    'UPDATE clientes SET nome=$1, telefone=$2, email=$3, observacoes=$4 WHERE id=$5 RETURNING *',
    [m.nome.trim(), m.telefone ?? null, m.email ?? null, m.observacoes ?? null, req.params.id]
  );
  res.json(row);
});

router.delete('/:id', async (req, res) => {
  const rowCount = await execute('DELETE FROM clientes WHERE id = $1', [req.params.id]);
  if (rowCount === 0) return res.status(404).json({ erro: 'Cliente não encontrado' });
  res.status(204).end();
});

export default router;
