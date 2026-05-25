-- ============================================================
-- RLS Phase 2: Row-Level Security por rol y scope
-- Ejecutar DESPUÉS de migracion.sql
-- Roles:
--   admin_central       → CRUD global (todo)
--   operador_drogueria  → CRUD dentro de su organización
--   visor_botica        → SELECT dentro de su org + botica
-- ============================================================

-- ============================================================
-- 1. Helper functions
-- ============================================================

-- Extraer rol del JWT (app_metadata con fallback a user_metadata)
CREATE OR REPLACE FUNCTION public.obtener_rol_usuario()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::jsonb
      -> 'app_metadata'
      ->> 'rol',
    current_setting('request.jwt.claims', true)::jsonb
      -> 'user_metadata'
      ->> 'rol',
    ''
  );
$$;

-- Org del usuario actual (JWT app_metadata → fallback a public.usuarios)
CREATE OR REPLACE FUNCTION public.obtener_org_usuario()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::jsonb
      -> 'app_metadata'
      ->> 'org_id')::uuid,
    (SELECT org_id FROM public.usuarios WHERE id = auth.uid())
  );
$$;

-- Botica asignada al usuario (nullable — solo visor_botica tiene una)
CREATE OR REPLACE FUNCTION public.obtener_botica_usuario()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::jsonb
      -> 'app_metadata'
      ->> 'botica_id')::uuid,
    (SELECT botica_id FROM public.usuarios WHERE id = auth.uid())
  );
$$;

-- ============================================================
-- 2. Habilitar RLS en todas las tablas
-- ============================================================
ALTER TABLE organizaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE ubigeos ENABLE ROW LEVEL SECURITY;
ALTER TABLE paises ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE boticas ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE precios ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_ubicaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE transferencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE transferencias_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordenes_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordenes_compra_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE modelos_ml ENABLE ROW LEVEL SECURITY;
ALTER TABLE predicciones_ml ENABLE ROW LEVEL SECURITY;
ALTER TABLE inferencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE drift_metricas ENABLE ROW LEVEL SECURITY;
ALTER TABLE alertas_ml ENABLE ROW LEVEL SECURITY;
ALTER TABLE recomendaciones_ml ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. Políticas — Tablas globales de referencia
-- ============================================================

-- ubigeos
DROP POLICY IF EXISTS "admin_full_access" ON ubigeos;
DROP POLICY IF EXISTS "lectura_autenticados" ON ubigeos;
CREATE POLICY "admin_full_access" ON ubigeos FOR ALL
  USING (obtener_rol_usuario() = 'admin_central');
CREATE POLICY "lectura_autenticados" ON ubigeos FOR SELECT
  USING (auth.role() = 'authenticated');

-- paises
DROP POLICY IF EXISTS "admin_full_access" ON paises;
DROP POLICY IF EXISTS "lectura_autenticados" ON paises;
CREATE POLICY "admin_full_access" ON paises FOR ALL
  USING (obtener_rol_usuario() = 'admin_central');
CREATE POLICY "lectura_autenticados" ON paises FOR SELECT
  USING (auth.role() = 'authenticated');

-- ============================================================
-- 4. organizaciones
-- admin: CRUD | operador: SELECT propia | visor: SELECT propia
-- ============================================================
DROP POLICY IF EXISTS "admin_full_access" ON organizaciones;
DROP POLICY IF EXISTS "lectura_autenticados" ON organizaciones;
CREATE POLICY "admin_full_access" ON organizaciones FOR ALL
  USING (obtener_rol_usuario() = 'admin_central');
CREATE POLICY "operador_select_org" ON organizaciones FOR SELECT
  USING (obtener_rol_usuario() = 'operador_drogueria' AND id = obtener_org_usuario());
CREATE POLICY "visor_select_org" ON organizaciones FOR SELECT
  USING (obtener_rol_usuario() = 'visor_botica' AND id = obtener_org_usuario());

