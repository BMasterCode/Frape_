-- ==========================================================
-- MIGRACIÓN 05 — Corre esto en el SQL Editor de Neon.
-- ==========================================================

ALTER TABLE menu_productos ADD COLUMN IF NOT EXISTS preparacion TEXT;
