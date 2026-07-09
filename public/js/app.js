// ====== Estado e utilidades ======
let ingredientesCache = [];

const fmt = (v) =>
  (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtNum = (v) =>
  (Number(v) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 4 });

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const el = (html) => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

// Custo unitário em unidade legível: por kg (g), por L (ml) ou por un.
function custoUnitarioLegivel(i) {
  if (i.unidade === 'g') return `${fmt(i.custo_unitario * 1000)} / kg`;
  if (i.unidade === 'ml') return `${fmt(i.custo_unitario * 1000)} / L`;
  return `${fmt(i.custo_unitario)} / un`;
}

function toast(msg, erro = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.toggle('erro', erro);
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.hidden = true), 3000);
}

// ====== Modal ======
const overlay = $('#modal-overlay');
function abrirModal(html) {
  $('#modal-content').innerHTML = '';
  $('#modal-content').appendChild(typeof html === 'string' ? el(html) : html);
  Mascaras.aplicar($('#modal-content'));
  overlay.hidden = false;
}
function fecharModal() {
  overlay.hidden = true;
  $('#modal-content').innerHTML = '';
}
$('#modal-close').addEventListener('click', fecharModal);
overlay.addEventListener('click', (e) => {
  if (e.target === overlay) fecharModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !overlay.hidden) fecharModal();
});

// ====== Navegação por abas ======
$$('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    $$('.tab').forEach((t) => t.classList.remove('active'));
    $$('.view').forEach((v) => v.classList.remove('active'));
    tab.classList.add('active');
    $(`#view-${tab.dataset.view}`).classList.add('active');
    carregarView(tab.dataset.view);
  });
});

function carregarView(view) {
  if (view === 'painel') renderPainel();
  if (view === 'ingredientes') renderIngredientes();
  if (view === 'receitas') renderReceitas();
  if (view === 'pedidos') renderPedidos();
  if (view === 'clientes') renderClientes();
}

// ====== Painel ======
async function renderPainel() {
  try {
    const [resumo, receitas] = await Promise.all([API.resumo(), API.receitas.listar()]);
    const cards = [
      ['Ingredientes', resumo.total_ingredientes],
      ['Receitas', resumo.total_receitas],
      ['Clientes', resumo.total_clientes],
      ['Pedidos em aberto', resumo.pedidos_abertos],
      ['Custo total das receitas', fmt(resumo.custo_total_receitas)],
      ['Receita potencial', fmt(resumo.receita_potencial)],
      ['Lucro potencial', fmt(resumo.lucro_potencial)],
    ];
    $('#resumo-cards').innerHTML = cards
      .map(
        ([rotulo, valor]) =>
          `<div class="card"><div class="valor">${esc(valor)}</div><div class="rotulo">${esc(rotulo)}</div></div>`
      )
      .join('');

    // Alerta de estoque baixo
    const alerta = $('#alerta-estoque');
    if (resumo.estoque_baixo?.length) {
      alerta.innerHTML = `<div class="alerta">
        <strong>⚠️ Estoque baixo (${resumo.estoque_baixo.length})</strong>
        <ul>${resumo.estoque_baixo
          .map((i) => `<li>${esc(i.nome)} — ${Unidades.formatar(i.estoque, i.unidade)} (mín.: ${Unidades.formatar(i.estoque_minimo, i.unidade)})</li>`)
          .join('')}</ul>
      </div>`;
    } else {
      alerta.innerHTML = '';
    }

    const tbody = $('#tabela-resumo-receitas tbody');
    if (!receitas.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="vazio">Nenhuma receita cadastrada ainda.</td></tr>`;
      return;
    }
    tbody.innerHTML = receitas
      .map(
        (r) => `<tr>
          <td>${esc(r.nome)}</td>
          <td>${esc(r.categoria || '—')}</td>
          <td>${fmtNum(r.rendimento)} ${esc(r.unidade_rendimento)}</td>
          <td class="num">${fmt(r.custo_total)}</td>
          <td class="num">${fmt(r.preco_venda_sugerido)}</td>
          <td class="num">${fmt(r.preco_por_porcao)}</td>
        </tr>`
      )
      .join('');
  } catch (e) {
    toast(e.message, true);
  }
}

// ====== Ingredientes ======
async function renderIngredientes() {
  try {
    ingredientesCache = await API.ingredientes.listar();
    const tbody = $('#tabela-ingredientes tbody');
    if (!ingredientesCache.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="vazio">Nenhum ingrediente cadastrado. Clique em "+ Novo ingrediente".</td></tr>`;
      return;
    }
    tbody.innerHTML = ingredientesCache
      .map((i) => {
        const baixo = i.estoque_minimo > 0 && i.estoque <= i.estoque_minimo;
        return `<tr>
          <td>${esc(i.nome)}</td>
          <td class="num">${fmt(i.preco_compra)}</td>
          <td class="num">${Unidades.formatar(i.quantidade_compra, i.unidade)}</td>
          <td class="num">${custoUnitarioLegivel(i)}</td>
          <td class="num ${baixo ? 'estoque-baixo' : ''}">${Unidades.formatar(i.estoque, i.unidade)}${baixo ? ' ⚠️' : ''}</td>
          <td>${esc(i.fornecedor || '—')}</td>
          <td class="num">
            <button class="btn small ghost" data-edit="${i.id}">Editar</button>
            <button class="btn small danger" data-del="${i.id}">Excluir</button>
          </td>
        </tr>`;
      })
      .join('');

    tbody.querySelectorAll('[data-edit]').forEach((b) =>
      b.addEventListener('click', () => formIngrediente(ingredientesCache.find((x) => x.id == b.dataset.edit)))
    );
    tbody.querySelectorAll('[data-del]').forEach((b) =>
      b.addEventListener('click', () => excluirIngrediente(b.dataset.del))
    );
  } catch (e) {
    toast(e.message, true);
  }
}

