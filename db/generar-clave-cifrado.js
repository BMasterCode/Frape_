// Genera una clave aleatoria de 32 bytes (64 caracteres hex) para ENCRYPTION_KEY.
// Uso: node db/generar-clave-cifrado.js
const crypto = require('crypto');
console.log('\nCopia esta línea en tu archivo .env:\n');
console.log(`ENCRYPTION_KEY=${crypto.randomBytes(32).toString('hex')}\n`);
console.log('⚠️  Si ya tenías usuarios creados antes de definir esta clave, sus');
console.log('   contraseñas visibles se guardarán recién a partir de ahora (cuando');
console.log('   el admin las cambie de nuevo). No compartas esta clave con nadie.\n');
