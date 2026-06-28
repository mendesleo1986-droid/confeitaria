// Popula o banco com dados de exemplo. Execute com: npm run seed
import db from './db.js';
import { fileURLToPath } from 'node:url';

const ingredientes = [
  // nome, unidade, preco_compra, quantidade_compra, fornecedor, estoque, estoque_minimo
  ['Farinha de trigo', 'g', 5.49, 1000, 'Atacadão', 5000, 1000],
  ['Açúcar refinado', 'g', 4.29, 1000, 'Atacadão', 4000, 1000],
  ['Ovos', 'un', 12.0, 12, 'Granja Local', 24, 12],
  ['Manteiga sem sal', 'g', 9.9, 200, 'Mercado', 400, 200],
  ['Leite integral', 'ml', 4.5, 1000, 'Mercado', 2000, 1000],
  ['Chocolate em pó 50%', 'g', 18.9, 400, 'Distribuidora', 300, 400],
  ['Fermento químico', 'g', 6.5, 100, 'Mercado', 80, 50],
  ['Leite condensado', 'g', 6.99, 395, 'Mercado', 790, 395],
  ['Creme de leite', 'g', 3.5, 200, 'Mercado', 400, 200],
  ['Chocolate granulado', 'g', 14.9, 500, 'Distribuidora', 250, 500],
];

const insertIng = db.prepare(
  `INSERT INTO ingredientes (nome, unidade, preco_compra, quantidade_compra, fornecedor, estoque, estoque_minimo)
   VALUES (?, ?, ?, ?, ?, ?, ?)`
);

const seed = db.transaction(() => {
  // Limpa tudo (cuidado: apaga dados existentes)
  db.exec(
    'DELETE FROM pedido_itens; DELETE FROM pedidos; DELETE FROM clientes;' +
      'DELETE FROM receita_ingredientes; DELETE FROM receitas; DELETE FROM ingredientes;'
  );
  db.exec(
    "DELETE FROM sqlite_sequence WHERE name IN " +
      "('pedido_itens','pedidos','clientes','receita_ingredientes','receitas','ingredientes');"
  );

  const ids = {};
  for (const ing of ingredientes) {
    const info = insertIng.run(...ing);
    ids[ing[0]] = info.lastInsertRowid;
  }

  // Receita 1: Bolo de chocolate
  const bolo = db
    .prepare(
      `INSERT INTO receitas (nome, categoria, rendimento, unidade_rendimento, modo_preparo,
        tempo_preparo, custo_mao_obra, custo_embalagem, percentual_custos_fixos, margem_lucro)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      'Bolo de Chocolate',
      'Bolo',
      12,
      'fatias',
      '1. Bata os ovos com o açúcar e a manteiga.\n2. Acrescente o leite e o chocolate em pó.\n3. Misture a farinha e o fermento.\n4. Asse a 180°C por 40 minutos.',
      60,
      20,
      5,
      15,
      120
    ).lastInsertRowid;

  // Receita 2: Brigadeiro gourmet
  const brigadeiro = db
    .prepare(
      `INSERT INTO receitas (nome, categoria, rendimento, unidade_rendimento, modo_preparo,
        tempo_preparo, custo_mao_obra, custo_embalagem, percentual_custos_fixos, margem_lucro)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      'Brigadeiro Gourmet',
      'Doce',
      30,
      'unidades',
      '1. Misture o leite condensado, o chocolate em pó e o creme de leite.\n2. Cozinhe em fogo baixo mexendo até desgrudar do fundo.\n3. Deixe esfriar, enrole e passe no granulado.',
      30,
      15,
      8,
      10,
      150
    ).lastInsertRowid;

  const insertRI = db.prepare(
    'INSERT INTO receita_ingredientes (receita_id, ingrediente_id, quantidade) VALUES (?, ?, ?)'
  );

  // Ingredientes do bolo (unidades base: g, un, ml)
  insertRI.run(bolo, ids['Farinha de trigo'], 400);
  insertRI.run(bolo, ids['Açúcar refinado'], 300);
  insertRI.run(bolo, ids['Ovos'], 4);
  insertRI.run(bolo, ids['Manteiga sem sal'], 100);
  insertRI.run(bolo, ids['Leite integral'], 200);
  insertRI.run(bolo, ids['Chocolate em pó 50%'], 100);
  insertRI.run(bolo, ids['Fermento químico'], 15);

  // Ingredientes do brigadeiro
  insertRI.run(brigadeiro, ids['Leite condensado'], 395);
  insertRI.run(brigadeiro, ids['Chocolate em pó 50%'], 60);
  insertRI.run(brigadeiro, ids['Creme de leite'], 100);
  insertRI.run(brigadeiro, ids['Chocolate granulado'], 100);

  // Cliente e pedido de exemplo
  const cliente = db
    .prepare('INSERT INTO clientes (nome, telefone, email) VALUES (?, ?, ?)')
    .run('Maria Silva', '(11) 98888-7777', 'maria@email.com').lastInsertRowid;

  const pedido = db
    .prepare(
      `INSERT INTO pedidos (cliente_id, data_entrega, status, observacoes)
       VALUES (?, date('now','+3 days'), 'pendente', 'Entregar gelado')`
    )
    .run(cliente).lastInsertRowid;

  db.prepare(
    'INSERT INTO pedido_itens (pedido_id, receita_id, descricao, quantidade, preco_unitario) VALUES (?, ?, ?, ?, ?)'
  ).run(pedido, bolo, 'Bolo de Chocolate', 1, 111.4);
  db.prepare(
    'INSERT INTO pedido_itens (pedido_id, receita_id, descricao, quantidade, preco_unitario) VALUES (?, ?, ?, ?, ?)'
  ).run(pedido, brigadeiro, 'Brigadeiro Gourmet', 2, 103.28);
});

export function runSeed() {
  seed();
  console.log('✅ Banco populado: 10 ingredientes, 2 receitas, 1 cliente, 1 pedido.');
}

// Executado diretamente via CLI (npm run seed)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runSeed();
  process.exit(0);
}
