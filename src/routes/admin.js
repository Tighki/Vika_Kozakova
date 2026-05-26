const express = require('express');
const { getDb } = require('../db/database');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(requireAdmin);

const STATUS_LABELS = {
  draft: 'Черновик',
  pending: 'На согласовании',
  approved: 'Утверждён',
  rejected: 'Отклонён',
};

router.get('/dashboard', (req, res) => {
  const db = getDb();

  const stats = db
    .prepare(`
      SELECT status, COUNT(*) AS count
      FROM documents
      GROUP BY status
    `)
    .all();

  const totalUsers = db.prepare('SELECT COUNT(*) AS cnt FROM users').get().cnt;
  const totalDocs = db.prepare('SELECT COUNT(*) AS cnt FROM documents').get().cnt;
  const recentDocs = db
    .prepare(`
      SELECT d.*, u.full_name AS author_name
      FROM documents d
      JOIN users u ON d.author_id = u.id
      ORDER BY d.updated_at DESC
      LIMIT 5
    `)
    .all();

  const statsMap = { draft: 0, pending: 0, approved: 0, rejected: 0 };
  stats.forEach((s) => {
    statsMap[s.status] = s.count;
  });

  res.render('admin/dashboard', {
    title: 'Панель администратора',
    stats: statsMap,
    totalUsers,
    totalDocs,
    recentDocs,
    statusLabels: STATUS_LABELS,
  });
});

router.get('/users', (req, res) => {
  const db = getDb();
  const users = db
    .prepare('SELECT id, email, full_name, role, is_active, created_at FROM users ORDER BY created_at DESC')
    .all();

  res.render('admin/users', {
    title: 'Пользователи',
    users,
  });
});

router.post('/users/:id/role', (req, res) => {
  const db = getDb();
  const { role } = req.body;
  const userId = parseInt(req.params.id, 10);

  if (!['admin', 'user'].includes(role)) {
    req.session.flash = { type: 'error', message: 'Недопустимая роль.' };
    return res.redirect('/admin/users');
  }

  if (userId === req.session.user.id && role !== 'admin') {
    req.session.flash = { type: 'error', message: 'Нельзя снять роль администратора с самого себя.' };
    return res.redirect('/admin/users');
  }

  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, userId);
  req.session.flash = { type: 'success', message: 'Роль пользователя обновлена.' };
  res.redirect('/admin/users');
});

router.post('/users/:id/toggle', (req, res) => {
  const db = getDb();
  const userId = parseInt(req.params.id, 10);

  if (userId === req.session.user.id) {
    req.session.flash = { type: 'error', message: 'Нельзя заблокировать самого себя.' };
    return res.redirect('/admin/users');
  }

  const user = db.prepare('SELECT is_active FROM users WHERE id = ?').get(userId);
  if (!user) {
    req.session.flash = { type: 'error', message: 'Пользователь не найден.' };
    return res.redirect('/admin/users');
  }

  const newStatus = user.is_active ? 0 : 1;
  db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(newStatus, userId);
  req.session.flash = {
    type: 'success',
    message: newStatus ? 'Пользователь разблокирован.' : 'Пользователь заблокирован.',
  };
  res.redirect('/admin/users');
});

module.exports = router;
