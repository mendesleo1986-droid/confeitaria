import { Router } from 'express';
import { query, queryOne, execute, transaction } from '../db.js';
import { calcularPrecificacao } from '../precificacao.js';
import { baixarEstoqueReceita, necessidadeReceita } from '../estoque.js';
import { fichaReceitaPDF } from '../pdf.js';

const router = Router();

async function itensDaReceita(receitaId, client = null) {
  const fn = client
    ? (sql, p) => client.query(sql, p).then((r) => r.rows)
    : (sql, p) => query(sql, p);
  const rows = await fn(
    `SELECT ri.id AS item_id, ri.quantidade, i.*
     FROM receita_ingredientes ri
     JOIN ingredientes i ON i.id = ri.ingrediente_id
     WHERE ri.receita_id = $1 ORDER BY LOWER(i.nome)`,
    [receitaId]
  );
  return rows.map(({ item_id, quantidade, ...ingrediente }) => ({ item_id, quantidade, ingrediente }));
}

async function receitaCompleta(receitaId) {
  const receita = await queryOne('SELECT * FROM receitas WHERE id = $1', [receitaId]);
  if (!receita) return null;
  const itens = await itensDaReceita(receitaId);
  const precificacao = calcularPrecificacao(receita, itens);
  return {
    ...receita,
    ingredientes: itens.map((i) => ({
      item_id: i.item_id,
      ingrediente_id: i.ingrediente.id,
      nome: i.ingrediente.nome,
      unidade: i.ingrediente.unidade,
      quantidade: i.quantidade,
    })),
    precificacao,
  };
}

router.get('/', async (req, res) => {
  const receitas = await query('SELECT * FROM receitas ORDER BY LOWER(nome)');
  const lista = await Promise.all(
    receitas.map(async (r) => {
      const itens = await itensDaReceita(r.id);
      const p = calcularPrecificacao(r, itens);
      return {
        id: r.id, nome: r.nome, categoria: r.categoria,
        rendimento: r.rendimento, unidade_rendimento: r.unidade_rendimento,
        qtd_ingredientes: itens.length,
        custo_total: p.custo_total,
        preco_venda_sugerido: p.preco_venda_sugerido,
        preco_por_porcao: p.preco_por_porcao,
      };
    })
  );
  res.json(lista);
});

router.get('/:id', async (req, res) => {
  const receita = await receitaCompleta(req.params.id);
  if (!receita) return res.status(404).json({ erro: 'Receita não encontrada' });
  res.json(receita);
});

router.get('/:id/pdf', async (req, res) => {
  const receita = await receitaCompleta(req.params.id);
  if (!receita) return res.status(404).json({ erro: 'Receita não encontrada' });
  fichaReceitaPDF(receita, res);
});

