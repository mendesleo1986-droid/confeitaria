// Máscaras e validações de entrada (telefone, dinheiro, CPF/CNPJ, e-mail).
// Uso: adicione data-mask="telefone|dinheiro|documento" a um <input> e chame
// Mascaras.aplicar(container) — o modal já faz isso automaticamente.
const Mascaras = (() => {
  const soDigitos = (s) => String(s ?? '').replace(/\D/g, '');

  // ---- Dinheiro (R$): sempre no formato "1.234,56" ----
  function dinheiro(valor) {
    let d = soDigitos(valor);
    if (!d) return '';
    while (d.length < 3) d = '0' + d;
    const centavos = d.slice(-2);
    let inteiro = d.slice(0, -2).replace(/^0+(?=\d)/, '');
    inteiro = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${inteiro},${centavos}`;
  }

  // Formata um número (5.49) para string de máscara ("5,49").
  function dinheiroDeNumero(n) {
    if (n === '' || n == null) return '';
    const num = Number(n);
    return isNaN(num) ? '' : dinheiro(num.toFixed(2));
  }

  // Converte string mascarada ("R$ 1.234,56") em número (1234.56).
  function paraNumero(valor) {
    if (typeof valor === 'number') return valor;
    const s = String(valor ?? '').replace(/[^\d,.-]/g, '');
    if (!s) return 0;
    const n = parseFloat(s.replace(/\./g, '').replace(',', '.'));
    return isNaN(n) ? 0 : n;
  }

  // ---- Telefone: (00) 0000-0000 ou (00) 00000-0000 ----
  function telefone(valor) {
    const d = soDigitos(valor).slice(0, 11);
    if (!d) return '';
    if (d.length <= 2) return `(${d}`;
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }

  // ---- CPF (000.000.000-00) ou CNPJ (00.000.000/0000-00) ----
  function documento(valor) {
    const d = soDigitos(valor).slice(0, 14);
    if (!d) return '';
    if (d.length <= 11) {
      let out = d.slice(0, 3);
      if (d.length > 3) out += '.' + d.slice(3, 6);
      if (d.length > 6) out += '.' + d.slice(6, 9);
      if (d.length > 9) out += '-' + d.slice(9, 11);
      return out;
    }
    let out = d.slice(0, 2);
    out += '.' + d.slice(2, 5);
    out += '.' + d.slice(5, 8);
    out += '/' + d.slice(8, 12);
    if (d.length > 12) out += '-' + d.slice(12, 14);
    return out;
  }

  // ---- Validações ----
  function validarEmail(email) {
    if (!email) return true; // opcional
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
  }

  function validarCPF(cpf) {
    cpf = soDigitos(cpf);
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    let s = 0;
    for (let i = 0; i < 9; i++) s += +cpf[i] * (10 - i);
    let d1 = (s * 10) % 11;
    if (d1 === 10) d1 = 0;
    if (d1 !== +cpf[9]) return false;
    s = 0;
    for (let i = 0; i < 10; i++) s += +cpf[i] * (11 - i);
    let d2 = (s * 10) % 11;
    if (d2 === 10) d2 = 0;
    return d2 === +cpf[10];
  }

  function validarCNPJ(cnpj) {
    cnpj = soDigitos(cnpj);
    if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
    const calc = (len) => {
      let soma = 0;
      let pos = len - 7;
      for (let i = len; i >= 1; i--) {
        soma += +cnpj[len - i] * pos--;
        if (pos < 2) pos = 9;
      }
      const r = soma % 11;
      return r < 2 ? 0 : 11 - r;
    };
    if (calc(12) !== +cnpj[12]) return false;
    return calc(13) !== +cnpj[13] ? false : true;
  }

  // Valida documento como CPF (11 díg.) ou CNPJ (14 díg.). Vazio = válido (opcional).
  function validarDocumento(valor) {
    const d = soDigitos(valor);
    if (!d) return true;
    if (d.length === 11) return validarCPF(d);
    if (d.length === 14) return validarCNPJ(d);
    return false;
  }

  // Valida telefone (10 ou 11 dígitos). Vazio = válido (opcional).
  function validarTelefone(valor) {
    const d = soDigitos(valor);
    return d.length === 0 || d.length === 10 || d.length === 11;
  }

  const FORMATADORES = { telefone, dinheiro, documento };

  // Liga as máscaras aos inputs [data-mask] dentro de um container.
  function aplicar(container) {
    if (!container) return;
    container.querySelectorAll('[data-mask]').forEach((inp) => {
      const fn = FORMATADORES[inp.dataset.mask];
      if (!fn) return;
      if (inp.value) inp.value = fn(inp.value);
      if (inp.dataset.maskBound) return;
      inp.dataset.maskBound = '1';
      inp.addEventListener('input', () => {
        inp.value = fn(inp.value);
      });
    });
  }

  // Converte os campos de dinheiro do form (mascarados) em números no objeto `dados`.
  function numerizarDinheiro(form, dados) {
    form.querySelectorAll('[data-mask="dinheiro"]').forEach((inp) => {
      if (inp.name) dados[inp.name] = paraNumero(inp.value);
    });
    return dados;
  }

  return {
    dinheiro,
    dinheiroDeNumero,
    paraNumero,
    telefone,
    documento,
    validarEmail,
    validarCPF,
    validarCNPJ,
    validarDocumento,
    validarTelefone,
    aplicar,
    numerizarDinheiro,
    soDigitos,
  };
})();