-- ============================================================
-- 5. usuarios
-- admin: CRUD | operador: CRUD (misma org) | visor: SELECT self
-- ============================================================
DROP POLICY IF EXISTS "admin_full_access" ON usuarios;
DROP POLICY IF EXISTS "lectura_autenticados" ON usuarios;
DROP POLICY IF EXISTS "self_update" ON usuarios;
CREATE POLICY "admin_full_access" ON usuarios FOR ALL
  USING (obtener_rol_usuario() = 'admin_central');
CREATE POLICY "operador_usuarios" ON usuarios FOR ALL
  USING (obtener_rol_usuario() = 'operador_drogueria' AND org_id = obtener_org_usuario());
CREATE POLICY "visor_select_self" ON usuarios FOR SELECT
  USING (obtener_rol_usuario() = 'visor_botica' AND id = auth.uid());
CREATE POLICY "self_update" ON usuarios FOR UPDATE
  USING (auth.uid() = id);

-- ============================================================
-- 6. boticas
-- admin: CRUD | operador: CRUD (misma org) | visor: SELECT propia
-- ============================================================
DROP POLICY IF EXISTS "admin_full_access" ON boticas;
DROP POLICY IF EXISTS "lectura_autenticados" ON boticas;
CREATE POLICY "admin_full_access" ON boticas FOR ALL
  USING (obtener_rol_usuario() = 'admin_central');
CREATE POLICY "operador_boticas" ON boticas FOR ALL
  USING (obtener_rol_usuario() = 'operador_drogueria' AND org_id = obtener_org_usuario());
CREATE POLICY "visor_select_botica" ON boticas FOR SELECT
  USING (obtener_rol_usuario() = 'visor_botica' AND id = obtener_botica_usuario());

-- ============================================================
-- 7. productos
-- admin: CRUD | operador: CRUD (misma org) | visor: SELECT (misma org)
-- ============================================================
DROP POLICY IF EXISTS "admin_full_access" ON productos;
DROP POLICY IF EXISTS "lectura_autenticados" ON productos;
CREATE POLICY "admin_full_access" ON productos FOR ALL
  USING (obtener_rol_usuario() = 'admin_central');
CREATE POLICY "operador_productos" ON productos FOR ALL
  USING (obtener_rol_usuario() = 'operador_drogueria' AND org_id = obtener_org_usuario());
CREATE POLICY "visor_select_productos" ON productos FOR SELECT
  USING (obtener_rol_usuario() = 'visor_botica' AND org_id = obtener_org_usuario());

-- ============================================================
-- 8. proveedores
-- admin: CRUD | operador: CRUD (misma org) | visor: SELECT (misma org)
-- ============================================================
DROP POLICY IF EXISTS "admin_full_access" ON proveedores;
DROP POLICY IF EXISTS "lectura_autenticados" ON proveedores;
CREATE POLICY "admin_full_access" ON proveedores FOR ALL
  USING (obtener_rol_usuario() = 'admin_central');
CREATE POLICY "operador_proveedores" ON proveedores FOR ALL
  USING (obtener_rol_usuario() = 'operador_drogueria' AND org_id = obtener_org_usuario());
CREATE POLICY "visor_select_proveedores" ON proveedores FOR SELECT
  USING (obtener_rol_usuario() = 'visor_botica' AND org_id = obtener_org_usuario());

-- ============================================================
-- 9. stock_ubicaciones
-- admin: CRUD | operador: CRUD (org) | visor: SELECT (su botica)
-- ============================================================
DROP POLICY IF EXISTS "admin_full_access" ON stock_ubicaciones;
DROP POLICY IF EXISTS "lectura_autenticados" ON stock_ubicaciones;
CREATE POLICY "admin_full_access" ON stock_ubicaciones FOR ALL
  USING (obtener_rol_usuario() = 'admin_central');
CREATE POLICY "operador_stock" ON stock_ubicaciones FOR ALL
  USING (obtener_rol_usuario() = 'operador_drogueria'
    AND EXISTS (SELECT 1 FROM boticas WHERE id = ubicacion_id AND org_id = obtener_org_usuario()));
CREATE POLICY "visor_select_stock" ON stock_ubicaciones FOR SELECT
  USING (obtener_rol_usuario() = 'visor_botica' AND ubicacion_id = obtener_botica_usuario());

