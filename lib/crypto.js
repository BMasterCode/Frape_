// Cifrado reversible AES-256-GCM, SOLO para que el admin pueda ver la
// contraseña de un usuario normal. El login sigue validándose con bcrypt
// (irreversible); esto es una copia aparte, guardada cifrada, que se
// puede descifrar únicamente con ENCRYPTION_KEY (definida en .env).
const crypto = require('crypto');

function obtenerClave() {
  const clave = process.env.ENCRYPTION_KEY;
  if (!clave || clave.length !== 64) {
    throw new Error(
      'Falta ENCRYPTION_KEY en el .env (debe ser una cadena de 64 caracteres hex). ' +
        'Genérala con: node db/generar-clave-cifrado.js'
    );
  }
  return Buffer.from(clave, 'hex');
}

function encriptar(textoPlano) {
  const key = obtenerClave();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const cifrado = Buffer.concat([cipher.update(textoPlano, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Guardamos iv + tag + cifrado, todo junto en hexadecimal
  return `${iv.toString('hex')}:${tag.toString('hex')}:${cifrado.toString('hex')}`;
}

function desencriptar(valorGuardado) {
  if (!valorGuardado) return null;
  const [ivHex, tagHex, dataHex] = valorGuardado.split(':');
  if (!ivHex || !tagHex || !dataHex) return null;
  const key = obtenerClave();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const textoPlano = Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]);
  return textoPlano.toString('utf8');
}

module.exports = { encriptar, desencriptar };
