-- ============================================================
-- Migracion 33: Integracion local ML + reglas de stock/compra
-- No destructiva: solo agrega columnas, checks e indices.
-- ============================================================

BEGIN;

-- ============================================================
-- Stock comprometido: reservado solo por transferencias aprobadas.
-- ============================================================
ALTER TABLE stock_ubicaciones
  ADD COLUMN IF NOT EXISTS stock_comprometido integer NOT NULL DEFAULT 0;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_stock_ubicaciones_comprometido_no_negativo'
  ) THEN
    ALTER TABLE stock_ubicaciones
      ADD CONSTRAINT chk_stock_ubicaciones_comprometido_no_negativo
      CHECK (stock_comprometido >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_stock_ubicaciones_comprometido_disponible'
  ) THEN
    ALTER TABLE stock_ubicaciones
      ADD CONSTRAINT chk_stock_ubicaciones_comprometido_disponible
      CHECK (stock_comprometido <= cantidad_disponible) NOT VALID;
  END IF;
END $$;

COMMENT ON COLUMN stock_ubicaciones.stock_comprometido IS
  'Stock fisico reservado por transferencias aprobadas y aun no despachadas. No se usa para ordenes de compra.';

-- ============================================================
-- Condiciones comerciales por proveedor-producto.
-- ============================================================
ALTER TABLE proveedor_producto
  ADD COLUMN IF NOT EXISTS cantidad_minima_compra integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS multiplo_empaque integer NOT NULL DEFAULT 1;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_proveedor_producto_cantidad_minima_compra'
  ) THEN
    ALTER TABLE proveedor_producto
      ADD CONSTRAINT chk_proveedor_producto_cantidad_minima_compra
      CHECK (cantidad_minima_compra > 0) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_proveedor_producto_multiplo_empaque'
  ) THEN
    ALTER TABLE proveedor_producto
      ADD CONSTRAINT chk_proveedor_producto_multiplo_empaque
      CHECK (multiplo_empaque > 0) NOT VALID;
  END IF;
END $$;

COMMENT ON COLUMN proveedor_producto.cantidad_minima_compra IS
  'Cantidad minima de compra exigida por el proveedor para este producto.';
COMMENT ON COLUMN proveedor_producto.multiplo_empaque IS
  'Multiplo de empaque exigido por el proveedor para este producto.';

-- ============================================================
-- Predicciones ML: multiempresa, estrategia y madurez reales.
-- ============================================================
ALTER TABLE predicciones_ml
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizaciones(id),
  ADD COLUMN IF NOT EXISTS intervalo_sup float,
  ADD COLUMN IF NOT EXISTS estrategia text,
  ADD COLUMN IF NOT EXISTS nivel_madurez text;

UPDATE predicciones_ml p
SET org_id = b.org_id
FROM boticas b
WHERE p.org_id IS NULL
  AND p.botica_id = b.id;

UPDATE predicciones_ml
SET intervalo_sup = intervalosup
WHERE intervalo_sup IS NULL
  AND intervalosup IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_predicciones_ml_unica_serie_periodo
  ON predicciones_ml (org_id, botica_id, producto_id, modelo_version_id, periodo_inicio)
  WHERE org_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_predicciones_ml_org ON predicciones_ml(org_id);
CREATE INDEX IF NOT EXISTS idx_predicciones_ml_org_botica_producto
  ON predicciones_ml(org_id, botica_id, producto_id);

-- ============================================================
-- Recomendaciones ML: detalle requerido por motor de recomendacion.
-- Se conservan columnas existentes para compatibilidad.
-- ============================================================
ALTER TABLE recomendaciones_ml
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizaciones(id),
  ADD COLUMN IF NOT EXISTS botica_id uuid REFERENCES boticas(id),
  ADD COLUMN IF NOT EXISTS proveedor_id uuid REFERENCES proveedores(id),
  ADD COLUMN IF NOT EXISTS modelo_version_id uuid REFERENCES modelos_ml(id),
  ADD COLUMN IF NOT EXISTS stock_disponible float,
  ADD COLUMN IF NOT EXISTS stock_comprometido float,
  ADD COLUMN IF NOT EXISTS stock_en_transito float,
  ADD COLUMN IF NOT EXISTS stock_por_recibir float,
  ADD COLUMN IF NOT EXISTS stock_seguridad float,
  ADD COLUMN IF NOT EXISTS demanda_durante_lead_time float,
  ADD COLUMN IF NOT EXISTS cantidad_base float,
  ADD COLUMN IF NOT EXISTS cantidad_minima_compra integer,
  ADD COLUMN IF NOT EXISTS multiplo_empaque integer,
  ADD COLUMN IF NOT EXISTS cantidad_final float,
  ADD COLUMN IF NOT EXISTS lead_time_dias integer,
  ADD COLUMN IF NOT EXISTS precio_referencial numeric(10,2),
  ADD COLUMN IF NOT EXISTS estrategia text,
  ADD COLUMN IF NOT EXISTS nivel_madurez text,
  ADD COLUMN IF NOT EXISTS datos_jsonb jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS motivo_rechazo text;

