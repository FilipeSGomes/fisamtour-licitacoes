const SECRET = /password|senha|hash|cpf|token|cookie|authorization|secret|session/i;

function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      if (SECRET.test(key)) continue;
      out[key] = redact(item);
    }
    return out;
  }
  return value;
}

async function audit(client, { userId, entity, entityId, action, changes }) {
  const safe = redact(changes || {});
  await client.query(
    `insert into audit_logs (user_id, entity, entity_id, action, changes)
     values ($1, $2, $3, $4, $5::jsonb)`,
    [userId || null, entity, entityId || null, action, JSON.stringify(safe)]
  );
}

module.exports = { audit, redact };
