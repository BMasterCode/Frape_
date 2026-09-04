// Cualquier ruta del dashboard requiere sesión (usuario normal o admin)
module.exports = function protegerDashboard(req, res, next) {
  if (req.session && (req.session.usuario || req.session.esAdmin)) {
    return next();
  }
  return res.redirect('/login');
};
