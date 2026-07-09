import { transaction } from './db.js';
import { fileURLToPath } from 'node:url';

const ingredientes = [
  ['Farinha de trigo',    'g',  5.49, 1000, 'Atacadão',      5000, 1000],
  ['Açúcar refinado',    'g',  4.29, 1000, 'Atacadão',      4000, 1000],
  ['Ovos',               'un', 12.0,   12, 'Granja Local',    24,   12],
  ['Manteiga sem sal',   'g',  9.9,   200, 'Mercado',        400,  200],
  ['Leite integral',     'ml', 4.5,  1000, 'Mercado',       2000, 1000],
  ['Chocolate em pó 50%','g', 18.9,   400, 'Distribuidora',  300,  400],
  ['Fermento químico',   'g',  6.5,   100, 'Mercado',         80,   50],
  ['Leite condensado',   'g',  6.99,  395, 'Mercado',        790,  395],
  ['Creme de leite',     'g',  3.5,   200, 'Mercado',        400,  200],
  ['Chocolate granulado','g', 14.9,   500, 'Distribuidora',  250,  500],
];

export async function runSeed() {
  await transaction(async (client) => {
    await client.query(
      'TRUNCATE pedido_itens, receita_ingredientes, pedidos, receitas, ingredientes, clientes RESTART IDENTITY CASCADE'
    );

    const ids = {};
    for (const ing of ingredientes) {
      const r = await client.query(
        `INSERT INTO ingredientes (nome, unidade, preco_compra, quantidade_compra, fornecedor, estoque, estoque_minimo)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        ing
      );
      ids[ing[0]] = r.rows[0].id;
    }

    const bolo = (await client.query(
      `INSERT INTO receitas (nome, categoria, rendimento, unidade_rendimento, modo_preparo,
         tempo_preparo, custo_mao_obra, custo_embalagem, percentual_custos_fixos, margem_lucro)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      ['Bolo de Chocolate','Bolo',12,'fatias',
       '1. Bata os ovos com o açúcar e a manteiga.\n2. Acrescente o leite e o chocolate em pó.\n3. Misture a farinha e o fermento.\n4. Asse a 180°C por 40 minutos.',
       60,20,5,15,120]
    )).rows[0].id;

    const brigadeiro = (await client.query(
      `INSERT INTO receitas (nome, categoria, rendimento, unidade_rendimento, modo_preparo,
         tempo_preparo, custo_mao_obra, custo_embalagem, percentual_custos_fixos, margem_lucro)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      ['Brigadeiro Gourmet','Doce',30,'unidades',
       '1. Misture o leite condensado, o chocolate em pó e o creme de leite.\n2. Cozinhe em fogo baixo mexendo até desgrudar do fundo.\n3. Deixe esfriar, enrole e passe no granulado.',
       30,15,8,10,150]
    )).rows[0].id;

    const ri = (receitaId, ingredienteId, qtd) =>
      client.query(
        'INSERT INTO receita_ingredientes (receita_id, ingrediente_id, quantidade) VALUES ($1,$2,$3)',
        [receitaId, ingredienteId, qtd]
      );

    await ri(bolo, ids['Farinha de trigo'],     400);
    await ri(bolo, ids['Açúcar refinado'],      300);
    await ri(bolo, ids['Ovos'],                   4);
    await ri(bolo, ids['Manteiga sem sal'],      100);
    await ri(bolo, ids['Leite integral'],         200);
    await ri(bolo, ids['Chocolate em pó 50%'],   100);
    await ri(bolo, ids['Fermento químico'],        15);

    await ri(brigadeiro, ids['Leite condensado'],    395);
    await ri(brigadeiro, ids['Chocolate em pó 50%'],  60);
    await ri(brigadeiro, ids['Creme de leite'],       100);
    await ri(brigadeiro, ids['Chocolate granulado'],  100);

    const cliente = (await client.query(
      'INSERT INTO clientes (nome, telefone, email) VALUES ($1,$2,$3) RETURNING id',
      ['Maria Silva','(11) 98888-7777','maria@email.com']
    )).rows[0].id;

    const pedido = (await client.query(
      `INSERT INTO pedidos (cliente_id, data_entrega, status, observacoes)
       VALUES ($1, CURRENT_DATE + INTERVAL '3 days', 'pendente', 'Entregar gelado') RETURNING id`,
      [cliente]
    )).rows[0].id;

    await client.query(
      'INSERT INTO pedido_itens (pedido_id, receita_id, descricao, quantidade, preco_unitario) VALUES ($1,$2,$3,$4,$5)',
      [pedido, bolo, 'Bolo de Chocolate', 1, 111.4]
    );
    await client.query(
      'INSERT INTO pedido_itens (pedido_id, receita_id, descricao, quantidade, preco_unitario) VALUES ($1,$2,$3,$4,$5)',
      [pedido, brigadeiro, 'Brigadeiro Gourmet', 2, 103.28]
    );
  });
  console.log('✅ Banco populado: 10 ingredientes, 2 receitas, 1 cliente, 1 pedido.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runSeed().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
}
