const $ = (s) => document.querySelector(s);
const els = { alert: $("#alert"), q: $("#q"), tbody: $("#tbody"), count: $("#count") };
let timer = null;

function showAlert(msg, type = "warn") {
  if (!msg) { els.alert.hidden = true; return; }
  els.alert.hidden = false;
  els.alert.className = `alert alert--${type}`;
  els.alert.textContent = msg;
}

async function search() {
  const q = els.q.value.trim();
  els.tbody.innerHTML = `<tr><td colspan="3" class="empty">Buscando…</td></tr>`;
  try {
    const list = await FisamAPI.searchPassageiros(q);
    els.count.textContent = `${list.length} itens`;
    if (!list.length) {
      els.tbody.innerHTML = `<tr><td colspan="3" class="empty">Nenhum passageiro encontrado.</td></tr>`;
      return;
    }
    els.tbody.innerHTML = list.map((p) => `
      <tr>
        <td>${FisamAPI.escapeHtml(p.nome)}</td>
        <td>${FisamAPI.formatDateBR(p.data_nasc)}</td>
        <td>${FisamAPI.escapeHtml(p.cpf)}</td>
      </tr>
    `).join("");
  } catch (err) {
    showAlert(err.message, "error");
    els.tbody.innerHTML = `<tr><td colspan="3" class="empty">Erro na busca.</td></tr>`;
  }
}

els.q.addEventListener("input", () => {
  clearTimeout(timer);
  timer = setTimeout(search, 300);
});

search();
