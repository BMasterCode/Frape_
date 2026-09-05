-- ==========================================================
-- MIGRACIÓN 02 — Corre esto en el SQL Editor de Neon si ya tenías
-- el proyecto funcionando y no quieres perder tus datos.
-- Es seguro correrlo aunque ya lo hayas corrido antes.
-- ==========================================================

-- Nuevas pestañas
INSERT INTO pestanas (clave, nombre, orden) VALUES
  ('menu',               'Menú de Productos',                2),
  ('activos_corrientes', 'Activos Corrientes (Inventario)',  3),
  ('pasivos',            'Pasivos (Deudas)',                  5)
ON CONFLICT (clave) DO NOTHING;
-- Reordena las que ya existían para que el menú quede en el orden correcto
UPDATE pestanas SET orden = 1  WHERE clave = 'ingresos_gastos';
UPDATE pestanas SET orden = 4  WHERE clave = 'activos_fijos';
UPDATE pestanas SET orden = 6  WHERE clave = 'accionistas';
UPDATE pestanas SET orden = 7  WHERE clave = 'cobros';
UPDATE pestanas SET orden = 8  WHERE clave = 'balance_general';
UPDATE pestanas SET orden = 9  WHERE clave = 'estado_resultados';
UPDATE pestanas SET orden = 10 WHERE clave = 'historial';

-- Contraseña visible para el admin
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS password_visible TEXT;

-- Inventario (Activos Corrientes)
CREATE TABLE IF NOT EXISTS inventario (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  unidad TEXT NOT NULL DEFAULT 'unidad',
  stock NUMERIC(12,3) NOT NULL DEFAULT 0,
  precio_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock_minimo NUMERIC(12,3) NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Menú de productos
CREATE TABLE IF NOT EXISTS menu_productos (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  categoria TEXT NOT NULL CHECK (categoria IN ('frappe','masita')),
  modo TEXT NOT NULL CHECK (modo IN ('elaborado','comprado')),
  inventario_id_comprado INTEGER REFERENCES inventario(id) ON DELETE SET NULL,
  precio_venta NUMERIC(12,2) NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS menu_receta (
  id SERIAL PRIMARY KEY,
  producto_id INTEGER NOT NULL REFERENCES menu_productos(id) ON DELETE CASCADE,
  insumo_id INTEGER NOT NULL REFERENCES inventario(id) ON DELETE CASCADE,
  cantidad_necesaria NUMERIC(12,3) NOT NULL
);

-- Pasivos
CREATE TABLE IF NOT EXISTS pasivos (
  id SERIAL PRIMARY KEY,
  descripcion TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('sueldo','cuenta','interes','otro')),
  monto NUMERIC(12,2) NOT NULL,
  pagado BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_pago DATE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Vincular movimientos con el menú (para descontar inventario)
ALTER TABLE movimientos ADD COLUMN IF NOT EXISTS producto_id INTEGER REFERENCES menu_productos(id) ON DELETE SET NULL;
ALTER TABLE movimientos ADD COLUMN IF NOT EXISTS cantidad NUMERIC(10,2);