-- ============================================================
-- 10. lotes
-- admin: CRUD | operador: CRUD (org) | visor: SELECT (su botica)
-- ============================================================
DROP POLICY IF EXISTS "admin_full_access" ON lotes;
DROP POLICY IF EXISTS "lectura_autenticados" ON lotes;
CREATE POLICY "admin_full_access" ON lotes FOR ALL
  USING (obtener_rol_usuario() = 'admin_central');
CREATE POLICY "operador_lotes" ON lotes FOR ALL
  USING (obtener_rol_usuario() = 'operador_drogueria'
    AND EXISTS (SELECT 1 FROM boticas WHERE id = ubicacion_id AND org_id = obtener_org_usuario()));
CREATE POLICY "visor_select_lotes" ON lotes FOR SELECT
  USING (obtener_rol_usuario() = 'visor_botica' AND ubicacion_id = obtener_botica_usuario());

-- ============================================================
-- 11. movimientos_inventario
-- admin: CRUD | operador: CRUD (org) | visor: SELECT (su botica)
-- ============================================================
DROP POLICY IF EXISTS "admin_full_access" ON movimientos_inventario;
DROP POLICY IF EXISTS "lectura_autenticados" ON movimientos_inventario;
CREATE POLICY "admin_full_access" ON movimientos_inventario FOR ALL
  USING (obtener_rol_usuario() = 'admin_central');
CREATE POLICY "operador_movimientos" ON movimientos_inventario FOR ALL
  USING (obtener_rol_usuario() = 'operador_drogueria'
    AND EXISTS (SELECT 1 FROM boticas WHERE id = ubicacion_id AND org_id = obtener_org_usuario()));
CREATE POLICY "visor_select_movimientos" ON movimientos_inventario FOR SELECT
  USING (obtener_rol_usuario() = 'visor_botica' AND ubicacion_id = obtener_botica_usuario());

-- ============================================================
-- 12. transferencias
-- admin: CRUD | operador: CRUD (org) | visor: SELECT (su botica)
-- ============================================================
DROP POLICY IF EXISTS "admin_full_access" ON transferencias;
DROP POLICY IF EXISTS "lectura_autenticados" ON transferencias;
CREATE POLICY "admin_full_access" ON transferencias FOR ALL
  USING (obtener_rol_usuario() = 'admin_central');
CREATE POLICY "operador_transferencias" ON transferencias FOR ALL
  USING (obtener_rol_usuario() = 'operador_drogueria'
    AND (EXISTS (SELECT 1 FROM boticas WHERE id = origen_id  AND org_id = obtener_org_usuario())
      OR EXISTS (SELECT 1 FROM boticas WHERE id = destino_id AND org_id = obtener_org_usuario())));
CREATE POLICY "visor_select_transferencias" ON transferencias FOR SELECT
  USING (obtener_rol_usuario() = 'visor_botica'
    AND (origen_id = obtener_botica_usuario() OR destino_id = obtener_botica_usuario()));

-- ============================================================
-- 13. transferencias_items
-- admin: CRUD | operador: CRUD (org vía transferencia) | visor: SELECT (su botica)
-- ============================================================
DROP POLICY IF EXISTS "admin_full_access" ON transferencias_items;
DROP POLICY IF EXISTS "lectura_autenticados" ON transferencias_items;
CREATE POLICY "admin_full_access" ON transferencias_items FOR ALL
  USING (obtener_rol_usuario() = 'admin_central');
CREATE POLICY "operador_transferencias_items" ON transferencias_items FOR ALL
  USING (obtener_rol_usuario() = 'operador_drogueria'
    AND EXISTS (SELECT 1 FROM transferencias t
      WHERE t.id = transferencia_id
        AND (EXISTS (SELECT 1 FROM boticas WHERE id = t.origen_id  AND org_id = obtener_org_usuario())
          OR EXISTS (SELECT 1 FROM boticas WHERE id = t.destino_id AND org_id = obtener_org_usuario()))));
CREATE POLICY "visor_select_transferencias_items" ON transferencias_items FOR SELECT
  USING (obtener_rol_usuario() = 'visor_botica'
    AND EXISTS (SELECT 1 FROM transferencias t
      WHERE t.id = transferencia_id
        AND (t.origen_id = obtener_botica_usuario() OR t.destino_id = obtener_botica_usuario())));

