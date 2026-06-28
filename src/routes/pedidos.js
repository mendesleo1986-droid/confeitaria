import { Router } from 'express';
import db from '../db.js';
import { calcularPrecificacao } from '../precificacao.js';
import { baixarEstoqueReceita } from '../estoque.js';

const router = Router();

const STATUS_VALIDOS = ['pendente', 'em_producao', 'concluido', 'cancelado'];

// Preço de venda sugerido (do lote) de uma receita, no momento atual.
function precoSugeridoReceita(receitaId) {
  const receita = db.prepare('SELECT * FROM receitas WHERE id = ?').get(receitaId);
  if (!receita) return null;
  const itens = db
    .prepare(
      `SELECT ri.quantidade, i.* FROM receita_ingredientes ri
       JOIN ingredientes i ON i.id = ri.ingrediente_id WHERE ri.receita_id = ?`
    )
    .all(receitaId)
    .map((row) => {
      const { quantidade, ...ingrediente } = row;
      return { quantidade, ingrediente };
    });
  return { receita, preco: calcularPrecificacao(receita, itens).preco_venda_sugerido };
}

function itensDoPedido(pedidoId) {
  return db
    .prepare('SELECT * FROM pedido_itens WHERE pedido_id = ? ORDER BY id').all(pedidoId)
    .map((i) => ({ ...i, subtotal: round(i.quantidade * i.preco_unitario) }));
}

function pedidoCompleto(pedidoId) {
  const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(pedidoId);
  if (!pedido) return null;
  const cliente = pedido.cliente_id
    ? db.prepare('SELECT id, nome, telefone FROM clientes WHERE id = ?').get(pedido.cliente_id)
    : null;
  const itens = itensDoPedido(pedidoId);
  const total = round(itens.reduce((s, i) => s + i.subtotal, 0));
  return { ...pedido, cliente, itens, total };
}

// Lista pedidos (resumo)
router.get('/', (req, res) => {
  const pedidos = db.prepare('SELECT * FROM pedidos ORDER BY criado_em DESC').all();
  const lista = pedidos.map((p) => {
    const itens = itensDoPedido(p.id);
    const total = round(itens.reduce((s, i) => s + i.subtotal, 0));
    const cliente = p.cliente_id
      ? db.prepare('SELECT nome FROM clientes WHERE id = ?').get(p.cliente_id)
      : null;
    return {
      id: p.id,
      cliente: cliente?.nome || 'Sem cliente',
      data_entrega: p.data_entrega,
      status: p.status,
      estoque_baixado: p.estoque_baixado,
      qtd_itens: itens.length,
      total,
    };
  });
  res.json(lista);
});

router.get('/:id', (req, res) => {
  const pedido = pedidoCompleto(req.params.id);
  if (!pedido) return res.status(404).json({ erro: 'Pedido não encontrado' });
  res.json(pedido);
});

router.post('/', (req, res) => {
  try {
    const id = db.transaction(() => {
      const { cliente_id, data_entrega, status, observacoes, itens } = validarPedido(req.body);
      const info = db
        .prepare(
          `INSERT INTO pedidos (cliente_id, data_entrega, status, observacoes)
           VALUES (?, ?, ?, ?)`
        )
        .run(cliente_id, data_entrega, status, observacoes);
      inserirItens(info.lastInsertRowid, itens);
      return info.lastInsertRowid;
    })();
    res.status(201).json(pedidoCompleto(id));
  } catch (e) {
    res.status(400).json({ erro: e.message });
  }
});

router.put('/:id', (req, res) => {
  const existe = db.prepare('SELECT id FROM pedidos WHERE id = ?').get(req.params.id);
  if (!existe) return res.status(404).json({ erro: 'Pedido não encontrado' });
  try {
    db.transaction(() => {
      const { cliente_id, data_entrega, status, observacoes, itens } = validarPedido(req.body);
      db.prepare(
        `UPDATE pedidos SET cliente_id = ?, data_entrega = ?, status = ?, observacoes = ? WHERE id = ?`
      ).run(cliente_id, data_entrega, status, observacoes, req.params.id);
      db.prepare('DELETE FROM pedido_itens WHERE pedido_id = ?').run(req.params.id);
      inserirItens(req.params.id, itens);
    })();
    res.json(pedidoCompleto(req.params.id));
  } catch (e) {
    res.status(400).json({ erro: e.message });
  }
});

router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM pedidos WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ erro: 'Pedido não encontrado' });
  res.status(204).end();
});

// Dá baixa no estoque para todos os itens do pedido (uma única vez)
router.post('/:id/baixar-estoque', (req, res) => {
  const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(req.params.id);
  if (!pedido) return res.status(404).json({ erro: 'Pedido não encontrado' });
  if (pedido.estoque_baixado) return res.status(409).json({ erro: 'O estoque deste pedido já foi baixado.' });

  const itens = db.prepare('SELECT * FROM pedido_itens WHERE pedido_id = ?').all(req.params.id);
  const comReceita = itens.filter((i) => i.receita_id);
  if (!comReceita.length)
    return res.status(400).json({ erro: 'Nenhum item vinculado a uma receita para baixar estoque.' });

  try {
    db.transaction(() => {
      for (const item of comReceita) baixarEstoqueReceita(item.receita_id, item.quantidade);
      db.prepare("UPDATE pedidos SET estoque_baixado = 1, status = 'em_producao' WHERE id = ?").run(req.params.id);
    })();
    res.json(pedidoCompleto(req.params.id));
  } catch (e) {
    res.status(409).json({ erro: e.message, faltando: e.faltando });
  }
});

function inserirItens(pedidoId, itens) {
  const stmt = db.prepare(
    'INSERT INTO pedido_itens (pedido_id, receita_id, descricao, quantidade, preco_unitario) VALUES (?, ?, ?, ?, ?)'
  );
  for (const item of itens) {
    let descricao = item.descricao?.trim();
    let preco = item.preco_unitario != null && item.preco_unitario !== '' ? Number(item.preco_unitario) : null;
    let receitaId = item.receita_id || null;

    if (receitaId) {
      const info = precoSugeridoReceita(receitaId);
      if (!info) throw new Error(`Receita ${receitaId} não existe.`);
      if (!descricao) descricao = info.receita.nome;
      if (preco == null) preco = info.preco; // usa o preço sugerido como padrão
    }
    if (!descricao) throw new Error('Cada item precisa de uma receita ou de uma descrição.');
    if (!(Number(item.quantidade) > 0)) throw new Error('A quantidade de cada item deve ser maior que zero.');
    if (preco == null || isNaN(preco) || preco < 0) throw new Error(`Preço inválido para "${descricao}".`);

    stmt.run(pedidoId, receitaId, descricao, Number(item.quantidade), preco);
  }
}

function validarPedido(d) {
  if (!Array.isArray(d.itens) || d.itens.length === 0)
    throw new Error('O pedido precisa de ao menos um item.');
  const status = d.status && STATUS_VALIDOS.includes(d.status) ? d.status : 'pendente';
  const cliente_id = d.cliente_id ? Number(d.cliente_id) : null;
  if (cliente_id) {
    const c = db.prepare('SELECT id FROM clientes WHERE id = ?').get(cliente_id);
    if (!c) throw new Error('Cliente informado não existe.');
  }
  return {
    cliente_id,
    data_entrega: d.data_entrega?.trim() || null,
    status,
    observacoes: d.observacoes?.trim() || null,
    itens: d.itens,
  };
}

function round(v) {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

export default router;
