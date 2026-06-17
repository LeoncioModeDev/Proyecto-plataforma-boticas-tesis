# Plan: Fixes + Multitenant (org_id)

## 1. Fix movimientos.js — quitar join sin FK

**File**: `src/services/supabase/movimientos.js`

**Problem**: `perfiles:usuario_id (nombre_completo)` en el SELECT falla porque `movimientos_inventario.usuario_id` no tiene REFERENCES a ninguna tabla.

**Changes**:
- Línea 17: cambiar `nombreUsuario: item.perfiles?.nombre_completo || item.usuario_id` → `nombreUsuario: item.usuario_id`
- Línea 34: eliminar `perfiles:usuario_id (nombre_completo)` del SELECT

```js
const MAPEAR_MOVIMIENTO = (item) => ({
  id: item.id,
  tipo: item.tipo_movimiento,
  productoId: item.producto_id,
  loteId: item.lote_id,
  ubicacionTipo: item.ubicacion_tipo,
  ubicacionId: item.ubicacion_id,
  cantidad: item.cantidad,
  motivo: item.motivo,
  usuarioId: item.usuario_id,
  transferenciaId: item.transferencia_id,
  createdAt: item.created_at,
  nombreProducto: item.productos?.nombre_comercial || item.producto_id,
  nombreUbicacion: item.boticas?.nombre || item.ubicacion_id || 'Droguería Central',
  nombreUsuario: item.usuario_id,
})

const SELECCION = `
  id,
  tipo_movimiento,
  producto_id,
  lote_id,
  ubicacion_tipo,
  ubicacion_id,
  cantidad,
  motivo,
  usuario_id,
  transferencia_id,
  created_at,
  productos:producto_id (nombre_comercial),
  boticas:ubicacion_id (nombre)
`
```

---

## 2. Fix ordenes-compra/index.ts — anidar monedas dentro de proveedores

**File**: `supabase/functions/ordenes-compra/index.ts`

**Problem**: La sintaxis `proveedores.monedas(id, codigo, simbolo)` como línea separada no es válida. `monedas` debe ir anidado DENTRO de `proveedores!inner(...)`. Además, cambiar de filtrar por `proveedores.org_id` a usar `ordenes_compra.org_id` directo (nueva columna que agregaremos).

**Changes in `listarOC` (líneas 107-116)**:
```ts
let query = supabase
    .from("ordenes_compra")
    .select(`
      *,
      proveedores!inner(
        id, razon_social,
        monedas!moneda_id(id, codigo, simbolo)
      ),
      ordenes_compra_items(*, productos(id, nombre_comercial))
    `)
    .eq("org_id", perfil.org_id)
    .order("created_at", { ascending: false });
```

**Changes in `obtenerOC` (líneas 139-153)**:
```ts
async function obtenerOC(supabase: any, perfil: PerfilUsuario, id: string) {
  const { data, error } = await supabase
    .from("ordenes_compra")
    .select(`
      *,
      proveedores!inner(
        id, razon_social,
        monedas!moneda_id(id, codigo, simbolo)
      ),
      ordenes_compra_items(*, productos(id, nombre_comercial)),
      recepciones_orden(
        *,
        recepcion_items(*, productos(id, nombre_comercial), lotes(id, numero_lote, fecha_vencimiento))
      )
    `)
    .eq("id", id)
    .eq("org_id", perfil.org_id)
    .single();

  if (error) return json({ error: error.message }, 404);

  return json({ datos: normalizarOC(data) });
}
```

**Changes in `crearOC` — agregar `org_id` al INSERT**:
```ts
const { data: oc, error: errOC } = await supabase
    .from("ordenes_compra")
    .insert({
      proveedor_id,
      creado_por: perfil.id,
      org_id: perfil.org_id,  // <-- NUEVO
      estado: "pendiente",
      fecha_estimada_entrega,
      observaciones: observaciones || null,
    })
    .select("id")
    .single();
```

---

## 3. Nueva migración: 00000000000002_multitenant.sql

**File**: `supabase/migrations/00000000000002_multitenant.sql`

Agrega `org_id` a las tablas principales y simplifica RLS policies.

