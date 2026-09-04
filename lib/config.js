// Ruta base del acceso de administrador. No usa la palabra "admin" para que
// los usuarios normales no la puedan adivinar mirando la URL.
// Puedes cambiarla definiendo ADMIN_PATH en tu archivo .env, por ejemplo:
//   ADMIN_PATH=/control-x92
const ADMIN_BASE = process.env.ADMIN_PATH || '/gestor-frape';

module.exports = { ADMIN_BASE };
