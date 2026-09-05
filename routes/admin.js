const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');
const { ADMIN_BASE } = require('../lib/config');
const { encriptar, desencriptar } = require('../lib/crypto');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireAdmin);

// ---------- Panel principal: lista de usuarios ----------
router.get('/', async (req, res) => {
  const usuarios = await pool.query('SELECT * FROM usuarios ORDER BY creado_en DESC');
  res.render('admin/dashboard', { usuarios: usuarios.rows, mensaje: null, error: null });
});

// ---------- Crear usuario ----------
router.post('/usuarios', async (req, res) => {
  const { username, password, nombre } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    let visible = null;
    try {
      visible = encriptar(password);
    } catch (e) {
      console.warn('⚠️ ', e.message);
    }
    const r = await pool.query(
      'INSERT INTO usuarios (username, password_hash, password_visible, nombre) VALUES ($1,$2,$3,$4) RETURNING id',
      [username, hash, visible, nombre]
    );
    const usuarioId = r.rows[0].id;

    // Crea filas de permiso (todo en falso) para cada pestaña existente
    const pestanas = await pool.query('SELECT clave FROM pestanas');
    for (const p of pestanas.rows) {
      await pool.query(
        `INSERT INTO permisos (usuario_id, pestana_clave, puede_ver, puede_editar)
         VALUES ($1,$2,FALSE,FALSE) ON CONFLICT DO NOTHING`,
        [usuarioId, p.clave]
      );
    }

    res.redirect(`${ADMIN_BASE}/usuarios/${usuarioId}`);
  } catch (err) {
    console.error(err);
    const usuarios = await pool.query('SELECT * FROM usuarios ORDER BY creado_en DESC');
    res.render('admin/dashboard', {
      usuarios: usuarios.rows,
      mensaje: null,
      error: 'No se pudo crear el usuario (¿el nombre de usuario ya existe?).',
    });
  }
});

// ---------- Editar usuario: pantalla con datos + permisos por pestaña ----------
router.get('/usuarios/:id', async (req, res) => {
  const { id } = req.params;
  const usuario = await pool.query('SELECT * FROM usuarios WHERE id = $1', [id]);
  if (!usuario.rows[0]) return res.redirect(ADMIN_BASE);

  const pestanas = await pool.query('SELECT * FROM pestanas ORDER BY orden');
  const permisos = await pool.query('SELECT * FROM permisos WHERE usuario_id = $1', [id]);
  const mapaPermisos = {};
  permisos.rows.forEach((p) => (mapaPermisos[p.pestana_clave] = p));

  let passwordVisible = null;
  try {
    passwordVisible = desencriptar(usuario.rows[0].password_visible);
  } catch (e) {
    console.warn('⚠️ ', e.message);
  }

  res.render('admin/usuario-editar', {
    usuario: usuario.rows[0],
    pestanas: pestanas.rows,
    mapaPermisos,
    passwordVisible,
    mensaje: null,
    error: null,
  });
});

// ---------- Actualizar datos básicos del usuario (nombre / activo) ----------
router.post('/usuarios/:id/datos', async (req, res) => {
  const { id } = req.params;
  const { nombre, username, activo } = req.body;
  try {
    await pool.query('UPDATE usuarios SET nombre = $1, username = $2, activo = $3 WHERE id = $4', [
      nombre,
      username,
      activo === 'on',
      id,
    ]);
    res.redirect(`${ADMIN_BASE}/usuarios/${id}`);
  } catch (err) {
    console.error(err);
    const usuario = await pool.query('SELECT * FROM usuarios WHERE id = $1', [id]);
    const pestanas = await pool.query('SELECT * FROM pestanas ORDER BY orden');
    const permisos = await pool.query('SELECT * FROM permisos WHERE usuario_id = $1', [id]);
    const mapaPermisos = {};
    permisos.rows.forEach((p) => (mapaPermisos[p.pestana_clave] = p));
    let passwordVisible = null;
    try {
      passwordVisible = desencriptar(usuario.rows[0].password_visible);
    } catch (e) {
      // sin clave configurada, seguimos sin mostrarla
    }
    res.render('admin/usuario-editar', {
      usuario: usuario.rows[0],
      pestanas: pestanas.rows,
      mapaPermisos,
      passwordVisible,
      mensaje: null,
      error: 'No se pudo actualizar: ese nombre de usuario ya existe.',
    });
  }
});

// ---------- Cambiar contraseña del usuario ----------
router.post('/usuarios/:id/password', async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;
  const hash = await bcrypt.hash(password, 10);
  let visible = null;
  try {
    visible = encriptar(password);
  } catch (e) {
    console.warn('⚠️ ', e.message);
  }
  await pool.query('UPDATE usuarios SET password_hash = $1, password_visible = $2 WHERE id = $3', [
    hash,
    visible,
    id,
  ]);
  res.redirect(`${ADMIN_BASE}/usuarios/${id}`);
});

// ---------- Guardar permisos por pestaña ----------
router.post('/usuarios/:id/permisos', async (req, res) => {
  const { id } = req.params;
  const pestanas = await pool.query('SELECT clave FROM pestanas');

  for (const p of pestanas.rows) {
    const puedeVer = req.body[`ver_${p.clave}`] === 'on';
    // No se puede editar sin poder ver
    const puedeEditar = puedeVer && req.body[`editar_${p.clave}`] === 'on';
    await pool.query(
      `INSERT INTO permisos (usuario_id, pestana_clave, puede_ver, puede_editar)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (usuario_id, pestana_clave)
       DO UPDATE SET puede_ver = $3, puede_editar = $4`,
      [id, p.clave, puedeVer, puedeEditar]
    );
  }
  res.redirect(`${ADMIN_BASE}/usuarios/${id}`);
});

// ---------- Eliminar usuario ----------
router.post('/usuarios/:id/eliminar', async (req, res) => {
  const { id } = req.params;
  await pool.query('DELETE FROM usuarios WHERE id = $1', [id]);
  res.redirect(ADMIN_BASE);
});

module.exports = router;
