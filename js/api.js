/**
 * FISAM Tour — cliente da API local (sessão em cookie httpOnly).
 * Não chama Google Apps Script nem Google Sheets.
 */
const FisamAPI = (() => {
  const CONFIG = {
    INSTAGRAM_URL: "https://instagram.com/fisamtour",
    WHATSAPP_URL: "https://wa.me/5511910218890",
  };

  function isLoginPage() {
    return /\/login\.html$/.test(location.pathname);
  }

  function brl(n) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);
  }

  function parseMoney(v) {
    if (typeof v === "number") return Number.isFinite(v) ? v : 0;
    const s = String(v ?? "").trim();
    if (!s) return 0;
    if (/^-?\d+(\.\d+)?$/.test(s)) {
      const n = Number(s);
      return Number.isFinite(n) ? n : 0;
    }
    const n = Number(s.replace(/\./g, "").replace(",", "."));
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
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    return s;
  }

  function isPago(v) {
    const s = String(v ?? "").trim().toLowerCase();
    return s === "sim" || s === "s" || s === "1" || s === "true" || s === "x";
  }

  function isEditavel(v) {
    const s = String(v ?? "").trim().toLowerCase();
    return !(s === "nao" || s === "não" || s === "n" || s === "0" || s === "false" || s === "no");
  }

  function isOrdemOrigem(v) {
    return String(v ?? "").trim().toLowerCase() === "ordem_servico";
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

  async function request(method, path, body) {
    ensureLoadingIndicator();
    pendingRequests += 1;
    updateLoadingIndicator();
    try {
      const res = await fetch(`/api${path}`, {
        method,
        credentials: "include",
        headers: body === undefined ? undefined : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (res.status === 401 && !isLoginPage()) {
        location.href = "./login.html";
        return new Promise(() => {});
      }
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.ok === false) {
        const err = new Error(json.error || `Erro HTTP ${res.status}`);
        err.status = res.status;
        throw err;
      }
      return json;
    } finally {
      pendingRequests = Math.max(0, pendingRequests - 1);
      updateLoadingIndicator();
    }
  }

  const apiGet = (path) => request("GET", path);
  const apiPost = (path, body) => request("POST", path, body ?? {});
  const apiPut = (path, body) => request("PUT", path, body ?? {});
  const apiPatch = (path, body) => request("PATCH", path, body ?? {});
  const apiDelete = (path) => request("DELETE", path);

  async function login(email, password) {
    return apiPost("/auth/login", { email, password });
  }

  async function logout() {
    await apiPost("/auth/logout", {});
    location.href = "./login.html";
  }

  async function listLancamentos(competencia) {
    return apiGet(`/lancamentos?competencia=${encodeURIComponent(competencia)}`);
  }

  async function fetchOptions() {
    const json = await apiGet("/opcoes");
    return { licitacoes: json.licitacoes || [], fornecedores: json.fornecedores || [] };
  }

  async function listLicitacoes(includeInativas = false) {
    const q = includeInativas ? "?include_inativas=1" : "";
    return (await apiGet(`/licitacoes${q}`)).licitacoes || [];
  }

  async function fetchTarifas(licitacaoId) {
    return (await apiGet(`/licitacoes/${encodeURIComponent(licitacaoId)}/tarifas`)).tarifas || [];
  }

  async function listOrdens(competencia, licitacaoId) {
    const params = new URLSearchParams();
    if (competencia) params.set("competencia", competencia);
    if (licitacaoId) params.set("licitacao_id", licitacaoId);
    const q = params.toString();
    return (await apiGet(`/ordens${q ? `?${q}` : ""}`)).ordens || [];
  }

  async function fetchFaturaElegiveis(competencia, licitacaoId) {
    const params = new URLSearchParams({ competencia, licitacao_id: licitacaoId });
    return apiGet(`/fatura?${params}`);
  }

  async function getRegistros(id) {
    return apiGet(`/licitacoes/${encodeURIComponent(id)}/registros`);
  }

  async function createRegistro(licitacaoId, item) {
    return apiPost(`/licitacoes/${encodeURIComponent(licitacaoId)}/registros`, item);
  }

  async function updateRegistro(licitacaoId, id, item) {
    return apiPut(`/licitacoes/${encodeURIComponent(licitacaoId)}/registros/${encodeURIComponent(id)}`, item);
  }

  async function updateRegistroPago(licitacaoId, id, pago) {
    return apiPatch(`/licitacoes/${encodeURIComponent(licitacaoId)}/registros/${encodeURIComponent(id)}/pago`, { pago });
  }

  async function deleteRegistro(licitacaoId, id) {
    return apiDelete(`/licitacoes/${encodeURIComponent(licitacaoId)}/registros/${encodeURIComponent(id)}`);
  }

  async function saveOrdem(ordem) {
    if (ordem?.id) return apiPut(`/ordens/${encodeURIComponent(ordem.id)}`, ordem);
    return apiPost("/ordens", ordem);
  }

  async function deleteOrdem(id) {
    return apiDelete(`/ordens/${encodeURIComponent(id)}`);
  }

  async function saveLicitacao(licitacao) {
    if (licitacao?.id) return apiPut(`/licitacoes/${encodeURIComponent(licitacao.id)}`, licitacao);
    return apiPost("/licitacoes", licitacao);
  }

  async function saveFornecedor(fornecedor) {
    if (fornecedor?.id) return apiPut(`/fornecedores/${encodeURIComponent(fornecedor.id)}`, fornecedor);
    return apiPost("/fornecedores", fornecedor);
  }

  async function saveTarifa(tarifa) {
    if (tarifa?.id) return apiPut(`/tarifas/${encodeURIComponent(tarifa.id)}`, tarifa);
    return apiPost("/tarifas", tarifa);
  }

  async function faturarOrdens(ids) {
    return apiPost("/ordens/faturar", { ids });
  }

  async function searchPassageiros(q) {
    if (!q) return (await apiGet("/passageiros/opcoes")).passageiros || [];
    return (await apiPost("/passageiros/busca", { q })).passageiros || [];
  }

  async function listPassageiros() {
    return (await apiGet("/passageiros")).passageiros || [];
  }

  async function savePassageiro(passageiro) {
    if (passageiro?.id) return apiPut(`/passageiros/${encodeURIComponent(passageiro.id)}`, passageiro);
    return apiPost("/passageiros", passageiro);
  }

  async function listUsuarios() {
    return (await apiGet("/usuarios")).usuarios || [];
  }

  async function saveUsuario(usuario) {
    if (usuario?.id) return apiPut(`/usuarios/${encodeURIComponent(usuario.id)}`, usuario);
    return apiPost("/usuarios", usuario);
  }

  async function addLancamento(row) {
    return apiPost("/lancamentos", row);
  }

  async function updateLancamento(row) {
    return apiPut(`/lancamentos/${encodeURIComponent(row.id)}`, row);
  }

  async function deleteLancamento(id) {
    return apiDelete(`/lancamentos/${encodeURIComponent(id)}`);
  }

  async function closeMonth(competencia) {
    return apiPost(`/competencias/${encodeURIComponent(competencia)}/fechar`, {});
  }

  async function reopenMonth(competencia) {
    return apiPost(`/competencias/${encodeURIComponent(competencia)}/reabrir`, {});
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

  function ensureSessionUi() {
    const actions = document.querySelector(".header__actions") || document.querySelector(".nav");
    if (!actions || document.getElementById("btnLogout")) return;
    const users = document.createElement("a");
    users.className = "nav__link";
    users.href = "./usuarios.html";
    users.textContent = "Usuários";
    const out = document.createElement("button");
    out.type = "button";
    out.className = "btn btn--ghost";
    out.id = "btnLogout";
    out.textContent = "Sair";
    out.addEventListener("click", () => logout().catch((err) => alert(err.message)));
    actions.appendChild(users);
    actions.appendChild(out);
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (isLoginPage()) return;
    try {
      await apiGet("/auth/me");
      ensureSessionUi();
    } catch (err) {
      if (err.status === 401) location.href = "./login.html";
    }
  });

  return {
    CONFIG, brl, parseMoney, monthToday, escapeHtml, formatDateBR, isPago,
    isEditavel, isOrdemOrigem, login, logout,
    listLancamentos, fetchOptions, listLicitacoes, fetchTarifas,
    listOrdens, fetchFaturaElegiveis, getRegistros, createRegistro, updateRegistro,
    updateRegistroPago, deleteRegistro, saveOrdem, deleteOrdem, saveLicitacao,
    saveFornecedor, saveTarifa, faturarOrdens, searchPassageiros, listPassageiros, savePassageiro,
    listUsuarios, saveUsuario,
    addLancamento, updateLancamento, deleteLancamento, closeMonth, reopenMonth,
    attachModalClose, fillSelect, tipoLabel,
  };
})();