router.post('/', async (req, res) => {
  const erro = validar(req.body);
  if (erro) return res.status(400).json({ erro });
  try {
    const id = await transaction(async (client) => {
      const norm = normalizar(req.body);
      const { rows } = await client.query(
        `INSERT INTO receitas (nome,categoria,rendimento,unidade_rendimento,modo_preparo,tempo_preparo,
           custo_mao_obra,custo_embalagem,percentual_custos_fixos,margem_lucro)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        [norm.nome,norm.categoria,norm.rendimento,norm.unidade_rendimento,norm.modo_preparo,norm.tempo_preparo,
         norm.custo_mao_obra,norm.custo_embalagem,norm.percentual_custos_fixos,norm.margem_lucro]
      );
      await inserirIngredientes(rows[0].id, req.body.ingredientes || [], client);
      return rows[0].id;
    });
    res.status(201).json(await receitaCompleta(id));
  } catch (e) {
    res.status(400).json({ erro: e.message });
  }
});

router.put('/:id', async (req, res) => {
  const existe = await queryOne('SELECT id FROM receitas WHERE id = $1', [req.params.id]);
  if (!existe) return res.status(404).json({ erro: 'Receita não encontrada' });
  const erro = validar(req.body);
  if (erro) return res.status(400).json({ erro });
  try {
    await transaction(async (client) => {
      const norm = normalizar(req.body);
      await client.query(
        `UPDATE receitas SET nome=$1,categoria=$2,rendimento=$3,unidade_rendimento=$4,modo_preparo=$5,
           tempo_preparo=$6,custo_mao_obra=$7,custo_embalagem=$8,percentual_custos_fixos=$9,
           margem_lucro=$10,atualizado_em=NOW() WHERE id=$11`,
        [norm.nome,norm.categoria,norm.rendimento,norm.unidade_rendimento,norm.modo_preparo,norm.tempo_preparo,
         norm.custo_mao_obra,norm.custo_embalagem,norm.percentual_custos_fixos,norm.margem_lucro,req.params.id]
      );
      await client.query('DELETE FROM receita_ingredientes WHERE receita_id = $1', [req.params.id]);
      await inserirIngredientes(req.params.id, req.body.ingredientes || [], client);
    });
    res.json(await receitaCompleta(req.params.id));
  } catch (e) {
    res.status(400).json({ erro: e.message });
  }
});

router.get('/:id/necessidade', async (req, res) => {
  const existe = await queryOne('SELECT id FROM receitas WHERE id = $1', [req.params.id]);
  if (!existe) return res.status(404).json({ erro: 'Receita não encontrada' });
  const lotes = Number(req.query.lotes) || 1;
  res.json({ lotes, itens: await necessidadeReceita(req.params.id, lotes) });
});

router.post('/:id/produzir', async (req, res) => {
  const existe = await queryOne('SELECT id FROM receitas WHERE id = $1', [req.params.id]);
  if (!existe) return res.status(404).json({ erro: 'Receita não encontrada' });
  const lotes = Number(req.body.lotes);
  if (!(lotes > 0)) return res.status(400).json({ erro: 'Informe um número de lotes maior que zero.' });
  try {
    const necessidades = await transaction((client) => baixarEstoqueReceita(req.params.id, lotes, client));
    res.json({ ok: true, lotes, baixados: necessidades });
  } catch (e) {
    res.status(409).json({ erro: e.message, faltando: e.faltando });
  }
});

router.delete('/:id', async (req, res) => {
  const rowCount = await execute('DELETE FROM receitas WHERE id = $1', [req.params.id]);
  if (rowCount === 0) return res.status(404).json({ erro: 'Receita não encontrada' });
  res.status(204).end();
});

async function inserirIngredientes(receitaId, ingredientes, client) {
  for (const item of ingredientes) {
    if (!item.ingrediente_id || !(Number(item.quantidade) > 0))
      throw new Error('Cada ingrediente precisa de ingrediente_id e quantidade > 0.');
    const { rows } = await client.query('SELECT id FROM ingredientes WHERE id = $1', [item.ingrediente_id]);
    if (!rows[0]) throw new Error(`Ingrediente ${item.ingrediente_id} não existe.`);
    await client.query(
      'INSERT INTO receita_ingredientes (receita_id, ingrediente_id, quantidade) VALUES ($1,$2,$3)',
      [receitaId, item.ingrediente_id, Number(item.quantidade)]
    );
  }
}

function normalizar(d) {
  return {
    nome: d.nome.trim(),
    categoria: d.categoria?.trim() || null,
    rendimento: Number(d.rendimento) || 1,
    unidade_rendimento: d.unidade_rendimento?.trim() || 'porções',
    modo_preparo: d.modo_preparo?.trim() || null,
    tempo_preparo: d.tempo_preparo != null && d.tempo_preparo !== '' ? Number(d.tempo_preparo) : null,
    custo_mao_obra: Number(d.custo_mao_obra) || 0,
    custo_embalagem: Number(d.custo_embalagem) || 0,
    percentual_custos_fixos: Number(d.percentual_custos_fixos) || 0,
    margem_lucro: Number(d.margem_lucro) || 0,
  };
}

function validar(d) {
  if (!d.nome?.trim()) return 'O nome da receita é obrigatório.';
  if (d.rendimento != null && Number(d.rendimento) <= 0) return 'O rendimento deve ser maior que zero.';
  if (d.margem_lucro != null && Number(d.margem_lucro) < 0) return 'A margem de lucro não pode ser negativa.';
  return null;
}

export default router;
