import pool, { query } from './db.js';

function qrows(client, sql, p = []) {
  return (client ? client.query(sql, p) : pool.query(sql, p)).then((r) => r.rows);
}

export async function necessidadeReceita(receitaId, multiplicador, client = null) {
  const itens = await qrows(
    client,
    `SELECT ri.quantidade, i.id, i.nome, i.unidade, i.estoque
     FROM receita_ingredientes ri
     JOIN ingredientes i ON i.id = ri.ingrediente_id
     WHERE ri.receita_id = $1`,
    [receitaId]
  );
  return itens.map((i) => ({
    ingrediente_id: i.id,
    nome: i.nome,
    unidade: i.unidade,
    necessario: i.quantidade * multiplicador,
    estoque: i.estoque,
  }));
}

export async function baixarEstoqueReceita(receitaId, multiplicador, client = null) {
  const necessidades = await necessidadeReceita(receitaId, multiplicador, client);
  const faltando = necessidades.filter((n) => n.estoque < n.necessario - 1e-9);

  if (faltando.length) {
    const lista = faltando
      .map((f) => `${f.nome} (faltam ${round(f.necessario - f.estoque)} ${f.unidade})`)
      .join('; ');
    const err = new Error(`Estoque insuficiente: ${lista}.`);
    err.faltando = faltando;
    throw err;
  }

  for (const n of necessidades) {
    await qrows(client,
      `UPDATE ingredientes SET estoque = estoque - $1, atualizado_em = NOW() WHERE id = $2`,
      [n.necessario, n.ingrediente_id]
    );
  }
  return necessidades;
}

export async function ingredientesEstoqueBaixo() {
  return query(
    `SELECT id, nome, unidade, estoque, estoque_minimo
     FROM ingredientes
     WHERE estoque_minimo > 0 AND estoque <= estoque_minimo
     ORDER BY LOWER(nome)`
  );
}

function round(v) {
  return Math.round((v + Number.EPSILON) * 1000) / 1000;
}
