const $ = (s) => document.querySelector(s);

const els = {
  alert: $("#alert"),
  tbody: $("#tbody"),
  btnRefresh: $("#btnRefresh"),
  btnNewLic: $("#btnNewLic"),
  year: $("#year"),
  modalLic: $("#modalLic"),
  modalLicTitle: $("#modalLicTitle"),
  formLic: $("#formLic"),
  f_lic_nome: $("#f_lic_nome"),
  f_lic_tipo: $("#f_lic_tipo"),
  f_lic_status: $("#f_lic_status"),
  modalTarifas: $("#modalTarifas"),
  modalTarTitle: $("#modalTarTitle"),
  tarifasList: $("#tarifasList"),
  btnAddTarifa: $("#btnAddTarifa"),
  modalFatura: $("#modalFatura"),
  formFatura: $("#formFatura"),
  f_fatura_comp: $("#f_fatura_comp"),
};

let state = { licitacoes: [], editingId: null, tarifasLicId: null, faturaLicId: null };

function showAlert(msg, type = "warn") {
  if (!msg) { els.alert.hidden = true; return; }
  els.alert.hidden = false;
  els.alert.className = `alert alert--${type}`;
  els.alert.textContent = msg;
}

function detailHref(lic) {
  if (lic.tipo === "calculadora") return "./tunas.html";
  return `./licitacao.html?id=${encodeURIComponent(lic.id)}`;
}

function statusBadge(status) {
  const s = String(status || "ativo").toLowerCase();
  const cls = s === "ativo" ? "badge badge--receita" : "badge badge--despesa";
  return `<span class="${cls}">${FisamAPI.escapeHtml(s)}</span>`;
}

function renderTable() {
  if (!state.licitacoes.length) {
    els.tbody.innerHTML = `<tr><td colspan="7" class="empty">Nenhuma licitação cadastrada.</td></tr>`;
    return;
  }

  els.tbody.innerHTML = state.licitacoes.map((lic) => `
    <tr class="${String(lic.status).toLowerCase() === "inativo" ? "row--muted" : ""}">
      <td><strong>${FisamAPI.escapeHtml(lic.nome)}</strong></td>
      <td>${FisamAPI.escapeHtml(FisamAPI.tipoLabel(lic.tipo))}</td>
      <td>${statusBadge(lic.status)}</td>
      <td class="right">${FisamAPI.brl(lic.receitas)}</td>
      <td class="right">${FisamAPI.brl(lic.despesas)}</td>
      <td class="right">${FisamAPI.brl(lic.lucro)}</td>
      <td class="right">
        <div class="row-actions row-actions--wrap">
          <button class="btn btn--outline btn--sm" type="button" data-edit="${FisamAPI.escapeHtml(lic.id)}">Editar</button>
          <button class="btn btn--outline btn--sm" type="button" data-tarifas="${FisamAPI.escapeHtml(lic.id)}">Tarifas</button>
          <a class="btn btn--outline btn--sm" href="${detailHref(lic)}">Detalhe</a>
          <button class="btn btn--primary btn--sm" type="button" data-fatura="${FisamAPI.escapeHtml(lic.id)}">Fatura</button>
        </div>
      </td>
    </tr>
  `).join("");

  els.tbody.querySelectorAll("[data-edit]").forEach((b) => {
    b.addEventListener("click", () => openLicModal(b.getAttribute("data-edit")));
  });
  els.tbody.querySelectorAll("[data-tarifas]").forEach((b) => {
    b.addEventListener("click", () => openTarifasModal(b.getAttribute("data-tarifas")));
  });
  els.tbody.querySelectorAll("[data-fatura]").forEach((b) => {
    b.addEventListener("click", () => openFaturaModal(b.getAttribute("data-fatura")));
  });
}

function openLicModal(id = null) {
  state.editingId = id;
  els.modalLicTitle.textContent = id ? "Editar licitação" : "Nova licitação";
  els.formLic.reset();
  if (id) {
    const lic = state.licitacoes.find((l) => l.id === id);
    if (lic) {
      els.f_lic_nome.value = lic.nome;
      els.f_lic_tipo.value = lic.tipo;
      els.f_lic_status.value = lic.status || "ativo";
    }
  }
  els.modalLic.setAttribute("aria-hidden", "false");
}

async function openTarifasModal(licId) {
  state.tarifasLicId = licId;
  const lic = state.licitacoes.find((l) => l.id === licId);
  els.modalTarTitle.textContent = `Tarifas — ${lic?.nome || licId}`;
  els.tarifasList.innerHTML = `<div class="empty">Carregando…</div>`;
  els.modalTarifas.setAttribute("aria-hidden", "false");
  await renderTarifasEditor();
}

