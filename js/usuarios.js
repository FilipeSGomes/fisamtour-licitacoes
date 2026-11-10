const $ = (s) => document.querySelector(s);
const els = {
  alert: $("#alert"), form: $("#form"), nome: $("#nome"), email: $("#email"),
  password: $("#password"), status: $("#status"), tbody: $("#tbody"),
  q: $("#q"), filtroStatus: $("#filtroStatus"), pager: $("#pager"),
};
let editingId = null;
let page = 1;
let all = [];

function showAlert(msg, type = "warn") {
  if (!msg) { els.alert.hidden = true; return; }
  els.alert.hidden = false;
  els.alert.className = `alert alert--${type}`;
  els.alert.textContent = msg;
}

function visibleUsers() {
  const q = (els.q?.value || "").trim().toLowerCase();
  const status = els.filtroStatus?.value || "all";
  return all.filter((user) => {
    const hay = `${user.nome} ${user.email}`.toLowerCase();
    return (!q || hay.includes(q)) && (status === "all" || user.status === status);
  });
}

function render() {
  const view = FisamUI.slice(visibleUsers(), page, 8);
  page = view.page;
  FisamUI.renderPager(els.pager, {
    page: view.page,
    pages: view.pages,
    total: view.total,
    onPage: (next) => { page = next; render(); },
  });
  els.tbody.innerHTML = view.items.map((user) => `
    <tr>
      <td>${FisamAPI.escapeHtml(user.nome)}</td>
      <td>${FisamAPI.escapeHtml(user.email)}</td>
      <td>${FisamAPI.escapeHtml(user.status)}</td>
      <td class="right"><button class="btn btn--outline btn--sm" type="button" data-id="${FisamAPI.escapeHtml(user.id)}">Editar</button></td>
    </tr>
  `).join("") || `<tr><td colspan="4" class="empty">Nenhum usuário.</td></tr>`;
  els.tbody.querySelectorAll("[data-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const user = all.find((item) => item.id === btn.getAttribute("data-id"));
      if (!user) return;
      editingId = user.id;
      els.nome.value = user.nome;
      els.email.value = user.email;
      els.email.disabled = true;
      els.status.value = user.status;
      els.password.value = "";
    });
  });
}

async function load() {
  all = await FisamAPI.listUsuarios();
  page = 1;
  render();
}

els.q?.addEventListener("input", () => { page = 1; render(); });
els.filtroStatus?.addEventListener("change", () => { page = 1; render(); });

els.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!editingId && els.password.value.length < 10) {
    FisamUI.showFieldError(els.password, "A senha precisa de pelo menos 10 caracteres.");
    return;
  }
  try {
    const payload = {
      id: editingId || undefined,
      nome: els.nome.value.trim(),
      email: els.email.value.trim(),
      status: els.status.value,
    };
    if (els.password.value) payload.password = els.password.value;
    await FisamAPI.saveUsuario(payload);
    editingId = null;
    els.form.reset();
    els.email.disabled = false;
    showAlert("Usuário salvo.", "success");
    await load();
  } catch (err) {
    showAlert(err.message, "error");
  }
});

load().catch((err) => showAlert(err.message, "error"));
