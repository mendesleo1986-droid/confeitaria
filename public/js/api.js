// Wrapper simples sobre fetch para a API da confeitaria
const API = {
  async req(metodo, url, corpo) {
    const opts = { method: metodo, headers: {} };
    if (corpo !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(corpo);
    }
    const resp = await fetch(url, opts);
    if (resp.status === 204) return null;
    const dados = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(dados.erro || `Erro ${resp.status}`);
    return dados;
  },

  resumo: () => API.req('GET', '/api/resumo'),

  ingredientes: {
    listar: () => API.req('GET', '/api/ingredientes'),
    criar: (d) => API.req('POST', '/api/ingredientes', d),
    atualizar: (id, d) => API.req('PUT', `/api/ingredientes/${id}`, d),
    remover: (id) => API.req('DELETE', `/api/ingredientes/${id}`),
  },

  receitas: {
    listar: () => API.req('GET', '/api/receitas'),
    obter: (id) => API.req('GET', `/api/receitas/${id}`),
    criar: (d) => API.req('POST', '/api/receitas', d),
    atualizar: (id, d) => API.req('PUT', `/api/receitas/${id}`, d),
    remover: (id) => API.req('DELETE', `/api/receitas/${id}`),
    produzir: (id, lotes) => API.req('POST', `/api/receitas/${id}/produzir`, { lotes }),
    pdfUrl: (id) => `/api/receitas/${id}/pdf`,
  },

  clientes: {
    listar: () => API.req('GET', '/api/clientes'),
    criar: (d) => API.req('POST', '/api/clientes', d),
    atualizar: (id, d) => API.req('PUT', `/api/clientes/${id}`, d),
    remover: (id) => API.req('DELETE', `/api/clientes/${id}`),
  },

  pedidos: {
    listar: () => API.req('GET', '/api/pedidos'),
    obter: (id) => API.req('GET', `/api/pedidos/${id}`),
    criar: (d) => API.req('POST', '/api/pedidos', d),
    atualizar: (id, d) => API.req('PUT', `/api/pedidos/${id}`, d),
    remover: (id) => API.req('DELETE', `/api/pedidos/${id}`),
    baixarEstoque: (id) => API.req('POST', `/api/pedidos/${id}/baixar-estoque`),
  },
};
