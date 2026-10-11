-- ============================================================
-- 18. Agregar FK de recepciones_orden.registrado_por → usuarios.id
-- ============================================================

BEGIN;

-- Limpiar huérfanos por si acaso (usuarios eliminados de auth.users)
DELETE FROM recepciones_orden r
WHERE r.registrado_por IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM usuarios u WHERE u.id = r.registrado_por);

-- Agregar la FK faltante
ALTER TABLE recepciones_orden
  ADD CONSTRAINT recepciones_orden_registrado_por_fkey
  FOREIGN KEY (registrado_por) REFERENCES usuarios(id);

COMMIT;
