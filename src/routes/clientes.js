import { Router } from 'express';
import db from '../db.js';

const router = Router();

router.get('/', (req, res) => {
  const rows = db
    .prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM pedidos p WHERE p.cliente_id = c.id) AS total_pedidos
       FROM clientes c ORDER BY c.nome COLLATE NOCASE`
    )
    .all();
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ erro: 'Cliente não encontrado' });
  res.json(row);
});

router.post('/', (req, res) => {
  const { nome, telefone = null, email = null, observacoes = null } = req.body;
  if (!nome || !nome.trim()) return res.status(400).json({ erro: 'O nome é obrigatório.' });
  const info = db
    .prepare('INSERT INTO clientes (nome, telefone, email, observacoes) VALUES (?, ?, ?, ?)')
    .run(nome.trim(), telefone, email, observacoes);
  res.status(201).json(db.prepare('SELECT * FROM clientes WHERE id = ?').get(info.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const atual = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id);
  if (!atual) return res.status(404).json({ erro: 'Cliente não encontrado' });
  const m = { ...atual, ...req.body };
  if (!m.nome || !m.nome.trim()) return res.status(400).json({ erro: 'O nome é obrigatório.' });
  db.prepare('UPDATE clientes SET nome = ?, telefone = ?, email = ?, observacoes = ? WHERE id = ?').run(
    m.nome.trim(),
    m.telefone ?? null,
    m.email ?? null,
    m.observacoes ?? null,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM clientes WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ erro: 'Cliente não encontrado' });
  res.status(204).end();
});

export default router;
