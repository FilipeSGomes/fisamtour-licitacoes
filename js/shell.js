/**
 * Sidebar única das telas operacionais. A página de login não usa este arquivo.
 */
(() => {
  const NAV = [
    { id: "dashboard", href: "./index.html", label: "Dashboard" },
    { id: "licitacoes", href: "./licitacoes.html", label: "Licitações" },
    { id: "passageiros", href: "./passageiros.html", label: "Passageiros" },
    { id: "tunas", href: "./tunas.html", label: "Calculadora TUNAS" },
    { id: "usuarios", href: "./usuarios.html", label: "Usuários" },
  ];

  const active = document.body.dataset.nav;
  if (!active) return;

  const aside = document.createElement("aside");
  aside.className = "sidebar";
  aside.innerHTML = `
    <a class="sidebar__brand" href="./index.html">
      <img src="./logo.png" alt="" class="sidebar__logo" />
      <span>
        <strong>FISAM TOUR</strong>
        <small>Painel operacional</small>
      </span>
    </a>
    <nav class="sidebar__nav" aria-label="Módulos">
      ${NAV.map((item) => `
        <a class="sidebar__link${item.id === active ? " is-active" : ""}" href="${item.href}">${item.label}</a>
      `).join("")}
    </nav>
    <div class="sidebar__session" data-session></div>
  `;
  document.body.prepend(aside);
  document.body.classList.add("has-shell");

  const backdrop = document.createElement("button");
  backdrop.type = "button";
  backdrop.className = "sidebar-backdrop";
  backdrop.setAttribute("aria-label", "Fechar menu");
  backdrop.addEventListener("click", () => document.body.classList.remove("sidebar-open"));
  document.body.append(backdrop);

  document.querySelectorAll("[data-nav-toggle]").forEach((button) => {
    button.addEventListener("click", () => document.body.classList.toggle("sidebar-open"));
  });
  aside.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => document.body.classList.remove("sidebar-open"));
  });
})();