UPDATE recomendaciones_ml r
SET org_id = b.org_id
FROM boticas b
WHERE r.org_id IS NULL
  AND r.botica_destino_id = b.id;

UPDATE recomendaciones_ml
SET botica_id = botica_destino_id
WHERE botica_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_recomendaciones_ml_org ON recomendaciones_ml(org_id);
CREATE INDEX IF NOT EXISTS idx_recomendaciones_ml_org_estado ON recomendaciones_ml(org_id, estado);
CREATE INDEX IF NOT EXISTS idx_recomendaciones_ml_org_producto_botica
  ON recomendaciones_ml(org_id, producto_id, botica_id);

-- ============================================================
-- Inferencias, alertas y drift con scope de organizacion.
-- ============================================================
ALTER TABLE inferencias
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizaciones(id),
  ADD COLUMN IF NOT EXISTS estrategia text,
  ADD COLUMN IF NOT EXISTS nivel_madurez text;

UPDATE inferencias i
SET org_id = b.org_id
FROM boticas b
WHERE i.org_id IS NULL
  AND i.botica_id = b.id;

CREATE INDEX IF NOT EXISTS idx_inferencias_org ON inferencias(org_id);

ALTER TABLE alertas_ml
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizaciones(id),
  ADD COLUMN IF NOT EXISTS modelo_version_id uuid REFERENCES modelos_ml(id),
  ADD COLUMN IF NOT EXISTS mensaje text,
  ADD COLUMN IF NOT EXISTS datos_jsonb jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE alertas_ml a
SET org_id = b.org_id
FROM boticas b
WHERE a.org_id IS NULL
  AND a.botica_id = b.id;

CREATE INDEX IF NOT EXISTS idx_alertas_ml_org ON alertas_ml(org_id);

ALTER TABLE drift_metricas
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizaciones(id),
  ADD COLUMN IF NOT EXISTS alerta_critica boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS datos_jsonb jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_drift_metricas_org ON drift_metricas(org_id);

-- ============================================================
-- Trabajos de reentrenamiento ML.
-- ============================================================
CREATE TABLE IF NOT EXISTS reentrenamientos_ml (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid REFERENCES organizaciones(id),
  job_id        uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  alcance       text NOT NULL DEFAULT 'GLOBAL',
  estado        text NOT NULL DEFAULT 'PENDIENTE',
  forzar        boolean NOT NULL DEFAULT false,
  mensaje       text,
  datos_jsonb   jsonb NOT NULL DEFAULT '{}'::jsonb,
  creado_en     timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE reentrenamientos_ml ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_reentrenamientos_ml_org ON reentrenamientos_ml(org_id);
CREATE INDEX IF NOT EXISTS idx_reentrenamientos_ml_estado ON reentrenamientos_ml(estado);

DROP POLICY IF EXISTS "admin_full_access" ON reentrenamientos_ml;
DROP POLICY IF EXISTS "operador_select_reentrenamientos" ON reentrenamientos_ml;
DROP POLICY IF EXISTS "visor_select_reentrenamientos" ON reentrenamientos_ml;

CREATE POLICY "admin_full_access" ON reentrenamientos_ml FOR ALL
  USING (
    obtener_rol_usuario() = 'super_admin'
    OR (obtener_rol_usuario() = 'admin_central' AND (org_id IS NULL OR org_id = obtener_org_usuario()))
  );

CREATE POLICY "operador_select_reentrenamientos" ON reentrenamientos_ml FOR SELECT
  USING (obtener_rol_usuario() = 'operador_drogueria' AND (org_id IS NULL OR org_id = obtener_org_usuario()));

CREATE POLICY "visor_select_reentrenamientos" ON reentrenamientos_ml FOR SELECT
  USING (obtener_rol_usuario() = 'visor_botica' AND (org_id IS NULL OR org_id = obtener_org_usuario()));

COMMIT;