```sql
BEGIN;

-- ============================================================
-- 1. Agregar org_id a tablas principales
-- ============================================================

-- Antes de agregar NOT NULL, se necesita un valor por defecto.
-- Asumimos que existe al menos una organización. Si hay datos
-- existentes, se migran con la primera org encontrada.
-- En producción, ajustar manualmente el org_id según cada registro.

DO $$
DECLARE
  v_org_id uuid;
BEGIN
  SELECT id INTO v_org_id FROM organizaciones LIMIT 1;

  -- ordenes_compra
  ALTER TABLE ordenes_compra ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizaciones(id);
  IF v_org_id IS NOT NULL THEN
    UPDATE ordenes_compra SET org_id = v_org_id WHERE org_id IS NULL;
  END IF;
  ALTER TABLE ordenes_compra ALTER COLUMN org_id SET NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_oc_org ON ordenes_compra(org_id);

  -- stock_ubicaciones
  ALTER TABLE stock_ubicaciones ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizaciones(id);
  IF v_org_id IS NOT NULL THEN
    UPDATE stock_ubicaciones SET org_id = v_org_id WHERE org_id IS NULL;
  END IF;
  ALTER TABLE stock_ubicaciones ALTER COLUMN org_id SET NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_stock_org ON stock_ubicaciones(org_id);

  -- lotes
  ALTER TABLE lotes ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizaciones(id);
  IF v_org_id IS NOT NULL THEN
    UPDATE lotes SET org_id = v_org_id WHERE org_id IS NULL;
  END IF;
  ALTER TABLE lotes ALTER COLUMN org_id SET NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_lotes_org ON lotes(org_id);

  -- movimientos_inventario
  ALTER TABLE movimientos_inventario ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizaciones(id);
  IF v_org_id IS NOT NULL THEN
    UPDATE movimientos_inventario SET org_id = v_org_id WHERE org_id IS NULL;
  END IF;
  ALTER TABLE movimientos_inventario ALTER COLUMN org_id SET NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_movimientos_org ON movimientos_inventario(org_id);

  -- recepciones_orden
  ALTER TABLE recepciones_orden ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizaciones(id);
  IF v_org_id IS NOT NULL THEN
    UPDATE recepciones_orden SET org_id = v_org_id WHERE org_id IS NULL;
  END IF;
  ALTER TABLE recepciones_orden ALTER COLUMN org_id SET NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_recepciones_org ON recepciones_orden(org_id);

  -- recepcion_items
  ALTER TABLE recepcion_items ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizaciones(id);
  IF v_org_id IS NOT NULL THEN
    UPDATE recepcion_items SET org_id = v_org_id WHERE org_id IS NULL;
  END IF;
  ALTER TABLE recepcion_items ALTER COLUMN org_id SET NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_recepcion_items_org ON recepcion_items(org_id);
END $$;

-- ============================================================
-- 2. Simplificar RLS policies para usar org_id directo
-- ============================================================

-- stock_ubicaciones
DROP POLICY IF EXISTS "operador_stock" ON stock_ubicaciones;
CREATE POLICY "operador_stock" ON stock_ubicaciones FOR ALL
  USING (obtener_rol_usuario() = 'operador_drogueria' AND org_id = obtener_org_usuario());

-- lotes
DROP POLICY IF EXISTS "operador_lotes" ON lotes;
CREATE POLICY "operador_lotes" ON lotes FOR ALL
  USING (obtener_rol_usuario() = 'operador_drogueria' AND org_id = obtener_org_usuario());
DROP POLICY IF EXISTS "visor_select_lotes" ON lotes;
CREATE POLICY "visor_select_lotes" ON lotes FOR SELECT
  USING (obtener_rol_usuario() = 'visor_botica' AND ubicacion_id = obtener_botica_usuario());

-- movimientos_inventario
DROP POLICY IF EXISTS "operador_movimientos" ON movimientos_inventario;
CREATE POLICY "operador_movimientos" ON movimientos_inventario FOR ALL
  USING (obtener_rol_usuario() = 'operador_drogueria' AND org_id = obtener_org_usuario());

-- ordenes_compra
DROP POLICY IF EXISTS "operador_oc" ON ordenes_compra;
CREATE POLICY "operador_oc" ON ordenes_compra FOR ALL
  USING (obtener_rol_usuario() = 'operador_drogueria' AND org_id = obtener_org_usuario());

-- ordenes_compra_items
DROP POLICY IF EXISTS "operador_oc_items" ON ordenes_compra_items;
CREATE POLICY "operador_oc_items" ON ordenes_compra_items FOR ALL
  USING (obtener_rol_usuario() = 'operador_drogueria'
    AND EXISTS (SELECT 1 FROM ordenes_compra WHERE id = orden_compra_id AND org_id = obtener_org_usuario()));

-- recepciones_orden
DROP POLICY IF EXISTS "operador_recepciones" ON recepciones_orden;
CREATE POLICY "operador_recepciones" ON recepciones_orden FOR ALL
  USING (obtener_rol_usuario() = 'operador_drogueria' AND org_id = obtener_org_usuario());

-- recepcion_items
DROP POLICY IF EXISTS "operador_recepcion_items" ON recepcion_items;
CREATE POLICY "operador_recepcion_items" ON recepcion_items FOR ALL
  USING (obtener_rol_usuario() = 'operador_drogueria'
    AND EXISTS (SELECT 1 FROM recepciones_orden WHERE id = recepcion_id AND org_id = obtener_org_usuario()));

COMMIT;
```

---

## 4. Orden de despliegue

Para que todo funcione correctamente, seguir este orden:

1. **Aplicar migración** `00000000000001_flujo_ordenes_compra.sql` (renombrar `precio_compra` → `precio_compra_referencial`)
2. **Aplicar migración** `00000000000002_multitenant.sql` (agregar `org_id`)
3. **Desplegar Edge Functions** (en cualquier orden):
   - `supabase/functions/productos`
   - `supabase/functions/ordenes-compra`
   - `supabase/functions/proveedor-producto`

---

## Resumen de archivos modificados

| Archivo | Cambio |
|---------|--------|
| `src/services/supabase/movimientos.js` | Quitar join `perfiles:usuario_id` (no existe FK) |
| `supabase/functions/ordenes-compra/index.ts` | Anidar `monedas` dentro de `proveedores!inner()`, usar `org_id` directo, asignar `org_id` en crearOC |
| `supabase/migrations/00000000000002_multitenant.sql` | Nuevo: agregar `org_id` + RLS simplificado |
