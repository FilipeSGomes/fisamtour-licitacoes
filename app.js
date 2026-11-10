/**
 * FISAM Tour - Dashboard + Nova Ordem de Serviço
 */

const $ = (s) => document.querySelector(s);

const els = {
  year: $("#year"), instagram: $("#linkInstagram"), whatsapp: $("#linkWhatsApp"),
  alert: $("#alert"), competencia: $("#competencia"), q: $("#q"), status: $("#status"),
  btnRefresh: $("#btnRefresh"), btnNew: $("#btnNew"), btnExport: $("#btnExport"), btnCloseMonth: $("#btnCloseMonth"), btnReopenMonth: $("#btnReopenMonth"),
  tbody: $("#tbody"), countInfo: $("#countInfo"), pager: $("#pager"),
  origem: $("#origem"), tipoValor: $("#tipoValor"),
  sumReceitas: $("#sumReceitas"), sumDespesas: $("#sumDespesas"), sumSaldo: $("#sumSaldo"),
  modal: $("#modal"), confirm: $("#confirm"), confirmText: $("#confirmText"), confirmOk: $("#confirmOk"),
  form: $("#form"), modalTitle: $("#modalTitle"),
  f_registro_tipo: $("#f_registro_tipo"), f_data: $("#f_data"), f_licitacao: $("#f_licitacao"),
  f_tarifa: $("#f_tarifa"), f_status_os: $("#f_status_os"), f_tipo: $("#f_tipo"), f_status: $("#f_status"),
  f_categoria: $("#f_categoria"), f_fornecedor: $("#f_fornecedor"), f_descricao: $("#f_descricao"),
  f_valor: $("#f_valor"), f_custo: $("#f_custo"), f_lucro: $("#f_lucro"), f_pago: $("#f_pago"), f_comprovante: $("#f_comprovante"),
  btnAddFornecedor: $("#btnAddFornecedor"), modalForn: $("#modalForn"), formForn: $("#formForn"), f_forn_nome: $("#f_forn_nome"),
  wrap_tarifa: $("#wrap_tarifa"), wrap_status_os: $("#wrap_status_os"),
  wrap_tipo_manual: $("#wrap_tipo_manual"), wrap_status_manual: $("#wrap_status_manual"),
  wrap_categoria: $("#wrap_categoria"), wrap_custo: $("#wrap_custo"), wrap_lucro: $("#wrap_lucro"), wrap_pago: $("#wrap_pago"),
};

