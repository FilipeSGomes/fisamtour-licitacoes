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

  let pendingRequests = 0;
  let loadingEl = null;

  function ensureLoadingIndicator() {
    if (loadingEl || typeof document === "undefined") return;
    loadingEl = document.createElement("div");
    loadingEl.id = "apiLoading";
    loadingEl.className = "api-loading";
    loadingEl.setAttribute("aria-hidden", "true");
    loadingEl.setAttribute("aria-live", "polite");
    loadingEl.title = "Carregando…";
    loadingEl.innerHTML = `
      <svg class="api-loading__gear" viewBox="0 0 24 24" width="32" height="32" aria-hidden="true">
        <path fill="currentColor" d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.53c.04-.32.07-.64.07-.97 0-.33-.03-.66-.07-1l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.31-.61-.22l-2.49 1c-.52-.4-1.06-.73-1.69-.98l-.37-2.65A.506.506 0 0 0 14 2h-4c-.25 0-.46.18-.5.42l-.37 2.65c-.63.25-1.17.59-1.69.98l-2.49-1c-.22-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.34-.07.67-.07 1 0 .33.03.65.07.97l-2.11 1.66c-.19.15-.25.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1.01c.52.4 1.06.74 1.69.99l.37 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.37-2.65c.63-.26 1.17-.59 1.69-.99l2.49 1.01c.22.08.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.66Z"/>
      </svg>
    `;
    document.body.appendChild(loadingEl);
  }

  function updateLoadingIndicator() {
    if (!loadingEl) return;
    const active = pendingRequests > 0;
    loadingEl.classList.toggle("api-loading--visible", active);
    loadingEl.setAttribute("aria-hidden", active ? "false" : "true");
  }

  function beginRequest() {
    ensureLoadingIndicator();
    pendingRequests += 1;
    updateLoadingIndicator();
  }

  function endRequest() {
    pendingRequests = Math.max(0, pendingRequests - 1);
    updateLoadingIndicator();
  }

  async function trackRequest(fn) {
    beginRequest();
    try {
      return await fn();
    } finally {
      endRequest();
    }
  }

  async function apiGet(params) {
    if (CONFIG.USE_MOCK || !CONFIG.API_URL) throw new Error("API desativada");
    return trackRequest(async () => {
      const qs = new URLSearchParams({ ...params, token: CONFIG.API_TOKEN });
      const res = await fetch(`${CONFIG.API_URL}?${qs}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || `Erro HTTP ${res.status}`);
      return json;
    });
  }

  async function apiPost(body) {
    if (CONFIG.USE_MOCK || !CONFIG.API_URL) throw new Error("API desativada");
    return trackRequest(async () => {
      const res = await fetch(CONFIG.API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ ...body, token: CONFIG.API_TOKEN }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || `Erro HTTP ${res.status}`);
      return json;
    });
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
