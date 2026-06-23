/**
 * FISAM Tour — cliente da API (Google Apps Script)
 */
const FisamAPI = (() => {
  const CONFIG = {
    INSTAGRAM_URL: "https://instagram.com/fisamtour",
    WHATSAPP_URL: "https://wa.me/5511910218890",
    API_URL: "https://script.google.com/macros/s/AKfycbwcakddghwC4hQrfO7spmNHk-O4CEwZMYf227v_rNqwVFPXBnAbpCTMhy1EdPC2X_Sd/exec",
    API_TOKEN: "fisam-licitacoes-2025-secreto",
    USE_MOCK: false,
  };

  function brl(n) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);
  }

  function parseMoney(v) {
    const s = String(v ?? "").trim().replace(/\./g, "").replace(",", ".");
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }

  function monthToday() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatDateBR(iso) {
    if (!iso) return "-";
    const s = String(iso);
    const p = s.slice(0, 10).split("-");
    if (p.length === 3 && p[0].length === 4) return `${p[2]}/${p[1]}/${p[0]}`;
    return s;
  }

  function isPago(v) {
    const s = String(v ?? "").trim().toLowerCase();
    return s === "sim" || s === "s" || s === "1" || s === "true" || s === "x";
  }

  async function apiGet(params) {
    if (CONFIG.USE_MOCK || !CONFIG.API_URL) throw new Error("API desativada");
    const qs = new URLSearchParams({ ...params, token: CONFIG.API_TOKEN });
    const res = await fetch(`${CONFIG.API_URL}?${qs}`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) throw new Error(json.error || `Erro HTTP ${res.status}`);
    return json;
  }

  async function apiPost(body) {
    if (CONFIG.USE_MOCK || !CONFIG.API_URL) throw new Error("API desativada");
    const res = await fetch(CONFIG.API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ ...body, token: CONFIG.API_TOKEN }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) throw new Error(json.error || `Erro HTTP ${res.status}`);
    return json;
  }

  async function listLancamentos(competencia) {
    return (await apiGet({ op: "list", competencia })).rows || [];
  }

  async function fetchOptions() {
    const json = await apiGet({ op: "options" });
    return { licitacoes: json.licitacoes || [], fornecedores: json.fornecedores || [] };
  }

  async function listLicitacoes(includeInativas = false) {
    const params = { op: "licitacoes" };
    if (includeInativas) params.include_inativas = "1";
    return (await apiGet(params)).licitacoes || [];
  }

  async function fetchTarifas(licitacaoId) {
    return (await apiGet({ op: "tarifas", licitacao_id: licitacaoId })).tarifas || [];
  }

  async function listOrdens(competencia, licitacaoId) {
    const params = { op: "ordens" };
    if (competencia) params.competencia = competencia;
    if (licitacaoId) params.licitacao_id = licitacaoId;
    return (await apiGet(params)).ordens || [];
  }

  async function fetchFaturaElegiveis(competencia, licitacaoId) {
    return apiGet({ op: "fatura", competencia, licitacao_id: licitacaoId });
  }

  async function faturaPreview(ids) {
    return apiGet({ op: "faturaPreview", ids: ids.join(",") });
  }

  async function getRegistros(id) {
    return apiGet({ op: "registros", id });
  }

  async function saveRegistros(licitacaoId, items) {
    return apiPost({ op: "saveRegistros", licitacao_id: licitacaoId, items });
  }

  async function updateRegistroPago(licitacaoId, id, pago) {
    return apiPost({ op: "updateRegistroPago", licitacao_id: licitacaoId, id, pago });
  }

  async function deleteRegistro(licitacaoId, id) {
    return apiPost({ op: "deleteRegistro", licitacao_id: licitacaoId, id });
  }

  async function saveOrdem(ordem) {
    return apiPost({ op: "saveOrdem", ordem });
  }

  async function deleteOrdem(id) {
    return apiPost({ op: "deleteOrdem", id });
  }

  async function saveLicitacao(licitacao) {
    return apiPost({ op: "saveLicitacao", licitacao });
  }

  async function saveFornecedor(fornecedor) {
    return apiPost({ op: "saveFornecedor", fornecedor });
  }

  async function saveTarifa(tarifa) {
    return apiPost({ op: "saveTarifa", tarifa });
  }

  async function faturarOrdens(ids) {
    return apiPost({ op: "faturarOrdens", ids });
  }

  async function searchPassageiros(q) {
    return (await apiGet({ op: "passageiros", q: q || "" })).passageiros || [];
  }

  async function addLancamento(row) {
    return apiPost({ op: "add", row });
  }

  async function updateLancamento(row) {
    return apiPost({ op: "update", row });
  }

  async function deleteLancamento(id) {
    return apiPost({ op: "delete", id });
  }

  async function closeMonth(competencia) {
    return apiPost({ op: "closeMonth", competencia });
  }

  function attachModalClose(modalEl) {
    modalEl.addEventListener("click", (e) => {
      if (e.target?.getAttribute?.("data-close") === "1") modalEl.setAttribute("aria-hidden", "true");
    });
  }

  function fillSelect(selectEl, items, placeholder = "Selecione…", allowEmpty = false, valueKey = "nome") {
    const current = selectEl.value;
    selectEl.innerHTML = "";
    const opt0 = document.createElement("option");
    opt0.textContent = placeholder;
    opt0.value = "";
    opt0.disabled = !allowEmpty;
    opt0.selected = true;
    selectEl.appendChild(opt0);
    if (allowEmpty) opt0.disabled = false;
    for (const it of items) {
      const o = document.createElement("option");
      o.value = it[valueKey] ?? it.id ?? it.nome;
      o.textContent = it.nome || it.id;
      if (it.id) o.dataset.id = it.id;
      selectEl.appendChild(o);
    }
    if (current) selectEl.value = current;
  }

  function tipoLabel(tipo) {
    return ({
      passagens: "Passagens", hospedagem: "Hospedagem", veiculo: "Veículo",
      calculadora: "Calculadora", ordem_servico: "Ordem de serviço",
    })[tipo] || tipo;
  }

  return {
    CONFIG, brl, parseMoney, monthToday, escapeHtml, formatDateBR, isPago,
    apiGet, apiPost, listLancamentos, fetchOptions, listLicitacoes, fetchTarifas,
    listOrdens, fetchFaturaElegiveis, faturaPreview, getRegistros, saveRegistros,
    updateRegistroPago, deleteRegistro, saveOrdem, deleteOrdem, saveLicitacao,
    saveFornecedor, saveTarifa, faturarOrdens, searchPassageiros,
    addLancamento, updateLancamento, deleteLancamento, closeMonth,
    attachModalClose, fillSelect, tipoLabel,
  };
})();
