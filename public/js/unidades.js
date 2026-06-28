// Conversão de unidades para a interface.
// Internamente o sistema sempre armazena na unidade base do ingrediente:
//   massa   -> g
//   volume  -> ml
//   unidade -> un
// Aqui permitimos que o usuário digite em unidades maiores (kg, L) e
// convertemos para a base antes de enviar ao servidor.

const DIMENSOES = {
  g: [
    { valor: 'g', rotulo: 'g', fator: 1 },
    { valor: 'kg', rotulo: 'kg', fator: 1000 },
  ],
  ml: [
    { valor: 'ml', rotulo: 'ml', fator: 1 },
    { valor: 'L', rotulo: 'L', fator: 1000 },
  ],
  un: [{ valor: 'un', rotulo: 'un', fator: 1 }],
};

const Unidades = {
  // Opções de unidade disponíveis para a unidade base de um ingrediente
  opcoes(base) {
    return DIMENSOES[base] || DIMENSOES.un;
  },

  // Converte um valor digitado (na unidade escolhida) para a unidade base
  paraBase(quantidade, unidade) {
    const fator = this._fator(unidade);
    return Number(quantidade) * fator;
  },

  _fator(unidade) {
    for (const lista of Object.values(DIMENSOES)) {
      const op = lista.find((o) => o.valor === unidade);
      if (op) return op.fator;
    }
    return 1;
  },

  // Formata uma quantidade armazenada em base para exibição amigável
  // (ex.: 1500 g -> "1,5 kg"; 800 g -> "800 g")
  formatar(quantidadeBase, base) {
    const q = Number(quantidadeBase) || 0;
    const num = (v) => v.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
    if (base === 'g' && q >= 1000) return `${num(q / 1000)} kg`;
    if (base === 'ml' && q >= 1000) return `${num(q / 1000)} L`;
    return `${num(q)} ${base}`;
  },

  // Monta o <select> de unidades para uma unidade base
  selectHtml(base, unidadeSelecionada, classe = '') {
    const ops = this.opcoes(base)
      .map((o) => `<option value="${o.valor}" ${o.valor === unidadeSelecionada ? 'selected' : ''}>${o.rotulo}</option>`)
      .join('');
    return `<select class="${classe}">${ops}</select>`;
  },
};
