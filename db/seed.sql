-- ==========================================================
-- Datos iniciales tomados de frape_club.xlsm
-- Edítalos o bórralos desde la app cuando quieras.
-- ==========================================================

-- Config de la empresa
UPDATE empresa_config SET
  fondo_inicial = 5000,
  total_acciones = 100,
  precio_accion = 50,
  pct_alquiler = 0.20,
  pct_reinversion = 0.40,
  pct_dividendos = 0.40,
  pct_reserva = 0.15,
  pct_deudas = 0.00,
  pct_capital_trabajo = 0.05
WHERE id = 1;

-- Socios (accionistas)
INSERT INTO socios (nombre, acciones, monto_invertido, condicion_especial) VALUES
  ('Alberto', 31, 1550, NULL),
  ('Bismark', 20, 1400, 'Compró 20 acciones al accionista mayoritario por 1,400 Bs (precio negociado, bajo el original de 50 Bs/acción); recibe 20% de la ganancia de esas 20 acciones solo por 3 meses'),
  ('Giselle', 20, 1000, NULL),
  ('Adrian', 11, 550, NULL),
  ('Christian', 9, 450, NULL),
  ('Aracely', 5, 250, NULL),
  ('Andres', 4, 200, NULL)
ON CONFLICT DO NOTHING;

-- Activos fijos
INSERT INTO activos_fijos (nombre, fecha_compra, costo, vida_util_anios, valor_residual) VALUES
  ('Cafetera espresso', '2026-08-15', 500, 10, 500),
  ('Licuadoras (x2)', '2026-08-15', 300, 4, 50),
  ('Mesas y sillas para juegos de mesa', '2026-08-01', 100, 8, 50),
  ('Juegos de mesa (sets)', '2026-08-01', 200, 5, 0),
  ('Mobiliario / vitrina', '2026-08-15', 500, 8, 50)
ON CONFLICT DO NOTHING;

-- Inventario de ejemplo (Activos Corrientes) — edítalo o bórralo desde la app
INSERT INTO inventario (nombre, unidad, stock, precio_unitario, stock_minimo) VALUES
  ('Café en grano', 'kg', 5, 80, 1),
  ('Leche', 'l', 10, 10, 2),
  ('Hielo', 'kg', 20, 3, 5),
  ('Vasos descartables', 'unidad', 200, 0.80, 50),
  ('Masitas compradas (paquete)', 'unidad', 30, 5, 5)
ON CONFLICT DO NOTHING;

-- Menú de ejemplo — bórralo o edítalo desde la app
-- (la receta se arma desde la pestaña "Menú", aquí solo dejamos el producto base)
INSERT INTO menu_productos (nombre, categoria, modo, precio_venta) VALUES
  ('Frappe de café', 'frappe', 'elaborado', 12)
ON CONFLICT DO NOTHING;
