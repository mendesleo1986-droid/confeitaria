import db from './db.js';

// Necessidade de ingredientes para produzir `multiplicador` lotes de uma receita.
export function necessidadeReceita(receitaId, multiplicador) {
  const itens = db
    .prepare(
      `SELECT ri.quantidade, i.id, i.nome, i.unidade, i.estoque
       FROM receita_ingredientes ri
       JOIN ingredientes i ON i.id = ri.ingrediente_id
       WHERE ri.receita_id = ?`
    )
    .all(receitaId);

  return itens.map((i) => ({
    ingrediente_id: i.id,
    nome: i.nome,
    unidade: i.unidade,
    necessario: i.quantidade * multiplicador,
    estoque: i.estoque,
  }));
}

// Baixa o estoque para produzir `multiplicador` lotes da receita.
// Lança Error (com .faltando) se algum ingrediente não tiver estoque suficiente.
// Deve ser chamada dentro de uma transação.
export function baixarEstoqueReceita(receitaId, multiplicador) {
  const necessidades = necessidadeReceita(receitaId, multiplicador);
  const faltando = necessidades.filter((n) => n.estoque < n.necessario - 1e-9);

  if (faltando.length) {
    const lista = faltando
      .map((f) => `${f.nome} (faltam ${round(f.necessario - f.estoque)} ${f.unidade})`)
      .join('; ');
    const err = new Error(`Estoque insuficiente: ${lista}.`);
    err.faltando = faltando;
    throw err;
  }

  const upd = db.prepare(
    `UPDATE ingredientes SET estoque = estoque - ?, atualizado_em = datetime('now','localtime') WHERE id = ?`
  );
  for (const n of necessidades) upd.run(n.necessario, n.ingrediente_id);
  return necessidades;
}

// Lista ingredientes com estoque igual ou abaixo do mínimo definido (>0).
export function ingredientesEstoqueBaixo() {
  return db
    .prepare(
      `SELECT id, nome, unidade, estoque, estoque_minimo
       FROM ingredientes
       WHERE estoque_minimo > 0 AND estoque <= estoque_minimo
       ORDER BY nome COLLATE NOCASE`
    )
    .all();
}

function round(v) {
  return Math.round((v + Number.EPSILON) * 1000) / 1000;
}
