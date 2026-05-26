const express = require('express');
const session = require('express-session');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');
const { initDatabase } = require('./src/db/database');
const { TYPE_LABELS, STATUS_LABELS } = require('./src/constants');
const { RULE_LABELS, REGISTER_RULES, DOCUMENT_RULES, getClientValidationScript } = require('./src/validators/rules');
const { requireAuth } = require('./src/middleware/auth');
const authRoutes = require('./src/routes/auth');
const documentRoutes = require('./src/routes/documents');
const adminRoutes = require('./src/routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const isProduction = process.env.NODE_ENV === 'production';

function getSessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (isProduction && process.env.RENDER) {
    console.warn('SESSION_SECRET не задан — используется ключ Render. Добавьте SESSION_SECRET в Environment.');
    return ['docflow', process.env.RENDER_SERVICE_ID, process.env.RENDER_GIT_COMMIT].filter(Boolean).join(':');
  }
  if (isProduction) {
    console.error('Ошибка: задайте переменную окружения SESSION_SECRET');
    process.exit(1);
  }
  return 'docflow-dev-secret';
}

initDatabase();
if (isProduction) app.set('trust proxy', 1);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

app.get('/js/validation.js', (_req, res) => {
  res.type('application/javascript').send(getClientValidationScript());
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: getSessionSecret(),
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 864e5, sameSite: 'lax', secure: isProduction },
  })
);

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  res.locals.typeLabels = TYPE_LABELS;
  res.locals.statusLabels = STATUS_LABELS;
  res.locals.ruleLabels = RULE_LABELS;
  res.locals.registerRules = REGISTER_RULES;
  res.locals.documentRules = DOCUMENT_RULES;
  next();
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'docflow' }));
app.get('/', (req, res) => res.redirect(req.session.user ? '/documents' : '/login'));

app.use('/', authRoutes);
app.use('/documents', requireAuth, documentRoutes);
app.use('/admin', requireAuth, adminRoutes);

app.use((req, res) =>
  res.status(404).render('error', {
    layout: false,
    title: 'Страница не найдена',
    message: 'Запрашиваемая страница не существует.',
    code: 404,
  })
);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).render('error', {
    layout: false,
    title: 'Ошибка сервера',
    message: 'Произошла внутренняя ошибка. Попробуйте позже.',
    code: 500,
  });
});

app.listen(PORT, HOST, () => console.log(`DocFlow: http://${HOST}:${PORT}`));
