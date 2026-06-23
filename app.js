/**
 * FISAM Tour - Dashboard + Nova Ordem de Serviço
 */

const $ = (s) => document.querySelector(s);

const els = {
  year: $("#year"), instagram: $("#linkInstagram"), whatsapp: $("#linkWhatsApp"),
  alert: $("#alert"), competencia: $("#competencia"), q: $("#q"), status: $("#status"),
  btnRefresh: $("#btnRefresh"), btnNew: $("#btnNew"), btnExport: $("#btnExport"), btnCloseMonth: $("#btnCloseMonth"),
  tbody: $("#tbody"), countInfo: $("#countInfo"),
  sumReceitas: $("#sumReceitas"), sumDespesas: $("#sumDespesas"), sumSaldo: $("#sumSaldo"),
  modal: $("#modal"), confirm: $("#confirm"), confirmText: $("#confirmText"), confirmOk: $("#confirmOk"),
  form: $("#form"), modalTitle: $("#modalTitle"),
  f_registro_tipo: $("#f_registro_tipo"), f_data: $("#f_data"), f_licitacao: $("#f_licitacao"),
  f_tarifa: $("#f_tarifa"), f_status_os: $("#f_status_os"), f_tipo: $("#f_tipo"), f_status: $("#f_status"),
  f_categoria: $("#f_categoria"), f_fornecedor: $("#f_fornecedor"), f_descricao: $("#f_descricao"),
  f_valor: $("#f_valor"), f_custo: $("#f_custo"), f_lucro: $("#f_lucro"), f_comprovante: $("#f_comprovante"),
  btnAddFornecedor: $("#btnAddFornecedor"), modalForn: $("#modalForn"), formForn: $("#formForn"), f_forn_nome: $("#f_forn_nome"),
  wrap_tarifa: $("#wrap_tarifa"), wrap_status_os: $("#wrap_status_os"),
  wrap_tipo_manual: $("#wrap_tipo_manual"), wrap_status_manual: $("#wrap_status_manual"),
  wrap_categoria: $("#wrap_categoria"), wrap_custo: $("#wrap_custo"), wrap_lucro: $("#wrap_lucro"),
};

let state = {
  rows: [], editingId: null, editingOrdemId: null, apiError: null,
  licitacoes: [], tarifas: [], fornecedores: [],
};

function showAlert(msg, type = "warn") {
  if (!els.alert) return;
  if (!msg) { els.alert.hidden = true; return; }
  els.alert.hidden = false;
  els.alert.className = `alert alert--${type}`;
  els.alert.textContent = msg;
}

function recalcLucro() {
  const v = FisamAPI.parseMoney(els.f_valor.value);
  const c = FisamAPI.parseMoney(els.f_custo.value);
  els.f_lucro.value = (v - c).toFixed(2).replace(".", ",");
}

function setFormMode(mode) {
  const isOS = mode === "ordem_servico";
  els.wrap_tarifa.classList.toggle("hidden", !isOS);
  els.wrap_status_os.classList.toggle("hidden", !isOS);
  els.wrap_custo.classList.toggle("hidden", !isOS);
  els.wrap_lucro.classList.toggle("hidden", !isOS);
  els.wrap_tipo_manual.classList.toggle("hidden", isOS);
  els.wrap_status_manual.classList.toggle("hidden", isOS);
  els.wrap_categoria.classList.toggle("hidden", isOS);
  if (isOS) els.f_categoria.removeAttribute("required");
  else els.f_categoria.setAttribute("required", "required");
}

