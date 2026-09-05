// Genera el hash de una contraseña para pegarlo en ADMIN_PASSWORD_HASH (.env)
// Uso: node db/hash-password.js "miContraseñaSegura"
const bcrypt = require('bcryptjs');

const plain = process.argv[2];
if (!plain) {
  console.error('Uso: node db/hash-password.js "tu-contraseña"');
  process.exit(1);
}

const hash = bcrypt.hashSync(plain, 10);
console.log('\nCopia esta línea en tu archivo .env:\n');
console.log(`ADMIN_PASSWORD_HASH=${hash}\n`);
