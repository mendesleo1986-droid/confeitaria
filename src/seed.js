// Popula o banco com dados de exemplo. Execute com: npm run seed
import db from './db.js';

const ingredientes = [
  // nome, unidade, preco_compra, quantidade_compra, fornecedor
  ['Farinha de trigo', 'g', 5.49, 1000, 'Atacadão'],
  ['Açúcar refinado', 'g', 4.29, 1000, 'Atacadão'],
  ['Ovos', 'un', 12.0, 12, 'Granja Local'],
  ['Manteiga sem sal', 'g', 9.9, 200, 'Mercado'],
  ['Leite integral', 'ml', 4.5, 1000, 'Mercado'],
  ['Chocolate em pó 50%', 'g', 18.9, 400, 'Distribuidora'],
  ['Fermento químico', 'g', 6.5, 100, 'Mercado'],
  ['Leite condensado', 'g', 6.99, 395, 'Mercado'],
  ['Creme de leite', 'g', 3.5, 200, 'Mercado'],
  ['Chocolate granulado', 'g', 14.9, 500, 'Distribuidora'],
];

const insertIng = db.prepare(
  `INSERT INTO ingredientes (nome, unidade, preco_compra, quantidade_compra, fornecedor)
   VALUES (?, ?, ?, ?, ?)`
);

const seed = db.transaction(() => {
  // Limpa tudo (cuidado: apaga dados existentes)
  db.exec('DELETE FROM receita_ingredientes; DELETE FROM receitas; DELETE FROM ingredientes;');
  db.exec("DELETE FROM sqlite_sequence WHERE name IN ('receita_ingredientes','receitas','ingredientes');");

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
});

seed();
console.log('✅ Banco populado com dados de exemplo (2 receitas, 10 ingredientes).');
process.exit(0);