function formIngrediente(ing = null) {
  const editando = !!ing;
  const base = ing?.unidade || 'g';
  const form = el(`<form>
    <h3>${editando ? 'Editar' : 'Novo'} ingrediente</h3>
    <div class="form-grid">
      <div class="field full">
        <label>Nome *</label>
        <input name="nome" required value="${esc(ing?.nome || '')}" placeholder="Ex.: Farinha de trigo" />
      </div>
      <div class="field">
        <label>Unidade base *</label>
        <select name="unidade" id="sel-base">
          <option value="g" ${base === 'g' ? 'selected' : ''}>Massa (g)</option>
          <option value="ml" ${base === 'ml' ? 'selected' : ''}>Volume (ml)</option>
          <option value="un" ${base === 'un' ? 'selected' : ''}>Unidades (un)</option>
        </select>
      </div>
      <div class="field">
        <label>Fornecedor</label>
        <input name="fornecedor" value="${esc(ing?.fornecedor || '')}" placeholder="Opcional" />
      </div>
      <div class="field">
        <label>Preço de compra (R$) *</label>
        <input name="preco_compra" data-mask="dinheiro" inputmode="numeric" required value="${Mascaras.dinheiroDeNumero(ing?.preco_compra)}" placeholder="0,00" />
      </div>
      <div class="field">
        <label>Qtd. da embalagem *</label>
        <div class="qtd-unidade">
          <input name="quantidade_compra" type="number" step="0.001" min="0.001" required value="${ing?.quantidade_compra ?? ''}" placeholder="Ex.: 1" />
          <span id="wrap-un-compra">${Unidades.selectHtml(base, base, 'sel-un-compra')}</span>
        </div>
      </div>
      <div class="field">
        <label>Estoque atual <span class="un-base">(${base})</span></label>
        <input name="estoque" type="number" step="0.001" min="0" value="${ing?.estoque ?? 0}" />
      </div>
      <div class="field">
        <label>Estoque mínimo <span class="un-base">(${base})</span></label>
        <input name="estoque_minimo" type="number" step="0.001" min="0" value="${ing?.estoque_minimo ?? 0}" />
      </div>
    </div>
    <p class="hint" id="custo-preview"></p>
    <div class="form-actions">
      <button type="button" class="btn ghost" data-cancel>Cancelar</button>
      <button type="submit" class="btn primary">${editando ? 'Salvar' : 'Cadastrar'}</button>
    </div>
  </form>`);

  const selBase = $('#sel-base', form);
  // Ao trocar a unidade base, recria o seletor de unidade da compra e os rótulos
  selBase.addEventListener('change', () => {
    const b = selBase.value;
    $('#wrap-un-compra', form).innerHTML = Unidades.selectHtml(b, b, 'sel-un-compra');
    $$('.un-base', form).forEach((s) => (s.textContent = `(${b})`));
    preview();
  });

  const preview = () => {
    const p = Mascaras.paraNumero(form.preco_compra.value);
    const unCompra = $('.sel-un-compra', form)?.value || selBase.value;
    const qBase = Unidades.paraBase(form.quantidade_compra.value, unCompra);
    $('#custo-preview', form).textContent =
      p > 0 && qBase > 0 ? `Custo unitário: ${fmt(p / qBase)} por ${selBase.value}` : '';
  };
  form.addEventListener('input', preview);
  preview();

  form.querySelector('[data-cancel]').addEventListener('click', fecharModal);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const dados = Object.fromEntries(new FormData(form));
    Mascaras.numerizarDinheiro(form, dados);
    // Converte a quantidade da compra para a unidade base
    const unCompra = $('.sel-un-compra', form)?.value || dados.unidade;
    dados.quantidade_compra = Unidades.paraBase(dados.quantidade_compra, unCompra);
    try {
      if (editando) await API.ingredientes.atualizar(ing.id, dados);
      else await API.ingredientes.criar(dados);
      fecharModal();
      toast(editando ? 'Ingrediente atualizado.' : 'Ingrediente cadastrado.');
      renderIngredientes();
    } catch (err) {
      toast(err.message, true);
    }
  });

  abrirModal(form);
}

