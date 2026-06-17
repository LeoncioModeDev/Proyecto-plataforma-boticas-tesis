BEGIN;

-- ============================================================
-- 1. Renombrar estado 'completada' → 'recibida'
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'estado_orden_compra' AND e.enumlabel = 'completada') THEN
    ALTER TYPE estado_orden_compra RENAME VALUE 'completada' TO 'recibida';
  END IF;
END $$;

-- ============================================================
-- 2. Agregar nuevos estados
-- ============================================================
ALTER TYPE estado_orden_compra ADD VALUE IF NOT EXISTS 'cancelada';
ALTER TYPE estado_orden_compra ADD VALUE IF NOT EXISTS 'recibida_parcial';
ALTER TYPE estado_orden_compra ADD VALUE IF NOT EXISTS 'recibida_con_observacion';

-- ============================================================
-- 3. Agregar fecha_real_entrega a ordenes_compra
-- ============================================================
ALTER TABLE ordenes_compra ADD COLUMN IF NOT EXISTS fecha_real_entrega date;

-- ============================================================
-- 4. Renombrar precio_compra → precio_compra_referencial
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'proveedor_producto' AND column_name = 'precio_compra') THEN
    ALTER TABLE proveedor_producto RENAME COLUMN precio_compra TO precio_compra_referencial;
  END IF;
END $$;

-- ============================================================
-- 5. Agregar stock_por_recibir a stock_ubicaciones
-- ============================================================
ALTER TABLE stock_ubicaciones ADD COLUMN IF NOT EXISTS stock_por_recibir int NOT NULL DEFAULT 0;

-- ============================================================
-- 6. Tabla: recepciones_orden (cabecera de recepción)
-- ============================================================
CREATE TABLE IF NOT EXISTS recepciones_orden (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_compra_id   uuid NOT NULL REFERENCES ordenes_compra(id),
  fecha_recepcion   timestamptz NOT NULL DEFAULT now(),
  observacion       text,
  registrado_por    uuid NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recepciones_orden_oc ON recepciones_orden(orden_compra_id);

-- ============================================================
-- 7. Tabla: recepcion_items (detalle de recepción)
-- ============================================================
CREATE TABLE IF NOT EXISTS recepcion_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recepcion_id        uuid NOT NULL REFERENCES recepciones_orden(id),
  producto_id         uuid NOT NULL REFERENCES productos(id),
  lote_id             uuid REFERENCES lotes(id),
  cantidad_solicitada int NOT NULL,
  cantidad_recibida   int NOT NULL,
  cantidad_devuelta   int NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recepcion_items_recepcion ON recepcion_items(recepcion_id);

-- ============================================================
-- 8. Actualizar trigger actualizar_stock para manejar stock_por_recibir
-- ============================================================
CREATE OR REPLACE FUNCTION actualizar_stock()
RETURNS trigger AS $$
BEGIN
  IF NEW.tipo_movimiento IN ('entrada', 'devolucion') THEN
    UPDATE stock_ubicaciones
    SET cantidad_disponible = cantidad_disponible + NEW.cantidad,
        stock_por_recibir = GREATEST(stock_por_recibir - NEW.cantidad, 0),
        updated_at = now()
    WHERE producto_id = NEW.producto_id
      AND ubicacion_tipo = NEW.ubicacion_tipo
      AND (ubicacion_id IS NOT DISTINCT FROM NEW.ubicacion_id);
  ELSIF NEW.tipo_movimiento IN ('salida', 'merma') THEN
    UPDATE stock_ubicaciones
    SET cantidad_disponible = GREATEST(cantidad_disponible - NEW.cantidad, 0),
        updated_at = now()
    WHERE producto_id = NEW.producto_id
      AND ubicacion_tipo = NEW.ubicacion_tipo
      AND (ubicacion_id IS NOT DISTINCT FROM NEW.ubicacion_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 9. RLS para nuevas tablas
-- ============================================================
ALTER TABLE recepciones_orden ENABLE ROW LEVEL SECURITY;
ALTER TABLE recepcion_items ENABLE ROW LEVEL SECURITY;

-- recepciones_orden policies
DROP POLICY IF EXISTS "admin_full_access" ON recepciones_orden;
CREATE POLICY "admin_full_access" ON recepciones_orden FOR ALL
  USING (obtener_rol_usuario() IN ('super_admin', 'admin_central'));

DROP POLICY IF EXISTS "operador_recepciones" ON recepciones_orden;
CREATE POLICY "operador_recepciones" ON recepciones_orden FOR ALL
  USING (obtener_rol_usuario() = 'operador_drogueria'
    AND EXISTS (SELECT 1 FROM ordenes_compra oc
      JOIN proveedores p ON p.id = oc.proveedor_id
      WHERE oc.id = recepciones_orden.orden_compra_id AND p.org_id = obtener_org_usuario()));

DROP POLICY IF EXISTS "visor_select_recepciones" ON recepciones_orden;
CREATE POLICY "visor_select_recepciones" ON recepciones_orden FOR SELECT
  USING (obtener_rol_usuario() = 'visor_botica');

-- recepcion_items policies
DROP POLICY IF EXISTS "admin_full_access" ON recepcion_items;
CREATE POLICY "admin_full_access" ON recepcion_items FOR ALL
  USING (obtener_rol_usuario() IN ('super_admin', 'admin_central'));

DROP POLICY IF EXISTS "operador_recepcion_items" ON recepcion_items;
CREATE POLICY "operador_recepcion_items" ON recepcion_items FOR ALL
  USING (obtener_rol_usuario() = 'operador_drogueria');

DROP POLICY IF EXISTS "visor_select_recepcion_items" ON recepcion_items;
CREATE POLICY "visor_select_recepcion_items" ON recepcion_items FOR SELECT
  USING (obtener_rol_usuario() = 'visor_botica');

COMMIT;
