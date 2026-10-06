BEGIN;

-- ============================================================
-- Migration 16: Fix RPC functions para manejar NULL en ubicacion_id
-- ============================================================
-- Las RPCs decrementar_stock_ubicacion e incrementar_stock_ubicacion
-- usaban "AND ubicacion_id = $4" que no funciona cuando $4 es NULL
-- porque en SQL "NULL = NULL" no es TRUE.
--
-- La droguería central se almacena con ubicacion_id = NULL en
-- stock_ubicaciones y lotes. Al pasar NULL como p_ubicacion_id,
-- la condición "= $4" nunca hace match.
--
-- Fix: usar "IS NOT DISTINCT FROM" que sí trata NULL como igual a NULL.
-- ============================================================

-- 1. Fix decrementar_stock_ubicacion
CREATE OR REPLACE FUNCTION public.decrementar_stock_ubicacion(
  p_producto_id UUID,
  p_ubicacion_tipo tipo_ubicacion,
  p_ubicacion_id UUID,
  p_columna TEXT,
  p_cantidad INT
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_columna TEXT;
BEGIN
  v_columna := CASE p_columna
    WHEN 'cantidad_disponible' THEN 'cantidad_disponible'
    WHEN 'stock_en_transito' THEN 'stock_en_transito'
    WHEN 'stock_por_recibir' THEN 'stock_por_recibir'
    ELSE NULL
  END;

  IF v_columna IS NULL THEN
    RAISE EXCEPTION 'Columna no válida: %', p_columna;
  END IF;

  EXECUTE format(
    'UPDATE stock_ubicaciones
     SET %I = %I - $1, updated_at = NOW()
     WHERE producto_id = $2
       AND ubicacion_tipo = $3::tipo_ubicacion
       AND (ubicacion_id IS NOT DISTINCT FROM $4)
       AND %I >= $1',
    v_columna, v_columna, v_columna
  ) USING p_cantidad, p_producto_id, p_ubicacion_tipo, p_ubicacion_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stock insuficiente en la ubicación o registro no encontrado';
  END IF;
END;
$$;

-- 2. Fix incrementar_stock_ubicacion
CREATE OR REPLACE FUNCTION public.incrementar_stock_ubicacion(
  p_producto_id UUID,
  p_ubicacion_tipo tipo_ubicacion,
  p_ubicacion_id UUID,
  p_columna TEXT,
  p_cantidad INT
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_columna TEXT;
BEGIN
  v_columna := CASE p_columna
    WHEN 'cantidad_disponible' THEN 'cantidad_disponible'
    WHEN 'stock_en_transito' THEN 'stock_en_transito'
    WHEN 'stock_por_recibir' THEN 'stock_por_recibir'
    ELSE NULL
  END;

  IF v_columna IS NULL THEN
    RAISE EXCEPTION 'Columna no válida: %', p_columna;
  END IF;

  EXECUTE format(
    'UPDATE stock_ubicaciones
     SET %I = %I + $1, updated_at = NOW()
     WHERE producto_id = $2
       AND ubicacion_tipo = $3::tipo_ubicacion
       AND (ubicacion_id IS NOT DISTINCT FROM $4)',
    v_columna, v_columna
  ) USING p_cantidad, p_producto_id, p_ubicacion_tipo, p_ubicacion_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registro de stock no encontrado para la ubicación';
  END IF;
END;
$$;

COMMIT;
