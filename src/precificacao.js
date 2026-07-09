// Lógica de cálculo de custo e precificação de receitas.
// Mantida separada das rotas para facilitar testes e reuso.

/**
 * Custo por unidade base de um ingrediente (ex.: R$ por grama).
 * preco_compra / quantidade_compra.
 */
export function custoUnitario(ingrediente) {
  if (!ingrediente.quantidade_compra) return 0;
  return ingrediente.preco_compra / ingrediente.quantidade_compra;
}

/**
 * Calcula a precificação completa de uma receita.
 *
 * @param {object} receita  Linha da tabela receitas (com parâmetros de precificação).
 * @param {Array}  itens    Lista de { quantidade, ingrediente }, onde `ingrediente`
 *                          é a linha da tabela ingredientes.
 * @returns {object} Detalhamento completo de custos e preços.
 */
export function calcularPrecificacao(receita, itens) {
  const rendimento = receita.rendimento > 0 ? receita.rendimento : 1;
  const margem = receita.margem_lucro ?? 0;
  const percFixos = receita.percentual_custos_fixos ?? 0;
  const maoObra = receita.custo_mao_obra ?? 0;
  const embalagem = receita.custo_embalagem ?? 0;

  const ingredientesDetalhe = itens.map((item) => {
    const unit = custoUnitario(item.ingrediente);
    const custo = unit * item.quantidade;
    return {
      ingrediente_id: item.ingrediente.id,
      nome: item.ingrediente.nome,
      unidade: item.ingrediente.unidade,
      quantidade: item.quantidade,
      custo_unitario: round(unit, 6),
      custo_total: round(custo, 4),
    };
  });

  const custoIngredientes = ingredientesDetalhe.reduce((s, i) => s + i.custo_total, 0);

  // Subtotal direto = ingredientes + mão de obra + embalagem
  const subtotal = custoIngredientes + maoObra + embalagem;

  // Custos fixos (gás, luz, água...) aplicados como % sobre o subtotal direto
  const custosFixos = subtotal * (percFixos / 100);

  const custoTotal = subtotal + custosFixos;

  // Preço de venda = custo total acrescido da margem de lucro (markup)
  const precoVenda = custoTotal * (1 + margem / 100);
  const lucro = precoVenda - custoTotal;

  return {
    rendimento,
    unidade_rendimento: receita.unidade_rendimento || 'porções',
    ingredientes: ingredientesDetalhe,
    custo_ingredientes: round(custoIngredientes),
    custo_mao_obra: round(maoObra),
    custo_embalagem: round(embalagem),
    percentual_custos_fixos: percFixos,
    custos_fixos: round(custosFixos),
    custo_total: round(custoTotal),
    custo_por_porcao: round(custoTotal / rendimento),
    margem_lucro: margem,
    lucro_total: round(lucro),
    preco_venda_sugerido: round(precoVenda),
    preco_por_porcao: round(precoVenda / rendimento),
  };
}

function round(value, casas = 2) {
  const f = 10 ** casas;
  return Math.round((value + Number.EPSILON) * f) / f;
}
