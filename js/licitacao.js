/**
 * Detalhe operacional por licitação (passagens / hospedagem / veículo)
 */

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const licitacaoId = params.get("id") || "";

const FIELDS = {
  passagens: [
    { key: "data_solicitacao", label: "Data solicitação", type: "date" },
    { key: "data_ida", label: "Data ida", type: "date" },
    { key: "data_chegada", label: "Data chegada", type: "date" },
    { key: "de", label: "De" },
    { key: "para", label: "Para" },
    { key: "horario_saida", label: "Horário saída" },
    { key: "horario_chegada", label: "Horário chegada" },
    { key: "assento", label: "Assento" },
    { key: "bilhete", label: "Bilhete" },
    { key: "classe", label: "Classe" },
    { key: "colaborador", label: "Colaborador", list: "passageirosList" },
    { key: "cpf", label: "CPF", list: "passageirosList" },
    { key: "dt_nasc", label: "Dt nasc.", type: "date" },
    { key: "valor", label: "Valor", type: "number" },
    { key: "custo", label: "Custo", type: "number" },
    { key: "lucro", label: "Lucro", type: "number" },
    { key: "pago", label: "Pago", type: "pago" },
  ],
  hospedagem: [
    { key: "dt_solicitacao", label: "Dt solicitação", type: "date" },
    { key: "check_in", label: "Check-in", type: "date" },
    { key: "check_out", label: "Check-out", type: "date" },
    { key: "diarias", label: "Diárias", type: "number" },
    { key: "colaborador", label: "Colaborador" },
    { key: "refeicoes", label: "Refeições", type: "number" },
    { key: "vlr_diaria", label: "Vlr diária", type: "number" },
    { key: "prev_vlr_refeicao", label: "Prev. refeição", type: "number" },
    { key: "vlr_total", label: "Vlr total", type: "number" },
    { key: "custo_hospedagem", label: "Custo hosp.", type: "number" },
    { key: "custo_refeicao", label: "Custo ref.", type: "number" },
    { key: "custo_tt", label: "Custo total", type: "number" },
    { key: "lucro", label: "Lucro" },
    { key: "prev_pgto", label: "Prev. pgto" },
    { key: "enviado_faturamento", label: "Enviado fat." },
    { key: "pago", label: "Pago", type: "pago" },
  ],
  veiculo: [
    { key: "data_solicitacao", label: "Data solicitação", type: "date" },
    { key: "modelo_veiculo", label: "Modelo" },
    { key: "placa", label: "Placa" },
    { key: "saida", label: "Saída" },
    { key: "data", label: "Data", type: "date" },
    { key: "colaborador", label: "Colaborador" },
    { key: "cpf", label: "CPF" },
    { key: "dt_nascimento", label: "Dt nasc.", type: "date" },
    { key: "valor", label: "Valor", type: "number" },
    { key: "custo", label: "Custo", type: "number" },
    { key: "lucro", label: "Lucro", type: "number" },
    { key: "prev_pgto", label: "Prev. pgto" },
    { key: "enviado_faturamento", label: "Enviado fat." },
    { key: "pago", label: "Pago", type: "pago" },
  ],
};

const DISPLAY = {
  passagens: ["data_ida", "de", "para", "colaborador", "valor", "custo", "lucro", "pago"],
  hospedagem: ["check_in", "check_out", "colaborador", "vlr_total", "custo_tt", "lucro", "pago"],
  veiculo: ["data", "saida", "colaborador", "valor", "custo", "lucro", "pago"],
};

const els = {
  alert: $("#alert"),
  pageTag: $("#pageTag"),
  thead: $("#thead"),
  tbody: $("#tbody"),
  tfoot: $("#tfoot"),
  totals: $("#totals"),
  filterPago: $("#filterPago"),
  modal: $("#modal"),
  modalTitle: $("#modalTitle"),
  form: $("#form"),
  formFields: $("#formFields"),
  btnAdd: $("#btnAdd"),
  btnSave: $("#btnSave"),
  passageirosList: $("#passageirosList"),
};

let state = {
  licitacao: null,
  tipo: "",
  fields: [],
  displayKeys: [],
  items: [],
  editIndex: null,
  pagoFilter: "all",
};