-- ============================================================
-- 14. precios
-- admin: CRUD | operador: CRUD (org vía producto) | visor: SELECT (su botica o global)
-- ============================================================
DROP POLICY IF EXISTS "admin_full_access" ON precios;
DROP POLICY IF EXISTS "lectura_autenticados" ON precios;
CREATE POLICY "admin_full_access" ON precios FOR ALL
  USING (obtener_rol_usuario() = 'admin_central');
CREATE POLICY "operador_precios" ON precios FOR ALL
  USING (obtener_rol_usuario() = 'operador_drogueria'
    AND EXISTS (SELECT 1 FROM productos WHERE id = producto_id AND org_id = obtener_org_usuario()));
CREATE POLICY "visor_select_precios" ON precios FOR SELECT
  USING (obtener_rol_usuario() = 'visor_botica'
    AND (botica_id = obtener_botica_usuario() OR botica_id IS NULL));

-- ============================================================
-- 15. ordenes_compra
-- admin: CRUD | operador: CRUD (org vía proveedor) | visor: sin acceso
-- ============================================================
DROP POLICY IF EXISTS "admin_full_access" ON ordenes_compra;
DROP POLICY IF EXISTS "lectura_autenticados" ON ordenes_compra;
CREATE POLICY "admin_full_access" ON ordenes_compra FOR ALL
  USING (obtener_rol_usuario() = 'admin_central');
CREATE POLICY "operador_oc" ON ordenes_compra FOR ALL
  USING (obtener_rol_usuario() = 'operador_drogueria'
    AND EXISTS (SELECT 1 FROM proveedores WHERE id = proveedor_id AND org_id = obtener_org_usuario()));

-- ============================================================
-- 16. ordenes_compra_items
-- admin: CRUD | operador: CRUD (org vía OC → proveedor) | visor: sin acceso
-- ============================================================
DROP POLICY IF EXISTS "admin_full_access" ON ordenes_compra_items;
DROP POLICY IF EXISTS "lectura_autenticados" ON ordenes_compra_items;
CREATE POLICY "admin_full_access" ON ordenes_compra_items FOR ALL
  USING (obtener_rol_usuario() = 'admin_central');
CREATE POLICY "operador_oc_items" ON ordenes_compra_items FOR ALL
  USING (obtener_rol_usuario() = 'operador_drogueria'
    AND EXISTS (SELECT 1 FROM ordenes_compra oc
      JOIN proveedores p ON p.id = oc.proveedor_id
      WHERE oc.id = orden_compra_id AND p.org_id = obtener_org_usuario()));

-- ============================================================
-- 17. modelos_ml (globales — no tienen org_id)
-- admin: CRUD | operador: SELECT | visor: SELECT
-- ============================================================
DROP POLICY IF EXISTS "admin_full_access" ON modelos_ml;
DROP POLICY IF EXISTS "lectura_autenticados" ON modelos_ml;
CREATE POLICY "admin_full_access" ON modelos_ml FOR ALL
  USING (obtener_rol_usuario() = 'admin_central');
CREATE POLICY "operador_select_modelos" ON modelos_ml FOR SELECT
  USING (obtener_rol_usuario() = 'operador_drogueria');
CREATE POLICY "visor_select_modelos" ON modelos_ml FOR SELECT
  USING (obtener_rol_usuario() = 'visor_botica');

-- ============================================================
-- 18. predicciones_ml
-- admin: CRUD | operador: CRUD (org vía botica) | visor: SELECT (su botica)
-- ============================================================
DROP POLICY IF EXISTS "admin_full_access" ON predicciones_ml;
DROP POLICY IF EXISTS "lectura_autenticados" ON predicciones_ml;
CREATE POLICY "admin_full_access" ON predicciones_ml FOR ALL
  USING (obtener_rol_usuario() = 'admin_central');
CREATE POLICY "operador_predicciones" ON predicciones_ml FOR ALL
  USING (obtener_rol_usuario() = 'operador_drogueria'
    AND EXISTS (SELECT 1 FROM boticas WHERE id = botica_id AND org_id = obtener_org_usuario()));
