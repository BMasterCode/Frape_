// Ejecuta el esquema y (opcionalmente) los datos semilla en la base de datos.
// Uso:
//   node db/init.js            -> crea las tablas
//   node db/init.js --seed     -> crea las tablas y carga los datos del Excel original
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./pool');

async function run() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  console.log('Aplicando esquema...');
  await pool.query(schema);
  console.log('✅ Esquema aplicado.');

  if (process.argv.includes('--seed')) {
    const seed = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8');
    console.log('Cargando datos iniciales...');
    await pool.query(seed);
    console.log('✅ Datos iniciales cargados.');
  }

  await pool.end();
  console.log('Listo. Puedes iniciar el servidor con: npm start');
}

run().catch((err) => {
  console.error('❌ Error inicializando la base de datos:', err);
  process.exit(1);
});
