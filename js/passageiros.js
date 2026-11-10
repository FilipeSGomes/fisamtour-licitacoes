const $ = (s) => document.querySelector(s);
const els = {
  alert: $("#alert"), q: $("#q"), tbody: $("#tbody"), count: $("#count"),
  form: $("#form"), nome: $("#nome"), dataNasc: $("#data_nasc"), cpf: $("#cpf"),
};
let timer = null;
let editingId = null;

function showAlert(msg, type = "warn") {
  if (!msg) { els.alert.hidden = true; return; }
  els.alert.hidden = false;
  els.alert.className = `alert alert--${type}`;
  els.alert.textContent = msg;
}

function render(list) {
  els.count.textContent = `${list.length} itens`;
  if (!list.length) {
    els.tbody.innerHTML = `<tr><td colspan="4" class="empty">Nenhum passageiro encontrado.</td></tr>`;
    return;
  }
  els.tbody.innerHTML = list.map((p) => `
    <tr>
      <td>${FisamAPI.escapeHtml(p.nome)}</td>
      <td>${FisamAPI.formatDateBR(p.data_nasc)}</td>
      <td>${FisamAPI.escapeHtml(p.cpf || "")}</td>
      <td class="right"><button class="btn btn--outline btn--sm" type="button" data-id="${FisamAPI.escapeHtml(p.id)}">Editar</button></td>
    </tr>
  `).join("");
  els.tbody.querySelectorAll("[data-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = list.find((row) => row.id === btn.getAttribute("data-id"));
      if (!item) return;
      editingId = item.id;
      els.nome.value = item.nome || "";
      els.dataNasc.value = item.data_nasc ? String(item.data_nasc).slice(0, 10) : "";
      els.cpf.value = item.cpf || "";
    });
  });
}

async function search() {
  const q = els.q.value.trim();
  try {
    const list = q ? await FisamAPI.searchPassageiros(q) : await FisamAPI.listPassageiros();
    render(list);
  } catch (err) {
    showAlert(err.message, "error");
    els.tbody.innerHTML = `<tr><td colspan="4" class="empty">Erro na busca.</td></tr>`;
  }
}

els.q.addEventListener("input", () => {
  clearTimeout(timer);
  timer = setTimeout(search, 300);
});

els.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await FisamAPI.savePassageiro({
      id: editingId || undefined,
      nome: els.nome.value.trim(),
      data_nasc: els.dataNasc.value,
      cpf: els.cpf.value,
    });
    editingId = null;
    els.form.reset();
    showAlert("Passageiro salvo.", "success");
    await search();
  } catch (err) {
    showAlert(err.message, "error");
  }
});

search();