async function excluirIngrediente(id) {
  if (!confirm('Excluir este ingrediente?')) return;
  try {
    await API.ingredientes.remover(id);
    toast('Ingrediente excluído.');
    renderIngredientes();
  } catch (e) {
    toast(e.message, true);
  }
}

$('#btn-novo-ingrediente').addEventListener('click', () => formIngrediente());

// ====== Receitas ======
async function renderReceitas() {
  try {
    const receitas = await API.receitas.listar();
    const cont = $('#lista-receitas');
    if (!receitas.length) {
      cont.innerHTML = `<p class="vazio">Nenhuma receita cadastrada. Clique em "+ Nova receita".</p>`;
      return;
    }
    cont.innerHTML = '';
    receitas.forEach((r) => {
      const card = el(`<div class="card receita-card">
        <h4>${esc(r.nome)}</h4>
        ${r.categoria ? `<span class="tag">${esc(r.categoria)}</span>` : ''}
        <div class="sub">${fmtNum(r.rendimento)} ${esc(r.unidade_rendimento)} • ${r.qtd_ingredientes} ingrediente(s)</div>
        <div class="preco">${fmt(r.preco_venda_sugerido)}</div>
        <div class="sub">Custo: ${fmt(r.custo_total)} • ${fmt(r.preco_por_porcao)}/porção</div>
      </div>`);
      card.addEventListener('click', () => detalheReceita(r.id));
      cont.appendChild(card);
    });
  } catch (e) {
    toast(e.message, true);
  }
}

async function detalheReceita(id) {
  try {
    const r = await API.receitas.obter(id);
    const p = r.precificacao;
    const ingrLinhas = p.ingredientes
      .map(
        (i) => `<div class="preco-linha"><span>${esc(i.nome)} — ${fmtNum(i.quantidade)} ${esc(i.unidade)}</span><span>${fmt(i.custo_total)}</span></div>`
      )
      .join('');

    abrirModal(`<div>
      <h3>${esc(r.nome)}</h3>
      ${r.categoria ? `<span class="tag">${esc(r.categoria)}</span>` : ''}
      <p class="hint">Rende ${fmtNum(r.rendimento)} ${esc(r.unidade_rendimento)}${r.tempo_preparo ? ` • ${r.tempo_preparo} min de preparo` : ''}</p>

      <h4 style="color:var(--marrom)">Ingredientes</h4>
      <div class="preco-box">
        ${ingrLinhas || '<div class="hint">Sem ingredientes.</div>'}
        <div class="preco-linha total"><span>Custo dos ingredientes</span><span>${fmt(p.custo_ingredientes)}</span></div>
      </div>

      <h4 style="color:var(--marrom)">Precificação</h4>
      <div class="preco-box">
        <div class="preco-linha"><span>Custo dos ingredientes</span><span>${fmt(p.custo_ingredientes)}</span></div>
        <div class="preco-linha"><span>Mão de obra</span><span>${fmt(p.custo_mao_obra)}</span></div>
        <div class="preco-linha"><span>Embalagem</span><span>${fmt(p.custo_embalagem)}</span></div>
        <div class="preco-linha"><span>Custos fixos (${fmtNum(p.percentual_custos_fixos)}%)</span><span>${fmt(p.custos_fixos)}</span></div>
        <div class="preco-linha total"><span>Custo total</span><span>${fmt(p.custo_total)}</span></div>
        <div class="preco-linha"><span>Custo por porção</span><span>${fmt(p.custo_por_porcao)}</span></div>
        <div class="preco-linha"><span>Margem de lucro (${fmtNum(p.margem_lucro)}%)</span><span>${fmt(p.lucro_total)}</span></div>
        <div class="preco-linha destaque total"><span>Preço de venda sugerido</span><span>${fmt(p.preco_venda_sugerido)}</span></div>
        <div class="preco-linha destaque"><span>Preço por porção</span><span>${fmt(p.preco_por_porcao)}</span></div>
      </div>

      ${r.modo_preparo ? `<h4 style="color:var(--marrom)">Modo de preparo</h4><p style="white-space:pre-line">${esc(r.modo_preparo)}</p>` : ''}

      <div class="form-actions">
        <button class="btn danger" data-del>Excluir</button>
        <a class="btn ghost" href="${API.receitas.pdfUrl(r.id)}" target="_blank" rel="noopener">Exportar PDF</a>
        <button class="btn ghost" data-produzir>Produzir</button>
        <button class="btn primary" data-edit>Editar</button>
      </div>
    </div>`);

    $('#modal-content [data-produzir]').addEventListener('click', () => produzirReceita(r));
    $('#modal-content [data-edit]').addEventListener('click', () => formReceita(r));
    $('#modal-content [data-del]').addEventListener('click', async () => {
      if (!confirm('Excluir esta receita?')) return;
      try {
        await API.receitas.remover(r.id);
        fecharModal();
        toast('Receita excluída.');
        renderReceitas();
      } catch (e) {
        toast(e.message, true);
      }
    });
  } catch (e) {
    toast(e.message, true);
  }
}

