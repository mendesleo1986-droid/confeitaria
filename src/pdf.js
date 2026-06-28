import PDFDocument from 'pdfkit';

const ROSA = '#d6336c';
const MARROM = '#5c3a21';
const CINZA = '#6b6360';

const brl = (v) =>
  'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (v) => (Number(v) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 });

// Gera o PDF da ficha técnica + precificação de uma receita e o envia em `res`.
export function fichaReceitaPDF(receita, res) {
  const p = receita.precificacao;
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `inline; filename="ficha-${slug(receita.nome)}.pdf"`
  );
  doc.pipe(res);

  // Cabeçalho
  doc.fillColor(ROSA).fontSize(22).font('Helvetica-Bold').text('Confeitaria', { continued: false });
  doc.fillColor(CINZA).fontSize(10).font('Helvetica').text('Ficha Técnica e Precificação');
  doc.moveDown(0.8);

  doc.fillColor(MARROM).fontSize(18).font('Helvetica-Bold').text(receita.nome);
  doc.fillColor(CINZA).fontSize(10).font('Helvetica');
  const meta = [
    receita.categoria ? `Categoria: ${receita.categoria}` : null,
    `Rendimento: ${num(receita.rendimento)} ${receita.unidade_rendimento}`,
    receita.tempo_preparo ? `Preparo: ${receita.tempo_preparo} min` : null,
  ]
    .filter(Boolean)
    .join('   •   ');
  doc.text(meta);
  linha(doc);

  // Ingredientes
  secao(doc, 'Ingredientes');
  doc.fontSize(10).font('Helvetica').fillColor('#333');
  if (p.ingredientes.length) {
    p.ingredientes.forEach((i) => {
      const y = doc.y;
      doc.text(`${i.nome} — ${num(i.quantidade)} ${i.unidade}`, 50, y, { width: 380 });
      doc.text(brl(i.custo_total), 430, y, { width: 115, align: 'right' });
      doc.moveDown(0.2);
    });
  } else {
    doc.fillColor(CINZA).text('Sem ingredientes cadastrados.');
  }
  doc.moveDown(0.3);
  linhaValor(doc, 'Custo dos ingredientes', brl(p.custo_ingredientes), true);

  // Precificação
  secao(doc, 'Precificação');
  linhaValor(doc, 'Custo dos ingredientes', brl(p.custo_ingredientes));
  linhaValor(doc, 'Mão de obra', brl(p.custo_mao_obra));
  linhaValor(doc, 'Embalagem', brl(p.custo_embalagem));
  linhaValor(doc, `Custos fixos (${num(p.percentual_custos_fixos)}%)`, brl(p.custos_fixos));
  linhaValor(doc, 'Custo total', brl(p.custo_total), true);
  linhaValor(doc, 'Custo por porção', brl(p.custo_por_porcao));
  linhaValor(doc, `Margem de lucro (${num(p.margem_lucro)}%)`, brl(p.lucro_total));
  doc.moveDown(0.2);
  linhaValor(doc, 'PREÇO DE VENDA SUGERIDO', brl(p.preco_venda_sugerido), true, ROSA);
  linhaValor(doc, 'Preço por porção', brl(p.preco_por_porcao), false, ROSA);

  // Modo de preparo
  if (receita.modo_preparo) {
    secao(doc, 'Modo de preparo');
    doc.fontSize(10).font('Helvetica').fillColor('#333').text(receita.modo_preparo, { lineGap: 2 });
  }

  // Rodapé — zera a margem inferior temporariamente para não forçar nova página
  const margemBaixo = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  doc.fontSize(8).fillColor(CINZA).text(
    `Gerado em ${new Date().toLocaleString('pt-BR')}`,
    50,
    doc.page.height - 35,
    { align: 'center', width: doc.page.width - 100 }
  );
  doc.page.margins.bottom = margemBaixo;

  doc.end();
}

function secao(doc, titulo) {
  doc.moveDown(0.8);
  doc.fillColor(MARROM).fontSize(13).font('Helvetica-Bold').text(titulo);
  doc.moveDown(0.3);
}

function linhaValor(doc, rotulo, valor, negrito = false, cor = '#333') {
  const y = doc.y;
  doc.font(negrito ? 'Helvetica-Bold' : 'Helvetica').fontSize(negrito ? 11 : 10).fillColor(cor);
  doc.text(rotulo, 50, y, { width: 380 });
  doc.text(valor, 430, y, { width: 115, align: 'right' });
  doc.moveDown(0.2);
}

function linha(doc) {
  doc.moveDown(0.3);
  doc
    .strokeColor('#f0d6df')
    .lineWidth(1)
    .moveTo(50, doc.y)
    .lineTo(doc.page.width - 50, doc.y)
    .stroke();
  doc.moveDown(0.3);
}

function slug(s) {
  return String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}