let state = {
  rows: [], editingId: null, editingOrdemId: null, apiError: null, page: 1,
  licitacoes: [], tarifas: [], fornecedores: [], totais: null,
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
  if (els.wrap_pago) els.wrap_pago.classList.toggle("hidden", !isOS);
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
      o.value = t.id;
      o.textContent = t.nome;
      o.dataset.valor = t.valor ?? "";
      o.dataset.custo = t.custo ?? "";
      o.dataset.editavel = FisamAPI.isEditavel(t.editavel) ? "1" : "0";
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

function moneyInput(v) {
  const n = FisamAPI.parseMoney(v);
  if (!n && n !== 0) return "";
  return String(n).replace(".", ",");
}

async function openModal(editRow = null) {
  const fromOS = FisamAPI.isOrdemOrigem(editRow?.origem);
  state.editingId = fromOS ? null : (editRow?.id || null);
  state.editingOrdemId = fromOS ? editRow.origem_id : null;
  els.modalTitle.textContent = editRow ? "Editar registro" : "Nova ordem de serviço";

  els.form.reset();
  els.f_valor.readOnly = false;
  els.f_custo.readOnly = false;
  if (els.f_pago) els.f_pago.checked = false;
  els.f_data.value = new Date().toISOString().slice(0, 10);
  els.f_registro_tipo.value = "ordem_servico";
  setFormMode("ordem_servico");
  FisamAPI.fillSelect(els.f_licitacao, state.licitacoes, "Selecione a licitação…", false, "id");
  FisamAPI.fillSelect(els.f_fornecedor, state.fornecedores, "Selecione…", true, "id");

  if (editRow) {
    els.f_data.value = String(editRow.data || "").slice(0, 10) || els.f_data.value;
    els.f_descricao.value = editRow.descricao || "";
    els.f_comprovante.value = editRow.comprovante_url || "";
    if (editRow.fornecedor_id) els.f_fornecedor.value = editRow.fornecedor_id;
    const licId = editRow.licitacao_id || state.licitacoes.find((l) => l.nome === editRow.licitacao)?.id;
    if (licId) {
      els.f_licitacao.value = licId;
      await loadTarifas(licId);
    }
    if (fromOS) {
      els.f_registro_tipo.value = "ordem_servico";
      setFormMode("ordem_servico");
      els.f_valor.value = moneyInput(editRow.valor);
      if (editRow.origem_id) {
        try {
          const ordens = await FisamAPI.listOrdens(editRow.competencia || els.competencia.value, licId);
          const os = ordens.find((o) => String(o.id) === String(editRow.origem_id));
          if (os) {
            els.f_status_os.value = os.status_os || "aberta";
            els.f_tarifa.value = os.tarifa_id || "";
            els.f_valor.value = moneyInput(os.valor);
            els.f_custo.value = moneyInput(os.custo);
            if (os.fornecedor_id) els.f_fornecedor.value = os.fornecedor_id;
            if (os.descricao) els.f_descricao.value = os.descricao;
            if (els.f_pago) els.f_pago.checked = FisamAPI.isPago(os.pago);
          }
        } catch (_) { /* usa campos do lançamento */ }
      }
      const opt = els.f_tarifa.selectedOptions[0];
      if (opt && opt.value) {
        const editavel = opt.dataset.editavel === "1";
        els.f_valor.readOnly = !editavel;
        els.f_custo.readOnly = !editavel;
      }
      recalcLucro();
    } else {
      els.f_registro_tipo.value = editRow.tipo;
      setFormMode(editRow.tipo);
      els.f_tipo.value = editRow.tipo;
      els.f_status.value = editRow.status;
      els.f_categoria.value = editRow.categoria;
      els.f_valor.value = moneyInput(editRow.valor);
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
  const tipo = els.tipoValor?.value || "all";
  const origem = els.origem?.value || "all";
  return rows.filter((r) => {
    const matchStatus = status === "all" ? true : r.status === status;
    const matchTipo = tipo === "all" || r.tipo === tipo;
    const matchOrigem = origem === "all"
      || (origem === "registro" ? String(r.origem || "").startsWith("reg_") : r.origem === origem);
    const hay = [r.licitacao, r.tipo, r.categoria, r.fornecedor, r.descricao].filter(Boolean).join(" ").toLowerCase();
    return (q ? hay.includes(q) : true) && matchStatus && matchTipo && matchOrigem;
  });
}

function renderPainel(painel) {
  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value == null ? "—" : String(value);
  };
  set("metricLicitacoes", painel?.licitacoes_ativas);
  set("metricOsAbertas", painel?.os_abertas);
  set("metricServicos", painel?.servicos_executados);
  const list = document.getElementById("atividadeList");
  if (!list) return;
  const items = painel?.atividade || [];
  if (!items.length) {
    list.innerHTML = `<li class="empty">Nenhuma alteração registrada.</li>`;
    return;
  }
  const acao = {
    criar: "criou", atualizar: "atualizou", inativar: "inativou", excluir: "excluiu",
    fechar: "fechou", reabrir: "reabriu",
  };
  const entidade = {
    licitacoes: "licitação", fornecedores: "fornecedor", tarifas: "tarifa",
    passageiros: "passageiro", ordens_servico: "ordem de serviço",
    reg_passagens: "passagem", reg_hospedagem: "hospedagem", reg_veiculo: "veículo",
    lancamentos: "lançamento", fechamentos: "competência", users: "usuário",
  };
  list.innerHTML = items.map((item) => {
    const quando = item.created_at ? new Date(item.created_at).toLocaleString("pt-BR") : "";
    return `<li><strong>${FisamAPI.escapeHtml(item.usuario || "Sistema")}</strong> ${FisamAPI.escapeHtml(acao[item.action] || item.action)} ${FisamAPI.escapeHtml(entidade[item.entity] || item.entity)} <span class="muted">${FisamAPI.escapeHtml(quando)}</span></li>`;
  }).join("");
}

function applyTotais(totais) {
  const t = totais || { receitas: 0, despesas: 0, lucro: 0 };
  els.sumReceitas.textContent = FisamAPI.brl(t.receitas);
  els.sumDespesas.textContent = FisamAPI.brl(t.despesas);
  els.sumSaldo.textContent = FisamAPI.brl(t.lucro);
}

function badge(tipo) {
  const cls = tipo === "receita" ? "badge badge--receita" : "badge badge--despesa";
  return `<span class="${cls}">${tipo}</span>`;
}

function renderTable(rows) {
  const filtered = filterRows(rows);
  applyTotais(state.totais);
  const pageSize = 8;
  const view = FisamUI.slice(filtered, state.page, pageSize);
  state.page = view.page;
  els.countInfo.textContent = `${view.total} itens`;
  FisamUI.renderPager(els.pager, {
    page: view.page,
    pages: view.pages,
    total: view.total,
    onPage: (page) => { state.page = page; renderTable(state.rows); },
  });

  if (!view.total) {
    const comp = els.competencia.value || FisamAPI.monthToday();
    els.tbody.innerHTML = `<tr><td colspan="8" class="empty">${FisamAPI.escapeHtml(state.apiError ? "Erro ao carregar." : `Nenhum lançamento em ${comp}.`)}</td></tr>`;
    return;
  }

  els.tbody.innerHTML = view.items.map((r) => `
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
      const row = state.rows.find((x) => x.id === b.getAttribute("data-del"));
      const fromOS = FisamAPI.isOrdemOrigem(row?.origem) && row?.origem_id;
      if (row?.origem && row.origem !== "manual" && !fromOS) {
        alert("Este lançamento vem de um registro. Exclua o registro na licitação.");
        return;
      }
      openConfirm(fromOS ? "Inativar esta ordem de serviço e retirar o razão vinculado?" : "Excluir este lançamento?", async () => {
        try {
          if (fromOS) await FisamAPI.deleteOrdem(row.origem_id);
          else await FisamAPI.deleteLancamento(b.getAttribute("data-del"));
          await refresh();
        } catch (err) { alert(err.message); }
      });
    });
  });
}

async function refresh() {
  state.page = 1;
  const competencia = els.competencia.value || FisamAPI.monthToday();
  state.apiError = null;
  showAlert(null);
  try {
    const [data, painel] = await Promise.all([
      FisamAPI.listLancamentos(competencia),
      FisamAPI.fetchPainel(competencia).catch(() => null),
    ]);
    renderPainel(painel);
    state.rows = data.rows || [];
    state.totais = data.totais || { receitas: 0, despesas: 0, lucro: 0 };
    state.fechamento = data.fechamento || null;
    const fechada = state.fechamento?.status === "fechada";
    if (els.btnReopenMonth) els.btnReopenMonth.hidden = !fechada;
    if (els.btnCloseMonth) els.btnCloseMonth.hidden = fechada;
    if (fechada) showAlert(`Competência ${competencia} está fechada.`, "info");
    else if (!state.rows.length) showAlert(`Nenhum lançamento em ${competencia}.`, "info");
  } catch (err) {
    state.apiError = err;
    state.rows = [];
    state.totais = { receitas: 0, despesas: 0, lucro: 0 };
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
    openConfirm(`Fechar competência ${c}? Lançamentos desse mês ficam bloqueados.`, async () => {
      try {
        await FisamAPI.closeMonth(c);
        await refresh();
      } catch (err) { alert(err.message); }
    });
  });
  if (els.btnReopenMonth) {
    els.btnReopenMonth.addEventListener("click", () => {
      const c = els.competencia.value || FisamAPI.monthToday();
      openConfirm(`Reabrir competência ${c}?`, async () => {
        try {
          await FisamAPI.reopenMonth(c);
          await refresh();
        } catch (err) { alert(err.message); }
      });
    });
  }

  const rerender = () => { state.page = 1; renderTable(state.rows); };
  els.q.addEventListener("input", rerender);
  els.status.addEventListener("change", rerender);
  if (els.origem) els.origem.addEventListener("change", rerender);
  if (els.tipoValor) els.tipoValor.addEventListener("change", rerender);
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
      const saved = await FisamAPI.saveFornecedor({ nome: els.f_forn_nome.value.trim() });
      const opts = await FisamAPI.fetchOptions();
      state.fornecedores = opts.fornecedores;
      FisamAPI.fillSelect(els.f_fornecedor, state.fornecedores, "Selecione…", true, "id");
      els.f_fornecedor.value = saved.fornecedor?.id || "";
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
          tarifa_id: tarOpt?.value || null,
          fornecedor_id: els.f_fornecedor.value || null,
          descricao: els.f_descricao.value.trim(),
          valor,
          custo,
          status_os: els.f_status_os.value,
          pago: els.f_pago?.checked ? "sim" : "nao",
          comprovante_url: els.f_comprovante.value.trim(),
        });
      } else {
        const row = {
          competencia, data: els.f_data.value, licitacao_id: lic.id,
          tipo: modo,
          categoria: els.f_categoria.value.trim(),
          fornecedor_id: els.f_fornecedor.value || null,
          descricao: els.f_descricao.value.trim(),
          valor: FisamAPI.parseMoney(els.f_valor.value),
          comprovante_url: els.f_comprovante.value.trim(),
        };
        if (state.editingId) await FisamAPI.updateLancamento({ ...row, id: state.editingId });
        else await FisamAPI.addLancamento(row);
      }
      closeModal();
      showAlert("Registro salvo.", "success");
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
