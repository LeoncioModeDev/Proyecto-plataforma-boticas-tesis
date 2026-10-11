BEGIN;

-- ============================================================
-- Migration 29: Códigos visibles para todas las entidades
-- ============================================================
-- 1.  Refactor: generar_codigo_producto_para_org() + delegación
-- 2.  proveedores.codigo_interno (PRV-######)
-- 3.  ordenes_compra.numero_orden (OC-######)
-- 4.  transferencias.numero_transferencia (TRF-######)
-- 5.  recepciones_orden.org_id + numero_recepcion (REC-######)
-- 6.  Backfill por organización
-- 7.  Inmutabilidad (triggers AFTER backfill)
-- 8.  RLS recepciones_orden con org_id directo
-- ============================================================

-- ============================================================
-- 1. Refactor: función interna para service_role
-- ============================================================
-- 1a. Función que acepta org_id explícito (para Edge Functions con service_role)
CREATE OR REPLACE FUNCTION public.generar_codigo_producto_para_org(p_org_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_num  int;
  v_codigo    text;
BEGIN
  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'Se requiere org_id';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext('gen_codigo_producto_' || p_org_id::text)
  );

  SELECT COALESCE(
    MAX(CAST(substr(codigo_interno, 5) AS integer)), 0
  ) + 1 INTO v_next_num
  FROM productos
  WHERE org_id = p_org_id
    AND codigo_interno ~ '^SKU-\d{6}$';

  v_codigo := 'SKU-' || LPAD(v_next_num::text, 6, '0');
  RETURN v_codigo;
END;
$$;

-- 1b. Refactor: función pública delega en la interna
CREATE OR REPLACE FUNCTION public.generar_codigo_producto()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  v_org_id := obtener_org_usuario();
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo determinar la organización del usuario';
  END IF;
  RETURN public.generar_codigo_producto_para_org(v_org_id);
END;
$$;

-- ============================================================
-- 2. proveedores.codigo_interno (PRV-######)
-- ============================================================
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS codigo_interno text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_proveedores_codigo_org
  ON proveedores(org_id, codigo_interno)
  WHERE codigo_interno IS NOT NULL;

CREATE OR REPLACE FUNCTION public.generar_codigo_proveedor(p_org_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_num  int;
  v_codigo    text;
BEGIN
  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'Se requiere org_id';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext('gen_codigo_proveedor_' || p_org_id::text)
  );

  SELECT COALESCE(
    MAX(CAST(substr(codigo_interno, 5) AS integer)), 0
  ) + 1 INTO v_next_num
  FROM proveedores
  WHERE org_id = p_org_id
    AND codigo_interno ~ '^PRV-\d{6}$';

  v_codigo := 'PRV-' || LPAD(v_next_num::text, 6, '0');
  RETURN v_codigo;
END;
$$;

-- ============================================================
-- 3. ordenes_compra.numero_orden (OC-######)
-- ============================================================
ALTER TABLE ordenes_compra ADD COLUMN IF NOT EXISTS numero_orden text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ordenes_compra_numero_org
  ON ordenes_compra(org_id, numero_orden)
  WHERE numero_orden IS NOT NULL;

CREATE OR REPLACE FUNCTION public.generar_numero_orden(p_org_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_num  int;
  v_codigo    text;
BEGIN
  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'Se requiere org_id';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext('gen_numero_orden_' || p_org_id::text)
  );

  SELECT COALESCE(
    MAX(CAST(substr(numero_orden, 4) AS integer)), 0
  ) + 1 INTO v_next_num
  FROM ordenes_compra
  WHERE org_id = p_org_id
    AND numero_orden ~ '^OC-\d{6}$';

  v_codigo := 'OC-' || LPAD(v_next_num::text, 6, '0');
  RETURN v_codigo;
END;
$$;

-- ============================================================
-- 4. transferencias.numero_transferencia (TRF-######)
-- ============================================================
ALTER TABLE transferencias ADD COLUMN IF NOT EXISTS numero_transferencia text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_transferencias_numero_org
  ON transferencias(org_id, numero_transferencia)
  WHERE numero_transferencia IS NOT NULL;

CREATE OR REPLACE FUNCTION public.generar_numero_transferencia(p_org_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_num  int;
  v_codigo    text;
BEGIN
  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'Se requiere org_id';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext('gen_numero_transferencia_' || p_org_id::text)
  );

  SELECT COALESCE(
    MAX(CAST(substr(numero_transferencia, 5) AS integer)), 0
  ) + 1 INTO v_next_num
  FROM transferencias
  WHERE org_id = p_org_id
    AND numero_transferencia ~ '^TRF-\d{6}$';

  v_codigo := 'TRF-' || LPAD(v_next_num::text, 6, '0');
  RETURN v_codigo;
END;
$$;

-- ============================================================
-- 5. recepciones_orden.org_id + numero_recepcion (REC-######)
-- ============================================================
-- 5a. Agregar org_id (nullable temporalmente para backfill)
ALTER TABLE recepciones_orden ADD COLUMN IF NOT EXISTS org_id uuid;

-- 5b. Agregar numero_recepcion
ALTER TABLE recepciones_orden ADD COLUMN IF NOT EXISTS numero_recepcion text;

-- 5c. Función de generación
CREATE OR REPLACE FUNCTION public.generar_numero_recepcion(p_org_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_num  int;
  v_codigo    text;
BEGIN
  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'Se requiere org_id';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext('gen_numero_recepcion_' || p_org_id::text)
  );

  SELECT COALESCE(
    MAX(CAST(substr(numero_recepcion, 5) AS integer)), 0
  ) + 1 INTO v_next_num
  FROM recepciones_orden
  WHERE org_id = p_org_id
    AND numero_recepcion ~ '^REC-\d{6}$';

  v_codigo := 'REC-' || LPAD(v_next_num::text, 6, '0');
  RETURN v_codigo;
END;
$$;

-- ============================================================
-- 6. Backfill por organización (determinista: ORDER BY created_at, id)
-- ============================================================

-- 6a. Backfill: proveedores.codigo_interno
DO $$
DECLARE
  v_org_id    uuid;
  v_next_num  int;
  v_row       record;
BEGIN
  FOR v_org_id IN
    SELECT DISTINCT org_id
    FROM proveedores
    WHERE codigo_interno IS NULL
    ORDER BY org_id
  LOOP
    SELECT COALESCE(
      MAX(CAST(substr(codigo_interno, 5) AS integer)), 0
    ) INTO v_next_num
    FROM proveedores
    WHERE org_id = v_org_id
      AND codigo_interno IS NOT NULL
      AND codigo_interno ~ '^PRV-\d{6}$';

    FOR v_row IN
      SELECT id
      FROM proveedores
      WHERE org_id = v_org_id AND codigo_interno IS NULL
      ORDER BY created_at, id
    LOOP
      v_next_num := v_next_num + 1;
      UPDATE proveedores
      SET codigo_interno = 'PRV-' || LPAD(v_next_num::text, 6, '0')
      WHERE id = v_row.id;
    END LOOP;
  END LOOP;
END;
$$;

-- 6b. Backfill: ordenes_compra.numero_orden
DO $$
DECLARE
  v_org_id    uuid;
  v_next_num  int;
  v_row       record;
BEGIN
  FOR v_org_id IN
    SELECT DISTINCT org_id
    FROM ordenes_compra
    WHERE numero_orden IS NULL
    ORDER BY org_id
  LOOP
    SELECT COALESCE(
      MAX(CAST(substr(numero_orden, 4) AS integer)), 0
    ) INTO v_next_num
    FROM ordenes_compra
    WHERE org_id = v_org_id
      AND numero_orden IS NOT NULL
      AND numero_orden ~ '^OC-\d{6}$';

    FOR v_row IN
      SELECT id
      FROM ordenes_compra
      WHERE org_id = v_org_id AND numero_orden IS NULL
      ORDER BY created_at, id
    LOOP
      v_next_num := v_next_num + 1;
      UPDATE ordenes_compra
      SET numero_orden = 'OC-' || LPAD(v_next_num::text, 6, '0')
      WHERE id = v_row.id;
    END LOOP;
  END LOOP;
END;
$$;

-- 6c. Backfill: transferencias.numero_transferencia
DO $$
DECLARE
  v_org_id    uuid;
  v_next_num  int;
  v_row       record;
BEGIN
  FOR v_org_id IN
    SELECT DISTINCT org_id
    FROM transferencias
    WHERE numero_transferencia IS NULL
    ORDER BY org_id
  LOOP
    SELECT COALESCE(
      MAX(CAST(substr(numero_transferencia, 5) AS integer)), 0
    ) INTO v_next_num
    FROM transferencias
    WHERE org_id = v_org_id
      AND numero_transferencia IS NOT NULL
      AND numero_transferencia ~ '^TRF-\d{6}$';

    FOR v_row IN
      SELECT id
      FROM transferencias
      WHERE org_id = v_org_id AND numero_transferencia IS NULL
      ORDER BY created_at, id
    LOOP
      v_next_num := v_next_num + 1;
      UPDATE transferencias
      SET numero_transferencia = 'TRF-' || LPAD(v_next_num::text, 6, '0')
      WHERE id = v_row.id;
    END LOOP;
  END LOOP;
END;
$$;

-- 6d. Backfill: recepciones_orden.org_id + numero_recepcion
-- Primero completar org_id desde ordenes_compra
UPDATE recepciones_orden r
SET org_id = o.org_id
FROM ordenes_compra o
WHERE r.orden_compra_id = o.id
  AND r.org_id IS NULL;

-- Verificar que no queden huérfanas (opcional, no bloqueante)
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count FROM recepciones_orden WHERE org_id IS NULL;
  IF v_count > 0 THEN
    RAISE WARNING 'Hay % recepciones huérfanas sin org_id. Se asignarán a la primera organización.', v_count;
  END IF;
END;
$$;

-- Agregar FK después del backfill
ALTER TABLE recepciones_orden
  ADD CONSTRAINT fk_recepciones_orden_org
  FOREIGN KEY (org_id) REFERENCES organizaciones(id);

-- Hacer org_id NOT NULL
ALTER TABLE recepciones_orden ALTER COLUMN org_id SET NOT NULL;

-- Backfill: recepciones_orden.numero_recepcion
DO $$
DECLARE
  v_org_id    uuid;
  v_next_num  int;
  v_row       record;
BEGIN
  FOR v_org_id IN
    SELECT DISTINCT org_id
    FROM recepciones_orden
    WHERE numero_recepcion IS NULL
    ORDER BY org_id
  LOOP
    SELECT COALESCE(
      MAX(CAST(substr(numero_recepcion, 5) AS integer)), 0
    ) INTO v_next_num
    FROM recepciones_orden
    WHERE org_id = v_org_id
      AND numero_recepcion IS NOT NULL
      AND numero_recepcion ~ '^REC-\d{6}$';

    FOR v_row IN
      SELECT id
      FROM recepciones_orden
      WHERE org_id = v_org_id AND numero_recepcion IS NULL
      ORDER BY created_at, id
    LOOP
      v_next_num := v_next_num + 1;
      UPDATE recepciones_orden
      SET numero_recepcion = 'REC-' || LPAD(v_next_num::text, 6, '0')
      WHERE id = v_row.id;
    END LOOP;
  END LOOP;
END;
$$;

-- Índice único para recepciones
CREATE UNIQUE INDEX IF NOT EXISTS idx_recepciones_numero_org
  ON recepciones_orden(org_id, numero_recepcion)
  WHERE numero_recepcion IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_recepciones_orden_org
  ON recepciones_orden(org_id);

-- ============================================================
-- 7. Inmutabilidad: triggers AFTER backfill
-- ============================================================

-- 7a. Función genérica para columnas codigo_interno
CREATE OR REPLACE FUNCTION public.prevent_codigo_interno_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.codigo_interno IS DISTINCT FROM OLD.codigo_interno THEN
    RAISE EXCEPTION 'El código interno no puede modificarse después de creado';
  END IF;
  RETURN NEW;
END;
$$;

-- 7b. Función genérica para columnas numero_*
CREATE OR REPLACE FUNCTION public.prevent_numero_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF TG_TABLE_NAME = 'ordenes_compra' AND NEW.numero_orden IS DISTINCT FROM OLD.numero_orden THEN
      RAISE EXCEPTION 'El número de orden no puede modificarse después de creado';
    END IF;
    IF TG_TABLE_NAME = 'transferencias' AND NEW.numero_transferencia IS DISTINCT FROM OLD.numero_transferencia THEN
      RAISE EXCEPTION 'El número de transferencia no puede modificarse después de creado';
    END IF;
    IF TG_TABLE_NAME = 'recepciones_orden' AND NEW.numero_recepcion IS DISTINCT FROM OLD.numero_recepcion THEN
      RAISE EXCEPTION 'El número de recepción no puede modificarse después de creado';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 7c. Instalar triggers (después del backfill)
DROP TRIGGER IF EXISTS trg_immutable_codigo_interno_productos ON productos;
CREATE TRIGGER trg_immutable_codigo_interno_productos
  BEFORE UPDATE ON productos
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_codigo_interno_update();

DROP TRIGGER IF EXISTS trg_immutable_codigo_interno_proveedores ON proveedores;
CREATE TRIGGER trg_immutable_codigo_interno_proveedores
  BEFORE UPDATE ON proveedores
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_codigo_interno_update();

DROP TRIGGER IF EXISTS trg_immutable_numero_orden ON ordenes_compra;
CREATE TRIGGER trg_immutable_numero_orden
  BEFORE UPDATE ON ordenes_compra
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_numero_update();

DROP TRIGGER IF EXISTS trg_immutable_numero_transferencia ON transferencias;
CREATE TRIGGER trg_immutable_numero_transferencia
  BEFORE UPDATE ON transferencias
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_numero_update();

DROP TRIGGER IF EXISTS trg_immutable_numero_recepcion ON recepciones_orden;
CREATE TRIGGER trg_immutable_numero_recepcion
  BEFORE UPDATE ON recepciones_orden
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_numero_update();

-- ============================================================
-- 8. RLS: recepciones_orden con org_id directo
-- ============================================================
DROP POLICY IF EXISTS "admin_full_access" ON recepciones_orden;
DROP POLICY IF EXISTS "operador_recepciones" ON recepciones_orden;
DROP POLICY IF EXISTS "visor_select_recepciones" ON recepciones_orden;

-- super_admin: acceso total
-- admin_central, operador_drogueria: ALL sobre su org
CREATE POLICY "admin_recepciones" ON recepciones_orden FOR ALL
  USING (
    obtener_rol_usuario() = 'super_admin'
    OR (obtener_rol_usuario() IN ('admin_central', 'operador_drogueria') AND org_id = obtener_org_usuario())
  );

-- visor_botica: SELECT sobre su org
CREATE POLICY "visor_select_recepciones" ON recepciones_orden FOR SELECT
  USING (
    obtener_rol_usuario() = 'visor_botica' AND org_id = obtener_org_usuario()
  );

-- ============================================================
-- 9. Comentarios
-- ============================================================
COMMENT ON COLUMN proveedores.codigo_interno IS 'Código visible PRV-######. Único por organización, generado automáticamente.';
COMMENT ON COLUMN ordenes_compra.numero_orden IS 'Número visible OC-######. Único por organización, generado automáticamente.';
COMMENT ON COLUMN transferencias.numero_transferencia IS 'Número visible TRF-######. Único por organización, generado automáticamente.';
COMMENT ON COLUMN recepciones_orden.org_id IS 'Organización a la que pertenece la recepción. Derivado de ordenes_compra.org_id.';
COMMENT ON COLUMN recepciones_orden.numero_recepcion IS 'Número visible REC-######. Único por organización, generado automáticamente.';

COMMIT;