function tarifaRowHtml(t, i) {
  return `
    <div class="tarifa-row" data-i="${i}">
      <input class="field__input" placeholder="Código" data-k="codigo" value="${FisamAPI.escapeHtml(t.codigo || "")}">
      <input class="field__input" placeholder="Nome" data-k="nome" value="${FisamAPI.escapeHtml(t.nome || "")}">
      <input class="field__input" placeholder="Valor" data-k="valor" inputmode="decimal" value="${t.valor ?? ""}">
      <input class="field__input" placeholder="Custo" data-k="custo" inputmode="decimal" value="${t.custo ?? ""}">
      <label class="pago-check"><input type="checkbox" data-k="editavel" ${t.editavel === true || t.editavel === "true" || t.editavel === "1" ? "checked" : ""}><span>Editável</span></label>
      <button type="button" class="btn btn--primary btn--sm" data-save-tarifa="${i}">Salvar</button>
    </div>
  `;
}

async function renderTarifasEditor() {
  try {
    const tarifas = await FisamAPI.fetchTarifas(state.tarifasLicId);
    state._tarifas = tarifas;
    if (!tarifas.length) {
      els.tarifasList.innerHTML = `<div class="empty">Nenhuma tarifa. Adicione abaixo.</div>`;
    } else {
      els.tarifasList.innerHTML = tarifas.map(tarifaRowHtml).join("");
    }
    bindTarifaButtons();
  } catch (err) {
    els.tarifasList.innerHTML = `<div class="empty">Erro: ${FisamAPI.escapeHtml(err.message)}</div>`;
  }
}

function bindTarifaButtons() {
  els.tarifasList.querySelectorAll("[data-save-tarifa]").forEach((btn) => {
    btn.addEventListener("click", () => saveTarifaRow(Number(btn.getAttribute("data-save-tarifa"))));
  });
}

async function saveTarifaRow(index) {
  const row = els.tarifasList.querySelector(`.tarifa-row[data-i="${index}"]`);
  if (!row) return;
  const t = state._tarifas[index] || {};
  const data = { id: t.id, licitacao_id: state.tarifasLicId };
  row.querySelectorAll("[data-k]").forEach((el) => {
    const k = el.getAttribute("data-k");
    if (k === "editavel") data[k] = el.checked ? "true" : "false";
    else data[k] = el.value.trim();
  });
  data.valor = FisamAPI.parseMoney(data.valor);
  data.custo = FisamAPI.parseMoney(data.custo);
  try {
    await FisamAPI.saveTarifa(data);
    showAlert("Tarifa salva.", "success");
    setTimeout(() => showAlert(null), 2000);
    await renderTarifasEditor();
  } catch (err) {
    showAlert(err.message, "error");
  }
}

function openFaturaModal(licId) {
  state.faturaLicId = licId;
  els.f_fatura_comp.value = FisamAPI.monthToday();
  els.modalFatura.setAttribute("aria-hidden", "false");
}

async function load() {
  showAlert(null);
  els.tbody.innerHTML = `<tr><td colspan="7" class="empty">Carregando…</td></tr>`;
  try {
    state.licitacoes = await FisamAPI.listLicitacoes(true);
    renderTable();
  } catch (err) {
    showAlert(`Erro: ${err.message}`, "error");
    els.tbody.innerHTML = `<tr><td colspan="7" class="empty">Falha ao carregar.</td></tr>`;
  }
}

els.year.textContent = String(new Date().getFullYear());
els.btnRefresh.addEventListener("click", load);
els.btnNewLic.addEventListener("click", () => openLicModal(null));

els.formLic.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await FisamAPI.saveLicitacao({
      id: state.editingId || undefined,
      nome: els.f_lic_nome.value.trim(),
      tipo: els.f_lic_tipo.value,
      status: els.f_lic_status.value,
    });
    els.modalLic.setAttribute("aria-hidden", "true");
    await load();
  } catch (err) {
    showAlert(err.message, "error");
  }
});

els.btnAddTarifa.addEventListener("click", async () => {
  if (!state.tarifasLicId) return;
  try {
    await FisamAPI.saveTarifa({
      licitacao_id: state.tarifasLicId,
      codigo: "nova",
      nome: "Nova tarifa",
      editavel: "true",
    });
    await renderTarifasEditor();
  } catch (err) {
    showAlert(err.message, "error");
  }
});

els.formFatura.addEventListener("submit", (e) => {
  e.preventDefault();
  const comp = els.f_fatura_comp.value;
  const id = state.faturaLicId;
  if (!id || !comp) return;
  location.href = `./fatura.html?licitacao_id=${encodeURIComponent(id)}&competencia=${encodeURIComponent(comp)}`;
});

FisamAPI.attachModalClose(els.modalLic);
FisamAPI.attachModalClose(els.modalTarifas);
FisamAPI.attachModalClose(els.modalFatura);
load();
