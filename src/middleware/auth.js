function requireAuth(req, res, next) {
  if (!req.session.user) {
    req.session.flash = { type: 'error', message: 'Войдите в систему для доступа.' };
    return res.redirect('/login');
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  if (req.session.user.role !== 'admin') {
    return res.status(403).render('error', {
      layout: false,
      title: 'Доступ запрещён',
      message: 'Эта страница доступна только администратору.',
      code: 403,
    });
  }
  next();
}

function redirectIfAuth(req, res, next) {
  if (req.session.user) {
    return res.redirect('/documents');
  }
  next();
}

module.exports = { requireAuth, requireAdmin, redirectIfAuth };
