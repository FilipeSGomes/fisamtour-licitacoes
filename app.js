/**
 * FISAM Tour - Site estático (Dashboard)
 * Integração com Google Sheets virá via Apps Script (API_URL).
 */

const CONFIG = {
  INSTAGRAM_URL: "https://instagram.com/fisamtour",
  WHATSAPP_URL: "https://wa.me/5511910218890",
  // Quando você tiver o Apps Script publicado, coloque aqui:
  // API_URL: "https://script.google.com/macros/s/SEU_ID/exec"
  API_URL: null,
  USE_MOCK: false, // deixe true enquanto não tiver API
};

const $ = (s) => document.querySelector(s);

const els = {
  year: $("#year"),
  instagram: $("#linkInstagram"),
  whatsapp: $("#linkWhatsApp"),

  competencia: $("#competencia"),
  q: $("#q"),
  status: $("#status"),

  btnRefresh: $("#btnRefresh"),
  btnNew: $("#btnNew"),
  btnExport: $("#btnExport"),
  btnCloseMonth: $("#btnCloseMonth"),

  tbody: $("#tbody"),
  countInfo: $("#countInfo"),

  sumReceitas: $("#sumReceitas"),
  sumDespesas: $("#sumDespesas"),
  sumSaldo: $("#sumSaldo"),

  modal: $("#modal"),
  confirm: $("#confirm"),
  confirmText: $("#confirmText"),
  confirmOk: $("#confirmOk"),

  form: $("#form"),
  modalTitle: $("#modalTitle"),

  f_data: $("#f_data"),
  f_tipo: $("#f_tipo"),
  f_licitacao: $("#f_licitacao"),
  f_status: $("#f_status"),
  f_categoria: $("#f_categoria"),
  f_fornecedor: $("#f_fornecedor"),
  f_descricao: $("#f_descricao"),
  f_valor: $("#f_valor"),
  f_comprovante: $("#f_comprovante"),
};

let state = {
  rows: [],
  editingId: null,
};

function brl(n) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);
}

