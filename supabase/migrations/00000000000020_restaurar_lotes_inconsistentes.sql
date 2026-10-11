-- ============================================================
-- Migration 20: Script de diagnóstico y restauración
-- ============================================================
-- Este script NO se ejecuta automáticamente con migration up.
-- Debe correrse manualmente en el SQL Editor de Supabase
-- después de aplicar la migración 19.
--
-- Propósito: identificar lotes que fueron decrementados por
-- intentos fallidos de enviar transferencias (cuando el RPC
-- decrementar_lote se ejecutaba pero decrementar_stock_ubicacion
-- fallaba por el bug de NULL ubicacion_id).
-- ============================================================

-- ============================================================
-- PASO 1: Identificar lotes potencialmente inconsistentes
-- ============================================================
-- Busca transferencias en estado "creada" cuyos items sumen
-- más que la cantidad actual del lote, indicando que el lote
-- fue parcial o totalmente descontado sin éxito.
-- ============================================================
SELECT
  l.id AS lote_id,
  l.numero_lote,
  l.producto_id,
  p.nombre_comercial,
  l.cantidad AS cantidad_actual_lote,
  SUM(ti.cantidad) AS total_solicitado_en_creadas,
  l.cantidad + SUM(ti.cantidad) AS cantidad_restaurada_sugerida,
  COUNT(DISTINCT t.id) AS intentos_fallidos,
  STRING_AGG(DISTINCT t.id::text, ', ') AS transferencias_afectadas
FROM transferencias t
JOIN transferencias_items ti ON ti.transferencia_id = t.id
JOIN lotes l ON l.id = ti.lote_id
JOIN productos p ON p.id = l.producto_id
WHERE t.estado = 'creada'
  AND l.cantidad < ti.cantidad  -- el lote tiene menos de lo que pide UNA sola transferencia
GROUP BY l.id, l.numero_lote, l.producto_id, p.nombre_comercial, l.cantidad
ORDER BY l.producto_id;

-- ============================================================
-- PASO 2: Restaurar lotes (SOLO si estás seguro)
-- ============================================================
-- Reemplaza los IDs de los lotes y cantidades según el Paso 1.
-- Ejecuta UNA SOLA VEZ por lote afectado.
-- ============================================================
-- UPDATE lotes
-- SET cantidad = cantidad + <cantidad_restaurada_sugerida>
-- WHERE id = '<lote_id>';
