/**
 * Validação visível e paginação das tabelas. Não chama rede.
 */
const FisamUI = (() => {
  function messageFor(input) {
    if (input.validity.valueMissing) return "Preencha este campo.";
    if (input.validity.typeMismatch) return "Use um formato válido.";
    if (input.validity.tooShort) return "Texto curto demais.";
    if (input.validity.rangeUnderflow) return "Valor abaixo do mínimo.";
    return "Revise este campo.";
  }

  function showFieldError(input, message) {
    if (!input) return;
    input.setAttribute("aria-invalid", "true");
    const field = input.closest(".field") || input.parentElement;
    let el = field.querySelector(":scope > .field-error");
    if (!el) {
      el = document.createElement("p");
      el.className = "field-error";
      el.setAttribute("role", "alert");
      field.appendChild(el);
    }
    el.textContent = message;
  }

  function clearFieldError(input) {
    if (!input) return;
    input.removeAttribute("aria-invalid");
    input.closest(".field")?.querySelector(":scope > .field-error")?.remove();
  }

  function bindForms(root = document) {
    root.querySelectorAll("form").forEach((form) => {
      if (form.dataset.boundValidation) return;
      form.dataset.boundValidation = "1";
      form.querySelectorAll("input, select, textarea").forEach((input) => {
        input.addEventListener("input", () => clearFieldError(input));
        input.addEventListener("change", () => clearFieldError(input));
      });
      form.addEventListener("submit", (event) => {
        const invalid = [...form.querySelectorAll("input, select, textarea")]
          .filter((el) => !el.disabled && !el.checkValidity());
        if (!invalid.length) return;
        event.preventDefault();
        event.stopPropagation();
        invalid.forEach((el) => showFieldError(el, messageFor(el)));
        invalid[0].focus();
      }, true);
    });
  }

  function slice(items, page, pageSize) {
    const total = items.length;
    const pages = Math.max(1, Math.ceil(total / pageSize) || 1);
    const current = Math.min(Math.max(1, page || 1), pages);
    const start = (current - 1) * pageSize;
    return { items: items.slice(start, start + pageSize), page: current, pages, total };
  }

  function renderPager(el, { page, pages, total, onPage }) {
    if (!el) return;
    el.innerHTML = "";
    const info = document.createElement("span");
    info.textContent = total ? `${total} itens · página ${page} de ${pages}` : "0 itens";
    const actions = document.createElement("div");
    actions.className = "pager__actions";
    const prev = document.createElement("button");
    prev.type = "button";
    prev.className = "btn btn--outline btn--sm";
    prev.textContent = "Anterior";
    prev.disabled = page <= 1 || !total;
    prev.addEventListener("click", () => onPage(page - 1));
    const next = document.createElement("button");
    next.type = "button";
    next.className = "btn btn--outline btn--sm";
    next.textContent = "Próxima";
    next.disabled = page >= pages || !total;
    next.addEventListener("click", () => onPage(page + 1));
    actions.append(prev, next);
    el.append(info, actions);
  }

  document.addEventListener("DOMContentLoaded", () => bindForms());

  return { bindForms, showFieldError, clearFieldError, slice, renderPager };
})();