// Produz N lotes de uma receita, dando baixa no estoque
async function produzirReceita(r) {
  const resp = prompt(`Quantos lotes de "${r.nome}" deseja produzir?\n(cada lote rende ${fmtNum(r.rendimento)} ${r.unidade_rendimento})`, '1');
  if (resp == null) return;
  const lotes = Number(resp.replace(',', '.'));
  if (!(lotes > 0)) return toast('Informe um número de lotes válido.', true);
  try {
    await API.receitas.produzir(r.id, lotes);
    toast(`Produzido(s) ${fmtNum(lotes)} lote(s). Estoque atualizado.`);
    fecharModal();
    ingredientesCache = [];
  } catch (e) {
    toast(e.message, true);
  }
}

async function formReceita(receita = null) {
  const editando = !!receita;
  // Garante que temos a lista de ingredientes disponível
  if (!ingredientesCache.length) ingredientesCache = await API.ingredientes.listar();

  if (!ingredientesCache.length) {
    toast('Cadastre ao menos um ingrediente antes de criar receitas.', true);
    return;
  }

  const form = el(`<form>
    <h3>${editando ? 'Editar' : 'Nova'} receita</h3>
    <div class="form-grid">
      <div class="field full">
        <label>Nome *</label>
        <input name="nome" required value="${esc(receita?.nome || '')}" placeholder="Ex.: Bolo de Chocolate" />
      </div>
      <div class="field">
        <label>Categoria</label>
        <input name="categoria" value="${esc(receita?.categoria || '')}" placeholder="Bolo, Doce, Torta..." />
      </div>
      <div class="field">
        <label>Tempo de preparo (min)</label>
        <input name="tempo_preparo" type="number" min="0" value="${receita?.tempo_preparo ?? ''}" />
      </div>
      <div class="field">
        <label>Rendimento *</label>
        <input name="rendimento" type="number" step="0.01" min="0.01" required value="${receita?.rendimento ?? 1}" />
      </div>
      <div class="field">
        <label>Unidade do rendimento</label>
        <input name="unidade_rendimento" value="${esc(receita?.unidade_rendimento || 'porções')}" placeholder="porções, fatias, unidades" />
      </div>
    </div>

    <h4 style="color:var(--marrom);margin-bottom:0.4rem">Ingredientes</h4>
    <div id="linhas-ingredientes"></div>
    <button type="button" class="btn ghost small" id="add-linha">+ Adicionar ingrediente</button>

    <h4 style="color:var(--marrom);margin-bottom:0.4rem">Custos e margem</h4>
    <div class="form-grid">
      <div class="field">
        <label>Mão de obra (R$)</label>
        <input name="custo_mao_obra" data-mask="dinheiro" inputmode="numeric" value="${Mascaras.dinheiroDeNumero(receita?.custo_mao_obra ?? 0)}" placeholder="0,00" />
      </div>
      <div class="field">
        <label>Embalagem (R$)</label>
        <input name="custo_embalagem" data-mask="dinheiro" inputmode="numeric" value="${Mascaras.dinheiroDeNumero(receita?.custo_embalagem ?? 0)}" placeholder="0,00" />
      </div>
      <div class="field">
        <label>Custos fixos (% sobre subtotal)</label>
        <input name="percentual_custos_fixos" type="number" step="0.1" min="0" value="${receita?.percentual_custos_fixos ?? 0}" />
      </div>
      <div class="field">
        <label>Margem de lucro (%)</label>
        <input name="margem_lucro" type="number" step="0.1" min="0" value="${receita?.margem_lucro ?? 100}" />
      </div>
      <div class="field full">
        <label>Modo de preparo</label>
        <textarea name="modo_preparo" placeholder="Passo a passo...">${esc(receita?.modo_preparo || '')}</textarea>
      </div>
    </div>

    <div class="preco-box" id="preview-preco"></div>

    <div class="form-actions">
      <button type="button" class="btn ghost" data-cancel>Cancelar</button>
      <button type="submit" class="btn primary">${editando ? 'Salvar' : 'Cadastrar'}</button>
    </div>
  </form>`);

  const linhasCont = $('#linhas-ingredientes', form);

  const opcoes = (selId) =>
    ingredientesCache
      .map(
        (i) =>
          `<option value="${i.id}" data-unidade="${i.unidade}" ${i.id == selId ? 'selected' : ''}>${esc(i.nome)} (${i.unidade})</option>`
      )
      .join('');

  const unidadeBaseDe = (ingId) =>
    ingredientesCache.find((x) => x.id === Number(ingId))?.unidade || 'g';

  function addLinha(ing = null) {
    const baseInicial = ing ? unidadeBaseDe(ing.ingrediente_id) : unidadeBaseDe(ingredientesCache[0]?.id);
    const linha = el(`<div class="ing-linha">
      <div class="field"><label>Ingrediente</label><select class="sel-ing">${opcoes(ing?.ingrediente_id)}</select></div>
      <div class="field"><label>Qtd.</label>
        <div class="qtd-unidade">
          <input class="qtd-ing" type="number" step="0.001" min="0" value="${ing?.quantidade ?? ''}" placeholder="0" />
          <span class="wrap-un-ing">${Unidades.selectHtml(baseInicial, baseInicial, 'sel-un-ing')}</span>
        </div>
      </div>
      <button type="button" class="btn small danger" title="Remover">✕</button>
    </div>`);
    const selIng = linha.querySelector('.sel-ing');
    selIng.addEventListener('change', () => {
      const b = unidadeBaseDe(selIng.value);
      linha.querySelector('.wrap-un-ing').innerHTML = Unidades.selectHtml(b, b, 'sel-un-ing');
      atualizarPreview();
    });
    linha.querySelector('button').addEventListener('click', () => {
      linha.remove();
      atualizarPreview();
    });
    linha.addEventListener('input', atualizarPreview);
    linhasCont.appendChild(linha);
  }

  function coletarIngredientes() {
    return $$('.ing-linha', form)
      .map((l) => {
        const unidade = l.querySelector('.sel-un-ing')?.value;
        return {
          ingrediente_id: Number(l.querySelector('.sel-ing').value),
          quantidade: Unidades.paraBase(l.querySelector('.qtd-ing').value, unidade),
        };
      })
      .filter((i) => i.ingrediente_id && i.quantidade > 0);
  }

  // Pré-visualização da precificação calculada no cliente (espelha o backend)
  function atualizarPreview() {
    const d = Object.fromEntries(new FormData(form));
    const itens = coletarIngredientes();
    const custoIng = itens.reduce((s, it) => {
      const ing = ingredientesCache.find((x) => x.id === it.ingrediente_id);
      return s + (ing ? (ing.preco_compra / ing.quantidade_compra) * it.quantidade : 0);
    }, 0);
    const subtotal = custoIng + Mascaras.paraNumero(d.custo_mao_obra) + Mascaras.paraNumero(d.custo_embalagem);
    const fixos = subtotal * ((Number(d.percentual_custos_fixos) || 0) / 100);
    const custoTotal = subtotal + fixos;
    const preco = custoTotal * (1 + (Number(d.margem_lucro) || 0) / 100);
    const rend = Number(d.rendimento) > 0 ? Number(d.rendimento) : 1;
    $('#preview-preco', form).innerHTML = `
      <div class="preco-linha"><span>Custo dos ingredientes</span><span>${fmt(custoIng)}</span></div>
      <div class="preco-linha total"><span>Custo total</span><span>${fmt(custoTotal)}</span></div>
      <div class="preco-linha destaque"><span>Preço de venda sugerido</span><span>${fmt(preco)}</span></div>
      <div class="preco-linha"><span>Preço por porção</span><span>${fmt(preco / rend)}</span></div>`;
  }

  form.addEventListener('input', atualizarPreview);
  $('#add-linha', form).addEventListener('click', () => addLinha());

  // Popular linhas existentes (edição) ou começar com uma vazia
  if (editando && receita.ingredientes?.length) receita.ingredientes.forEach(addLinha);
  else addLinha();
  atualizarPreview();

  form.querySelector('[data-cancel]').addEventListener('click', fecharModal);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const dados = Object.fromEntries(new FormData(form));
    Mascaras.numerizarDinheiro(form, dados);
    dados.ingredientes = coletarIngredientes();
    try {
      if (editando) await API.receitas.atualizar(receita.id, dados);
      else await API.receitas.criar(dados);
      fecharModal();
      toast(editando ? 'Receita atualizada.' : 'Receita cadastrada.');
      renderReceitas();
    } catch (err) {
      toast(err.message, true);
    }
  });

  abrirModal(form);
}

