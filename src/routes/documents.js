const express = require('express');
const { getDb } = require('../db/database');
const {
  DOCUMENT_RULES,
  RULE_LABELS,
  parseEnabledRules,
  validateWithRules,
} = require('../validators/rules');

const router = express.Router();

const TYPE_LABELS = {
  incoming: 'Входящий',
  outgoing: 'Исходящий',
  internal: 'Внутренний',
};

const STATUS_LABELS = {
  draft: 'Черновик',
  pending: 'На согласовании',
  approved: 'Утверждён',
  rejected: 'Отклонён',
};

function canAccessDocument(doc, user) {
  if (user.role === 'admin') return true;
  return doc.author_id === user.id || doc.assignee_id === user.id;
}

function canEditDocument(doc, user) {
  if (user.role === 'admin') return true;
  return doc.author_id === user.id && doc.status === 'draft';
}

function addHistory(db, documentId, userId, action, comment = null) {
  db.prepare(
    'INSERT INTO document_history (document_id, user_id, action, comment) VALUES (?, ?, ?, ?)'
  ).run(documentId, userId, action, comment);
}

function getActiveUsers(db) {
  return db
    .prepare('SELECT id, full_name, email FROM users WHERE is_active = 1 ORDER BY full_name')
    .all();
}

router.get('/', (req, res) => {
  const db = getDb();
  const user = req.session.user;
  const { status, type, q } = req.query;

  let sql = `
    SELECT d.*, a.full_name AS author_name, s.full_name AS assignee_name
    FROM documents d
    JOIN users a ON d.author_id = a.id
    LEFT JOIN users s ON d.assignee_id = s.id
    WHERE 1=1
  `;
  const params = [];

  if (user.role !== 'admin') {
    sql += ' AND (d.author_id = ? OR d.assignee_id = ?)';
    params.push(user.id, user.id);
  }

  if (status) {
    sql += ' AND d.status = ?';
    params.push(status);
  }
  if (type) {
    sql += ' AND d.type = ?';
    params.push(type);
  }
  if (q) {
    sql += ' AND (d.title LIKE ? OR d.doc_number LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
  }

  sql += ' ORDER BY d.updated_at DESC';

  const documents = db.prepare(sql).all(...params);

  res.render('documents/index', {
    title: 'Документы',
    documents,
    filters: { status: status || '', type: type || '', q: q || '' },
    typeLabels: TYPE_LABELS,
    statusLabels: STATUS_LABELS,
  });
});

router.get('/new', (req, res) => {
  const db = getDb();
  res.render('documents/form', {
    title: 'Новый документ',
    document: null,
    users: getActiveUsers(db),
    errors: [],
    form: {},
    documentRules: DOCUMENT_RULES,
    ruleLabels: RULE_LABELS,
    enabledRules: DOCUMENT_RULES,
    typeLabels: TYPE_LABELS,
  });
});

