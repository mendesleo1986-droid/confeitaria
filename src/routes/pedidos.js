import { Router } from 'express';
import { query, queryOne, execute, transaction } from '../db.js';
import { calcularPrecificacao } from '../precificacao.js';
import { baixarEstoqueReceita } from '../estoque.js';

const router = Router();
const STATUS_VALIDOS = ['pendente', 'em_producao', 'concluido', 'cancelado'];

async function precoSugeridoReceita(receitaId, client) {
  const qone = (sql, p) => client.query(sql, p).then((r) => r.rows[0] ?? null);
  const qall = (sql, p) => client.query(sql, p).then((r) => r.rows);
  const receita = await qone('SELECT * FROM receitas WHERE id = $1', [receitaId]);
  if (!receita) return null;
  const itens = (await qall(
    `SELECT ri.quantidade, i.* FROM receita_ingredientes ri
     JOIN ingredientes i ON i.id = ri.ingrediente_id WHERE ri.receita_id = $1`,
    [receitaId]
  )).map(({ quantidade, ...ingrediente }) => ({ quantidade, ingrediente }));
  return { receita, preco: calcularPrecificacao(receita, itens).preco_venda_sugerido };
}

async function itensDoPedido(pedidoId) {
  const itens = await query('SELECT * FROM pedido_itens WHERE pedido_id = $1 ORDER BY id', [pedidoId]);
  return itens.map((i) => ({ ...i, subtotal: round(i.quantidade * i.preco_unitario) }));
}

async function pedidoCompleto(pedidoId) {
  const pedido = await queryOne('SELECT * FROM pedidos WHERE id = $1', [pedidoId]);
  if (!pedido) return null;
  const cliente = pedido.cliente_id
    ? await queryOne('SELECT id, nome, telefone FROM clientes WHERE id = $1', [pedido.cliente_id])
    : null;
  const itens = await itensDoPedido(pedidoId);
  const total = round(itens.reduce((s, i) => s + i.subtotal, 0));
  return { ...pedido, cliente, itens, total };
}

router.get('/', async (req, res) => {
  const pedidos = await query('SELECT * FROM pedidos ORDER BY criado_em DESC');
  const lista = await Promise.all(
    pedidos.map(async (p) => {
      const itens = await itensDoPedido(p.id);
      const total = round(itens.reduce((s, i) => s + i.subtotal, 0));
      const cliente = p.cliente_id
        ? await queryOne('SELECT nome FROM clientes WHERE id = $1', [p.cliente_id])
        : null;
      return { id: p.id, cliente: cliente?.nome || 'Sem cliente', data_entrega: p.data_entrega,
               status: p.status, estoque_baixado: p.estoque_baixado, qtd_itens: itens.length, total };
    })
  );
  res.json(lista);
});

router.get('/:id', async (req, res) => {
  const pedido = await pedidoCompleto(req.params.id);
  if (!pedido) return res.status(404).json({ erro: 'Pedido não encontrado' });
  res.json(pedido);
});

router.post('/', async (req, res) => {
  try {
    const id = await transaction(async (client) => {
      const { cliente_id, data_entrega, status, observacoes, itens } = await validarPedido(req.body, client);
      const { rows } = await client.query(
        'INSERT INTO pedidos (cliente_id,data_entrega,status,observacoes) VALUES ($1,$2,$3,$4) RETURNING id',
        [cliente_id, data_entrega, status, observacoes]
      );
      await inserirItens(rows[0].id, itens, client);
      return rows[0].id;
    });
    res.status(201).json(await pedidoCompleto(id));
  } catch (e) {
    res.status(400).json({ erro: e.message });
  }
});

