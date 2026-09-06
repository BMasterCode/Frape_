-- ==========================================================
-- MIGRACIÓN 04 — Corre esto en el SQL Editor de Neon.
-- Permite agregar juegos (cartas / mesa por persona) al Menú de Productos,
-- para poder elegir el nombre del juego al registrar un ingreso.
-- ==========================================================

ALTER TABLE menu_productos DROP CONSTRAINT IF EXISTS menu_productos_categoria_check;
ALTER TABLE menu_productos ADD CONSTRAINT menu_productos_categoria_check
  CHECK (categoria IN ('frappe','masita','juego_cartas','juego_mesa_persona'));

ALTER TABLE menu_productos DROP CONSTRAINT IF EXISTS menu_productos_modo_check;
ALTER TABLE menu_productos ADD CONSTRAINT menu_productos_modo_check
  CHECK (modo IN ('elaborado','comprado','servicio'));
