const pool = require('../db/pool');
const { ADMIN_BASE } = require('../lib/config');

// --- Requiere sesión de usuario normal ---
function requireUser(req, res, next) {
  if (req.session && req.session.usuario) return next();
  return res.redirect('/login');
}

// --- Requiere sesión de admin ---
function requireAdmin(req, res, next) {
  if (req.session && req.session.esAdmin) return next();
  return res.redirect(`${ADMIN_BASE}/login`);
}

// --- Carga todas las pestañas + los permisos del usuario en sesión ---
// Convierte los números que vienen de Postgres (ej: "3.000") a un formato
// legible: sin decimales de sobra, y con coma/punto según convención
// hispana (para no confundir "3.000" con "tres mil" cuando en realidad es 3).
function formatearNumero(valor, maximoDecimales = 3) {
  const n = Number(valor);
  if (Number.isNaN(n)) return '0';
  return n.toLocaleString('es-BO', { maximumFractionDigits: maximoDecimales });
}

async function cargarPestanasYPermisos(req, res, next) {
  try {
    res.locals.fmt = formatearNumero;

    const pestanas = await pool.query('SELECT * FROM pestanas ORDER BY orden');

    if (req.session.esAdmin) {
      // El admin ve y edita todo
      res.locals.pestanas = pestanas.rows.map((p) => ({
        ...p,
        puede_ver: true,
        puede_editar: true,
      }));
    } else if (req.session.usuario) {
      const permisos = await pool.query(
        'SELECT pestana_clave, puede_ver, puede_editar FROM permisos WHERE usuario_id = $1',
        [req.session.usuario.id]
      );
      const mapa = {};
      permisos.rows.forEach((p) => (mapa[p.pestana_clave] = p));

      res.locals.pestanas = pestanas.rows
        .map((p) => ({
          ...p,
          puede_ver: mapa[p.clave]?.puede_ver || false,
          puede_editar: mapa[p.clave]?.puede_editar || false,
        }))
        .filter((p) => p.puede_ver);
    } else {
      res.locals.pestanas = [];
    }

    res.locals.usuarioActual = req.session.usuario || null;
    res.locals.esAdmin = !!req.session.esAdmin;
    res.locals.ADMIN_BASE = ADMIN_BASE;
    next();
  } catch (err) {
    next(err);
  }
}

// --- Middleware factory: exige permiso de VER sobre una pestaña concreta ---
function requierePermisoVer(clave) {
  return async (req, res, next) => {
    if (req.session.esAdmin) return next();
    if (!req.session.usuario) return res.redirect('/login');
    const r = await pool.query(
      'SELECT puede_ver FROM permisos WHERE usuario_id = $1 AND pestana_clave = $2',
      [req.session.usuario.id, clave]
    );
    if (r.rows[0]?.puede_ver) return next();
    return res.status(403).render('error', {
      mensaje: 'No tienes permiso para ver esta sección.',
    });
  };
}

// --- Middleware factory: exige permiso de EDITAR (para POST/PUT/DELETE) ---
function requierePermisoEditar(clave) {
  return async (req, res, next) => {
    if (req.session.esAdmin) return next();
    if (!req.session.usuario) return res.status(401).json({ error: 'No autenticado' });
    const r = await pool.query(
      'SELECT puede_editar FROM permisos WHERE usuario_id = $1 AND pestana_clave = $2',
      [req.session.usuario.id, clave]
    );
    if (r.rows[0]?.puede_editar) return next();
    return res.status(403).json({ error: 'No tienes permiso para editar esta sección.' });
  };
}

module.exports = {
  requireUser,
  requireAdmin,
  cargarPestanasYPermisos,
  requierePermisoVer,
  requierePermisoEditar,
};