router.put('/:id', async (req, res) => {
  const existe = await queryOne('SELECT id FROM pedidos WHERE id = $1', [req.params.id]);
  if (!existe) return res.status(404).json({ erro: 'Pedido não encontrado' });
  try {
    await transaction(async (client) => {
      const { cliente_id, data_entrega, status, observacoes, itens } = await validarPedido(req.body, client);
      await client.query(
        'UPDATE pedidos SET cliente_id=$1, data_entrega=$2, status=$3, observacoes=$4 WHERE id=$5',
        [cliente_id, data_entrega, status, observacoes, req.params.id]
      );
      await client.query('DELETE FROM pedido_itens WHERE pedido_id = $1', [req.params.id]);
      await inserirItens(req.params.id, itens, client);
    });
    res.json(await pedidoCompleto(req.params.id));
  } catch (e) {
    res.status(400).json({ erro: e.message });
  }
});

router.delete('/:id', async (req, res) => {
  const rowCount = await execute('DELETE FROM pedidos WHERE id = $1', [req.params.id]);
  if (rowCount === 0) return res.status(404).json({ erro: 'Pedido não encontrado' });
  res.status(204).end();
});

router.post('/:id/baixar-estoque', async (req, res) => {
  const pedido = await queryOne('SELECT * FROM pedidos WHERE id = $1', [req.params.id]);
  if (!pedido) return res.status(404).json({ erro: 'Pedido não encontrado' });
  if (pedido.estoque_baixado) return res.status(409).json({ erro: 'O estoque deste pedido já foi baixado.' });

  const itens = await query('SELECT * FROM pedido_itens WHERE pedido_id = $1', [req.params.id]);
  const comReceita = itens.filter((i) => i.receita_id);
  if (!comReceita.length)
    return res.status(400).json({ erro: 'Nenhum item vinculado a uma receita para baixar estoque.' });

  try {
    await transaction(async (client) => {
      for (const item of comReceita) await baixarEstoqueReceita(item.receita_id, item.quantidade, client);
      await client.query(
        "UPDATE pedidos SET estoque_baixado=TRUE, status='em_producao' WHERE id=$1", [req.params.id]
      );
    });
    res.json(await pedidoCompleto(req.params.id));
  } catch (e) {
    res.status(409).json({ erro: e.message, faltando: e.faltando });
  }
});

async function inserirItens(pedidoId, itens, client) {
  for (const item of itens) {
    let descricao = item.descricao?.trim();
    let preco = item.preco_unitario != null && item.preco_unitario !== '' ? Number(item.preco_unitario) : null;
    const receitaId = item.receita_id || null;
    if (receitaId) {
      const info = await precoSugeridoReceita(receitaId, client);
      if (!info) throw new Error(`Receita ${receitaId} não existe.`);
      if (!descricao) descricao = info.receita.nome;
      if (preco == null) preco = info.preco;
    }
    if (!descricao) throw new Error('Cada item precisa de uma receita ou de uma descrição.');
    if (!(Number(item.quantidade) > 0)) throw new Error('A quantidade de cada item deve ser maior que zero.');
    if (preco == null || isNaN(preco) || preco < 0) throw new Error(`Preço inválido para "${descricao}".`);
    await client.query(
      'INSERT INTO pedido_itens (pedido_id,receita_id,descricao,quantidade,preco_unitario) VALUES ($1,$2,$3,$4,$5)',
      [pedidoId, receitaId, descricao, Number(item.quantidade), preco]
    );
  }
}

async function validarPedido(d, client) {
  if (!Array.isArray(d.itens) || d.itens.length === 0) throw new Error('O pedido precisa de ao menos um item.');
  const status = d.status && STATUS_VALIDOS.includes(d.status) ? d.status : 'pendente';
  const cliente_id = d.cliente_id ? Number(d.cliente_id) : null;
  if (cliente_id) {
    const { rows } = await client.query('SELECT id FROM clientes WHERE id = $1', [cliente_id]);
    if (!rows[0]) throw new Error('Cliente informado não existe.');
  }
  return { cliente_id, data_entrega: d.data_entrega?.trim() || null, status, observacoes: d.observacoes?.trim() || null, itens: d.itens };
}

function round(v) { return Math.round((v + Number.EPSILON) * 100) / 100; }

export default router;
