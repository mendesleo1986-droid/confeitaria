import { Router } from 'express';
import db from '../db.js';
import { calcularPrecificacao } from '../precificacao.js';
import { baixarEstoqueReceita, necessidadeReceita } from '../estoque.js';
import { fichaReceitaPDF } from '../pdf.js';

const router = Router();

// Monta a lista de itens (quantidade + ingrediente completo) de uma receita
function itensDaReceita(receitaId) {
  return db
    .prepare(
      `SELECT ri.id AS item_id, ri.quantidade, i.*
       FROM receita_ingredientes ri
       JOIN ingredientes i ON i.id = ri.ingrediente_id
       WHERE ri.receita_id = ?
       ORDER BY i.nome COLLATE NOCASE`
    )
    .all(receitaId)
    .map((row) => {
      const { item_id, quantidade, ...ingrediente } = row;
      return { item_id, quantidade, ingrediente };
    });
}

// Receita completa: dados + ingredientes + precificação calculada
function receitaCompleta(receitaId) {
  const receita = db.prepare('SELECT * FROM receitas WHERE id = ?').get(receitaId);
  if (!receita) return null;
  const itens = itensDaReceita(receitaId);
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

// Lista receitas (resumo + preço sugerido)
router.get('/', (req, res) => {
  const receitas = db.prepare('SELECT * FROM receitas ORDER BY nome COLLATE NOCASE').all();
  const lista = receitas.map((r) => {
    const itens = itensDaReceita(r.id);
    const p = calcularPrecificacao(r, itens);
    return {
      id: r.id,
      nome: r.nome,
      categoria: r.categoria,
      rendimento: r.rendimento,
      unidade_rendimento: r.unidade_rendimento,
      qtd_ingredientes: itens.length,
      custo_total: p.custo_total,
      preco_venda_sugerido: p.preco_venda_sugerido,
      preco_por_porcao: p.preco_por_porcao,
    };
  });
  res.json(lista);
});

// Detalhe de uma receita
router.get('/:id', (req, res) => {
  const receita = receitaCompleta(req.params.id);
  if (!receita) return res.status(404).json({ erro: 'Receita não encontrada' });
  res.json(receita);
});

// Exporta a ficha técnica + precificação em PDF
router.get('/:id/pdf', (req, res) => {
  const receita = receitaCompleta(req.params.id);
  if (!receita) return res.status(404).json({ erro: 'Receita não encontrada' });
  fichaReceitaPDF(receita, res);
});

// Cria receita (com seus ingredientes)
router.post('/', (req, res) => {
  const erro = validar(req.body);
  if (erro) return res.status(400).json({ erro });

  const criar = db.transaction((dados) => {
    const info = db
      .prepare(
        `INSERT INTO receitas
         (nome, categoria, rendimento, unidade_rendimento, modo_preparo, tempo_preparo,
          custo_mao_obra, custo_embalagem, percentual_custos_fixos, margem_lucro)
         VALUES (@nome, @categoria, @rendimento, @unidade_rendimento, @modo_preparo, @tempo_preparo,
          @custo_mao_obra, @custo_embalagem, @percentual_custos_fixos, @margem_lucro)`
      )
      .run(normalizar(dados));
    inserirIngredientes(info.lastInsertRowid, dados.ingredientes || []);
    return info.lastInsertRowid;
  });

  try {
    const id = criar(req.body);
    res.status(201).json(receitaCompleta(id));
  } catch (e) {
    res.status(400).json({ erro: e.message });
  }
});

// Atualiza receita (substitui ingredientes)
router.put('/:id', (req, res) => {
  const existe = db.prepare('SELECT id FROM receitas WHERE id = ?').get(req.params.id);
  if (!existe) return res.status(404).json({ erro: 'Receita não encontrada' });

  const erro = validar(req.body);
  if (erro) return res.status(400).json({ erro });

  const atualizar = db.transaction((id, dados) => {
    db.prepare(
      `UPDATE receitas SET
         nome = @nome, categoria = @categoria, rendimento = @rendimento,
         unidade_rendimento = @unidade_rendimento, modo_preparo = @modo_preparo,
         tempo_preparo = @tempo_preparo, custo_mao_obra = @custo_mao_obra,
         custo_embalagem = @custo_embalagem, percentual_custos_fixos = @percentual_custos_fixos,
         margem_lucro = @margem_lucro, atualizado_em = datetime('now','localtime')
       WHERE id = @id`
    ).run({ ...normalizar(dados), id: Number(id) });

    db.prepare('DELETE FROM receita_ingredientes WHERE receita_id = ?').run(id);
    inserirIngredientes(id, dados.ingredientes || []);
  });

  try {
    atualizar(req.params.id, req.body);
    res.json(receitaCompleta(req.params.id));
  } catch (e) {
    res.status(400).json({ erro: e.message });
  }
});

// Pré-visualiza a necessidade de ingredientes para produzir N lotes
router.get('/:id/necessidade', (req, res) => {
  const existe = db.prepare('SELECT id FROM receitas WHERE id = ?').get(req.params.id);
  if (!existe) return res.status(404).json({ erro: 'Receita não encontrada' });
  const lotes = Number(req.query.lotes) || 1;
  res.json({ lotes, itens: necessidadeReceita(req.params.id, lotes) });
});

// Produz a receita: baixa o estoque dos ingredientes para N lotes
router.post('/:id/produzir', (req, res) => {
  const existe = db.prepare('SELECT id FROM receitas WHERE id = ?').get(req.params.id);
  if (!existe) return res.status(404).json({ erro: 'Receita não encontrada' });

  const lotes = Number(req.body.lotes);
  if (!(lotes > 0)) return res.status(400).json({ erro: 'Informe um número de lotes maior que zero.' });

  try {
    const baixar = db.transaction(() => baixarEstoqueReceita(req.params.id, lotes));
    const necessidades = baixar();
    res.json({ ok: true, lotes, baixados: necessidades });
  } catch (e) {
    res.status(409).json({ erro: e.message, faltando: e.faltando });
  }
});

// Remove receita
router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM receitas WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ erro: 'Receita não encontrada' });
  res.status(204).end();
});

function inserirIngredientes(receitaId, ingredientes) {
  const stmt = db.prepare(
    'INSERT INTO receita_ingredientes (receita_id, ingrediente_id, quantidade) VALUES (?, ?, ?)'
  );
  for (const item of ingredientes) {
    if (!item.ingrediente_id || !(Number(item.quantidade) > 0)) {
      throw new Error('Cada ingrediente da receita precisa de um ingrediente_id e quantidade > 0.');
    }
    const existe = db.prepare('SELECT id FROM ingredientes WHERE id = ?').get(item.ingrediente_id);
    if (!existe) throw new Error(`Ingrediente ${item.ingrediente_id} não existe.`);
    stmt.run(receitaId, item.ingrediente_id, Number(item.quantidade));
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
  if (!d.nome || !d.nome.trim()) return 'O nome da receita é obrigatório.';
  if (d.rendimento != null && Number(d.rendimento) <= 0) return 'O rendimento deve ser maior que zero.';
  if (d.margem_lucro != null && Number(d.margem_lucro) < 0) return 'A margem de lucro não pode ser negativa.';
  return null;
}

export default router;
