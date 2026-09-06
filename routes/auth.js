const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');
const { ADMIN_BASE } = require('../lib/config');

const router = express.Router();

// ---------- LOGIN DE USUARIOS NORMALES ----------
router.get('/login', (req, res) => {
  // Si ya hay una sesión abierta pero la persona quiere ir a /login de todos
  // modos (por ejemplo porque quedó "atascada" sin permisos, o quiere entrar
  // con otra cuenta), la cerramos primero para no quedar en un bucle.
  if (req.session.usuario || req.session.esAdmin) {
    return req.session.destroy(() => res.render('login', { error: null }));
  }
  res.render('login', { error: null });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const r = await pool.query(
      'SELECT * FROM usuarios WHERE username = $1 AND activo = TRUE',
      [username]
    );
    const usuario = r.rows[0];
    if (!usuario) {
      return res.render('login', { error: 'Usuario o contraseña incorrectos.' });
    }
    const ok = await bcrypt.compare(password, usuario.password_hash);
    if (!ok) {
      return res.render('login', { error: 'Usuario o contraseña incorrectos.' });
    }
    req.session.usuario = { id: usuario.id, username: usuario.username, nombre: usuario.nombre };
    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.render('login', { error: 'Ocurrió un error al iniciar sesión.' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// ---------- LOGIN DEL ADMIN (usuario único, definido por variables de entorno) ----------
// La ruta NO se llama /admin a propósito, para que los usuarios normales no
// sepan que existe un acceso de administrador. Ver lib/config.js.
router.get(`${ADMIN_BASE}/login`, (req, res) => {
  if (req.session.esAdmin) return res.redirect(ADMIN_BASE);
  res.render('admin/login', { error: null });
});

router.post(`${ADMIN_BASE}/login`, async (req, res) => {
  const { username, password } = req.body;
  try {
    if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD_HASH) {
      console.error(
        '❌ Falta ADMIN_USERNAME o ADMIN_PASSWORD_HASH en las variables de entorno (.env).'
      );
      return res.render('admin/login', {
        error: 'El acceso de administrador no está configurado todavía (revisa el .env del servidor).',
      });
    }

    const usernameOk = username.trim() === process.env.ADMIN_USERNAME.trim();
    const passOk = await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH.trim());

    if (!usernameOk || !passOk) {
      return res.render('admin/login', { error: 'Usuario o contraseña incorrectos.' });
    }
    req.session.esAdmin = true;
    res.redirect(ADMIN_BASE);
  } catch (err) {
    console.error(err);
    res.render('admin/login', { error: 'Ocurrió un error al iniciar sesión.' });
  }
});

router.post(`${ADMIN_BASE}/logout`, (req, res) => {
  req.session.destroy(() => res.redirect(`${ADMIN_BASE}/login`));
});

module.exports = router;
