const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.warn('⚠️  No se encontró DATABASE_URL en las variables de entorno.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // requerido por Neon
});

module.exports = pool;