$('#btn-nova-receita').addEventListener('click', () => formReceita());

// ====== Clientes ======
let clientesCache = [];

async function renderClientes() {
  try {
    clientesCache = await API.clientes.listar();
    const tbody = $('#tabela-clientes tbody');
    if (!clientesCache.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="vazio">Nenhum cliente cadastrado.</td></tr>`;
      return;
    }
    tbody.innerHTML = clientesCache
      .map(
        (c) => `<tr>
          <td>${esc(c.nome)}</td>
          <td>${esc(c.documento || '—')}</td>
          <td>${esc(c.telefone || '—')}</td>
          <td>${esc(c.email || '—')}</td>
          <td class="num">${c.total_pedidos}</td>
          <td class="num">
            <button class="btn small ghost" data-edit="${c.id}">Editar</button>
            <button class="btn small danger" data-del="${c.id}">Excluir</button>
          </td>
        </tr>`
      )
      .join('');
    tbody.querySelectorAll('[data-edit]').forEach((b) =>
      b.addEventListener('click', () => formCliente(clientesCache.find((x) => x.id == b.dataset.edit)))
    );
    tbody.querySelectorAll('[data-del]').forEach((b) =>
      b.addEventListener('click', () => excluirCliente(b.dataset.del))
    );
  } catch (e) {
    toast(e.message, true);
  }
}

function formCliente(cli = null) {
  const editando = !!cli;
  const form = el(`<form>
    <h3>${editando ? 'Editar' : 'Novo'} cliente</h3>
    <div class="form-grid">
      <div class="field full"><label>Nome *</label><input name="nome" required value="${esc(cli?.nome || '')}" /></div>
      <div class="field"><label>CPF / CNPJ</label><input name="documento" data-mask="documento" inputmode="numeric" value="${esc(cli?.documento || '')}" placeholder="000.000.000-00" /></div>
      <div class="field"><label>Telefone</label><input name="telefone" data-mask="telefone" inputmode="numeric" value="${esc(cli?.telefone || '')}" placeholder="(00) 00000-0000" /></div>
      <div class="field full"><label>E-mail</label><input name="email" type="email" value="${esc(cli?.email || '')}" placeholder="nome@exemplo.com" /></div>
      <div class="field full"><label>Observações</label><textarea name="observacoes">${esc(cli?.observacoes || '')}</textarea></div>
    </div>
    <div class="form-actions">
      <button type="button" class="btn ghost" data-cancel>Cancelar</button>
      <button type="submit" class="btn primary">${editando ? 'Salvar' : 'Cadastrar'}</button>
    </div>
  </form>`);
  form.querySelector('[data-cancel]').addEventListener('click', fecharModal);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const dados = Object.fromEntries(new FormData(form));
    if (!Mascaras.validarDocumento(dados.documento)) return toast('CPF/CNPJ inválido.', true);
    if (!Mascaras.validarTelefone(dados.telefone)) return toast('Telefone inválido.', true);
    if (!Mascaras.validarEmail(dados.email)) return toast('E-mail inválido.', true);
    try {
      if (editando) await API.clientes.atualizar(cli.id, dados);
      else await API.clientes.criar(dados);
      fecharModal();
      toast(editando ? 'Cliente atualizado.' : 'Cliente cadastrado.');
      renderClientes();
    } catch (err) {
      toast(err.message, true);
    }
  });
  abrirModal(form);
}

async function excluirCliente(id) {
  if (!confirm('Excluir este cliente? Os pedidos dele ficarão sem cliente.')) return;
  try {
    await API.clientes.remover(id);
    toast('Cliente excluído.');
    renderClientes();
  } catch (e) {
    toast(e.message, true);
  }
}

$('#btn-novo-cliente').addEventListener('click', () => formCliente());

// ====== Pedidos ======
const STATUS_ROTULO = {
  pendente: 'Pendente',
  em_producao: 'Em produção',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};

async function renderPedidos() {
  try {
    const pedidos = await API.pedidos.listar();
    const tbody = $('#tabela-pedidos tbody');
    if (!pedidos.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="vazio">Nenhum pedido registrado.</td></tr>`;
      return;
    }
    tbody.innerHTML = pedidos
      .map(
        (p) => `<tr>
          <td>#${p.id}</td>
          <td>${esc(p.cliente)}</td>
          <td>${esc(formatarData(p.data_entrega))}</td>
          <td class="num">${p.qtd_itens}</td>
          <td class="num">${fmt(p.total)}</td>
          <td><span class="status status-${esc(p.status)}">${esc(STATUS_ROTULO[p.status] || p.status)}</span>${p.estoque_baixado ? ' <span class="tag">estoque baixado</span>' : ''}</td>
          <td class="num"><button class="btn small ghost" data-ver="${p.id}">Abrir</button></td>
        </tr>`
      )
      .join('');
    tbody.querySelectorAll('[data-ver]').forEach((b) =>
      b.addEventListener('click', () => detalhePedido(b.dataset.ver))
    );
  } catch (e) {
    toast(e.message, true);
  }
}