CREATE POLICY "visor_select_predicciones" ON predicciones_ml FOR SELECT
  USING (obtener_rol_usuario() = 'visor_botica' AND botica_id = obtener_botica_usuario());

-- ============================================================
-- 19. inferencias
-- admin: CRUD | operador: CRUD (org vía botica) | visor: SELECT (su botica)
-- ============================================================
DROP POLICY IF EXISTS "admin_full_access" ON inferencias;
DROP POLICY IF EXISTS "lectura_autenticados" ON inferencias;
CREATE POLICY "admin_full_access" ON inferencias FOR ALL
  USING (obtener_rol_usuario() = 'admin_central');
CREATE POLICY "operador_inferencias" ON inferencias FOR ALL
  USING (obtener_rol_usuario() = 'operador_drogueria'
    AND EXISTS (SELECT 1 FROM boticas WHERE id = botica_id AND org_id = obtener_org_usuario()));
CREATE POLICY "visor_select_inferencias" ON inferencias FOR SELECT
  USING (obtener_rol_usuario() = 'visor_botica' AND botica_id = obtener_botica_usuario());

-- ============================================================
-- 20. drift_metricas (globales — vía modelo_version_id)
-- admin: CRUD | operador: SELECT | visor: SELECT
-- ============================================================
DROP POLICY IF EXISTS "admin_full_access" ON drift_metricas;
DROP POLICY IF EXISTS "lectura_autenticados" ON drift_metricas;
CREATE POLICY "admin_full_access" ON drift_metricas FOR ALL
  USING (obtener_rol_usuario() = 'admin_central');
CREATE POLICY "operador_select_drift" ON drift_metricas FOR SELECT
  USING (obtener_rol_usuario() = 'operador_drogueria');
CREATE POLICY "visor_select_drift" ON drift_metricas FOR SELECT
  USING (obtener_rol_usuario() = 'visor_botica');

-- ============================================================
-- 21. alertas_ml
-- admin: CRUD | operador: CRUD (org vía botica) | visor: SELECT (su botica)
-- ============================================================
DROP POLICY IF EXISTS "admin_full_access" ON alertas_ml;
DROP POLICY IF EXISTS "lectura_autenticados" ON alertas_ml;
CREATE POLICY "admin_full_access" ON alertas_ml FOR ALL
  USING (obtener_rol_usuario() = 'admin_central');
CREATE POLICY "operador_alertas" ON alertas_ml FOR ALL
  USING (obtener_rol_usuario() = 'operador_drogueria'
    AND EXISTS (SELECT 1 FROM boticas WHERE id = botica_id AND org_id = obtener_org_usuario()));
CREATE POLICY "visor_select_alertas" ON alertas_ml FOR SELECT
  USING (obtener_rol_usuario() = 'visor_botica' AND botica_id = obtener_botica_usuario());

-- ============================================================
-- 22. recomendaciones_ml
-- admin: CRUD | operador: CRUD (org vía botica) | visor: SELECT (su botica)
-- ============================================================
DROP POLICY IF EXISTS "admin_full_access" ON recomendaciones_ml;
DROP POLICY IF EXISTS "lectura_autenticados" ON recomendaciones_ml;
CREATE POLICY "admin_full_access" ON recomendaciones_ml FOR ALL
  USING (obtener_rol_usuario() = 'admin_central');
CREATE POLICY "operador_recomendaciones" ON recomendaciones_ml FOR ALL
  USING (obtener_rol_usuario() = 'operador_drogueria'
    AND EXISTS (SELECT 1 FROM boticas WHERE id = botica_destino_id AND org_id = obtener_org_usuario()));
CREATE POLICY "visor_select_recomendaciones" ON recomendaciones_ml FOR SELECT
  USING (obtener_rol_usuario() = 'visor_botica'
    AND (botica_destino_id = obtener_botica_usuario() OR botica_origen_id = obtener_botica_usuario()));

-- ============================================================
-- 23. Nota: el trigger actualizar_stock usa SECURITY DEFINER,
--     por lo que funciona incluso con RLS habilitado.
-- ============================================================
