-- ==========================================================
-- MIGRACIÓN 03 — Corre esto en el SQL Editor de Neon.
-- Seguro de correr aunque ya hayas corrido las migraciones anteriores.
-- ==========================================================

INSERT INTO pestanas (clave, nombre, orden) VALUES
  ('distribucion_utilidad', 'Cobro de Distribución de Utilidad', 8)
ON CONFLICT (clave) DO NOTHING;

UPDATE pestanas SET orden = 9  WHERE clave = 'balance_general';
UPDATE pestanas SET orden = 10 WHERE clave = 'estado_resultados';
UPDATE pestanas SET orden = 11 WHERE clave = 'historial';

CREATE TABLE IF NOT EXISTS distribucion_usos (
  id SERIAL PRIMARY KEY,
  categoria TEXT NOT NULL CHECK (categoria IN ('reinversion','reserva','deudas','capital_trabajo')),
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  monto NUMERIC(12,2) NOT NULL,
  nota TEXT,
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
