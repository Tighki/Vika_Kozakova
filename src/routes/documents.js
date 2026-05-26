const express = require('express');
const { getDb } = require('../db/database');
const { renderError, setFlash } = require('../helpers');
const { DOCUMENT_RULES, resolveRules, validateWithRules } = require('../validators/rules');
const {
  canAccess,
  canEdit,
  getDoc,
  getDocRaw,
  getUsers,
  addHistory,
  parseDocBody,
} = require('../lib/documents');

const router = express.Router();
const formView = (res, opts) =>
  res.render('documents/form', {
    title: opts.document ? 'Редактирование' : 'Новый документ',
    users: getUsers(getDb()),
    errors: [],
    form: {},
    enabledRules: DOCUMENT_RULES,
    ...opts,
  });

router.get('/', (req, res) => {
  const { status, type, q } = req.query;
  const user = req.session.user;
  let sql = `SELECT d.*, a.full_name AS author_name, s.full_name AS assignee_name
    FROM documents d JOIN users a ON d.author_id = a.id LEFT JOIN users s ON d.assignee_id = s.id WHERE 1=1`;
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

  res.render('documents/index', {
    title: 'Документы',
    documents: getDb().prepare(sql + ' ORDER BY d.updated_at DESC').all(...params),
    filters: { status: status || '', type: type || '', q: q || '' },
  });
});

router.get('/new', (req, res) => formView(res, { document: null }));

router.post('/new', (req, res) => {
  const db = getDb();
  const user = req.session.user;
  const data = parseDocBody(req.body);
  const enabled = resolveRules(req.body, DOCUMENT_RULES);
  const errors = validateWithRules(req.body, enabled);

  if (!data.title || !data.doc_number || !data.type) {
    errors.unshift('Заполните обязательные поля: заголовок, номер, тип.');
  }
  if (db.prepare('SELECT id FROM documents WHERE doc_number = ?').get(data.doc_number)) {
    errors.push('Документ с таким номером уже существует.');
  }
  if (errors.length) {
    return formView(res, { document: null, errors, form: req.body, enabledRules: enabled });
  }

  const { lastInsertRowid: id } = db
    .prepare(
      'INSERT INTO documents (title, doc_number, type, content, author_id, assignee_id) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(data.title, data.doc_number, data.type, data.content, user.id, data.assignee_id);

  addHistory(db, id, user.id, 'created', 'Документ создан');
  setFlash(req, 'success', 'Документ успешно создан.');
  res.redirect(`/documents/${id}`);
});

router.get('/:id', (req, res) => {
  const user = req.session.user;
  const doc = getDoc(getDb(), req.params.id);
  if (!doc || !canAccess(doc, user)) {
    return renderError(res, 404, 'Документ не найден', 'Документ не существует или у вас нет доступа.');
  }

  const history = getDb()
    .prepare(
      `SELECT h.*, u.full_name AS user_name FROM document_history h
       JOIN users u ON h.user_id = u.id WHERE h.document_id = ? ORDER BY h.created_at DESC`
    )
    .all(doc.id);

  res.render('documents/show', {
    title: doc.title,
    document: doc,
    history,
    canEdit: canEdit(doc, user),
  });
});

router.get('/:id/edit', (req, res) => {
  const user = req.session.user;
  const doc = getDocRaw(getDb(), req.params.id);
  if (!doc || !canAccess(doc, user)) {
    return renderError(res, 404, 'Документ не найден', 'Документ не существует или у вас нет доступа.');
  }
  if (!canEdit(doc, user)) {
    setFlash(req, 'error', 'Редактирование недоступно для этого документа.');
    return res.redirect(`/documents/${doc.id}`);
  }
  formView(res, { document: doc, form: doc });
});

router.post('/:id/edit', (req, res) => {
  const db = getDb();
  const user = req.session.user;
  const doc = getDocRaw(db, req.params.id);
  if (!doc || !canAccess(doc, user) || !canEdit(doc, user)) {
    return renderError(res, 403, 'Доступ запрещён', 'Редактирование этого документа невозможно.');
  }

  const data = parseDocBody(req.body);
  const enabled = resolveRules(req.body, DOCUMENT_RULES);
  const errors = validateWithRules(req.body, enabled);
  if (db.prepare('SELECT id FROM documents WHERE doc_number = ? AND id != ?').get(data.doc_number, doc.id)) {
    errors.push('Документ с таким номером уже существует.');
  }
  if (errors.length) {
    return formView(res, { document: doc, errors, form: { ...doc, ...req.body }, enabledRules: enabled });
  }

  db.prepare(
    `UPDATE documents SET title=?, doc_number=?, type=?, content=?, assignee_id=?, updated_at=datetime('now') WHERE id=?`
  ).run(data.title, data.doc_number, data.type, data.content, data.assignee_id, doc.id);

  addHistory(db, doc.id, user.id, 'updated', 'Документ отредактирован');
  setFlash(req, 'success', 'Изменения сохранены.');
  res.redirect(`/documents/${doc.id}`);
});

router.post('/:id/submit', (req, res) => {
  const db = getDb();
  const user = req.session.user;
  const doc = getDocRaw(db, req.params.id);

  if (!doc || !canAccess(doc, user)) {
    return renderError(res, 404, 'Документ не найден', 'Документ не найден.');
  }
  if (doc.status !== 'draft') {
    setFlash(req, 'error', 'Отправить можно только черновик.');
    return res.redirect(`/documents/${doc.id}`);
  }
  if (user.role !== 'admin' && doc.author_id !== user.id) {
    return renderError(res, 403, 'Доступ запрещён', 'Только автор может отправить документ.');
  }

  db.prepare("UPDATE documents SET status='pending', updated_at=datetime('now') WHERE id=?").run(doc.id);
  addHistory(db, doc.id, user.id, 'submitted', 'Отправлен на согласование');
  setFlash(req, 'success', 'Документ отправлен на согласование.');
  res.redirect(`/documents/${doc.id}`);
});

router.post('/:id/status', (req, res) => {
  const user = req.session.user;
  if (user.role !== 'admin') {
    return renderError(res, 403, 'Доступ запрещён', 'Только администратор может менять статус.');
  }

  const db = getDb();
  const doc = getDocRaw(db, req.params.id);
  const { status, comment } = req.body;
  if (!doc) return renderError(res, 404, 'Документ не найден', 'Документ не найден.');
  if (!['approved', 'rejected', 'pending', 'draft'].includes(status)) {
    setFlash(req, 'error', 'Недопустимый статус.');
    return res.redirect(`/documents/${doc.id}`);
  }

  db.prepare("UPDATE documents SET status=?, updated_at=datetime('now') WHERE id=?").run(status, doc.id);
  const actions = { approved: 'approved', rejected: 'rejected', pending: 'returned', draft: 'reopened' };
  addHistory(db, doc.id, user.id, actions[status] || status, comment || null);
  setFlash(req, 'success', 'Статус документа обновлён.');
  res.redirect(`/documents/${doc.id}`);
});

module.exports = router;