async function detalhePedido(id) {
  try {
    const p = await API.pedidos.obter(id);
    const itens = p.itens
      .map(
        (i) => `<div class="preco-linha"><span>${fmtNum(i.quantidade)}× ${esc(i.descricao)}</span><span>${fmt(i.subtotal)}</span></div>`
      )
      .join('');
    abrirModal(`<div>
      <h3>Pedido #${p.id}</h3>
      <p class="hint">
        Cliente: ${esc(p.cliente?.nome || 'Sem cliente')}${p.cliente?.telefone ? ' • ' + esc(p.cliente.telefone) : ''}<br>
        Entrega: ${esc(formatarData(p.data_entrega))} •
        Status: <span class="status status-${esc(p.status)}">${esc(STATUS_ROTULO[p.status] || p.status)}</span>
        ${p.estoque_baixado ? ' • <span class="tag">estoque baixado</span>' : ''}
      </p>
      ${p.observacoes ? `<p class="hint">Obs.: ${esc(p.observacoes)}</p>` : ''}
      <div class="preco-box">
        ${itens}
        <div class="preco-linha destaque total"><span>Total</span><span>${fmt(p.total)}</span></div>
      </div>
      <div class="form-actions">
        <button class="btn danger" data-del>Excluir</button>
        ${p.estoque_baixado ? '' : '<button class="btn ghost" data-baixar>Dar baixa no estoque</button>'}
        <button class="btn primary" data-edit>Editar</button>
      </div>
    </div>`);

    $('#modal-content [data-edit]').addEventListener('click', () => formPedido(p));
    $('#modal-content [data-del]').addEventListener('click', async () => {
      if (!confirm('Excluir este pedido?')) return;
      try {
        await API.pedidos.remover(p.id);
        fecharModal();
        toast('Pedido excluído.');
        renderPedidos();
      } catch (e) {
        toast(e.message, true);
      }
    });
    const btnBaixar = $('#modal-content [data-baixar]');
    if (btnBaixar)
      btnBaixar.addEventListener('click', async () => {
        if (!confirm('Dar baixa no estoque dos ingredientes deste pedido?')) return;
        try {
          await API.pedidos.baixarEstoque(p.id);
          toast('Estoque baixado. Pedido em produção.');
          ingredientesCache = [];
          detalhePedido(p.id);
        } catch (e) {
          toast(e.message, true);
        }
      });
  } catch (e) {
    toast(e.message, true);
  }
}