async function loadTarifas(licitacaoId) {
  els.f_tarifa.innerHTML = '<option value="">Carregando…</option>';
  if (!licitacaoId) {
    els.f_tarifa.innerHTML = '<option value="">Selecione a licitação…</option>';
    return;
  }
  try {
    state.tarifas = await FisamAPI.fetchTarifas(licitacaoId);
    els.f_tarifa.innerHTML = '<option value="">Selecione a tarifa…</option>';
    for (const t of state.tarifas) {
      const o = document.createElement("option");
      o.value = t.codigo;
      o.textContent = t.nome;
      o.dataset.valor = t.valor ?? "";
      o.dataset.custo = t.custo ?? "";
      o.dataset.editavel = (t.editavel === true || t.editavel === "true" || t.editavel === "1" || t.editavel === 1) ? "1" : "0";
      o.dataset.nome = t.nome;
      els.f_tarifa.appendChild(o);
    }
  } catch {
    els.f_tarifa.innerHTML = '<option value="">Sem tarifas cadastradas</option>';
  }
}

function applyTarifa() {
  const opt = els.f_tarifa.selectedOptions[0];
  if (!opt || !opt.value) return;
  const editavel = opt.dataset.editavel === "1";
  els.f_valor.readOnly = !editavel && !!opt.dataset.valor;
  els.f_custo.readOnly = !editavel && !!opt.dataset.custo;
  if (opt.dataset.valor) els.f_valor.value = String(opt.dataset.valor).replace(".", ",");
  if (opt.dataset.custo) els.f_custo.value = String(opt.dataset.custo).replace(".", ",");
  if (editavel) {
    els.f_valor.readOnly = false;
    els.f_custo.readOnly = false;
  }
  recalcLucro();
}

function getSelectedLicitacao() {
  const opt = els.f_licitacao.selectedOptions[0];
  if (!opt || !opt.value) return null;
  return { id: opt.dataset.id || opt.value, nome: opt.textContent };
}

async function openModal(editRow = null) {
  state.editingId = editRow?.origem === "ordem_servico" ? null : (editRow?.id || null);
  state.editingOrdemId = editRow?.origem === "ordem_servico" ? editRow.origem_id : null;
  els.modalTitle.textContent = editRow ? "Editar registro" : "Nova ordem de serviço";

  els.form.reset();
  els.f_data.value = new Date().toISOString().slice(0, 10);
  els.f_registro_tipo.value = "ordem_servico";
  setFormMode("ordem_servico");
  FisamAPI.fillSelect(els.f_licitacao, state.licitacoes, "Selecione a licitação…", false, "id");
  FisamAPI.fillSelect(els.f_fornecedor, state.fornecedores, "Selecione…", true);

  if (editRow) {
    els.f_data.value = editRow.data?.slice(0, 10) || els.f_data.value;
    els.f_descricao.value = editRow.descricao || "";
    els.f_comprovante.value = editRow.comprovante_url || "";
    els.f_fornecedor.value = editRow.fornecedor || "";
    const lic = state.licitacoes.find((l) => l.nome === editRow.licitacao);
    if (lic) {
      els.f_licitacao.value = lic.id;
      await loadTarifas(lic.id);
    }
    if (editRow.origem === "ordem_servico") {
      els.f_registro_tipo.value = "ordem_servico";
      setFormMode("ordem_servico");
      els.f_valor.value = String(editRow.valor || "").replace(".", ",");
    } else {
      els.f_registro_tipo.value = editRow.tipo;
      setFormMode(editRow.tipo);
      els.f_tipo.value = editRow.tipo;
      els.f_status.value = editRow.status;
      els.f_categoria.value = editRow.categoria;
      els.f_valor.value = String(editRow.valor || "").replace(".", ",");
    }
  }

  els.modal.setAttribute("aria-hidden", "false");
}

function closeModal() { els.modal.setAttribute("aria-hidden", "true"); }

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

function filterRows(rows) {
  const q = els.q.value.trim().toLowerCase();
  const status = els.status.value;
  return rows.filter((r) => {
    const matchStatus = status === "all" ? true : r.status === status;
    const hay = [r.licitacao, r.tipo, r.categoria, r.fornecedor, r.descricao].filter(Boolean).join(" ").toLowerCase();
    return (q ? hay.includes(q) : true) && matchStatus;
  });
}

