// backend/src/utils/audit.js
// Audit logging helper for database transactions

async function logAudit(conn, { userId, action, entity, entityId, details }) {
  await conn.query(
    `INSERT INTO audit_log (user_id, action, entity, entity_id, details)
     VALUES (?, ?, ?, ?, ?)`,
    [
      userId || null,
      action,
      entity,
      entityId ? String(entityId) : null,
      details ? JSON.stringify(details) : null,
    ]
  );
}

module.exports = {
  logAudit,
};