async function formPedido(pedido = null) {
  const editando = !!pedido;
  const [clientes, receitas] = await Promise.all([API.clientes.listar(), API.receitas.listar()]);
  if (!receitas.length) {
    toast('Cadastre ao menos uma receita antes de criar pedidos.', true);
    return;
  }

  const optClientes = (sel) =>
    `<option value="">Sem cliente</option>` +
    clientes.map((c) => `<option value="${c.id}" ${c.id == sel ? 'selected' : ''}>${esc(c.nome)}</option>`).join('');
  const optReceitas = (sel) =>
    receitas
      .map((r) => `<option value="${r.id}" data-preco="${r.preco_venda_sugerido}" ${r.id == sel ? 'selected' : ''}>${esc(r.nome)}</option>`)
      .join('');
  const statusOpts = (sel) =>
    Object.entries(STATUS_ROTULO)
      .map(([v, r]) => `<option value="${v}" ${v === sel ? 'selected' : ''}>${r}</option>`)
      .join('');

  const form = el(`<form>
    <h3>${editando ? `Editar pedido #${pedido.id}` : 'Novo pedido'}</h3>
    <div class="form-grid">
      <div class="field"><label>Cliente</label><select name="cliente_id">${optClientes(pedido?.cliente_id)}</select></div>
      <div class="field"><label>Data de entrega</label><input name="data_entrega" type="date" value="${esc(pedido?.data_entrega || '')}" /></div>
      <div class="field"><label>Status</label><select name="status">${statusOpts(pedido?.status || 'pendente')}</select></div>
      <div class="field full"><label>Observações</label><input name="observacoes" value="${esc(pedido?.observacoes || '')}" /></div>
    </div>
    <h4 style="color:var(--marrom);margin-bottom:0.4rem">Itens</h4>
    <div id="linhas-itens"></div>
    <button type="button" class="btn ghost small" id="add-item">+ Adicionar item</button>
    <div class="preco-box" id="preview-total"></div>
    <div class="form-actions">
      <button type="button" class="btn ghost" data-cancel>Cancelar</button>
      <button type="submit" class="btn primary">${editando ? 'Salvar' : 'Cadastrar'}</button>
    </div>
  </form>`);

  const cont = $('#linhas-itens', form);

  function addItem(item = null) {
    const linha = el(`<div class="ing-linha item-linha">
      <div class="field"><label>Receita</label><select class="sel-receita">${optReceitas(item?.receita_id)}</select></div>
      <div class="field"><label>Qtd.</label><input class="qtd-item" type="number" step="0.01" min="0.01" value="${item?.quantidade ?? 1}" /></div>
      <div class="field"><label>Preço unit.</label><input class="preco-item" data-mask="dinheiro" inputmode="numeric" value="${Mascaras.dinheiroDeNumero(item?.preco_unitario)}" placeholder="auto" /></div>
      <button type="button" class="btn small danger" title="Remover">✕</button>
    </div>`);
    const selR = linha.querySelector('.sel-receita');
    const precoInput = linha.querySelector('.preco-item');
    // Preenche o preço sugerido ao escolher a receita (se vazio)
    const aplicarPreco = () => {
      const opt = selR.selectedOptions[0];
      if (opt && (!precoInput.value || precoInput.dataset.auto === '1')) {
        precoInput.value = Mascaras.dinheiroDeNumero(opt.dataset.preco);
        precoInput.dataset.auto = '1';
      }
      atualizarTotal();
    };
    selR.addEventListener('change', () => {
      precoInput.dataset.auto = '1';
      precoInput.value = '';
      aplicarPreco();
    });
    precoInput.addEventListener('input', () => (precoInput.dataset.auto = '0'));
    linha.querySelector('button').addEventListener('click', () => {
      linha.remove();
      atualizarTotal();
    });
    linha.addEventListener('input', atualizarTotal);
    cont.appendChild(linha);
    Mascaras.aplicar(linha);
    if (!item) aplicarPreco();
  }

  function coletarItens() {
    return $$('.item-linha', form)
      .map((l) => {
        const precoStr = l.querySelector('.preco-item').value.trim();
        return {
          receita_id: Number(l.querySelector('.sel-receita').value),
          quantidade: Number(l.querySelector('.qtd-item').value),
          // vazio => backend usa o preço sugerido automaticamente
          preco_unitario: precoStr === '' ? '' : Mascaras.paraNumero(precoStr),
        };
      })
      .filter((i) => i.receita_id && i.quantidade > 0);
  }

  function atualizarTotal() {
    const total = coletarItens().reduce((s, i) => s + i.quantidade * (Number(i.preco_unitario) || 0), 0);
    $('#preview-total', form).innerHTML = `<div class="preco-linha destaque total"><span>Total do pedido</span><span>${fmt(total)}</span></div>`;
  }

  $('#add-item', form).addEventListener('click', () => addItem());
  if (editando && pedido.itens?.length) pedido.itens.forEach(addItem);
  else addItem();
  atualizarTotal();

  form.querySelector('[data-cancel]').addEventListener('click', fecharModal);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const dados = Object.fromEntries(new FormData(form));
    dados.itens = coletarItens();
    if (!dados.itens.length) return toast('Adicione ao menos um item.', true);
    try {
      if (editando) await API.pedidos.atualizar(pedido.id, dados);
      else await API.pedidos.criar(dados);
      fecharModal();
      toast(editando ? 'Pedido atualizado.' : 'Pedido cadastrado.');
      renderPedidos();
    } catch (err) {
      toast(err.message, true);
    }
  });

  abrirModal(form);
}

$('#btn-novo-pedido').addEventListener('click', () => formPedido());

function formatarData(iso) {
  if (!iso) return 'Sem data';
  const [a, m, d] = iso.split('-');
  return d ? `${d}/${m}/${a}` : iso;
}

// ====== Início ======
renderPainel();