router.post('/new', (req, res) => {
  const db = getDb();
  const user = req.session.user;
  const { title, doc_number, type, content, assignee_id } = req.body;
  const enabledRules = parseEnabledRules(req.body);
  const errors = [];

  if (!title || !doc_number || !type) {
    errors.push('Заполните обязательные поля: заголовок, номер, тип.');
  }

  const validationErrors = validateWithRules(
    { title, doc_number, content },
    enabledRules.length ? enabledRules : DOCUMENT_RULES
  );
  errors.push(...validationErrors);

  const existing = db.prepare('SELECT id FROM documents WHERE doc_number = ?').get(doc_number?.trim());
  if (existing) {
    errors.push('Документ с таким номером уже существует.');
  }

  if (errors.length) {
    return res.render('documents/form', {
      title: 'Новый документ',
      document: null,
      users: getActiveUsers(db),
      errors,
      form: req.body,
      documentRules: DOCUMENT_RULES,
      ruleLabels: RULE_LABELS,
      enabledRules: enabledRules.length ? enabledRules : DOCUMENT_RULES,
      typeLabels: TYPE_LABELS,
    });
  }

  const result = db
    .prepare(`
      INSERT INTO documents (title, doc_number, type, content, author_id, assignee_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    .run(
      title.trim(),
      doc_number.trim().toUpperCase(),
      type,
      (content || '').trim(),
      user.id,
      assignee_id ? parseInt(assignee_id, 10) : null
    );

  addHistory(db, result.lastInsertRowid, user.id, 'created', 'Документ создан');
  req.session.flash = { type: 'success', message: 'Документ успешно создан.' };
  res.redirect(`/documents/${result.lastInsertRowid}`);
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const user = req.session.user;
  const doc = db
    .prepare(`
      SELECT d.*, a.full_name AS author_name, s.full_name AS assignee_name
      FROM documents d
      JOIN users a ON d.author_id = a.id
      LEFT JOIN users s ON d.assignee_id = s.id
      WHERE d.id = ?
    `)
    .get(req.params.id);

  if (!doc || !canAccessDocument(doc, user)) {
    return res.status(404).render('error', {
      layout: false,
      title: 'Документ не найден',
      message: 'Документ не существует или у вас нет доступа.',
      code: 404,
    });
  }

  const history = db
    .prepare(`
      SELECT h.*, u.full_name AS user_name
      FROM document_history h
      JOIN users u ON h.user_id = u.id
      WHERE h.document_id = ?
      ORDER BY h.created_at DESC
    `)
    .all(doc.id);

  res.render('documents/show', {
    title: doc.title,
    document: doc,
    history,
    canEdit: canEditDocument(doc, user),
    typeLabels: TYPE_LABELS,
    statusLabels: STATUS_LABELS,
  });
});

router.get('/:id/edit', (req, res) => {
  const db = getDb();
  const user = req.session.user;
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);

  if (!doc || !canAccessDocument(doc, user)) {
    return res.status(404).render('error', {
      layout: false,
      title: 'Документ не найден',
      message: 'Документ не существует или у вас нет доступа.',
      code: 404,
    });
  }

  if (!canEditDocument(doc, user)) {
    req.session.flash = { type: 'error', message: 'Редактирование недоступно для этого документа.' };
    return res.redirect(`/documents/${doc.id}`);
  }

  res.render('documents/form', {
    title: 'Редактирование',
    document: doc,
    users: getActiveUsers(db),
    errors: [],
    form: doc,
    documentRules: DOCUMENT_RULES,
    ruleLabels: RULE_LABELS,
    enabledRules: DOCUMENT_RULES,
    typeLabels: TYPE_LABELS,
  });
});

router.post('/:id/edit', (req, res) => {
  const db = getDb();
  const user = req.session.user;
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);

  if (!doc || !canAccessDocument(doc, user) || !canEditDocument(doc, user)) {
    return res.status(403).render('error', {
      layout: false,
      title: 'Доступ запрещён',
      message: 'Редактирование этого документа невозможно.',
      code: 403,
    });
  }

  const { title, doc_number, type, content, assignee_id } = req.body;
  const enabledRules = parseEnabledRules(req.body);
  const errors = [];

  const validationErrors = validateWithRules(
    { title, doc_number, content },
    enabledRules.length ? enabledRules : DOCUMENT_RULES
  );
  errors.push(...validationErrors);

  const duplicate = db
    .prepare('SELECT id FROM documents WHERE doc_number = ? AND id != ?')
    .get(doc_number?.trim(), doc.id);
  if (duplicate) {
    errors.push('Документ с таким номером уже существует.');
  }

  if (errors.length) {
    return res.render('documents/form', {
      title: 'Редактирование',
      document: doc,
      users: getActiveUsers(db),
      errors,
      form: { ...doc, ...req.body },
      documentRules: DOCUMENT_RULES,
      ruleLabels: RULE_LABELS,
      enabledRules: enabledRules.length ? enabledRules : DOCUMENT_RULES,
      typeLabels: TYPE_LABELS,
    });
  }

  db.prepare(`
    UPDATE documents
    SET title = ?, doc_number = ?, type = ?, content = ?,
        assignee_id = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(
    title.trim(),
    doc_number.trim().toUpperCase(),
    type,
    (content || '').trim(),
    assignee_id ? parseInt(assignee_id, 10) : null,
    doc.id
  );

  addHistory(db, doc.id, user.id, 'updated', 'Документ отредактирован');
  req.session.flash = { type: 'success', message: 'Изменения сохранены.' };
  res.redirect(`/documents/${doc.id}`);
});

router.post('/:id/submit', (req, res) => {
  const db = getDb();
  const user = req.session.user;
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);

  if (!doc || !canAccessDocument(doc, user)) {
    return res.status(404).render('error', {
      layout: false,
      title: 'Документ не найден',
      message: 'Документ не найден.',
      code: 404,
    });
  }

  if (doc.status !== 'draft') {
    req.session.flash = { type: 'error', message: 'Отправить можно только черновик.' };
    return res.redirect(`/documents/${doc.id}`);
  }

  if (user.role !== 'admin' && doc.author_id !== user.id) {
    return res.status(403).render('error', {
      layout: false,
      title: 'Доступ запрещён',
      message: 'Только автор может отправить документ.',
      code: 403,
    });
  }

  db.prepare("UPDATE documents SET status = 'pending', updated_at = datetime('now') WHERE id = ?").run(
    doc.id
  );
  addHistory(db, doc.id, user.id, 'submitted', 'Отправлен на согласование');
  req.session.flash = { type: 'success', message: 'Документ отправлен на согласование.' };
  res.redirect(`/documents/${doc.id}`);
});

router.post('/:id/status', (req, res) => {
  const db = getDb();
  const user = req.session.user;

  if (user.role !== 'admin') {
    return res.status(403).render('error', {
      layout: false,
      title: 'Доступ запрещён',
      message: 'Только администратор может менять статус.',
      code: 403,
    });
  }

  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  const { status, comment } = req.body;

  if (!doc) {
    return res.status(404).render('error', {
      layout: false,
      title: 'Документ не найден',
      message: 'Документ не найден.',
      code: 404,
    });
  }

  if (!['approved', 'rejected', 'pending', 'draft'].includes(status)) {
    req.session.flash = { type: 'error', message: 'Недопустимый статус.' };
    return res.redirect(`/documents/${doc.id}`);
  }

  db.prepare('UPDATE documents SET status = ?, updated_at = datetime("now") WHERE id = ?').run(
    status,
    doc.id
  );

  const actionMap = {
    approved: 'approved',
    rejected: 'rejected',
    pending: 'returned',
    draft: 'reopened',
  };

  addHistory(db, doc.id, user.id, actionMap[status] || status, comment || null);
  req.session.flash = { type: 'success', message: 'Статус документа обновлён.' };
  res.redirect(`/documents/${doc.id}`);
});

module.exports = router;
