const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb } = require('../db/database');
const { redirectIfAuth } = require('../middleware/auth');
const { setFlash } = require('../helpers');
const { REGISTER_RULES, resolveRules, validateWithRules } = require('../validators/rules');

const router = express.Router();
const authView = (res, view, data) => res.render(`auth/${view}`, { layout: 'layout-auth', ...data });

router.get('/login', redirectIfAuth, (req, res) => {
  authView(res, 'login', { title: 'Вход', errors: [], form: {} });
});

router.post('/login', redirectIfAuth, (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return authView(res, 'login', { title: 'Вход', errors: ['Заполните email и пароль.'], form: { email } });
  }

  const user = getDb()
    .prepare('SELECT * FROM users WHERE email = ? AND is_active = 1')
    .get(email.trim().toLowerCase());

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return authView(res, 'login', {
      title: 'Вход',
      errors: ['Неверный email или пароль.'],
      form: { email },
    });
  }

  req.session.user = { id: user.id, email: user.email, full_name: user.full_name, role: user.role };
  setFlash(req, 'success', `Добро пожаловать, ${user.full_name}!`);
  res.redirect('/documents');
});

router.get('/register', redirectIfAuth, (req, res) => {
  authView(res, 'register', { title: 'Регистрация', errors: [], form: {}, enabledRules: REGISTER_RULES });
});

router.post('/register', redirectIfAuth, (req, res) => {
  const { email, full_name, password, password_confirm } = req.body;
  const enabled = resolveRules(req.body, REGISTER_RULES);
  const errors = validateWithRules({ email, full_name, password, password_confirm }, enabled);

  if (!email || !full_name || !password) errors.unshift('Заполните все обязательные поля.');
  if (getDb().prepare('SELECT id FROM users WHERE email = ?').get(email.trim().toLowerCase())) {
    errors.push('Пользователь с таким email уже существует.');
  }

  if (errors.length) {
    return authView(res, 'register', {
      title: 'Регистрация',
      errors,
      form: { email, full_name },
      enabledRules: enabled,
    });
  }

  getDb()
    .prepare('INSERT INTO users (email, password_hash, full_name, role) VALUES (?, ?, ?, ?)')
    .run(email.trim().toLowerCase(), bcrypt.hashSync(password, 10), full_name.trim(), 'user');

  setFlash(req, 'success', 'Регистрация успешна. Войдите в систему.');
  res.redirect('/login');
});

router.post('/logout', (req, res) => req.session.destroy(() => res.redirect('/login')));

module.exports = router;
