require('dotenv').config();
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const path = require('path');

const pool = require('./db/pool');
const { cargarPestanasYPermisos } = require('./middleware/auth');
const { ADMIN_BASE } = require('./lib/config');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const dashboardRoutes = require('./routes/dashboard');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/public', express.static(path.join(__dirname, 'public')));

app.use(
  session({
    store: new pgSession({ pool, tableName: 'session', createTableIfMissing: true }),
    secret: process.env.SESSION_SECRET || 'cambia-esto',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 días
      secure: process.env.NODE_ENV === 'production',
    },
  })
);

// Pestañas + permisos disponibles en todas las vistas (res.locals)
app.use(cargarPestanasYPermisos);

app.use('/', authRoutes);
app.use(ADMIN_BASE, adminRoutes);
app.use('/', require('./middleware/protegerDashboard'), dashboardRoutes);

app.use((req, res) => {
  res.status(404).render('error', { mensaje: 'Página no encontrada.' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', { mensaje: 'Ocurrió un error inesperado.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Frape Club corriendo en http://localhost:${PORT}`);
});
