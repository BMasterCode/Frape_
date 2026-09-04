-- ==========================================================
-- FRAPE CLUB - Esquema de base de datos (Neon / PostgreSQL)
-- ==========================================================

-- Pestañas del sistema (para el panel de permisos del admin)
CREATE TABLE IF NOT EXISTS pestanas (
  clave TEXT PRIMARY KEY,       -- ej: 'ingresos_gastos'
  nombre TEXT NOT NULL,         -- ej: 'Ingresos y Gastos del Día'
  orden INTEGER NOT NULL DEFAULT 0
);

INSERT INTO pestanas (clave, nombre, orden) VALUES
  ('ingresos_gastos',   'Ingresos y Gastos del Día', 1),
  ('activos_fijos',     'Activos Fijos',             2),
  ('accionistas',       'Accionistas',                3),
  ('cobros',            'Cobros de Dividendos',       4),
  ('balance_general',   'Balance General',            5),
  ('estado_resultados', 'Estado de Resultados',       6),
  ('historial',         'Historial Semanal / Mensual',7)
ON CONFLICT (clave) DO NOTHING;

-- Usuarios normales (creados únicamente por el admin)
CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nombre TEXT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Permisos por usuario y por pestaña: puede_ver / puede_editar
CREATE TABLE IF NOT EXISTS permisos (
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  pestana_clave TEXT NOT NULL REFERENCES pestanas(clave) ON DELETE CASCADE,
  puede_ver BOOLEAN NOT NULL DEFAULT FALSE,
  puede_editar BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (usuario_id, pestana_clave)
);

-- Socios / Accionistas
CREATE TABLE IF NOT EXISTS socios (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  acciones NUMERIC(10,2) NOT NULL DEFAULT 0,
  monto_invertido NUMERIC(12,2) NOT NULL DEFAULT 0,
  condicion_especial TEXT,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fondo inicial / total de acciones de la empresa (una sola fila de config)
CREATE TABLE IF NOT EXISTS empresa_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  fondo_inicial NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_acciones NUMERIC(10,2) NOT NULL DEFAULT 100,
  precio_accion NUMERIC(10,2) NOT NULL DEFAULT 0,
  pct_alquiler NUMERIC(5,4) NOT NULL DEFAULT 0.20,      -- % que se va a alquiler sobre utilidad variada
  pct_reinversion NUMERIC(5,4) NOT NULL DEFAULT 0.40,
  pct_dividendos NUMERIC(5,4) NOT NULL DEFAULT 0.40,
  pct_reserva NUMERIC(5,4) NOT NULL DEFAULT 0.15,
  pct_deudas NUMERIC(5,4) NOT NULL DEFAULT 0.00,
  pct_capital_trabajo NUMERIC(5,4) NOT NULL DEFAULT 0.05,
  CHECK (id = 1)
);
INSERT INTO empresa_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Activos fijos
CREATE TABLE IF NOT EXISTS activos_fijos (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  fecha_compra DATE NOT NULL,
  costo NUMERIC(12,2) NOT NULL,
  vida_util_anios NUMERIC(6,2) NOT NULL,
  valor_residual NUMERIC(12,2) NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Movimientos diarios: ingresos y gastos (reemplaza la captura manual del Excel)
-- servicio: 'frappe' | 'masita' | 'juego_cartas' | 'juego_mesa_persona' | 'otro_ingreso'
--           'insumos' | 'sueldos' | 'servicios' | 'financiero' | 'otro_gasto'
CREATE TABLE IF NOT EXISTS movimientos (
  id SERIAL PRIMARY KEY,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo TEXT NOT NULL CHECK (tipo IN ('ingreso','gasto')),
  servicio TEXT NOT NULL,
  descripcion TEXT,
  horas NUMERIC(6,2),
  personas NUMERIC(6,2),
  tarifa NUMERIC(10,2),
  monto NUMERIC(12,2) NOT NULL,
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_movimientos_fecha ON movimientos(fecha);

-- Cobros de dividendos por socio
CREATE TABLE IF NOT EXISTS cobros_dividendos (
  id SERIAL PRIMARY KEY,
  socio_id INTEGER NOT NULL REFERENCES socios(id) ON DELETE CASCADE,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  monto NUMERIC(12,2) NOT NULL,
  nota TEXT,
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Balance General: partidas que se llenan a mano (mes a mes)
CREATE TABLE IF NOT EXISTS balance_general (
  id SERIAL PRIMARY KEY,
  mes TEXT NOT NULL UNIQUE, -- formato '2026-08'
  caja_bancos NUMERIC(12,2) NOT NULL DEFAULT 0,
  cuentas_cobrar NUMERIC(12,2) NOT NULL DEFAULT 0,
  inventario NUMERIC(12,2) NOT NULL DEFAULT 0,
  cuentas_pagar NUMERIC(12,2) NOT NULL DEFAULT 0,
  sueldos_pagar NUMERIC(12,2) NOT NULL DEFAULT 0,
  impuestos_pagar NUMERIC(12,2) NOT NULL DEFAULT 0,
  prestamo_largo_plazo NUMERIC(12,2) NOT NULL DEFAULT 0,
  capital_social NUMERIC(12,2) NOT NULL DEFAULT 0,
  utilidades_retenidas NUMERIC(12,2) NOT NULL DEFAULT 0,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabla de sesiones para connect-pg-simple (se crea sola en el primer arranque,
-- pero la dejamos aquí por si se quiere crear a mano)
CREATE TABLE IF NOT EXISTS "session" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL
)
WITH (OIDS=FALSE);
ALTER TABLE "session" ADD CONSTRAINT IF NOT EXISTS "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
