const { renderError } = require('../helpers');

const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    req.session.flash = { type: 'error', message: 'Войдите в систему для доступа.' };
    return res.redirect('/login');
  }
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.session.user) return res.redirect('/login');
  if (req.session.user.role !== 'admin') {
    return renderError(res, 403, 'Доступ запрещён', 'Эта страница доступна только администратору.');
  }
  next();
};

const redirectIfAuth = (req, res, next) => {
  if (req.session.user) return res.redirect('/documents');
  next();
};

module.exports = { requireAuth, requireAdmin, redirectIfAuth };
