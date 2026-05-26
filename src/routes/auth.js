const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb } = require('../db/database');
const { redirectIfAuth } = require('../middleware/auth');
const {
  REGISTER_RULES,
  RULE_LABELS,
  parseEnabledRules,
  validateWithRules,
} = require('../validators/rules');

const router = express.Router();

router.get('/login', redirectIfAuth, (req, res) => {
  res.render('auth/login', {
    title: 'Вход',
    layout: 'layout-auth',
    errors: [],
    form: {},
  });
});

router.post('/login', redirectIfAuth, (req, res) => {
  const { email, password } = req.body;
  const errors = [];

  if (!email || !password) {
    errors.push('Заполните email и пароль.');
  }

  if (errors.length) {
    return res.render('auth/login', {
      title: 'Вход',
      layout: 'layout-auth',
      errors,
      form: { email },
    });
  }

  const db = getDb();
  const user = db
    .prepare('SELECT * FROM users WHERE email = ? AND is_active = 1')
    .get(email.trim().toLowerCase());

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.render('auth/login', {
      title: 'Вход',
      layout: 'layout-auth',
      errors: ['Неверный email или пароль.'],
      form: { email },
    });
  }

  req.session.user = {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
  };

  req.session.flash = { type: 'success', message: `Добро пожаловать, ${user.full_name}!` };
  res.redirect('/documents');
});

router.get('/register', redirectIfAuth, (req, res) => {
  res.render('auth/register', {
    title: 'Регистрация',
    layout: 'layout-auth',
    errors: [],
    form: {},
    registerRules: REGISTER_RULES,
    ruleLabels: RULE_LABELS,
    enabledRules: REGISTER_RULES,
  });
});

router.post('/register', redirectIfAuth, (req, res) => {
  const { email, full_name, password, password_confirm } = req.body;
  const errors = [];
  const enabledRules = parseEnabledRules(req.body);

  if (!email || !full_name || !password) {
    errors.push('Заполните все обязательные поля.');
  }

  const validationErrors = validateWithRules(
    { email, full_name, password, password_confirm },
    enabledRules.length ? enabledRules : REGISTER_RULES
  );
  errors.push(...validationErrors);

  const db = getDb();
  const existing = db
    .prepare('SELECT id FROM users WHERE email = ?')
    .get(email.trim().toLowerCase());
  if (existing) {
    errors.push('Пользователь с таким email уже существует.');
  }

  if (errors.length) {
    return res.render('auth/register', {
      title: 'Регистрация',
      layout: 'layout-auth',
      errors,
      form: { email, full_name },
      registerRules: REGISTER_RULES,
      ruleLabels: RULE_LABELS,
      enabledRules: enabledRules.length ? enabledRules : REGISTER_RULES,
    });
  }

  const hash = bcrypt.hashSync(password, 10);
  db.prepare(
    'INSERT INTO users (email, password_hash, full_name, role) VALUES (?, ?, ?, ?)'
  ).run(email.trim().toLowerCase(), hash, full_name.trim(), 'user');

  req.session.flash = { type: 'success', message: 'Регистрация успешна. Войдите в систему.' };
  res.redirect('/login');
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

module.exports = router;