function showAlert(msg, type = "warn") {
  if (!msg) { els.alert.hidden = true; return; }
  els.alert.hidden = false;
  els.alert.className = `alert alert--${type}`;
  els.alert.textContent = msg;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizePago(v) {
  return FisamAPI.isPago(v) ? "sim" : "nao";
}

function filteredItems() {
  if (state.pagoFilter === "all") return state.items;
  if (state.pagoFilter === "sim") return state.items.filter((i) => FisamAPI.isPago(i.pago));
  return state.items.filter((i) => !FisamAPI.isPago(i.pago));
}

function recalcLucro(item) {
  if (state.tipo === "passagens" || state.tipo === "veiculo") {
    const v = num(item.valor);
    const c = num(item.custo);
    if (v || c) item.lucro = Math.round((v - c) * 100) / 100;
  } else if (state.tipo === "hospedagem") {
    const v = num(item.vlr_total);
    const c = num(item.custo_tt || item.custo_hospedagem);
    if (v || c) item.lucro = Math.round((v - c) * 100) / 100;
  }
  item.pago = normalizePago(item.pago);
  return item;
}

function renderTotals(totais) {
  els.totals.innerHTML = `
    <div class="summary__card"><div class="summary__label">Receitas</div><div class="summary__value">${FisamAPI.brl(totais.receitas)}</div></div>
    <div class="summary__card"><div class="summary__label">Despesas</div><div class="summary__value">${FisamAPI.brl(totais.despesas)}</div></div>
    <div class="summary__card summary__card--strong"><div class="summary__label">Lucro</div><div class="summary__value">${FisamAPI.brl(totais.lucro)}</div></div>
  `;
}

function computeFooter(items) {
  let receitas = 0;
  let despesas = 0;
  for (const item of items) {
    if (state.tipo === "hospedagem") {
      receitas += num(item.vlr_total);
      despesas += num(item.custo_tt || item.custo_hospedagem);
    } else {
      receitas += num(item.valor);
      despesas += num(item.custo);
    }
  }
  return { receitas, despesas, lucro: receitas - despesas };
}

function cellValue(item, key) {
  if (key === "pago") {
    const checked = FisamAPI.isPago(item.pago) ? "checked" : "";
    return `<label class="pago-check"><input type="checkbox" class="pago-check__input" data-pago-id="${FisamAPI.escapeHtml(item.id)}" ${checked}><span class="pago-check__label">${FisamAPI.isPago(item.pago) ? "Sim" : "Não"}</span></label>`;
  }
  const v = item[key];
  if (v === null || v === undefined || v === "") return "-";
  if (String(key).includes("data") || key.startsWith("check_") || key === "dt_solicitacao") {
    return FisamAPI.formatDateBR(v);
  }
  if (["valor", "custo", "lucro", "vlr_total", "custo_tt", "vlr_diaria"].includes(key)) {
    return FisamAPI.brl(v);
  }
  return FisamAPI.escapeHtml(String(v));
}

function renderTable() {
  const items = filteredItems();
  const keys = state.displayKeys;
  els.thead.innerHTML = `<tr>${keys.map((k) => {
    const f = state.fields.find((x) => x.key === k);
    return `<th>${FisamAPI.escapeHtml(f?.label || k)}</th>`;
  }).join("")}<th class="right">Ações</th></tr>`;

  if (!items.length) {
    els.tbody.innerHTML = `<tr><td colspan="${keys.length + 1}" class="empty">Nenhum registro.</td></tr>`;
  } else {
    els.tbody.innerHTML = items.map((item) => {
      const idx = state.items.indexOf(item);
      return `
      <tr>
        ${keys.map((k) => `<td>${cellValue(item, k)}</td>`).join("")}
        <td class="right">
          <div class="row-actions">
            <button class="btn btn--outline" type="button" data-edit="${idx}">Editar</button>
            <button class="btn btn--ghost" type="button" data-del="${idx}">Excluir</button>
          </div>
        </td>
      </tr>
    `;
    }).join("");
  }

  const foot = computeFooter(items);
  const valIdx = keys.indexOf("valor") >= 0 ? keys.indexOf("valor") : keys.indexOf("vlr_total");
  const lucIdx = keys.indexOf("lucro");
  const colspan = valIdx > 0 ? valIdx : Math.max(1, keys.length - 3);

  els.tfoot.innerHTML = `<tr class="tfoot">
    <td colspan="${colspan}"><strong>TOTAL</strong></td>
    <td class="right"><strong>${FisamAPI.brl(foot.receitas)}</strong></td>
    <td class="right"><strong>${FisamAPI.brl(foot.despesas)}</strong></td>
    <td class="right"><strong>${FisamAPI.brl(foot.lucro)}</strong></td>
    ${lucIdx >= 0 && lucIdx < keys.length - 1 ? `<td colspan="${keys.length - lucIdx - 1}"></td>` : ""}
    <td></td>
  </tr>`;

  renderTotals(foot);

  els.tbody.querySelectorAll("[data-edit]").forEach((b) => {
    b.addEventListener("click", () => openEditor(Number(b.getAttribute("data-edit"))));
  });
  els.tbody.querySelectorAll("[data-del]").forEach((b) => {
    b.addEventListener("click", () => deleteItem(Number(b.getAttribute("data-del"))));
  });
  els.tbody.querySelectorAll(".pago-check__input").forEach((cb) => {
    cb.addEventListener("change", () => togglePago(cb));
  });
}

async function togglePago(checkbox) {
  const id = checkbox.getAttribute("data-pago-id");
  const item = state.items.find((x) => x.id === id);
  if (!item) return;
  const pago = checkbox.checked ? "sim" : "nao";
  checkbox.disabled = true;
  try {
    await FisamAPI.updateRegistroPago(licitacaoId, id, pago);
    item.pago = pago;
    const label = checkbox.closest(".pago-check")?.querySelector(".pago-check__label");
    if (label) label.textContent = pago === "sim" ? "Sim" : "Não";
    renderTable();
  } catch (err) {
    checkbox.checked = !checkbox.checked;
    showAlert(`Erro ao atualizar pago: ${err.message}`, "error");
  } finally {
    checkbox.disabled = false;
  }
}

async function deleteItem(index) {
  const item = state.items[index];
  if (!item) return;
  if (!confirm("Excluir este registro?")) return;
  try {
    if (item.id) await FisamAPI.deleteRegistro(licitacaoId, item.id);
    state.items.splice(index, 1);
    renderTable();
    showAlert("Registro excluído.", "success");
    setTimeout(() => showAlert(null), 2500);
  } catch (err) {
    showAlert(`Erro ao excluir: ${err.message}`, "error");
  }
}

function buildFormFields(item = {}) {
  els.formFields.innerHTML = state.fields.map((f) => {
    const val = item[f.key] ?? "";
    if (f.type === "pago") {
      const checked = FisamAPI.isPago(val) ? "checked" : "";
      return `
        <div class="field">
          <label class="field__label">${FisamAPI.escapeHtml(f.label)}</label>
          <label class="pago-check"><input class="pago-check__input" name="${f.key}" type="checkbox" ${checked}><span class="pago-check__label">Marcar como pago</span></label>
        </div>
      `;
    }
    const list = f.list ? ` list="${f.list}"` : "";
    const type = f.type === "date" ? "date" : f.type === "number" ? "number" : "text";
    const step = f.type === "number" ? ' step="0.01"' : "";
    const displayVal = f.type === "date" && val ? String(val).slice(0, 10) : val;
    return `
      <div class="field">
        <label class="field__label">${FisamAPI.escapeHtml(f.label)}</label>
        <input class="field__input" name="${f.key}" type="${type}" value="${FisamAPI.escapeHtml(String(displayVal))}"${list}${step}>
      </div>
    `;
  }).join("");
}

function openEditor(index = null) {
  state.editIndex = index;
  els.modalTitle.textContent = index === null ? "Nova linha" : "Editar registro";
  const item = index === null ? {} : { ...state.items[index] };
  buildFormFields(item);
  els.modal.setAttribute("aria-hidden", "false");
}

function readFormItem() {
  const item = {};
  for (const f of state.fields) {
    const input = els.form.querySelector(`[name="${f.key}"]`);
    if (f.type === "pago") {
      item[f.key] = input?.checked ? "sim" : "nao";
    } else {
      item[f.key] = input ? input.value.trim() : "";
    }
  }
  if (!item.id) item.id = "pg-" + Date.now();
  item.status = "ativo";
  return recalcLucro(item);
}

async function loadPassageirosDatalist() {
  if (state.tipo !== "passagens") return;
  try {
    const list = await FisamAPI.searchPassageiros("");
    els.passageirosList.innerHTML = list.map((p) =>
      `<option value="${FisamAPI.escapeHtml(p.nome)}" label="${FisamAPI.escapeHtml(p.cpf)}">`
    ).join("");
  } catch (_) { /* opcional */ }
}

async function load() {
  if (!licitacaoId) {
    showAlert("ID da licitação não informado.", "error");
    return;
  }
  showAlert(null);
  try {
    const data = await FisamAPI.getRegistros(licitacaoId);
    state.licitacao = data.licitacao;
    state.tipo = data.licitacao.tipo;
    state.fields = FIELDS[state.tipo] || [];
    state.displayKeys = DISPLAY[state.tipo] || state.fields.map((f) => f.key).slice(0, 6);
    state.items = (data.items || []).map(recalcLucro);
    document.title = `FISAM Tour | ${data.licitacao.nome}`;
    els.pageTag.textContent = `${data.licitacao.nome} • ${FisamAPI.tipoLabel(state.tipo)}`;
    renderTable();
    await loadPassageirosDatalist();
  } catch (err) {
    showAlert(`Erro: ${err.message}`, "error");
  }
}

els.btnAdd.addEventListener("click", () => openEditor(null));
els.btnSave.addEventListener("click", async () => {
  try {
    showAlert("Salvando…", "info");
    await FisamAPI.saveRegistros(licitacaoId, state.items);
    showAlert("Salvo e dashboard sincronizado.", "success");
    setTimeout(() => showAlert(null), 3000);
    await load();
  } catch (err) {
    showAlert(`Erro ao salvar: ${err.message}`, "error");
  }
});

if (els.filterPago) {
  els.filterPago.addEventListener("change", () => {
    state.pagoFilter = els.filterPago.value;
    renderTable();
  });
}

els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  const item = readFormItem();
  if (state.editIndex === null) state.items.push(item);
  else state.items[state.editIndex] = { ...state.items[state.editIndex], ...item };
  els.modal.setAttribute("aria-hidden", "true");
  renderTable();
});

FisamAPI.attachModalClose(els.modal);
load();
