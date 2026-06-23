const DESCONTO = 0.4001;

const els = {
  vlrRef: document.getElementById("vlrRef"),
  qtd: document.getElementById("qtd"),
  desconto: document.getElementById("desconto"),
  final: document.getElementById("final"),
  porPessoa: document.getElementById("porPessoa"),
};

function calc() {
  const ref = Number(els.vlrRef.value) || 0;
  const qtd = Math.max(1, Number(els.qtd.value) || 1);
  const desc = ref * DESCONTO;
  const fin = ref - desc;
  els.desconto.textContent = FisamAPI.brl(desc);
  els.final.textContent = FisamAPI.brl(fin);
  els.porPessoa.textContent = FisamAPI.brl(fin / qtd);
}

els.vlrRef.addEventListener("input", calc);
els.qtd.addEventListener("input", calc);
calc();
