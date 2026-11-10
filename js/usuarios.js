const $ = (s) => document.querySelector(s);
const els = {
  alert: $("#alert"), form: $("#form"), nome: $("#nome"), email: $("#email"),
  password: $("#password"), status: $("#status"), tbody: $("#tbody"),
};
let editingId = null;

function showAlert(msg, type = "warn") {
  if (!msg) { els.alert.hidden = true; return; }
  els.alert.hidden = false;
  els.alert.className = `alert alert--${type}`;
  els.alert.textContent = msg;
}

async function load() {
  const list = await FisamAPI.listUsuarios();
  els.tbody.innerHTML = list.map((user) => `
    <tr>
      <td>${FisamAPI.escapeHtml(user.nome)}</td>
      <td>${FisamAPI.escapeHtml(user.email)}</td>
      <td>${FisamAPI.escapeHtml(user.status)}</td>
      <td class="right"><button class="btn btn--outline btn--sm" type="button" data-id="${FisamAPI.escapeHtml(user.id)}">Editar</button></td>
    </tr>
  `).join("") || `<tr><td colspan="4" class="empty">Nenhum usuário.</td></tr>`;
  els.tbody.querySelectorAll("[data-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const user = list.find((item) => item.id === btn.getAttribute("data-id"));
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

els.form.addEventListener("submit", async (event) => {
  event.preventDefault();
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
