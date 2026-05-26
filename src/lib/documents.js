const DOC_SQL = `SELECT d.*, a.full_name AS author_name, s.full_name AS assignee_name
FROM documents d
JOIN users a ON d.author_id = a.id
LEFT JOIN users s ON d.assignee_id = s.id`;

function canAccess(doc, user) {
  return user.role === 'admin' || doc.author_id === user.id || doc.assignee_id === user.id;
}

function canEdit(doc, user) {
  return user.role === 'admin' || (doc.author_id === user.id && doc.status === 'draft');
}

function getDoc(db, id) {
  return db.prepare(`${DOC_SQL} WHERE d.id = ?`).get(id);
}

function getDocRaw(db, id) {
  return db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
}

function getUsers(db) {
  return db.prepare('SELECT id, full_name, email FROM users WHERE is_active = 1 ORDER BY full_name').all();
}

function addHistory(db, docId, userId, action, comment = null) {
  db.prepare(
    'INSERT INTO document_history (document_id, user_id, action, comment) VALUES (?, ?, ?, ?)'
  ).run(docId, userId, action, comment);
}

function parseDocBody(body) {
  const { title, doc_number, type, content, assignee_id } = body;
  return {
    title: title?.trim(),
    doc_number: doc_number?.trim().toUpperCase(),
    type,
    content: (content || '').trim(),
    assignee_id: assignee_id ? parseInt(assignee_id, 10) : null,
  };
}

module.exports = { canAccess, canEdit, getDoc, getDocRaw, getUsers, addHistory, parseDocBody };
