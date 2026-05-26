function renderError(res, code, title, message) {
  return res.status(code).render('error', { layout: false, title, message, code });
}

function setFlash(req, type, message) {
  req.session.flash = { type, message };
}

function redirectFlash(req, res, url, type, message) {
  setFlash(req, type, message);
  res.redirect(url);
}

module.exports = { renderError, setFlash, redirectFlash };
