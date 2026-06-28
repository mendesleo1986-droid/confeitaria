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
}

// ====== Painel ======
async function renderPainel() {
  try {
    const [resumo, receitas] = await Promise.all([API.resumo(), API.receitas.listar()]);
    const cards = [
      ['Ingredientes', resumo.total_ingredientes, false],
      ['Receitas', resumo.total_receitas, false],
      ['Custo total das receitas', fmt(resumo.custo_total_receitas), true],
      ['Receita potencial', fmt(resumo.receita_potencial), true],
      ['Lucro potencial', fmt(resumo.lucro_potencial), true],
    ];
    $('#resumo-cards').innerHTML = cards
      .map(
        ([rotulo, valor]) =>
          `<div class="card"><div class="valor">${esc(valor)}</div><div class="rotulo">${esc(rotulo)}</div></div>`
      )
      .join('');

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
      .map(
        (i) => `<tr>
          <td>${esc(i.nome)}</td>
          <td>${esc(i.unidade)}</td>
          <td class="num">${fmt(i.preco_compra)}</td>
          <td class="num">${fmtNum(i.quantidade_compra)} ${esc(i.unidade)}</td>
          <td class="num">${fmt(i.custo_unitario)} / ${esc(i.unidade)}</td>
          <td>${esc(i.fornecedor || '—')}</td>
          <td class="num">
            <button class="btn small ghost" data-edit="${i.id}">Editar</button>
            <button class="btn small danger" data-del="${i.id}">Excluir</button>
          </td>
        </tr>`
      )
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
  const form = el(`<form>
    <h3>${editando ? 'Editar' : 'Novo'} ingrediente</h3>
    <div class="form-grid">
      <div class="field full">
        <label>Nome *</label>
        <input name="nome" required value="${esc(ing?.nome || '')}" placeholder="Ex.: Farinha de trigo" />
      </div>
      <div class="field">
        <label>Unidade base *</label>
        <select name="unidade">
          <option value="g" ${ing?.unidade === 'g' ? 'selected' : ''}>Gramas (g)</option>
          <option value="ml" ${ing?.unidade === 'ml' ? 'selected' : ''}>Mililitros (ml)</option>
          <option value="un" ${ing?.unidade === 'un' ? 'selected' : ''}>Unidades (un)</option>
        </select>
      </div>
      <div class="field">
        <label>Fornecedor</label>
        <input name="fornecedor" value="${esc(ing?.fornecedor || '')}" placeholder="Opcional" />
      </div>
      <div class="field">
        <label>Preço de compra (R$) *</label>
        <input name="preco_compra" type="number" step="0.01" min="0" required value="${ing?.preco_compra ?? ''}" placeholder="Ex.: 5.49" />
      </div>
      <div class="field">
        <label>Qtd. da embalagem *</label>
        <input name="quantidade_compra" type="number" step="0.001" min="0.001" required value="${ing?.quantidade_compra ?? ''}" placeholder="Ex.: 1000" />
      </div>
    </div>
    <p class="hint" id="custo-preview"></p>
    <div class="form-actions">
      <button type="button" class="btn ghost" data-cancel>Cancelar</button>
      <button type="submit" class="btn primary">${editando ? 'Salvar' : 'Cadastrar'}</button>
    </div>
  </form>`);

  const preview = () => {
    const p = Number(form.preco_compra.value);
    const q = Number(form.quantidade_compra.value);
    const u = form.unidade.value;
    $('#custo-preview', form).textContent =
      p > 0 && q > 0 ? `Custo unitário: ${fmt(p / q)} por ${u}` : '';
  };
  form.addEventListener('input', preview);
  preview();

  form.querySelector('[data-cancel]').addEventListener('click', fecharModal);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const dados = Object.fromEntries(new FormData(form));
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
        <button class="btn primary" data-edit>Editar</button>
      </div>
    </div>`);

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
        <input name="custo_mao_obra" type="number" step="0.01" min="0" value="${receita?.custo_mao_obra ?? 0}" />
      </div>
      <div class="field">
        <label>Embalagem (R$)</label>
        <input name="custo_embalagem" type="number" step="0.01" min="0" value="${receita?.custo_embalagem ?? 0}" />
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

  function addLinha(ing = null) {
    const linha = el(`<div class="ing-linha">
      <div class="field"><label>Ingrediente</label><select class="sel-ing">${opcoes(ing?.ingrediente_id)}</select></div>
      <div class="field"><label>Qtd.</label><input class="qtd-ing" type="number" step="0.001" min="0" value="${ing?.quantidade ?? ''}" placeholder="0" /></div>
      <button type="button" class="btn small danger" title="Remover">✕</button>
    </div>`);
    linha.querySelector('button').addEventListener('click', () => {
      linha.remove();
      atualizarPreview();
    });
    linha.addEventListener('input', atualizarPreview);
    linhasCont.appendChild(linha);
  }

  function coletarIngredientes() {
    return $$('.ing-linha', form)
      .map((l) => ({
        ingrediente_id: Number(l.querySelector('.sel-ing').value),
        quantidade: Number(l.querySelector('.qtd-ing').value),
      }))
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
    const subtotal = custoIng + (Number(d.custo_mao_obra) || 0) + (Number(d.custo_embalagem) || 0);
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

// ====== Início ======
renderPainel();
