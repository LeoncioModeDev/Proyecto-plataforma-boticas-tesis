-- Migration 32: UNIQUE constraint on dominio_correo_organizacion
-- Se ejecuta guiado (no blocking) para limpiar duplicados previos

-- ============================================================
-- 1. Identificar y limpiar duplicados
-- ============================================================
-- Conserva el registro más antiguo por dominio; los duplicados se ponen NULL
UPDATE configuracion_organizacion c
SET dominio_correo_organizacion = NULL
WHERE c.dominio_correo_organizacion IS NOT NULL
  AND c.id NOT IN (
    SELECT id FROM (
      SELECT DISTINCT ON (dominio_correo_organizacion) id
      FROM configuracion_organizacion
      WHERE dominio_correo_organizacion IS NOT NULL
      ORDER BY dominio_correo_organizacion, created_at ASC
    ) AS keep
  );

-- ============================================================
-- 2. Agregar UNIQUE constraint
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_config_dominio_unico
  ON configuracion_organizacion (dominio_correo_organizacion)
  WHERE dominio_correo_organizacion IS NOT NULL;

-- ============================================================
-- 3. Comentario
-- ============================================================
COMMENT ON INDEX idx_config_dominio_unico IS
  'Garantiza que cada dominio institucional sea único entre organizaciones';
