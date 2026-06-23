/**
 * Montagem manual de fatura mensal (Add/Remove + impressão + confirmar)
 */

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const licitacaoId = params.get("licitacao_id") || "";
const competencia = params.get("competencia") || FisamAPI.monthToday();

const els = {
  alert: $("#alert"),
  pageTag: $("#pageTag"),
  listDisp: $("#listDisp"),
  listSel: $("#listSel"),
  totalsInline: $("#totalsInline"),
  printTbody: $("#printTbody"),
  printTfoot: $("#printTfoot"),
  docMeta: $("#docMeta"),
  btnPrint: $("#btnPrint"),
  btnConfirm: $("#btnConfirm"),
};

let state = {
  licitacaoNome: "",
  disponiveis: [],
  selecionados: [],
};

function showAlert(msg, type = "warn") {
  if (!msg) { els.alert.hidden = true; return; }
  els.alert.hidden = false;
  els.alert.className = `alert alert--${type}`;
  els.alert.textContent = msg;
}

function computeTotais(items) {
  let receitas = 0;
  let despesas = 0;
  for (const o of items) {
    receitas += Number(o.valor) || 0;
    despesas += Number(o.custo) || 0;
  }
  return { receitas, despesas, lucro: receitas - despesas, qtd: items.length };
}

function ordemLabel(o) {
  const parts = [o.tarifa_nome, o.descricao].filter(Boolean);
  return parts.join(" — ") || o.tarifa_codigo || "-";
}

function itemHtml(o, mode) {
  const pagoBadge = FisamAPI.isPago(o.pago)
    ? '<span class="badge badge--receita">Pago</span>'
    : '<span class="badge badge--despesa">Não pago</span>';
  const btn = mode === "add"
    ? `<button type="button" class="btn btn--outline btn--sm" data-add="${FisamAPI.escapeHtml(o.id)}">Add →</button>`
    : `<button type="button" class="btn btn--ghost btn--sm" data-remove="${FisamAPI.escapeHtml(o.id)}">← Remove</button>`;

  return `
    <div class="fatura-item">
      <div class="fatura-item__main">
        <div class="fatura-item__date">${FisamAPI.formatDateBR(o.data)}</div>
        <div class="fatura-item__desc">${FisamAPI.escapeHtml(ordemLabel(o))}</div>
        <div class="fatura-item__vals">
          <span>${FisamAPI.brl(o.valor)}</span>
          <span class="muted">custo ${FisamAPI.brl(o.custo)}</span>
          ${pagoBadge}
        </div>
      </div>
      <div class="fatura-item__action">${btn}</div>
    </div>
  `;
}

function renderLists() {
  els.listDisp.innerHTML = state.disponiveis.length
    ? state.disponiveis.map((o) => itemHtml(o, "add")).join("")
    : `<div class="empty">Nenhuma OS disponível.</div>`;

  els.listSel.innerHTML = state.selecionados.length
    ? state.selecionados.map((o) => itemHtml(o, "remove")).join("")
    : `<div class="empty">Adicione itens da lista à esquerda.</div>`;

  const t = computeTotais(state.selecionados);
  els.totalsInline.innerHTML = `
    <div><span class="muted">Itens</span><strong>${t.qtd}</strong></div>
    <div><span class="muted">Receitas</span><strong>${FisamAPI.brl(t.receitas)}</strong></div>
    <div><span class="muted">Despesas</span><strong>${FisamAPI.brl(t.despesas)}</strong></div>
    <div><span class="muted">Lucro</span><strong>${FisamAPI.brl(t.lucro)}</strong></div>
  `;

  renderPrintPreview(t);
  bindListButtons();
}

function renderPrintPreview(t) {
  els.docMeta.textContent = `${state.licitacaoNome} • Competência ${competencia}`;
  document.title = `Fatura ${competencia} — ${state.licitacaoNome}`;

  if (!state.selecionados.length) {
    els.printTbody.innerHTML = `<tr><td colspan="5" class="empty">Nenhum item selecionado.</td></tr>`;
    els.printTfoot.innerHTML = "";
    return;
  }

  els.printTbody.innerHTML = state.selecionados.map((o) => `
    <tr>
      <td>${FisamAPI.formatDateBR(o.data)}</td>
      <td>${FisamAPI.escapeHtml(ordemLabel(o))}</td>
      <td class="right">${FisamAPI.brl(o.valor)}</td>
      <td class="right">${FisamAPI.brl(o.custo)}</td>
      <td class="right">${FisamAPI.brl(o.lucro ?? (o.valor - o.custo))}</td>
    </tr>
  `).join("");

  els.printTfoot.innerHTML = `
    <tr class="tfoot">
      <td colspan="2"><strong>TOTAIS (${t.qtd} itens)</strong></td>
      <td class="right"><strong>${FisamAPI.brl(t.receitas)}</strong></td>
      <td class="right"><strong>${FisamAPI.brl(t.despesas)}</strong></td>
      <td class="right"><strong>${FisamAPI.brl(t.lucro)}</strong></td>
    </tr>
  `;
}

function bindListButtons() {
  els.listDisp.querySelectorAll("[data-add]").forEach((b) => {
    b.addEventListener("click", () => moveItem(b.getAttribute("data-add"), "add"));
  });
  els.listSel.querySelectorAll("[data-remove]").forEach((b) => {
    b.addEventListener("click", () => moveItem(b.getAttribute("data-remove"), "remove"));
  });
}

function moveItem(id, dir) {
  if (dir === "add") {
    const idx = state.disponiveis.findIndex((o) => o.id === id);
    if (idx < 0) return;
    const [item] = state.disponiveis.splice(idx, 1);
    state.selecionados.push(item);
  } else {
    const idx = state.selecionados.findIndex((o) => o.id === id);
    if (idx < 0) return;
    const [item] = state.selecionados.splice(idx, 1);
    state.disponiveis.push(item);
    state.disponiveis.sort((a, b) => (a.data < b.data ? 1 : -1));
  }
  renderLists();
}

async function load() {
  if (!licitacaoId) {
    showAlert("licitacao_id não informado na URL.", "error");
    return;
  }
  showAlert(null);
  try {
    const [lics, fatura] = await Promise.all([
      FisamAPI.listLicitacoes(true),
      FisamAPI.fetchFaturaElegiveis(competencia, licitacaoId),
    ]);
    const lic = lics.find((l) => l.id === licitacaoId);
    state.licitacaoNome = lic?.nome || licitacaoId;
    els.pageTag.textContent = `${state.licitacaoNome} • ${competencia}`;
    state.disponiveis = (fatura.ordens || []).filter((o) => {
      const st = String(o.status_os || "").toLowerCase();
      return st !== "faturada" && st !== "cancelada";
    });
    state.selecionados = [];
    renderLists();
  } catch (err) {
    showAlert(`Erro: ${err.message}`, "error");
  }
}

els.btnPrint.addEventListener("click", () => {
  if (!state.selecionados.length) {
    alert("Selecione ao menos um item para imprimir.");
    return;
  }
  window.print();
});

els.btnConfirm.addEventListener("click", async () => {
  if (!state.selecionados.length) {
    alert("Selecione ao menos um item para faturar.");
    return;
  }
  if (!confirm(`Confirmar faturamento de ${state.selecionados.length} ordem(ns)?`)) return;
  try {
    const ids = state.selecionados.map((o) => o.id);
    await FisamAPI.faturarOrdens(ids);
    showAlert("Faturamento confirmado.", "success");
    await load();
  } catch (err) {
    showAlert(err.message, "error");
  }
});

load();