function computeSummary(rows) {
  let receitas = 0, despesas = 0;
  for (const r of rows) {
    if (r.tipo === "receita") receitas += r.valor;
    else despesas += r.valor;
  }
  els.sumReceitas.textContent = FisamAPI.brl(receitas);
  els.sumDespesas.textContent = FisamAPI.brl(despesas);
  els.sumSaldo.textContent = FisamAPI.brl(receitas - despesas);
}

function badge(tipo) {
  const cls = tipo === "receita" ? "badge badge--receita" : "badge badge--despesa";
  return `<span class="${cls}">${tipo}</span>`;
}

function renderTable(rows) {
  const filtered = filterRows(rows);
  computeSummary(filtered);
  els.countInfo.textContent = `${filtered.length} itens`;

  if (!filtered.length) {
    const comp = els.competencia.value || FisamAPI.monthToday();
    els.tbody.innerHTML = `<tr><td colspan="8" class="empty">${FisamAPI.escapeHtml(state.apiError ? "Erro ao carregar." : `Nenhum lançamento em ${comp}.`)}</td></tr>`;
    return;
  }

  els.tbody.innerHTML = filtered.map((r) => `
    <tr>
      <td>${FisamAPI.formatDateBR(r.data)}</td>
      <td>${FisamAPI.escapeHtml(r.licitacao)}</td>
      <td>${badge(r.tipo)}</td>
      <td>${FisamAPI.escapeHtml(r.categoria)}</td>
      <td>${FisamAPI.escapeHtml(r.fornecedor || "-")}</td>
      <td>${FisamAPI.escapeHtml(r.descricao || "-")}</td>
      <td class="right">${FisamAPI.brl(r.valor)}</td>
      <td class="right">
        <div class="row-actions">
          <button class="btn btn--outline" data-edit="${r.id}">Editar</button>
          <button class="btn btn--ghost" data-del="${r.id}">Excluir</button>
        </div>
      </td>
    </tr>
  `).join("");

  els.tbody.querySelectorAll("[data-edit]").forEach((b) => {
    b.addEventListener("click", () => {
      const row = state.rows.find((x) => x.id === b.getAttribute("data-edit"));
      if (row) openModal(row);
    });
  });
  els.tbody.querySelectorAll("[data-del]").forEach((b) => {
    b.addEventListener("click", () => {
      openConfirm("Excluir este lançamento?", async () => {
        try {
          await FisamAPI.deleteLancamento(b.getAttribute("data-del"));
          await refresh();
        } catch (err) { alert(err.message); }
      });
    });
  });
}

async function refresh() {
  const competencia = els.competencia.value || FisamAPI.monthToday();
  state.apiError = null;
  showAlert(null);
  try {
    state.rows = await FisamAPI.listLancamentos(competencia);
    if (!state.rows.length) showAlert(`Nenhum lançamento em ${competencia}.`, "info");
  } catch (err) {
    state.apiError = err;
    state.rows = [];
    showAlert(`Erro na API: ${err.message}`, "error");
  }
  renderTable(state.rows);
}