function parseMoney(v) {
  // aceita "1.234,56" ou "1234.56"
  const s = String(v ?? "").trim().replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function monthToday() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${mm}`;
}

function openModal(editRow = null) {
  state.editingId = editRow ? editRow.id : null;
  els.modalTitle.textContent = editRow ? "Editar lançamento" : "Novo lançamento";

  if (editRow) {
    els.f_data.value = editRow.data;
    els.f_tipo.value = editRow.tipo;
    els.f_licitacao.value = editRow.licitacao;
    els.f_status.value = editRow.status;
    els.f_categoria.value = editRow.categoria;
    els.f_fornecedor.value = editRow.fornecedor || "";
    els.f_descricao.value = editRow.descricao || "";
    els.f_valor.value = String(editRow.valor).replace(".", ",");
    els.f_comprovante.value = editRow.comprovante_url || "";
  } else {
    els.form.reset();
    els.f_data.value = new Date().toISOString().slice(0, 10);
    els.f_tipo.value = "receita";
    els.f_status.value = "em_andamento";
  }

  els.modal.setAttribute("aria-hidden", "false");
}

function closeModal() {
  els.modal.setAttribute("aria-hidden", "true");
}

function openConfirm(text, onOk) {
  els.confirmText.textContent = text;
  els.confirm.setAttribute("aria-hidden", "false");
  const handler = () => {
    els.confirmOk.removeEventListener("click", handler);
    els.confirm.setAttribute("aria-hidden", "true");
    onOk();
  };
  els.confirmOk.addEventListener("click", handler);
}

function closeConfirm() {
  els.confirm.setAttribute("aria-hidden", "true");
}

function attachModalClose(modalEl) {
  modalEl.addEventListener("click", (e) => {
    const close = e.target?.getAttribute?.("data-close");
    if (close === "1") {
      modalEl.setAttribute("aria-hidden", "true");
    }
  });
}

function filterRows(rows) {
  const q = els.q.value.trim().toLowerCase();
  const status = els.status.value;

  return rows.filter((r) => {
    const matchStatus = (status === "all") ? true : r.status === status;
    const hay = [
      r.licitacao, r.tipo, r.categoria, r.fornecedor, r.descricao
    ].filter(Boolean).join(" ").toLowerCase();
    const matchQ = q ? hay.includes(q) : true;
    return matchStatus && matchQ;
  });
}

function computeSummary(rows) {
  let receitas = 0;
  let despesas = 0;

  for (const r of rows) {
    if (r.tipo === "receita") receitas += r.valor;
    else despesas += r.valor;
  }
  els.sumReceitas.textContent = brl(receitas);
  els.sumDespesas.textContent = brl(despesas);
  els.sumSaldo.textContent = brl(receitas - despesas);
}

function badge(tipo) {
  const cls = tipo === "receita" ? "badge badge--receita" : "badge badge--despesa";
  return `<span class="${cls}">${tipo}</span>`;
}

function renderTable(rows) {
  const filtered = filterRows(rows);
  computeSummary(filtered);

  els.countInfo.textContent = `${filtered.length} itens`;

  els.tbody.innerHTML = filtered.map((r) => `
    <tr>
      <td>${r.data.split("-").reverse().join("/")}</td>
      <td>${escapeHtml(r.licitacao)}</td>
      <td>${badge(r.tipo)}</td>
      <td>${escapeHtml(r.categoria)}</td>
      <td>${escapeHtml(r.fornecedor || "-")}</td>
      <td>${escapeHtml(r.descricao || "-")}${r.comprovante_url ? ` • <a class="link" href="${r.comprovante_url}" target="_blank" rel="noopener">comprovante</a>` : ""}</td>
      <td class="right">${brl(r.valor)}</td>
      <td class="right">
        <div class="row-actions">
          <button class="btn btn--outline" data-edit="${r.id}">Editar</button>
          <button class="btn btn--ghost" data-del="${r.id}">Excluir</button>
        </div>
      </td>
    </tr>
  `).join("");

  // actions
  els.tbody.querySelectorAll("[data-edit]").forEach((b) => {
    b.addEventListener("click", () => {
      const id = b.getAttribute("data-edit");
      const row = state.rows.find(x => x.id === id);
      if (row) openModal(row);
    });
  });

  els.tbody.querySelectorAll("[data-del]").forEach((b) => {
    b.addEventListener("click", () => {
      const id = b.getAttribute("data-del");
      openConfirm("Deseja excluir este lançamento?", async () => {
        await deleteRow(id);
      });
    });
  });
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ------------------- Data layer ------------------- */

function mockData(competencia) {
  // exemplo: use isso só pra ver a UI
  return [
    {
      id: "1",
      competencia,
      data: `${competencia}-03`,
      licitacao: "PE 52/2025 • Licitação Turismo",
      status: "em_andamento",
      tipo: "receita",
      categoria: "comissão",
      fornecedor: "—",
      descricao: "Comissão estimada do mês",
      valor: 3200.00,
      comprovante_url: "",
    },
    {
      id: "2",
      competencia,
      data: `${competencia}-08`,
      licitacao: "PE 52/2025 • Licitação Turismo",
      status: "em_andamento",
      tipo: "despesa",
      categoria: "taxas",
      fornecedor: "Operadora",
      descricao: "Taxas operacionais",
      valor: 450.50,
      comprovante_url: "",
    },
    {
      id: "3",
      competencia,
      data: `${competencia}-14`,
      licitacao: "Processo 11/2025 • Órgão X",
      status: "ganho",
      tipo: "receita",
      categoria: "passagens",
      fornecedor: "—",
      descricao: "Emissão de passagens (faturado)",
      valor: 7800.00,
      comprovante_url: "",
    }
  ];
}

async function fetchRows(competencia) {
  if (CONFIG.USE_MOCK || !CONFIG.API_URL) {
    return mockData(competencia);
  }

  const url = `${CONFIG.API_URL}?op=list&competencia=${encodeURIComponent(competencia)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Falha ao carregar dados da API");
  const json = await res.json();
  return json.rows || [];
}

async function saveRow(row) {
  if (CONFIG.USE_MOCK || !CONFIG.API_URL) {
    // mock: salva em memória
    if (state.editingId) {
      state.rows = state.rows.map(r => r.id === state.editingId ? { ...row, id: state.editingId } : r);
    } else {
      state.rows = [{ ...row, id: String(Date.now()) }, ...state.rows];
    }
    renderTable(state.rows);
    return;
  }

  const op = state.editingId ? "update" : "add";
  const payload = { op, row: { ...row, id: state.editingId || undefined } };

  const res = await fetch(CONFIG.API_URL, {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Falha ao salvar na API");
  await refresh();
}

async function deleteRow(id) {
  if (CONFIG.USE_MOCK || !CONFIG.API_URL) {
    state.rows = state.rows.filter(r => r.id !== id);
    renderTable(state.rows);
    return;
  }

  const res = await fetch(CONFIG.API_URL, {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify({ op: "delete", id }),
  });
  if (!res.ok) throw new Error("Falha ao excluir na API");
  await refresh();
}

async function closeMonth(competencia) {
  if (CONFIG.USE_MOCK || !CONFIG.API_URL) {
    alert("Mock: mês fechado (aqui depois vai chamar a API e gerar invoice).");
    return;
  }

  const res = await fetch(CONFIG.API_URL, {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify({ op: "closeMonth", competencia }),
  });
  if (!res.ok) throw new Error("Falha ao fechar mês");
  const json = await res.json();
  // Ex.: json.invoicePdfUrl
  alert("Mês fechado com sucesso!");
  await refresh();
}

/* ------------------- UI actions ------------------- */

async function refresh() {
  const competencia = els.competencia.value || monthToday();
  const rows = await fetchRows(competencia);
  state.rows = rows;
  renderTable(state.rows);
}

function exportCSV() {
  const filtered = filterRows(state.rows);
  const header = ["data","licitacao","status","tipo","categoria","fornecedor","descricao","valor","comprovante_url"];
  const lines = [header.join(",")];

  for (const r of filtered) {
    const row = [
      r.data, r.licitacao, r.status, r.tipo, r.categoria,
      r.fornecedor || "", r.descricao || "", String(r.valor), r.comprovante_url || ""
    ].map(v => `"${String(v).replaceAll('"','""')}"`);
    lines.push(row.join(","));
  }

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `fisam_lancamentos_${els.competencia.value || monthToday()}.csv`;
  a.click();
}

function wire() {
  els.year.textContent = String(new Date().getFullYear());

  els.instagram.href = CONFIG.INSTAGRAM_URL;
  els.whatsapp.href = CONFIG.WHATSAPP_URL;

  els.competencia.value = monthToday();

  els.btnRefresh.addEventListener("click", refresh);
  els.btnNew.addEventListener("click", () => openModal(null));
  els.btnExport.addEventListener("click", exportCSV);
  els.btnCloseMonth.addEventListener("click", () => {
    const c = els.competencia.value || monthToday();
    openConfirm(`Confirmar fechamento da competência ${c}?`, () => closeMonth(c));
  });

  els.q.addEventListener("input", () => renderTable(state.rows));
  els.status.addEventListener("change", () => renderTable(state.rows));
  els.competencia.addEventListener("change", refresh);

  els.form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const competencia = els.competencia.value || monthToday();
    const row = {
      competencia,
      data: els.f_data.value,
      tipo: els.f_tipo.value,
      licitacao: els.f_licitacao.value.trim(),
      status: els.f_status.value,
      categoria: els.f_categoria.value.trim(),
      fornecedor: els.f_fornecedor.value.trim(),
      descricao: els.f_descricao.value.trim(),
      valor: parseMoney(els.f_valor.value),
      comprovante_url: els.f_comprovante.value.trim(),
    };

    if (!row.data || !row.tipo || !row.licitacao || !row.categoria || !Number.isFinite(row.valor)) {
      alert("Preencha os campos obrigatórios.");
      return;
    }

    await saveRow(row);
    closeModal();
  });

  attachModalClose(els.modal);
  attachModalClose(els.confirm);
}

(async function init(){
  wire();
  await refresh();
})();
