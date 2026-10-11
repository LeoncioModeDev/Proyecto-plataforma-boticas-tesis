-- ============================================================
-- Migration 22: Script de diagnóstico para recibir transferencia
-- ============================================================
-- Este script NO se ejecuta automáticamente con migration up.
-- Debe correrse manualmente en el SQL Editor de Supabase
-- después de aplicar la migración 21.
--
-- Propósito: identificar stock_en_transito que fue decrementado
-- por intentos fallidos de recibir transferencia (cuando el paso 1
-- se ejecutaba pero el paso 2 fallaba por la falta de transacción).
-- ============================================================

-- ============================================================
-- PASO 1: Identificar transferencias en "en_transito" cuyo
-- stock_en_transito no coincide con lo esperado
-- ============================================================
SELECT
  t.id AS transferencia_id,
  t.destino_id AS botica_destino,
  b.nombre AS nombre_botica,
  ti.producto_id,
  p.nombre_comercial,
  ti.cantidad AS cantidad_solicitada,
  COALESCE(su.stock_en_transito, 0) AS stock_en_transito_actual,
  CASE
    WHEN COALESCE(su.stock_en_transito, 0) < ti.cantidad THEN 'PARCIALMENTE_DECONTADO'
    WHEN COALESCE(su.stock_en_transito, 0) = 0 THEN 'TOTALMENTE_DECONTADO'
    ELSE 'OK'
  END AS estado_stock
FROM transferencias t
JOIN transferencias_items ti ON ti.transferencia_id = t.id
LEFT JOIN stock_ubicaciones su ON su.producto_id = ti.producto_id
  AND su.ubicacion_tipo = 'botica'
  AND su.ubicacion_id = t.destino_id
JOIN productos p ON p.id = ti.producto_id
LEFT JOIN boticas b ON b.id = t.destino_id
WHERE t.estado = 'en_transito'
  AND COALESCE(su.stock_en_transito, 0) < ti.cantidad
ORDER BY t.id, ti.producto_id;

-- ============================================================
-- PASO 2: Restaurar stock_en_transito (SOLO si estás seguro)
-- ============================================================
-- Reemplaza los valores según el Paso 1. Ejecuta UNA SOLA VEZ.
-- ============================================================
-- UPDATE stock_ubicaciones
-- SET stock_en_transito = stock_en_transito + <diferencia>,
--     updated_at = NOW()
-- WHERE producto_id = '<producto_id>'
--   AND ubicacion_tipo = 'botica'
--   AND ubicacion_id = '<botica_destino>';
