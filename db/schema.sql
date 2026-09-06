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
  ('menu',              'Menú de Productos',         2),
  ('activos_corrientes','Activos Corrientes (Inventario)', 3),
  ('activos_fijos',     'Activos Fijos',             4),
  ('pasivos',           'Pasivos (Deudas)',          5),
  ('accionistas',       'Accionistas',                6),
  ('cobros',            'Cobros de Dividendos',       7),
  ('distribucion_utilidad', 'Cobro de Distribución de Utilidad', 8),
  ('balance_general',   'Balance General',            9),
  ('estado_resultados', 'Estado de Resultados',       10),
  ('historial',         'Historial Semanal / Mensual',11)
ON CONFLICT (clave) DO NOTHING;

-- Usuarios normales (creados únicamente por el admin)
CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,        -- usado para validar el login (no se puede leer)
  password_visible TEXT,              -- copia cifrada-reversible, solo para que el admin la vea
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

-- ==========================================================
-- ACTIVOS CORRIENTES / INVENTARIO
-- Cada producto/insumo con su stock y precio. Alimenta directamente
-- el Balance General (ya no se llena "Inventario" a mano ahí).
-- ==========================================================
CREATE TABLE IF NOT EXISTS inventario (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  unidad TEXT NOT NULL DEFAULT 'unidad', -- 'unidad' | 'g' | 'kg' | 'ml' | 'l'
  stock NUMERIC(12,3) NOT NULL DEFAULT 0,
  precio_unitario NUMERIC(12,2) NOT NULL DEFAULT 0, -- valor de cada unidad, para el balance
  stock_minimo NUMERIC(12,3) NOT NULL DEFAULT 0,     -- para avisar "se está acabando"
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================================
-- MENÚ DE PRODUCTOS (lo que se vende: frappes/refrescos, masitas/snacks)
-- Puede ser 'elaborado' (se arma con insumos del inventario) o
-- 'comprado' (se compra ya hecho y se revende con margen).
-- ==========================================================
CREATE TABLE IF NOT EXISTS menu_productos (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  categoria TEXT NOT NULL CHECK (categoria IN ('frappe','masita','juego_cartas','juego_mesa_persona')),
  modo TEXT NOT NULL CHECK (modo IN ('elaborado','comprado','servicio')),
  inventario_id_comprado INTEGER REFERENCES inventario(id) ON DELETE SET NULL, -- solo si modo = 'comprado'
  precio_venta NUMERIC(12,2) NOT NULL DEFAULT 0,
  preparacion TEXT, -- instrucciones de preparación (solo aplica a 'elaborado')
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Receta: qué insumos (y cuánto de cada uno) lleva un producto 'elaborado'
CREATE TABLE IF NOT EXISTS menu_receta (
  id SERIAL PRIMARY KEY,
  producto_id INTEGER NOT NULL REFERENCES menu_productos(id) ON DELETE CASCADE,
  insumo_id INTEGER NOT NULL REFERENCES inventario(id) ON DELETE CASCADE,
  cantidad_necesaria NUMERIC(12,3) NOT NULL -- cuánto de ese insumo lleva UNA unidad del producto
);

-- ==========================================================
-- PASIVOS (deudas por pagar): sueldos no pagados, cuentas, intereses...
-- Lo pendiente alimenta directamente el Balance General.
-- ==========================================================
CREATE TABLE IF NOT EXISTS pasivos (
  id SERIAL PRIMARY KEY,
  descripcion TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('sueldo','cuenta','interes','otro')),
  monto NUMERIC(12,2) NOT NULL,
  pagado BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_pago DATE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- servicio: 'frappe' | 'masita' | 'juego_cartas' | 'juego_mesa_persona' | 'otro_ingreso'
--           'insumos' | 'sueldos' | 'servicios' | 'financiero' | 'otro_gasto'
CREATE TABLE IF NOT EXISTS movimientos (
  id SERIAL PRIMARY KEY,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo TEXT NOT NULL CHECK (tipo IN ('ingreso','gasto')),
  servicio TEXT NOT NULL,
  producto_id INTEGER REFERENCES menu_productos(id) ON DELETE SET NULL, -- solo para frappe/masita
  cantidad NUMERIC(10,2),                                               -- unidades vendidas (frappe/masita)
  descripcion TEXT,
  horas NUMERIC(6,2),
  personas NUMERIC(6,2),
  tarifa NUMERIC(10,2),
  monto NUMERIC(12,2) NOT NULL,
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_movimientos_fecha ON movimientos(fecha);

-- ==========================================================
-- USOS DE LA DISTRIBUCIÓN DE UTILIDAD (todo lo que NO es dividendos:
-- reinversión, reserva, pago de deudas, capital de trabajo).
-- Los dividendos se cobran aparte, en "cobros_dividendos".
-- ==========================================================
CREATE TABLE IF NOT EXISTS distribucion_usos (
  id SERIAL PRIMARY KEY,
  categoria TEXT NOT NULL CHECK (categoria IN ('reinversion','reserva','deudas','capital_trabajo')),
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  monto NUMERIC(12,2) NOT NULL,
  nota TEXT,
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

-- Balance General: la mayoría se llena a mano (mes a mes).
-- inventario, cuentas_pagar y sueldos_pagar YA NO se guardan aquí: se
-- calculan solos, en vivo, desde "inventario" y "pasivos" (ver lib/calculos.js).
-- Se dejan las columnas por compatibilidad pero la app ya no las usa.
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

-- La tabla "session" (para connect-pg-simple) NO se crea aquí a propósito:
-- el servidor la crea solo, con la estructura correcta, gracias a
-- createTableIfMissing: true en server.js. Si alguna vez la creas a mano,
-- recuerda que "ADD CONSTRAINT IF NOT EXISTS" no existe en PostgreSQL —
-- usa CREATE TABLE con PRIMARY KEY directamente en la definición.
