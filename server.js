const express = require('express');
const session = require('express-session');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');
const { initDatabase } = require('./src/db/database');

const authRoutes = require('./src/routes/auth');
const documentRoutes = require('./src/routes/documents');
const adminRoutes = require('./src/routes/admin');
const { requireAuth } = require('./src/middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const isProduction = process.env.NODE_ENV === 'production';

if (!process.env.SESSION_SECRET && isProduction) {
  console.error('Ошибка: задайте переменную окружения SESSION_SECRET');
  process.exit(1);
}

initDatabase();

if (isProduction) {
  app.set('trust proxy', 1);
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'docflow-dev-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'lax',
      secure: isProduction,
    },
  })
);

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
});

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'docflow' });
});

app.get('/', (req, res) => {
  if (req.session.user) {
    return res.redirect('/documents');
  }
  res.redirect('/login');
});

app.use('/', authRoutes);
app.use('/documents', requireAuth, documentRoutes);
app.use('/admin', requireAuth, adminRoutes);

app.use((req, res) => {
  res.status(404).render('error', {
    layout: false,
    title: 'Страница не найдена',
    message: 'Запрашиваемая страница не существует.',
    code: 404,
  });
});

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).render('error', {
    layout: false,
    title: 'Ошибка сервера',
    message: 'Произошла внутренняя ошибка. Попробуйте позже.',
    code: 500,
  });
});

app.listen(PORT, HOST, () => {
  console.log(`DocFlow запущен: http://${HOST}:${PORT} (${isProduction ? 'production' : 'development'})`);
});
