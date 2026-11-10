class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function httpError(status, message) {
  return new HttpError(status, message);
}

function mapDbError(err) {
  if (err instanceof HttpError) return err;
  if (err && err.code === "23505") return httpError(409, "Registro duplicado");
  if (err && err.code === "23503") return httpError(409, "Registro em uso ou referência inválida");
  if (err && err.code === "23514") return httpError(400, "Registro viola uma regra de integridade");
  if (err && err.code === "P0001") {
    const msg = String(err.message || "");
    if (msg.includes("competencia_fechada")) return httpError(409, "Competência fechada. Reabra o mês para alterar o razão.");
    if (msg.includes("tipo_licitacao_incompativel")) return httpError(400, "O tipo da licitação não aceita este registro");
    if (msg.includes("licitacao_inexistente")) return httpError(404, "Licitação não encontrada");
    return httpError(400, "Operação rejeitada pelo banco");
  }
  return err;
}

module.exports = { HttpError, httpError, mapDbError };
