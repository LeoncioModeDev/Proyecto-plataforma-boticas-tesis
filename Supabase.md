# Supabase — Conexión Inicial

Guía paso a paso para conectar **botica-demand-ml** con Supabase (Fase 2 del roadmap).

---

## Índice

1. [Crear proyecto Supabase](#1-crear-proyecto-supabase)
2. [Configurar variables de entorno](#2-configurar-variables-de-entorno)
3. [Migración de base de datos](#3-migración-de-base-de-datos)
4. [Seed data inicial](#4-seed-data-inicial)
5. [Autenticación (Auth)](#5-autenticación-auth)
6. [Row-Level Security (RLS)](#6-row-level-security-rls)
7. [Realtime](#7-realtime)
8. [Storage](#8-storage)
9. [Edge Functions](#9-edge-functions)
10. [pg_cron](#10-pg_cron)
11. [Conexión desde el frontend](#11-conexión-desde-el-frontend)
12. [Verificación](#12-verificación)

---

## 1. Crear proyecto Supabase

1. Ve a [supabase.com](https://supabase.com) e inicia sesión con GitHub.
2. Clic en **New project**.
3. Configura:

   | Campo | Valor |
   |-------|-------|
   | Name | `botica-demand-ml` |
   | Database Password | Generar o ingresar una segura (guardarla) |
   | Region | `South America (southamerica-east1)` — São Paulo, Brasil |
   | Pricing Plan | **Free Tier** (500 MB DB, 1 GB Storage, 50k usuarios/mes) |

4. Espera a que Supabase provisione la base de datos (~2 minutos).
5. Desde **Project Settings > API**, copia los siguientes valores:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public key** → `VITE_SUPABASE_ANON_KEY`
   - **service_role key** → (guardar para Edge Functions y pg_cron)

---

## 2. Configurar variables de entorno

En la raíz del proyecto, crea o edita `.env`:

```bash
# .env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

> No uses `service_role key` en el frontend — solo en Edge Functions y pg_cron.
> El archivo `.env` está en `.gitignore`; los valores de ejemplo están en `.env.example`.

---

## 3. Migración de base de datos

Ejecuta este script SQL completo en **SQL Editor** de Supabase. Crea todas las tablas, enums, índices y extensiones necesarias.

### 3.1 Extensiones

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
```

### 3.2 Enums

```sql
CREATE TYPE tipo_ubicacion AS ENUM ('drogueria', 'botica');
CREATE TYPE tipo_movimiento AS ENUM ('entrada', 'salida', 'ajuste', 'merma', 'devolucion');
CREATE TYPE tipo_transferencia AS ENUM ('transferencia_central', 'redistribucion');
CREATE TYPE estado_transferencia AS ENUM ('creada', 'en_transito', 'recibida', 'cancelada');
CREATE TYPE tipo_identificacion AS ENUM ('ruc', 'nit', 'tax_id', 'vat', 'otro');
CREATE TYPE clasificacion_producto AS ENUM ('OTC', 'receta', 'generico');
CREATE TYPE estado_producto AS ENUM ('activo', 'inactivo', 'descontinuado');
CREATE TYPE tipo_alerta AS ENUM ('quiebre', 'sobrestock', 'vencimiento_proximo', 'prediccion');
CREATE TYPE tipo_origen_alerta AS ENUM ('regla', 'modelo');
CREATE TYPE urgencia_alerta AS ENUM ('alta', 'media', 'baja');
CREATE TYPE estado_modelo AS ENUM ('staging', 'production', 'archived');
CREATE TYPE estado_recomendacion AS ENUM ('pendiente', 'confirmada', 'rechazada', 'ejecutada');
CREATE TYPE estado_orden_compra AS ENUM ('pendiente', 'aprobada', 'rechazada', 'completada');
CREATE TYPE tendencia_drift AS ENUM ('estable', 'degradando', 'mejorando');
```

### 3.3 Tabla: organizaciones

```sql
CREATE TABLE organizaciones (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          text NOT NULL,
  tipo_identificacion tipo_identificacion NOT NULL,
  numero_identificacion text NOT NULL,
  pais_origen     char(2) NOT NULL DEFAULT 'PE',
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tipo_identificacion, numero_identificacion)
);
```

### 3.4 Tabla: ubigeos (padrón INEI)

```sql
CREATE TABLE ubigeos (
  codigo       char(6) PRIMARY KEY,
  distrito     text NOT NULL,
  provincia    text NOT NULL,
  departamento text NOT NULL
);
```

### 3.5 Tabla: boticas

```sql
CREATE TABLE boticas (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id   uuid NOT NULL REFERENCES organizaciones(id),
  nombre   text NOT NULL,
  tipo     tipo_ubicacion NOT NULL,
  ubigeo   char(6) NOT NULL REFERENCES ubigeos(codigo),
  direccion text,
  telefono text,
  activa   boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_boticas_org ON boticas(org_id);
```

### 3.6 Tabla: productos

```sql
CREATE TABLE productos (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES organizaciones(id),
  codigo_interno        text NOT NULL UNIQUE,
  nombre_comercial      text NOT NULL,
  principio_activo      text NOT NULL,
  forma_farmaceutica    text NOT NULL,
  concentracion         text NOT NULL,
  laboratorio           text NOT NULL,
  codigo_barras         text UNIQUE,
  categoria_terapeutica text NOT NULL,
  clasificacion         clasificacion_producto NOT NULL,
  requiere_receta       boolean NOT NULL,
  estado                estado_producto NOT NULL DEFAULT 'activo',
  created_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_productos_org ON productos(org_id);
CREATE INDEX idx_productos_categoria ON productos(categoria_terapeutica);
CREATE INDEX idx_productos_buscador ON productos USING gin (nombre_comercial gin_trgm_ops);
```

### 3.7 Tabla: precios

```sql
CREATE TABLE precios (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id   uuid NOT NULL REFERENCES productos(id),
  botica_id     uuid REFERENCES boticas(id),
  precio_venta  numeric(10,2) NOT NULL,
  precio_costo  numeric(10,2) NOT NULL,
  vigente_desde timestamptz NOT NULL,
  vigente_hasta timestamptz
);
CREATE INDEX idx_precios_producto ON precios(producto_id);
```

### 3.8 Tabla: proveedores

```sql
CREATE TABLE proveedores (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES organizaciones(id),
  razon_social        text NOT NULL,
  tipo_identificacion tipo_identificacion NOT NULL,
  numero_identificacion text NOT NULL,
  pais_origen         char(2) NOT NULL DEFAULT 'PE',
  lead_time_dias      int NOT NULL,
  contacto            text,
  activo              boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tipo_identificacion, numero_identificacion)
);
CREATE INDEX idx_proveedores_org ON proveedores(org_id);
```

### 3.9 Tabla: stock_ubicaciones

```sql
CREATE TABLE stock_ubicaciones (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id        uuid NOT NULL REFERENCES productos(id),
  ubicacion_tipo     tipo_ubicacion NOT NULL,
  ubicacion_id       uuid REFERENCES boticas(id),
  cantidad_disponible int NOT NULL DEFAULT 0,
  stock_minimo       int NOT NULL,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (producto_id, ubicacion_tipo, COALESCE(ubicacion_id, '00000000-0000-0000-0000-000000000000'))
);
CREATE INDEX idx_stock_producto ON stock_ubicaciones(producto_id);
CREATE INDEX idx_stock_ubicacion ON stock_ubicaciones(ubicacion_tipo, ubicacion_id);
```

### 3.10 Tabla: lotes

```sql
CREATE TABLE lotes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id      uuid NOT NULL REFERENCES productos(id),
  ubicacion_tipo   tipo_ubicacion NOT NULL,
  ubicacion_id     uuid REFERENCES boticas(id),
  numero_lote      text NOT NULL,
  fecha_vencimiento date NOT NULL,
  cantidad         int NOT NULL,
  proveedor_id     uuid REFERENCES proveedores(id),
  UNIQUE (producto_id, numero_lote, ubicacion_tipo, COALESCE(ubicacion_id, '00000000-0000-0000-0000-000000000000'))
);
CREATE INDEX idx_lotes_producto ON lotes(producto_id);
CREATE INDEX idx_lotes_vencimiento ON lotes(fecha_vencimiento);
```

### 3.11 Tabla: movimientos_inventario

```sql
CREATE TABLE movimientos_inventario (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id      uuid NOT NULL REFERENCES productos(id),
  lote_id          uuid NOT NULL REFERENCES lotes(id),
  ubicacion_tipo   tipo_ubicacion NOT NULL,
  ubicacion_id     uuid REFERENCES boticas(id),
  tipo_movimiento  tipo_movimiento NOT NULL,
  cantidad         int NOT NULL,
  motivo           text NOT NULL,
  usuario_id       uuid NOT NULL,
  transferencia_id uuid,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_movimientos_producto ON movimientos_inventario(producto_id);
CREATE INDEX idx_movimientos_fecha ON movimientos_inventario(created_at);
CREATE INDEX idx_movimientos_tipo ON movimientos_inventario(tipo_movimiento);
```

### 3.12 Tabla: transferencias

```sql
CREATE TABLE transferencias (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_transferencia tipo_transferencia NOT NULL,
  origen_tipo       tipo_ubicacion NOT NULL,
  origen_id         uuid REFERENCES boticas(id),
  destino_tipo      tipo_ubicacion NOT NULL DEFAULT 'botica',
  destino_id        uuid NOT NULL REFERENCES boticas(id),
  estado            estado_transferencia NOT NULL DEFAULT 'creada',
  creado_por        uuid NOT NULL,
  fecha_despacho    timestamptz,
  fecha_recepcion   timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_transferencias_destino ON transferencias(destino_id);
CREATE INDEX idx_transferencias_estado ON transferencias(estado);
```

### 3.13 Tabla: transferencias_items

```sql
CREATE TABLE transferencias_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transferencia_id uuid NOT NULL REFERENCES transferencias(id),
  producto_id      uuid NOT NULL REFERENCES productos(id),
  lote_id          uuid REFERENCES lotes(id),
  cantidad         int NOT NULL
);
CREATE INDEX idx_transferencias_items_transferencia ON transferencias_items(transferencia_id);
```

### 3.14 Tabla: ordenes_compra

```sql
CREATE TABLE ordenes_compra (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_id          uuid NOT NULL REFERENCES proveedores(id),
  creado_por            uuid NOT NULL,
  estado                estado_orden_compra NOT NULL DEFAULT 'pendiente',
  fecha_estimada_entrega date,
  observaciones         text,
  aprobado_por          uuid,
  fecha_aprobacion      timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_oc_proveedor ON ordenes_compra(proveedor_id);
CREATE INDEX idx_oc_estado ON ordenes_compra(estado);
```

### 3.15 Tabla: ordenes_compra_items

```sql
CREATE TABLE ordenes_compra_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_compra_id uuid NOT NULL REFERENCES ordenes_compra(id),
  producto_id     uuid NOT NULL REFERENCES productos(id),
  cantidad        int NOT NULL,
  precio_unitario numeric(10,2) NOT NULL
);
CREATE INDEX idx_oc_items_orden ON ordenes_compra_items(orden_compra_id);
```

### 3.16 Tablas MLOps

#### modelos_ml

```sql
CREATE TABLE modelos_ml (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version             text NOT NULL UNIQUE,
  algoritmo           text NOT NULL,
  hash                text NOT NULL,
  fecha_entrenamiento timestamptz NOT NULL,
  fecha_promocion     timestamptz,
  mae                 float NOT NULL,
  rmse                float NOT NULL,
  mape                float NOT NULL,
  psi_baseline_jsonb  jsonb NOT NULL,
  datos_desde         date NOT NULL,
  datos_hasta         date NOT NULL,
  status              estado_modelo NOT NULL DEFAULT 'staging',
  activo              boolean NOT NULL DEFAULT false
);

CREATE UNIQUE INDEX idx_modelos_ml_production ON modelos_ml (status) WHERE status = 'production';
```

#### predicciones_ml

```sql
CREATE TABLE predicciones_ml (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id       uuid NOT NULL REFERENCES productos(id),
  botica_id         uuid NOT NULL REFERENCES boticas(id),
  periodo_inicio    date NOT NULL,
  periodo_fin       date NOT NULL,
  cantidad_predicha float NOT NULL,
  intervalo_inf     float NOT NULL,
  intervaloSup     float NOT NULL,
  confianza         float NOT NULL,
  modelo_version_id uuid NOT NULL REFERENCES modelos_ml(id),
  generado_en       timestamptz NOT NULL DEFAULT now()
) REPLICA IDENTITY FULL;
CREATE INDEX idx_predicciones_producto_botica ON predicciones_ml(producto_id, botica_id);
```

#### inferencias

```sql
CREATE TABLE inferencias (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id       uuid NOT NULL REFERENCES productos(id),
  botica_id         uuid NOT NULL REFERENCES boticas(id),
  modelo_version_id uuid NOT NULL REFERENCES modelos_ml(id),
  fecha_pred        date NOT NULL,
  valor_pred        float NOT NULL,
  features_jsonb    jsonb NOT NULL,
  valor_real        float,
  error_absoluto    float,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz
);
CREATE INDEX idx_inferencias_modelo_fecha ON inferencias(modelo_version_id, fecha_pred);
CREATE INDEX idx_inferencias_producto_botica ON inferencias(producto_id, botica_id, fecha_pred);
```

#### drift_metricas

```sql
CREATE TABLE drift_metricas (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modelo_version_id         uuid NOT NULL REFERENCES modelos_ml(id),
  fecha_calculo             timestamptz NOT NULL DEFAULT now(),
  ventana_dias              int NOT NULL DEFAULT 28,
  psi_features              jsonb NOT NULL,
  psi_max                   float NOT NULL,
  mape_rolling              float NOT NULL,
  mape_baseline             float NOT NULL,
  ratio_mape                float NOT NULL,
  tendencia                 tendencia_drift NOT NULL,
  requiere_retraining       boolean NOT NULL,
  reentrenamiento_disparado boolean NOT NULL DEFAULT false
) REPLICA IDENTITY FULL;
CREATE INDEX idx_drift_modelo_fecha ON drift_metricas(modelo_version_id, fecha_calculo);
```

#### alertas_ml

```sql
CREATE TABLE alertas_ml (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo        tipo_alerta NOT NULL,
  tipo_origen tipo_origen_alerta NOT NULL,
  producto_id uuid NOT NULL REFERENCES productos(id),
  botica_id   uuid NOT NULL REFERENCES boticas(id),
  urgencia    urgencia_alerta NOT NULL,
  resuelta    boolean NOT NULL DEFAULT false,
  generado_en timestamptz NOT NULL DEFAULT now()
) REPLICA IDENTITY FULL;
CREATE INDEX idx_alertas_botica ON alertas_ml(botica_id);
CREATE INDEX idx_alertas_resuelta ON alertas_ml(resuelta);
```

#### recomendaciones_ml

```sql
CREATE TABLE recomendaciones_ml (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id        uuid NOT NULL REFERENCES productos(id),
  botica_destino_id  uuid NOT NULL REFERENCES boticas(id),
  botica_origen_id   uuid REFERENCES boticas(id),
  tipo_recomendacion text NOT NULL,
  cantidad_sugerida  int NOT NULL,
  motivo             text NOT NULL,
  confianza_modelo   float NOT NULL,
  estado             estado_recomendacion NOT NULL DEFAULT 'pendiente',
  transferencia_id   uuid REFERENCES transferencias(id),
  confirmado_por     uuid,
  confirmado_en      timestamptz,
  generado_en        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_recomendaciones_estado ON recomendaciones_ml(estado);
```

### 3.17 Trigger: actualizar stock en movimiento

```sql
CREATE OR REPLACE FUNCTION actualizar_stock()
RETURNS trigger AS $$
BEGIN
  IF NEW.tipo_movimiento IN ('entrada', 'devolucion') THEN
    UPDATE stock_ubicaciones
    SET cantidad_disponible = cantidad_disponible + NEW.cantidad,
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

CREATE TRIGGER trg_actualizar_stock
AFTER INSERT ON movimientos_inventario
FOR EACH ROW EXECUTE FUNCTION actualizar_stock();
```

---

## 4. Seed data inicial

Ejecuta este script para insertar datos iniciales básicos para desarrollo.

### 4.1 Organización

```sql
INSERT INTO organizaciones (id, nombre, tipo_identificacion, numero_identificacion, pais_origen)
VALUES ('00000000-0000-0000-0000-000000000001', 'D&R Farma', 'ruc', '20123456789', 'PE');
```

### 4.2 Ubigeos (Lima)

```sql
INSERT INTO ubigeos (codigo, distrito, provincia, departamento) VALUES
('150101', 'Cercado de Lima', 'Lima', 'Lima'),
('150104', 'Miraflores', 'Lima', 'Lima'),
('150114', 'Surco', 'Lima', 'Lima'),
('150116', 'Los Olivos', 'Lima', 'Lima'),
('150143', 'San Borja', 'Lima', 'Lima');
```

### 4.3 Boticas

```sql
INSERT INTO boticas (id, org_id, nombre, tipo, ubigeo, direccion, telefono, activa) VALUES
('ub-001', '00000000-0000-0000-0000-000000000001', 'Droguería Central', 'drogueria', '150101', 'Av. Abancay 234', '01-4567890', true),
('ub-002', '00000000-0000-0000-0000-000000000001', 'Botica Miraflores', 'botica', '150104', 'Calle Schell 412', '01-2345678', true),
('ub-003', '00000000-0000-0000-0000-000000000001', 'Botica San Borja', 'botica', '150143', 'Av. San Luis 1890', '01-3456789', true),
('ub-004', '00000000-0000-0000-0000-000000000001', 'Botica Surco', 'botica', '150114', 'Av. El Derby 567', '01-5678901', true),
('ub-005', '00000000-0000-0000-0000-000000000001', 'Botica Los Olivos', 'botica', '150116', 'Av. Universitaria 3456', '01-6789012', true);
```

### 4.4 Productos, precios, proveedores, stock, lotes y movimientos

Usa los archivos mock en `src/mock-data/` como referencia para crear los inserts SQL correspondientes. Convierte los datos JS a SQL manualmente o mediante un script de migración. El seed completo debe cubrir:

- 12 productos activos
- 5 proveedores
- 14 lotes con fechas variadas
- 16+ registros de stock en 5 ubicaciones
- 21+ movimientos de todos los tipos
- 6 transferencias en distintos estados
- 9 alertas (regla + predictivas)
- 5 predicciones con serie histórica

---

## 5. Autenticación (Auth)

### 5.1 Configurar proveedor de email

1. En Supabase Dashboard: **Authentication > Providers > Email**.
2. Habilitar **Enable email confirmations** solo para producción (desactivar en desarrollo local).
3. En desarrollo: desactivar confirmación para pruebas rápidas.

### 5.2 Crear usuarios desde el dashboard

En **Authentication > Users > Invite** o mediante SQL:

```sql
-- Nota: Las contraseñas se manejan con el API de Auth, no con SQL directo.
-- Usa supabase-js o la UI de Supabase para crear usuarios.
```

### 5.3 Configurar el cliente en el frontend

Edita `src/services/supabase/cliente.js`:

```javascript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})
```

### 5.4 Actualizar store de autenticación

Modifica `src/state/useAutenticacion.js` para que en Fase 2 use `supabase.auth` en lugar del mock:

```javascript
import { create } from 'zustand'
import { supabase } from '@/services/supabase/cliente'

const useAutenticacion = create((set) => ({
  usuario: null,
  autenticado: false,

  iniciarSesion: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    // Obtener perfil desde la tabla perfiles o auth.users
    set({ usuario: data.user, autenticado: true })
  },

  cerrarSesion: async () => {
    await supabase.auth.signOut()
    set({ usuario: null, autenticado: false })
  },

  // ...
}))
```

---

## 6. Row-Level Security (RLS)

Ejecuta el archivo [`rls.sql`](./supabase/migrations/00000000000001_rls.sql) completo en el SQL Editor de Supabase.

Este archivo:

- Crea helpers `obtener_rol_usuario()` y `obtener_botica_usuario()` que extraen el rol y botica del JWT (`app_metadata`).
- Habilita RLS en las 19 tablas.
- Define políticas por rol:
  - **admin_central**: acceso total (SELECT/INSERT/UPDATE/DELETE) a todas las tablas.
  - **operador_drogueria**: lectura de todo, escritura en inventario, transferencias y órdenes de compra.
  - **visor_botica**: solo lectura, excepto confirmar recepción de transferencias destinadas a su botica.

### 6.2 Configurar app_metadata de usuarios

Para que RLS funcione, cada usuario Auth debe tener `app_metadata` con su rol:

| Usuario | app_metadata |
|---------|-------------|
| `admin_central@boticaml.pe` | `{"rol": "admin_central"}` |
| `operador@boticaml.pe` | `{"rol": "operador_drogueria"}` |
| `visor@boticaml.pe` | `{"rol": "visor_botica", "botica_id": "906aeca6-3956-57b6-b7ba-1123cce33ac7"}` |

Para configurarlo:

**Opción A — Supabase Dashboard:**
1. Ir a **Authentication > Users**.
2. Clic en cada usuario.
3. En la sección **App Metadata**, pegar el JSON correspondiente.
4. Guardar.

**Opción B — Admin API (curl):**
```bash
curl -X PATCH 'https://gijafqewxvzukzxlfzsh.supabase.co/auth/v1/admin/users/{UUID}' \
  -H 'apikey: {service_role_key}' \
  -H 'Authorization: Bearer {service_role_key}' \
  -H 'Content-Type: application/json' \
  -d '{"app_metadata": {"rol": "admin_central"}}'
```

> El frontend usa `filtrarPorBoticaId` de `src/utilities/permisos.js` como lógica complementaria del lado cliente.

---

## 7. Realtime

Habilitar Realtime en las tablas MLOps desde **Supabase Dashboard > Database > Replication**:

| Tabla | Canal | Propósito |
|-------|-------|-----------|
| `alertas_ml` | `alertas_ml` | Alertas en tiempo real al dashboard |
| `predicciones_ml` | `predicciones_ml` | Gráfico de pronóstico actualizado al regenerar |
| `drift_metricas` | `drift_metricas` | Monitoreo del estado del modelo |

Marcar con `REPLICA IDENTITY FULL` (ya incluido en el DDL de las tablas).

---

## 8. Storage

Crear bucket para artefactos ML:

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('models', 'models', false);
```

Política de acceso:

```sql
CREATE POLICY "Solo service_role puede leer/escribir modelos"
ON storage.objects FOR ALL
USING (bucket_id = 'models' AND auth.role() = 'service_role');
```

Estructura de almacenamiento:

```
models/
  v1.0.0/
    a1b2c3d4e5f6...pkl
    a1b2c3d4e5f6...config.json
  v1.1.0/
    ...
```

---

## 9. Edge Functions

### 9.1 Instalar Supabase CLI

```bash
npm install -g supabase
supabase login
supabase link --project-ref <REF>
```

### 9.2 Inicializar funciones locales

```bash
supabase functions new promote_model
supabase functions new alert_dispatch
```

### 9.3 Desplegar

```bash
supabase functions deploy promote_model --no-verify-jwt
supabase functions deploy alert_dispatch --no-verify-jwt
```

> `--no-verify-jwt` porque estas funciones son invocadas internamente (por Cloud Run y pg_cron), no por usuarios.

---

## 10. pg_cron

### 10.1 Crear los jobs de orquestación MLOps

```sql
-- Job 1: Cálculo de drift semanal (lunes 03:00 UTC)
SELECT cron.schedule(
  'calc_drift_semanal',
  '0 3 * * 1',
  $$SELECT public.calc_drift_semanal()$$
);

-- Job 2: Decisión de reentrenamiento (lunes 03:15 UTC)
SELECT cron.schedule(
  'decide_retrain',
  '15 3 * * 1',
  $$SELECT public.decide_retrain()$$
);

-- Job 3: Cleanup diario (02:00 UTC)
SELECT cron.schedule(
  'cleanup',
  '0 2 * * *',
  $$DELETE FROM lotes WHERE fecha_vencimiento < CURRENT_DATE;$$
);

-- Job 4: Backfill valor_real en inferencias (02:30 UTC)
SELECT cron.schedule(
  'backfill_inferencias',
  '30 2 * * *',
  $$UPDATE inferencias i
    SET valor_real = COALESCE(m.total_salida, 0),
        error_absoluto = ABS(COALESCE(m.total_salida, 0) - i.valor_pred),
        updated_at = now()
    FROM (
      SELECT producto_id, ubicacion_id AS botica_id, DATE(created_at) AS fecha, SUM(cantidad) AS total_salida
      FROM movimientos_inventario
      WHERE tipo_movimiento = 'salida' AND DATE(created_at) = CURRENT_DATE - INTERVAL '1 day'
      GROUP BY producto_id, ubicacion_id, DATE(created_at)
    ) m
    WHERE i.producto_id = m.producto_id
      AND i.botica_id = m.botica_id
      AND i.fecha_pred = m.fecha
      AND i.valor_real IS NULL$$
);
```

### 10.2 Almacenar token de Cloud Run en Vault

```sql
SELECT vault.create_secret(
  '{"token": "tu-token-cloud-run-aqui"}',
  'cloud_run_token',
  'Token para invocar Cloud Run desde pg_net'
);
```

---

## 11. Conexión desde el frontend

### 11.1 Actualizar cliente Supabase

Edita `src/services/supabase/cliente.js` (ya descrito en la sección 5.3).

### 11.2 Actualizar servicios mock

Cada archivo en `src/services/supabase/` debe migrarse de mock a real. Ejemplo para `productos.js`:

```javascript
import { supabase } from './cliente'

export async function obtenerProductos() {
  const { data, error } = await supabase
    .from('productos')
    .select('*')
    .eq('estado', 'activo')
    .order('nombre_comercial')

  if (error) throw error
  return data
}

export async function crearProducto(producto) {
  const { data, error } = await supabase
    .from('productos')
    .insert(producto)
    .select()
    .single()

  if (error) throw error
  return data
}
```

### 11.3 Migración progresiva

| Servicio | Archivo | Prioridad |
|----------|---------|-----------|
| Cliente | `cliente.js` | ⭐ Alta (dependencia) |
| Autenticación | `autenticacion.js` | ⭐ Alta |
| Productos | `productos.js` | ⭐ Alta |
| Stock | `stock.js` | ⭐ Alta |
| Lotes | `lotes.js` | ⭐ Alta |
| Movimientos | `movimientos.js` | ⭐ Alta |
| Transferencias | `transferencias.js` | ⭐ Alta |
| Predicciones | `predicciones.js` | 🟡 Media |
| ML | `clienteML.js`, `prediccion.js`, `metricas.js` | 🔵 Baja (Fase 3) |

---

## 12. Verificación

### 12.1 Prueba de conexión

```javascript
// En la consola del navegador después de iniciar sesión:
import { supabase } from './src/services/supabase/cliente'

const { data, error } = await supabase.from('boticas').select('*')
console.log({ data, error })
// Debe mostrar 5 boticas sin error
```

### 12.2 Prueba de autenticación

```javascript
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'usuario@boticaml.pe',
  password: 'contraseña-segura',
})
console.log({ user: data?.user, error })
```

### 12.3 Prueba de RLS

```javascript
// Inicia sesión como visor_botica
// Debe ver solo registros de su botica_id
const { data } = await supabase.from('stock_ubicaciones').select('*')
console.log('Filas visibles:', data.length)
```

### 12.4 Prueba de Realtime

```javascript
const canal = supabase
  .channel('test-alertas')
  .on('postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'alertas_ml' },
    (payload) => console.log('Nueva alerta:', payload.new)
  )
  .subscribe()
```

### 12.5 Estados de migración

| Servicio | Estado esperado | Cómo verificarlo |
|----------|----------------|------------------|
| Auth | Login funcional con 3 roles | Iniciar sesión como cada rol, ver redirección correcta |
| RLS | Visor solo ve su botica | Navegar a stock, lotes, movimientos |
| Realtime | Alertas aparecen sin recargar | Insertar manual en `alertas_ml`, ver badge actualizado |
| Transferencias | CRUD completo con estados | Crear, enviar, cancelar, confirmar recepción |
| Stock | Actualización por trigger | Crear movimiento, ver stock actualizado en UI |

---

---

## Apéndice A — Reset completo de la base de datos

Para entornos de desarrollo/prueba, estos scripts eliminan todo y permiten empezar de cero.

### A.1 Eliminar todas las tablas (orden seguro por FK)

```sql
DROP TABLE IF EXISTS recomendaciones_ml CASCADE;
DROP TABLE IF EXISTS drift_metricas CASCADE;
DROP TABLE IF EXISTS inferencias CASCADE;
DROP TABLE IF EXISTS predicciones_ml CASCADE;
DROP TABLE IF EXISTS alertas_ml CASCADE;
DROP TABLE IF EXISTS modelos_ml CASCADE;
DROP TABLE IF EXISTS ordenes_compra_items CASCADE;
DROP TABLE IF EXISTS ordenes_compra CASCADE;
DROP TABLE IF EXISTS transferencias_items CASCADE;
DROP TABLE IF EXISTS movimientos_inventario CASCADE;
DROP TABLE IF EXISTS transferencias CASCADE;
DROP TABLE IF EXISTS lotes CASCADE;
DROP TABLE IF EXISTS stock_ubicaciones CASCADE;
DROP TABLE IF EXISTS precios CASCADE;
DROP TABLE IF EXISTS productos CASCADE;
DROP TABLE IF EXISTS boticas CASCADE;
DROP TABLE IF EXISTS ubigeos CASCADE;
DROP TABLE IF EXISTS proveedores CASCADE;
DROP TABLE IF EXISTS organizaciones CASCADE;
```

### A.2 Eliminar enums

```sql
DROP TYPE IF EXISTS tipo_ubicacion CASCADE;
DROP TYPE IF EXISTS tipo_movimiento CASCADE;
DROP TYPE IF EXISTS tipo_transferencia CASCADE;
DROP TYPE IF EXISTS estado_transferencia CASCADE;
DROP TYPE IF EXISTS tipo_identificacion CASCADE;
DROP TYPE IF EXISTS clasificacion_producto CASCADE;
DROP TYPE IF EXISTS estado_producto CASCADE;
DROP TYPE IF EXISTS tipo_alerta CASCADE;
DROP TYPE IF EXISTS tipo_origen_alerta CASCADE;
DROP TYPE IF EXISTS urgencia_alerta CASCADE;
DROP TYPE IF EXISTS estado_modelo CASCADE;
DROP TYPE IF EXISTS estado_recomendacion CASCADE;
DROP TYPE IF EXISTS estado_orden_compra CASCADE;
DROP TYPE IF EXISTS tendencia_drift CASCADE;
```

### A.3 Eliminar extensiones (opcional)

```sql
DROP EXTENSION IF EXISTS pg_cron CASCADE;
DROP EXTENSION IF EXISTS pg_net CASCADE;
DROP EXTENSION IF EXISTS pg_trgm CASCADE;
```

### A.4 Eliminar funciones y triggers

```sql
DROP TRIGGER IF EXISTS trg_actualizar_stock ON movimientos_inventario CASCADE;
DROP FUNCTION IF EXISTS actualizar_stock CASCADE;
```

### A.5 Eliminar jobs de pg_cron

```sql
SELECT cron.unschedule('calc_drift_semanal');
SELECT cron.unschedule('decide_retrain');
SELECT cron.unschedule('cleanup');
SELECT cron.unschedule('backfill_inferencias');
```

### A.6 Eliminar secretos de Vault

```sql
SELECT vault.delete_secret(
  (SELECT id FROM vault.decrypted_secrets WHERE name = 'cloud_run_token')
);
```

### A.7 Eliminar bucket de Storage

```sql
DELETE FROM storage.objects WHERE bucket_id = 'models';
DELETE FROM storage.buckets WHERE id = 'models';
```

### A.8 Eliminar canal de Realtime (se recrea al insertar en tabla con `REPLICA IDENTITY FULL`)

Los canales Realtime se eliminan automáticamente al dropear las tablas. Si solo quieres reiniciar las suscripciones sin dropear tablas:

```sql
SELECT pg_replication_origin_create('realtimel_alertas_ml');
-- Para listar réplicas activas:
SELECT * FROM pg_replication_origin;
```

> En la práctica, con el Free Tier de Supabase, el reset más rápido es eliminar el proyecto desde el dashboard y crear uno nuevo. Estos scripts son útiles cuando quieres conservar la configuración del proyecto (Auth, Storage, Edge Functions) pero reiniciar solo los datos.

---

## Referencias

- [`src/services/supabase/cliente.js`](./src/services/supabase/cliente.js) — placeholder del cliente
- [`Arquitectura_Logica_v4.md`](./Arquitectura_Logica_v4.md) — modelo de datos completo
- [`Arquitectura_Fisica_v3.md`](./Arquitectura_Fisica_v3.md) — despliegue y componentes físicos
- [`src/mock-data/`](./src/mock-data/) — datos de prueba para seed
- [`src/constants/`](./src/constants/) — enums y constantes del dominio