function exportCSV() {
  const filtered = filterRows(state.rows);
  const header = ["data", "licitacao", "status", "tipo", "categoria", "fornecedor", "descricao", "valor"];
  const lines = [header.join(",")];
  for (const r of filtered) {
    lines.push([r.data, r.licitacao, r.status, r.tipo, r.categoria, r.fornecedor || "", r.descricao || "", r.valor]
      .map((v) => `"${String(v).replaceAll('"', '""')}"`).join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `fisam_lancamentos_${els.competencia.value || FisamAPI.monthToday()}.csv`;
  a.click();
}

function wire() {
  els.year.textContent = String(new Date().getFullYear());
  els.instagram.href = FisamAPI.CONFIG.INSTAGRAM_URL;
  els.whatsapp.href = FisamAPI.CONFIG.WHATSAPP_URL;
  els.competencia.value = FisamAPI.monthToday();

  els.btnRefresh.addEventListener("click", refresh);
  els.btnNew.addEventListener("click", () => openModal(null));
  els.btnExport.addEventListener("click", exportCSV);
  els.btnCloseMonth.addEventListener("click", () => {
    const c = els.competencia.value || FisamAPI.monthToday();
    openConfirm(`Fechar competência ${c}?`, async () => {
      try {
        await FisamAPI.closeMonth(c);
        alert("Mês fechado!");
        await refresh();
      } catch (err) { alert(err.message); }
    });
  });

  els.q.addEventListener("input", () => renderTable(state.rows));
  els.status.addEventListener("change", () => renderTable(state.rows));
  els.competencia.addEventListener("change", refresh);

  els.f_registro_tipo.addEventListener("change", () => setFormMode(els.f_registro_tipo.value));
  els.f_licitacao.addEventListener("change", () => loadTarifas(els.f_licitacao.value));
  els.f_tarifa.addEventListener("change", applyTarifa);
  els.f_valor.addEventListener("input", recalcLucro);
  els.f_custo.addEventListener("input", recalcLucro);

  els.btnAddFornecedor.addEventListener("click", () => {
    els.f_forn_nome.value = "";
    els.modalForn.setAttribute("aria-hidden", "false");
  });

  els.formForn.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await FisamAPI.saveFornecedor({ nome: els.f_forn_nome.value.trim() });
      const opts = await FisamAPI.fetchOptions();
      state.fornecedores = opts.fornecedores;
      FisamAPI.fillSelect(els.f_fornecedor, state.fornecedores, "Selecione…", true);
      els.f_fornecedor.value = els.f_forn_nome.value.trim();
      els.modalForn.setAttribute("aria-hidden", "true");
    } catch (err) { alert(err.message); }
  });

  els.form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const competencia = els.competencia.value || FisamAPI.monthToday();
    const lic = getSelectedLicitacao();
    if (!lic) { alert("Selecione a licitação."); return; }

    const modo = els.f_registro_tipo.value;
    try {
      if (modo === "ordem_servico") {
        const tarOpt = els.f_tarifa.selectedOptions[0];
        const valor = FisamAPI.parseMoney(els.f_valor.value);
        const custo = FisamAPI.parseMoney(els.f_custo.value);
        await FisamAPI.saveOrdem({
          id: state.editingOrdemId || undefined,
          competencia,
          data: els.f_data.value,
          licitacao_id: lic.id,
          licitacao_nome: lic.nome,
          tarifa_codigo: tarOpt?.value || "",
          tarifa_nome: tarOpt?.dataset.nome || tarOpt?.textContent || "",
          fornecedor: els.f_fornecedor.value.trim(),
          descricao: els.f_descricao.value.trim(),
          valor,
          custo,
          lucro: valor - custo,
          status_os: els.f_status_os.value,
          pago: "nao",
          comprovante_url: els.f_comprovante.value.trim(),
        });
      } else {
        const row = {
          competencia, data: els.f_data.value, licitacao: lic.nome,
          status: els.f_status.value, tipo: modo,
          categoria: els.f_categoria.value.trim(),
          fornecedor: els.f_fornecedor.value.trim(),
          descricao: els.f_descricao.value.trim(),
          valor: FisamAPI.parseMoney(els.f_valor.value),
          comprovante_url: els.f_comprovante.value.trim(),
          origem: "manual",
        };
        if (state.editingId) await FisamAPI.updateLancamento({ ...row, id: state.editingId });
        else await FisamAPI.addLancamento(row);
      }
      closeModal();
      await refresh();
    } catch (err) { alert(err.message); }
  });

  FisamAPI.attachModalClose(els.modal);
  FisamAPI.attachModalClose(els.confirm);
  FisamAPI.attachModalClose(els.modalForn);
}

(async function init() {
  wire();
  try {
    const opts = await FisamAPI.fetchOptions();
    state.licitacoes = opts.licitacoes;
    state.fornecedores = opts.fornecedores;
  } catch (_) { /* ok */ }
  await refresh();
})();
