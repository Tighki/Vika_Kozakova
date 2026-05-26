const express = require('express');
const { getDb } = require('../db/database');
const { requireAdmin } = require('../middleware/auth');
const { setFlash } = require('../helpers');
const { STATUS_KEYS } = require('../constants');

const router = express.Router();
router.use(requireAdmin);

router.get('/dashboard', (req, res) => {
  const db = getDb();
  const stats = Object.fromEntries(STATUS_KEYS.map((k) => [k, 0]));
  db.prepare('SELECT status, COUNT(*) AS count FROM documents GROUP BY status')
    .all()
    .forEach((r) => {
      stats[r.status] = r.count;
    });

  res.render('admin/dashboard', {
    title: 'Панель администратора',
    stats,
    totalUsers: db.prepare('SELECT COUNT(*) AS cnt FROM users').get().cnt,
    totalDocs: db.prepare('SELECT COUNT(*) AS cnt FROM documents').get().cnt,
    recentDocs: db
      .prepare(
        `SELECT d.*, u.full_name AS author_name FROM documents d
         JOIN users u ON d.author_id = u.id ORDER BY d.updated_at DESC LIMIT 5`
      )
      .all(),
  });
});

router.get('/users', (req, res) => {
  res.render('admin/users', {
    title: 'Пользователи',
    users: getDb()
      .prepare('SELECT id, email, full_name, role, is_active, created_at FROM users ORDER BY created_at DESC')
      .all(),
  });
});

router.post('/users/:id/role', (req, res) => {
  const userId = +req.params.id;
  const { role } = req.body;
  if (!['admin', 'user'].includes(role)) {
    setFlash(req, 'error', 'Недопустимая роль.');
    return res.redirect('/admin/users');
  }
  if (userId === req.session.user.id && role !== 'admin') {
    setFlash(req, 'error', 'Нельзя снять роль администратора с самого себя.');
    return res.redirect('/admin/users');
  }
  getDb().prepare('UPDATE users SET role = ? WHERE id = ?').run(role, userId);
  setFlash(req, 'success', 'Роль пользователя обновлена.');
  res.redirect('/admin/users');
});

router.post('/users/:id/toggle', (req, res) => {
  const userId = +req.params.id;
  if (userId === req.session.user.id) {
    setFlash(req, 'error', 'Нельзя заблокировать самого себя.');
    return res.redirect('/admin/users');
  }
  const user = getDb().prepare('SELECT is_active FROM users WHERE id = ?').get(userId);
  if (!user) {
    setFlash(req, 'error', 'Пользователь не найден.');
    return res.redirect('/admin/users');
  }
  const active = user.is_active ? 0 : 1;
  getDb().prepare('UPDATE users SET is_active = ? WHERE id = ?').run(active, userId);
  setFlash(req, 'success', active ? 'Пользователь разблокирован.' : 'Пользователь заблокирован.');
  res.redirect('/admin/users');
});

module.exports = router;
