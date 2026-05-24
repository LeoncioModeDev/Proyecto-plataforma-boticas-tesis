# Arquitectura Lógica — Modelo de Datos v4

**Proyecto:** Plataforma Web Basada en Arquitectura Serverless y Machine Learning para Controlar el Sobrestock y Desabastecimiento de Medicamentos en Boticas del Perú
**Universidad:** Universidad Peruana de Ciencias Aplicadas (UPC), 2026
**Empresa:** D&R Farma
**BaaS:** Supabase (PostgreSQL) · **ML:** SARIMA + XGBoost
**Diferenciador arquitectónico:** Closed-Loop MLOps in-Database con Reentrenamiento Drift-Aware

---

## Objetivos del proyecto (ACP v1.3)

### Objetivo General
Implementar una plataforma web basada en Arquitectura Serverless y Machine Learning para controlar el sobrestock y desabastecimiento de medicamentos en boticas del Perú.

### Objetivos Específicos y métricas de éxito

| OE | Descripción | Indicador | Meta |
|---|---|---|---|
| OE1 | Analizar datos históricos con EDA y evaluar alternativas de arquitectura | Patrones de demanda identificados | ≥ 3 patrones relevantes (tendencia, estacionalidad, anomalías) |
| OE1 | Evaluación comparativa de arquitectura | Componentes justificados | 100% con criterios técnicos documentados |
| OE2 | Diseñar arquitectura física y lógica serverless | Diagramas elaborados y aprobados | 100% de diagramas aprobados por el asesor |
| OE2 | Integración React + Supabase + FastAPI | Coherencia de flujos | Auth, RLS y Realtime validados técnicamente |
| OE3 | Precisión del modelo predictivo | MAPE en prueba piloto | **MAPE ≤ 20%** |
| OE3 | Validación por expertos farmacéuticos | Valoración positiva | **≥ 80%** de evaluación positiva |
| OE3 | Fill Rate (control de desabastecimiento) | Tasa de servicio | Incremento desde línea base ≈ 61% hasta **≥ 85%** al cierre del piloto (Contreras-Alva et al., 2024) |
| OE3 | Tasa de Sobrestock (control de exceso) | SKU con cobertura > 60 días | **Reducción ≥ 25%** respecto a la línea base medida al inicio del piloto |
| OE4 | Plan de continuidad y escalabilidad | Componentes del plan documentados | 100% definidos y documentados |
| OE4 | Gestión de riesgos operativos | Riesgos críticos tratados | 100% identificados y con mitigación definida |

> **Nota:** Las métricas de Fill Rate y Tasa de Sobrestock son los indicadores de negocio primarios del proyecto (OE3.I3). El MAPE ≤ 20% es la condición habilitante técnica: si el modelo no predice con esa precisión, las métricas operativas no mejorarán de forma sostenida. Ambas deben medirse simultáneamente para evitar que mejorar una desplace el problema hacia la otra.

---

## Alcance y exclusiones

### Lo que SÍ modela esta arquitectura

- Gestión de inventario en droguería central y boticas (stock, lotes, movimientos)
- Catálogo de productos farmacéuticos (medicamentos genéricos y de marca, controlados y no controlados)
- Predicciones de demanda por producto y por ubicación
- Alertas automáticas de quiebre de stock, sobrestock y vencimiento próximo
- Transferencias de droguería a boticas
- Gestión de proveedores con tiempos de reposición
- Versionado de modelos ML con métricas de evaluación y promoción champion–challenger
- Auditoría completa de inferencias (predicción ↔ versión del modelo ↔ realidad observada)
- Detección de drift estadístico (PSI, MAPE rolling) y reentrenamiento condicional
- Precios de venta y costo como dato de referencia para el modelo ML
- Soporte parcial al cumplimiento de Buenas Prácticas de Almacenamiento (BPA)

### Lo que NO modela esta arquitectura

| Exclusión | Motivo (fuente ACP) |
|---|---|---|
| Módulo de ventas / POS | Fuera del alcance — la plataforma consume movimientos de salida, no registra ventas directas al cliente |
| Órdenes de compra automatizadas a proveedores | Excluidas del alcance funcional — las órdenes de compra existen como soporte documental manual, no como abastecimiento inteligente automatizado |
| Autenticación biométrica u OAuth corporativo | Solo Supabase Auth (JWT + RLS nativo) |
| Autenticación biométrica u OAuth corporativo | Solo Supabase Auth (JWT + RLS nativo) |
| Integración con sistemas externos (POS, ERP, WMS) | Solo datos históricos en formato digital |
| Despliegue en infraestructura productiva de alta disponibilidad | Entornos gratuitos y contenedores de bajo costo |
| Automatización de reposición física de inventario | Solo predicciones, alertas y visualizaciones |
| Aplicación móvil | Plataforma exclusivamente web |
| Contabilidad, facturación electrónica, atención al cliente | Fuera del alcance |
| Variables exógenas en el modelo ML (clima, epidemiología, campañas) | Prioridad a patrones internos de la serie temporal |
| Medicamentos con cambios regulatorios durante el estudio | Generan alteraciones abruptas en patrones de demanda |
| Medicamentos con condiciones especiales de conservación (refrigeración) | Excluidos del dataset |
| Productos no farmacológicos (dispositivos médicos, higiene, sanitarios) | Fuera del alcance del dataset |
| Temporadas y campañas registradas explícitamente | El modelo detecta estacionalidad desde `created_at` |
| Datos de clientes (nombre, DNI, teléfono, dirección) | Privacidad; no aportan al modelo predictivo |
| Imágenes y documentos adjuntos | Fuera del alcance |
| Observaciones en texto libre | Generan ruido; excluidas del entrenamiento |

---

## Métricas de evaluación de la plataforma

### Fill Rate — Tasa de Servicio (OE3.I3)

Mide el control del desabastecimiento desde la perspectiva de disponibilidad del medicamento.

```
Fill Rate = (Unidades dispensadas a tiempo / Unidades solicitadas) × 100
```

| Parámetro | Valor |
|---|---|
| Línea base | ≈ 61% (Contreras-Alva et al., 2024 — botica peruana mediana) |
| Meta ACP | ≥ 85% al cierre del piloto |
| Fuente en el modelo | `movimientos_inventario` filtrando `tipo_movimiento = 'salida'` |

### Tasa de Sobrestock (OE3.I3)

Mide el control del exceso de inventario identificando SKU con riesgo de vencimiento.

```
Tasa de Sobrestock = (N° SKU con cobertura > 60 días / N° total SKU activos) × 100

Cobertura (días) = stock_actual / demanda_promedio_diaria_90_días
```

| Parámetro | Valor |
|---|---|
| Umbral de riesgo | 60 días de cobertura |
| Meta ACP | Reducción ≥ 25% respecto a la línea base medida al inicio del piloto |
| Fuente en el modelo | `stock_ubicaciones.cantidad_disponible` + `movimientos_inventario` últimos 90 días |

### MAPE — Condición habilitante técnica (OE3.I1)

```
MAPE = (1/n) × Σ |valor_real - valor_predicho| / |valor_real| × 100
```

| Parámetro | Valor |
|---|---|
| Meta ACP | ≤ 20% |
| Fuente en el modelo | `modelos_ml.mape` por cada versión entrenada + `drift_metricas.mape_rolling` |

### Reentrenamientos evitados — KPI del diferenciador MLOps

```
Reentrenamientos Evitados = (Semanas evaluadas − Semanas con retraining disparado) / Semanas evaluadas × 100
```

| Parámetro | Valor |
|---|---|
| Línea base teórica | 0% (reentrenamiento periódico ciego — todas las semanas) |
| Meta esperada | ≥ 60% (reentrenar solo cuando hay drift real) |
| Fuente en el modelo | `drift_metricas.reentrenamiento_disparado` agregado por mes |

> KPI novedoso en el dominio farmacéutico peruano. Demuestra que el enfoque drift-aware ahorra cómputo respecto al retraining periódico ciego (Pawar et al., 2025; Wang et al., 2026 — DriftGuard).

---

## Cambios respecto al modelo v3

| Tabla / Componente | Cambio | Motivo |
|---|---|---|
| Métricas | Añadido cuadro de métricas ACP como sección principal | Alineación con OE3.I1, OE3.I2, OE3.I3 del ACP v1.3 |
| Exclusiones | Incorporadas todas las exclusiones del ACP v1.3 | Coherencia entre scope del ACP y el modelo de datos |
| `alertas_ml` | Se agrega tipo `prediccion` al enum | Alineación con mock del frontend (`alertas.js` incluye alertas predictivas) |
| `alertas_ml` | Se agrega campo `tipo_origen` | Distingue alertas por regla (quiebre, sobrestock, vencimiento) de alertas predictivas del modelo |
| Realtime | Nueva sección que documenta tablas con Realtime y canales del frontend | Resolver gap crítico identificado en validación |
| `inferencias` | Nueva sección que documenta el mecanismo de backfill de `valor_real` | Resolver gap crítico: sin backfill el MAPE rolling no tiene datos |
| `modelos_ml` | Documentado el UNIQUE INDEX parcial como constraint explícito | Garantía operativa del champion-challenger |
| Storage de modelos | Documentado naming convention del bucket | Trazabilidad de rollback |
| `organizaciones` | Reemplazado `ruc` por `tipo_identificacion + numero_identificacion + pais_origen` | Laboratorios extranjeros (India, China, Europa) |
| `boticas` | `activa` corregido a `boolean`; agregados `distrito` y `ubigeo char(6)` | Corrección del docente + feature ML geográfico |
| `productos` | Agregados `codigo_interno`, `categoria_terapeutica`, `requiere_receta` | Cobertura del dataset del contacto |
| `movimientos_inventario` | Agregado `devolucion` al enum | Distinción de demanda neta para ML |
| `proveedores` | Reemplazado `ruc` por esquema polimórfico; agregado `lead_time_dias` | Columna "oro" para punto de pedido |
| `modelos_ml` | Agregados `hash`, `algoritmo`, `psi_baseline_jsonb`, `status`, `fecha_promocion`, `mape` | Model registry completo + meta MAPE del ACP |
| `predicciones_ml` | `modelo_version` cambiado a `modelo_version_id uuid` con FK | Integridad referencial auditable |
| `inferencias` | Tabla nueva | Audit log de cada predicción servida |
| `drift_metricas` | Tabla nueva | Historial de métricas de drift semanales |
| `precios` | Tabla nueva | `precio_venta` y `precio_costo` requeridos para ML |
| `ubigeos` | Tabla de referencia auxiliar (padrón INEI) | FK desde `boticas.ubigeo` |
| `transferencias` | Reemplazado `botica_id` por `origen_tipo`, `origen_id`, `destino_tipo`, `destino_id`; agregado `tipo_transferencia` y estado `cancelada` | Soportar redistribución botica→botica y flujo completo de estados |
| `ordenes_compra` | Tabla nueva para soporte documental de reabastecimiento | HU-029, HU-030, HU-031, HU-016 |
| `ordenes_compra_items` | Tabla nueva con detalle de productos por orden | HU-029 |
| `recomendaciones_ml` | Tabla nueva para recomendaciones operativas de transferencia/redistribución | Alineación ML con distribución |

---

## Dominio 1 — Organización y Acceso

### `organizaciones`

Representa la empresa propietaria de la red (ej. D&R Farma). Diseñada para soportar organizaciones nacionales y extranjeras.

| Columna | Tipo | Restricción | Descripción |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | Identificador único |
| `nombre` | `text` | NOT NULL | Razón social o nombre comercial |
| `tipo_identificacion` | `enum('ruc','nit','tax_id','vat','otro')` | NOT NULL | Tipo de identificación tributaria según país |
| `numero_identificacion` | `text` | NOT NULL | Número de RUC, NIT, Tax ID, VAT, etc. |
| `pais_origen` | `char(2)` | NOT NULL, default `'PE'` | ISO 3166-1 alpha-2 |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | Fecha de registro |

**Constraint:** `UNIQUE (tipo_identificacion, numero_identificacion)`

---

### `boticas`

Cada local físico perteneciente a una organización. Solo la central crea y gestiona boticas.

| Columna | Tipo | Restricción | Descripción |
|---|---|---|---|
| `id` | `uuid` | PK | Identificador único |
| `org_id` | `uuid` | FK → organizaciones.id, NOT NULL | Organización propietaria |
| `nombre` | `text` | NOT NULL | Nombre del local |
| `ubigeo` | `char(6)` | NOT NULL, FK → ubigeos.codigo | Código INEI (2 dpto + 2 prov + 2 dist) |
| `distrito` | `text` | NOT NULL | Nombre del distrito — variable geográfica ML |
| `activa` | `boolean` | NOT NULL, default `true` | Estado operativo del local |

---

## Dominio 2 — Catálogo de Productos

### `productos`

Catálogo maestro de medicamentos. No contiene stock ni precios.

| Columna | Tipo | Restricción | Descripción |
|---|---|---|---|
| `id` | `uuid` | PK | Identificador único |
| `org_id` | `uuid` | FK → organizaciones.id, NOT NULL | Organización que gestiona el catálogo |
| `codigo_interno` | `text` | UQ, NOT NULL | SKU interno (`codigo_producto` para ML) |
| `nombre_comercial` | `text` | NOT NULL | Nombre comercial del producto |
| `principio_activo` | `text` | NOT NULL | DCI — ingrediente farmacéutico activo |
| `forma_farmaceutica` | `text` | NOT NULL | Tableta, jarabe, inyectable, cápsula… |
| `concentracion` | `text` | NOT NULL | Ej: 500mg, 1g, 250mg/5ml |
| `laboratorio` | `text` | NOT NULL | Fabricante o laboratorio titular |
| `codigo_barras` | `text` | UQ, nullable | EAN/GS1 — puede ser nulo si el caso de estudio no lo registra |
| `categoria_terapeutica` | `text` | NOT NULL | Analgésico, antibiótico, antihipertensivo… (feature ML) |
| `clasificacion` | `enum('OTC','receta','generico')` | NOT NULL | Clasificación regulatoria DIGEMID |
| `requiere_receta` | `boolean` | NOT NULL | Indicador explícito — un genérico puede requerir receta |
| `estado` | `enum('activo','inactivo','descontinuado')` | NOT NULL, default `'activo'` | Ciclo de vida del producto |

> Se excluyen del catálogo activo los medicamentos con cambios regulatorios durante el periodo de estudio y los que requieren refrigeración controlada (exclusiones del ACP).

---

### `precios`

Historial de precios por producto. No es módulo de ventas — es la fuente de `precio_venta` y `precio_costo` requeridos para el entrenamiento ML.

| Columna | Tipo | Restricción | Descripción |
|---|---|---|---|
| `id` | `uuid` | PK | Identificador único |
| `producto_id` | `uuid` | FK → productos.id, NOT NULL | Producto al que aplica el precio |
| `botica_id` | `uuid` | FK → boticas.id, nullable | NULL = precio base de droguería central |
| `precio_venta` | `numeric(10,2)` | NOT NULL | Precio de venta al público en soles (S/) |
| `precio_costo` | `numeric(10,2)` | NOT NULL | Costo de compra al proveedor (S/) |
| `vigente_desde` | `timestamptz` | NOT NULL | Inicio de vigencia |
| `vigente_hasta` | `timestamptz` | nullable | NULL = precio actualmente vigente |

---

## Dominio 3 — Inventario

### `stock_ubicaciones`

Fuente de verdad del stock actual por producto y ubicación. Se actualiza automáticamente mediante trigger.

| Columna | Tipo | Restricción | Descripción |
|---|---|---|---|
| `id` | `uuid` | PK | Identificador único |
| `producto_id` | `uuid` | FK → productos.id, NOT NULL | Producto |
| `ubicacion_tipo` | `enum('drogueria','botica')` | NOT NULL | Tipo de ubicación |
| `ubicacion_id` | `uuid` | nullable | ID de botica; NULL = droguería central |
| `cantidad_disponible` | `int` | NOT NULL, default 0 | Unidades en stock (`stock_actual` para ML) |
| `stock_minimo` | `int` | NOT NULL | Umbral de alerta de quiebre (feature ML) |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | Última actualización por trigger |

---

### `lotes`

Control de lotes activos. Permite aplicar FEFO (First Expired, First Out) usando `fecha_vencimiento`.

| Columna | Tipo | Restricción | Descripción |
|---|---|---|---|
| `id` | `uuid` | PK | Identificador único |
| `producto_id` | `uuid` | FK → productos.id, NOT NULL | Producto al que pertenece |
| `ubicacion_tipo` | `enum('drogueria','botica')` | NOT NULL | Dónde está físicamente |
| `ubicacion_id` | `uuid` | nullable | ID de botica; NULL = droguería central |
| `numero_lote` | `text` | NOT NULL | Número del fabricante (trazabilidad) |
| `fecha_vencimiento` | `date` | NOT NULL | Fecha de vencimiento — feature ML importante |
| `cantidad` | `int` | NOT NULL | Unidades disponibles en este lote |
| `proveedor_id` | `uuid` | FK → proveedores.id, nullable | Solo aplica en droguería (entradas de compra) |

---

### `movimientos_inventario`

Log inmutable de auditoría. Nunca se modifica ni elimina. Es la tabla central para construir el dataset de entrenamiento ML: de aquí se deriva la demanda histórica (`cantidad_vendida`) por producto, ubicación y período.

| Columna | Tipo | Restricción | Descripción |
|---|---|---|---|
| `id` | `uuid` | PK | Identificador único |
| `producto_id` | `uuid` | FK → productos.id, NOT NULL | Producto involucrado |
| `lote_id` | `uuid` | FK → lotes.id, NOT NULL | Lote específico |
| `ubicacion_tipo` | `enum('drogueria','botica')` | NOT NULL | Dónde ocurre el movimiento |
| `ubicacion_id` | `uuid` | nullable | ID de botica; NULL = droguería central |
| `tipo_movimiento` | `enum('entrada','salida','ajuste','merma','devolucion')` | NOT NULL | Naturaleza del movimiento — crítico para ML |
| `cantidad` | `int` | NOT NULL | Unidades (positivo = entrada, negativo = salida/merma) |
| `motivo` | `text` | NOT NULL | Descripción obligatoria del motivo |
| `usuario_id` | `uuid` | FK → auth.users, NOT NULL | Quién registró |
| `transferencia_id` | `uuid` | FK → transferencias.id, nullable | Vincula a transferencia si aplica |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | Fecha y hora exacta — `fecha_venta` para ML |

**Filtros obligatorios al construir el dataset de entrenamiento:**

```python
# Solo movimientos que representan demanda real del cliente
tipo_movimiento_validos = ["salida"]

# Excluir explícitamente — no son demanda
tipo_movimiento_excluidos = ["entrada", "ajuste", "merma", "devolucion"]

# Historia mínima para que SARIMA detecte estacionalidad
meses_minimos_historia = 12
# Recomendación mínima para primer entrenamiento: 6 meses de datos limpios

# Solo productos activos y dentro del alcance del dataset (sin cambios regulatorios, sin refrigeración)
estado_producto = "activo"
```

---

## Dominio 4 — Distribución y Proveedores

### `proveedores`

Proveedores nacionales e internacionales.

| Columna | Tipo | Restricción | Descripción |
|---|---|---|---|
| `id` | `uuid` | PK | Identificador único |
| `org_id` | `uuid` | FK → organizaciones.id, NOT NULL | Organización que gestiona este proveedor |
| `razon_social` | `text` | NOT NULL | Nombre legal del proveedor |
| `tipo_identificacion` | `enum('ruc','nit','tax_id','vat','otro')` | NOT NULL | Tipo de identificación tributaria |
| `numero_identificacion` | `text` | NOT NULL | Número de identificación |
| `pais_origen` | `char(2)` | NOT NULL, default `'PE'` | ISO 3166-1 alpha-2 |
| `lead_time_dias` | `int` | NOT NULL | Días promedio de reposición — feature "oro" ML |
| `contacto` | `text` | nullable | Nombre del contacto comercial |
| `activo` | `boolean` | NOT NULL, default `true` | Estado del proveedor |

**Constraint:** `UNIQUE (tipo_identificacion, numero_identificacion)`

---

### `transferencias`

Despachos desde droguería central hacia boticas (transferencia_central) o entre boticas (redistribucion). La central y el operador logístico crean transferencias; el visor de botica solo confirma recepción.

| Columna | Tipo | Restricción | Descripción |
|---|---|---|---|
| `id` | `uuid` | PK | Identificador único |
| `tipo_transferencia` | `enum('transferencia_central','redistribucion')` | NOT NULL | Distingue envío desde droguería vs redistribución entre boticas |
| `origen_tipo` | `enum('drogueria','botica')` | NOT NULL | Tipo de ubicación origen |
| `origen_id` | `uuid` | FK → boticas.id, nullable | ID de botica origen; NULL si origen_tipo = 'drogueria' |
| `destino_tipo` | `enum('drogueria','botica')` | NOT NULL, default 'botica' | Tipo de ubicación destino |
| `destino_id` | `uuid` | FK → boticas.id, NOT NULL | Botica destino |
| `estado` | `enum('creada','en_transito','recibida','cancelada')` | NOT NULL, default `'creada'` | Estado del flujo de distribución |
| `creado_por` | `uuid` | FK → auth.users, NOT NULL | Usuario que creó la transferencia |
| `fecha_despacho` | `timestamptz` | nullable | Cuándo salió de origen |
| `fecha_recepcion` | `timestamptz` | nullable | Cuándo fue recibida en destino |

**Reglas de estado:**
- `creada` → solo se puede enviar (→ `en_transito`) o cancelar (→ `cancelada`)
- `en_transito` → solo se puede confirmar recepción (→ `recibida`)
- `recibida` / `cancelada` → solo lectura, no se permiten más cambios

---

### `transferencias_items`

Detalle de productos y lotes por transferencia.

| Columna | Tipo | Restricción | Descripción |
|---|---|---|---|
| `id` | `uuid` | PK | Identificador único |
| `transferencia_id` | `uuid` | FK → transferencias.id, NOT NULL | Transferencia |
| `producto_id` | `uuid` | FK → productos.id, NOT NULL | Producto transferido |
| `lote_id` | `uuid` | FK → lotes.id, NOT NULL | Lote seleccionado con criterio FEFO |
| `cantidad` | `int` | NOT NULL | Unidades transferidas |

---

### `ordenes_compra`

Órdenes de compra a proveedores. Soporte documental y operativo para planificación de reabastecimiento — no es un ERP ni compras automatizadas.

| Columna | Tipo | Restricción | Descripción |
|---|---|---|---|
| `id` | `uuid` | PK | Identificador único |
| `proveedor_id` | `uuid` | FK → proveedores.id, NOT NULL | Proveedor al que se ordena |
| `creado_por` | `uuid` | FK → auth.users, NOT NULL | Usuario que registró la orden (Operador) |
| `estado` | `enum('pendiente','aprobada','rechazada','completada')` | NOT NULL, default `'pendiente'` | Estado de la orden |
| `fecha_estimada_entrega` | `date` | nullable | Fecha estimada de recepción |
| `observaciones` | `text` | nullable | Notas adicionales |
| `aprobado_por` | `uuid` | FK → auth.users, nullable | Admin que aprobó o rechazó |
| `fecha_aprobacion` | `timestamptz` | nullable | Cuándo se aprobó/rechazó |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | Fecha de creación |

**Reglas de flujo:**
- Operador crea → estado `pendiente`
- Admin aprueba → `aprobada` o rechaza → `rechazada`
- Solo el operador puede marcar como `completada` cuando llega la mercadería

---

### `ordenes_compra_items`

Detalle de productos por orden de compra.

| Columna | Tipo | Restricción | Descripción |
|---|---|---|---|
| `id` | `uuid` | PK | Identificador único |
| `orden_compra_id` | `uuid` | FK → ordenes_compra.id, NOT NULL | Orden de compra |
| `producto_id` | `uuid` | FK → productos.id, NOT NULL | Producto solicitado |
| `cantidad` | `int` | NOT NULL | Unidades solicitadas |
| `precio_unitario` | `numeric(10,2)` | NOT NULL | Precio unitario acordado |

---

## Dominio 5 — Machine Learning

### `recomendaciones_ml`

Recomendaciones operativas generadas por el modelo ML para transferencias y redistribuciones. El usuario puede confirmar o rechazar; al confirmar, se crea automáticamente un registro en `transferencias`.

| Columna | Tipo | Restricción | Descripción |
|---|---|---|---|
| `id` | `uuid` | PK | Identificador único |
| `producto_id` | `uuid` | FK → productos.id, NOT NULL | Producto sobre el que se recomienda |
| `botica_destino_id` | `uuid` | FK → boticas.id, NOT NULL | Botica con riesgo de desabastecimiento |
| `botica_origen_id` | `uuid` | FK → boticas.id, nullable | Botica con excedente (NULL si origen es droguería central) |
| `tipo_recomendacion` | `enum('transferencia','redistribucion')` | NOT NULL | Tipo de acción sugerida |
| `cantidad_sugerida` | `int` | NOT NULL | Unidades sugeridas |
| `motivo` | `text` | NOT NULL | Descripción del análisis ML |
| `confianza_modelo` | `float` | NOT NULL | Nivel de confianza del modelo (0–100) |
| `estado` | `enum('pendiente','confirmada','rechazada','ejecutada')` | NOT NULL, default `'pendiente'` | Estado de la recomendación |
| `transferencia_id` | `uuid` | FK → transferencias.id, nullable | Transferencia creada al confirmar |
| `confirmado_por` | `uuid` | FK → auth.users, nullable | Usuario que confirmó/rechazó |
| `confirmado_en` | `timestamptz` | nullable | Cuándo se confirmó/rechazó |
| `generado_en` | `timestamptz` | NOT NULL, default `now()` | Cuándo se generó la recomendación |

**Flujo:**
1. ML detecta riesgo de quiebre o sobrestock → genera recomendación (`pendiente`)
2. Usuario revisa → confirma (`confirmada`) o rechaza (`rechazada`)
3. Al confirmar → sistema crea transferencia/redistribución y vincula (`ejecutada`, `transferencia_id`)

---

### `predicciones_ml`

Salida del servicio ML. El servicio Python escribe aquí — el frontend solo lee. Vinculada a la versión exacta del modelo para auditoría y rollback.

| Columna | Tipo | Restricción | Descripción |
|---|---|---|---|
| `id` | `uuid` | PK | Identificador único |
| `producto_id` | `uuid` | FK → productos.id, NOT NULL | Producto predicho |
| `botica_id` | `uuid` | FK → boticas.id, NOT NULL | Botica para la que se predice |
| `periodo_inicio` | `date` | NOT NULL | Inicio del horizonte de predicción |
| `periodo_fin` | `date` | NOT NULL | Fin del horizonte de predicción |
| `cantidad_predicha` | `float` | NOT NULL | Demanda estimada para el periodo |
| `intervalo_inf` | `float` | NOT NULL | Límite inferior del intervalo de confianza |
| `intervalo_sup` | `float` | NOT NULL | Límite superior del intervalo de confianza |
| `confianza` | `float` | NOT NULL | Nivel de confianza del modelo (0 a 1) |
| `modelo_version_id` | `uuid` | FK → modelos_ml.id, NOT NULL | Versión exacta del modelo (auditable) |
| `generado_en` | `timestamptz` | NOT NULL, default `now()` | Timestamp de generación |

> **Realtime:** esta tabla tiene `REPLICA IDENTITY FULL` habilitada. El Panel ML del frontend se suscribe al canal `predicciones_ml` usando `supabase.channel('predicciones_ml').on('postgres_changes', ...)`.

---

### `modelos_ml`

Model registry completo. Soporta el patrón champion–challenger: un modelo nuevo puede entrenarse en `staging` mientras el actual sigue en `production`, y solo se promociona si supera al champion en métricas de holdout.

| Columna | Tipo | Restricción | Descripción |
|---|---|---|---|
| `id` | `uuid` | PK | Identificador único |
| `version` | `text` | NOT NULL, UQ | Ej: v1.0.0, v1.3.0 (semver) |
| `algoritmo` | `text` | NOT NULL | Ej: 'SARIMA+XGBoost' |
| `hash` | `text` | NOT NULL | SHA-256 del modelo serializado (`.pkl`) |
| `fecha_entrenamiento` | `timestamptz` | NOT NULL | Cuándo se entrenó |
| `fecha_promocion` | `timestamptz` | nullable | Cuándo pasó a `production` |
| `mae` | `float` | NOT NULL | Mean Absolute Error en holdout |
| `rmse` | `float` | NOT NULL | Root Mean Square Error en holdout |
| `mape` | `float` | NOT NULL | **MAPE en holdout — meta ≤ 20% (OE3.I1 del ACP)** |
| `psi_baseline_jsonb` | `jsonb` | NOT NULL | Distribuciones de referencia de las features al momento del entrenamiento |
| `datos_desde` | `date` | NOT NULL | Inicio del período de entrenamiento |
| `datos_hasta` | `date` | NOT NULL | Fin del período de entrenamiento |
| `status` | `enum('staging','production','archived')` | NOT NULL, default `'staging'` | Estado en el ciclo de vida |
| `activo` | `boolean` | NOT NULL, default `false` | Vista derivada de `status='production'` — compatibilidad |

**Constraint:** `CREATE UNIQUE INDEX idx_modelos_ml_production ON modelos_ml (status) WHERE status = 'production'`

> Solo una fila puede tener `status='production'` simultáneamente. Este índice parcial es la garantía operativa del champion-challenger.

**Estructura de `psi_baseline_jsonb`:**

```json
{
  "cantidad": {"bins": [0, 5, 10, 20, 50, 100], "frecuencias": [0.4, 0.25, 0.15, 0.12, 0.08]},
  "precio_venta": {"bins": [0, 5, 10, 20, 50], "frecuencias": [0.3, 0.4, 0.2, 0.1]},
  "dia_semana": {"bins": [0, 1, 2, 3, 4, 5, 6], "frecuencias": [0.14, 0.15, 0.15, 0.16, 0.17, 0.13, 0.10]}
}
```

**Naming convention en Supabase Storage:** `models/{version}/{hash}.pkl` y `models/{version}/{hash}_config.json`
Esto permite que `promote_model.ts` cargue el artefacto exacto usando el `hash` de la tabla para cualquier rollback.

---

### `inferencias`

Audit log de cada predicción servida individualmente. Base para calcular el MAPE rolling y detectar drift.

| Columna | Tipo | Restricción | Descripción |
|---|---|---|---|
| `id` | `uuid` | PK | Identificador único |
| `producto_id` | `uuid` | FK → productos.id, NOT NULL | Producto sobre el que se infiere |
| `botica_id` | `uuid` | FK → boticas.id, NOT NULL | Botica para la que se infiere |
| `modelo_version_id` | `uuid` | FK → modelos_ml.id, NOT NULL | Versión exacta del modelo usado |
| `fecha_pred` | `date` | NOT NULL | Fecha para la que se predice la demanda |
| `valor_pred` | `float` | NOT NULL | Valor predicho |
| `features_jsonb` | `jsonb` | NOT NULL | Snapshot de los features usados |
| `valor_real` | `float` | nullable | Demanda real observada — backfill por job diario |
| `error_absoluto` | `float` | nullable | `ABS(valor_real - valor_pred)` — calculado al actualizar |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | Cuándo se generó la inferencia |
| `updated_at` | `timestamptz` | nullable | Cuándo se actualizó con el valor real |

**Índices:**
- `idx_inferencias_modelo_fecha` sobre `(modelo_version_id, fecha_pred)` — queries de MAPE rolling
- `idx_inferencias_producto_botica` sobre `(producto_id, botica_id, fecha_pred)` — análisis por SKU/ubicación

**Mecanismo de backfill de `valor_real` (resuelve gap crítico):**

El campo `valor_real` se rellena mediante un job `pg_cron` que corre diariamente a las 02:30 UTC (inmediatamente después del job de cleanup):

```sql
-- Job pg_cron: backfill_inferencias — diario 02:30 UTC
-- Cruza inferencias del día anterior con los movimientos reales registrados
UPDATE inferencias i
SET
  valor_real = COALESCE(m.total_salida, 0),
  error_absoluto = ABS(COALESCE(m.total_salida, 0) - i.valor_pred),
  updated_at = now()
FROM (
  SELECT
    producto_id,
    ubicacion_id AS botica_id,
    DATE(created_at) AS fecha,
    SUM(cantidad) AS total_salida
  FROM movimientos_inventario
  WHERE tipo_movimiento = 'salida'
    AND DATE(created_at) = CURRENT_DATE - INTERVAL '1 day'
  GROUP BY producto_id, ubicacion_id, DATE(created_at)
) m
WHERE i.producto_id = m.producto_id
  AND i.botica_id = m.botica_id
  AND i.fecha_pred = m.fecha
  AND i.valor_real IS NULL;
```

> Este backfill es el requisito previo para que `drift_metricas.mape_rolling` tenga datos reales con qué calcularse.

**Estructura de `features_jsonb`:**

```json
{
  "stock_actual": 45,
  "stock_minimo": 20,
  "precio_venta": 12.50,
  "lead_time_dias": 21,
  "dia_semana": 3,
  "semana_del_anio": 28,
  "mes": 7,
  "categoria_terapeutica": "analgesico",
  "requiere_receta": false
}
```

---

### `drift_metricas`

Historial de métricas de drift calculadas semanalmente. Sustenta el KPI "reentrenamientos evitados".

| Columna | Tipo | Restricción | Descripción |
|---|---|---|---|
| `id` | `uuid` | PK | Identificador único |
| `modelo_version_id` | `uuid` | FK → modelos_ml.id, NOT NULL | Modelo evaluado |
| `fecha_calculo` | `timestamptz` | NOT NULL, default `now()` | Cuándo se ejecutó el job de drift |
| `ventana_dias` | `int` | NOT NULL, default 28 | Ventana de tiempo evaluada (4 semanas) |
| `psi_features` | `jsonb` | NOT NULL | PSI calculado por feature |
| `psi_max` | `float` | NOT NULL | Máximo PSI — para evaluación rápida |
| `mape_rolling` | `float` | NOT NULL | MAPE realizado en la ventana (calculado desde `inferencias`) |
| `mape_baseline` | `float` | NOT NULL | MAPE de referencia del modelo en holdout |
| `ratio_mape` | `float` | NOT NULL | `mape_rolling / mape_baseline` — > 1.25 indica degradación |
| `tendencia` | `enum('estable','degradando','mejorando')` | NOT NULL | Diagnóstico cualitativo |
| `requiere_retraining` | `boolean` | NOT NULL | Decisión final del job |
| `reentrenamiento_disparado` | `boolean` | NOT NULL, default `false` | Si efectivamente se invocó /retrain |

**Índice:** `idx_drift_modelo_fecha` sobre `(modelo_version_id, fecha_calculo)`

**Reglas de decisión:**

```sql
requiere_retraining =
  (psi_max > 0.2)
  OR (ratio_mape > 1.25 AND tendencia = 'degradando')
  OR (existe_alerta_consecutiva_2_semanas)
```

> **Distinción de umbrales:** `psi_max > 0.2` o `ratio_mape > 1.25` disparan el reentrenamiento vía `pg_net`. `psi_max > 0.3` o `ratio_mape > 1.5` disparan además la notificación vía `alert_dispatch.ts` (umbral de alerta crítica al usuario).

> **Realtime:** esta tabla tiene `REPLICA IDENTITY FULL` habilitada. El Panel ML se suscribe al canal `drift_metricas` para visualizar el estado del modelo en tiempo real.

---

### `alertas_ml`

Alertas generadas automáticamente. Alimenta el dashboard central y el Panel ML.

| Columna | Tipo | Restricción | Descripción |
|---|---|---|---|
| `id` | `uuid` | PK | Identificador único |
| `tipo` | `enum('quiebre','sobrestock','vencimiento_proximo','prediccion')` | NOT NULL | Tipo de alerta |
| `tipo_origen` | `enum('regla','modelo')` | NOT NULL | Distingue alerta por regla vs alerta predictiva ML |
| `producto_id` | `uuid` | FK → productos.id, NOT NULL | Producto en alerta |
| `botica_id` | `uuid` | FK → boticas.id, NOT NULL | Botica afectada |
| `urgencia` | `enum('alta','media','baja')` | NOT NULL | Nivel de urgencia |
| `resuelta` | `boolean` | NOT NULL, default `false` | Si fue atendida |
| `generado_en` | `timestamptz` | NOT NULL, default `now()` | Cuándo se generó |

> **Alineación con frontend:** el mock `alertas.js` contiene alertas de tipo "regla" (quiebre, vencimiento, sobrestock) y "predictivas" del modelo. El campo `tipo_origen` resuelve esta distinción. El tipo `prediccion` en el enum cubre las alertas predictivas del Panel ML.

> **Realtime:** esta tabla tiene `REPLICA IDENTITY FULL` habilitada. El Panel ML y el Portal Central se suscriben al canal `alertas_ml` para recibir alertas en tiempo real.

---

## Tabla de referencia auxiliar

### `ubigeos`

Padrón INEI. Se carga una sola vez como seed y no cambia.

| Columna | Tipo | Restricción | Descripción |
|---|---|---|---|
| `codigo` | `char(6)` | PK | Código INEI |
| `distrito` | `text` | NOT NULL | Nombre del distrito |
| `provincia` | `text` | NOT NULL | Nombre de la provincia |
| `departamento` | `text` | NOT NULL | Nombre del departamento |

---

## Suscripciones Realtime (resuelve gap crítico)

Las siguientes tablas tienen `REPLICA IDENTITY FULL` habilitada en Supabase para soportar suscripciones WebSocket en tiempo real:

| Tabla | Canal Realtime | Suscriptor | Propósito |
|---|---|---|---|
| `alertas_ml` | `alertas_ml` | Portal Central + Panel ML | Alertas de stock en tiempo real al dashboard |
| `predicciones_ml` | `predicciones_ml` | Panel ML | Actualización del gráfico de pronóstico al regenerar predicciones |
| `drift_metricas` | `drift_metricas` | Panel ML (Admin) | Visualización del estado del modelo y métricas de drift |

**Implementación en frontend (supabase-js):**

```javascript
// Ejemplo: suscripción a alertas_ml en el Panel ML
supabase
  .channel('alertas_ml')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'alertas_ml',
    filter: `botica_id=eq.${boticaId}`
  }, (payload) => {
    useAlertas.getState().agregarAlerta(payload.new)
  })
  .subscribe()
```

> RLS filtra automáticamente los eventos Realtime según el `botica_id` del usuario autenticado.

---

## Componentes de orquestación serverless

| Componente | Función | Ejecución |
|---|---|---|
| `pg_cron` Job 1 | `calc_drift_semanal()` — calcula PSI + MAPE rolling | Lunes 03:00 UTC |
| `pg_cron` Job 2 | `decide_retrain()` — evalúa umbrales y dispara reentrenamiento | Lunes 03:15 UTC |
| `pg_cron` Job 3 | `cleanup()` — lotes expirados | Diario 02:00 UTC |
| `pg_cron` Job 4 | `backfill_inferencias()` — rellena `valor_real` en `inferencias` | Diario 02:30 UTC |
| `pg_net` | `http_post` al endpoint `/retrain` de Cloud Run cuando `requiere_retraining = true` | Llamado por Job 2 |
| Supabase Vault | Almacén cifrado del token de autenticación al servicio Cloud Run | Accedido solo por service_role en pg_cron |
| `promote_model.ts` | Champion-challenger: compara nuevo modelo vs production; promueve si MAPE mejora ≥ 5% | Llamado por Cloud Run al finalizar /retrain |
| `alert_dispatch.ts` | Notificación de drift crítico cuando `psi_max > 0.3` o `ratio_mape > 1.5` | Llamado por Job 1 si se supera umbral crítico |

---

## Diagrama de relaciones

```
organizaciones ──< boticas
organizaciones ──< productos
organizaciones ──< proveedores

ubigeos ──< boticas

productos ──< stock_ubicaciones
productos ──< lotes
productos ──< movimientos_inventario
productos ──< precios
productos ──< predicciones_ml
productos ──< inferencias
productos ──< alertas_ml
productos ──< transferencias_items

boticas ──< stock_ubicaciones
boticas ──< lotes
boticas ──< movimientos_inventario
boticas ──< precias
boticas ──< predicciones_ml
boticas ──< inferencias
boticas ──< alertas_ml
boticas ──< transferencias          (como destino)
boticas ──< transferencias          (como origen, en redistribucion)

proveedores ──< lotes
proveedores ──< ordenes_compra

transferencias ──< transferencias_items
transferencias_items >── lotes

ordenes_compra ──< ordenes_compra_items

modelos_ml ──< predicciones_ml         (auditoría: predicción → versión)
modelos_ml ──< inferencias              (auditoría: inferencia → versión)
modelos_ml ──< drift_metricas           (monitoreo: drift por versión activa)
modelos_ml ──< recomendaciones_ml       (recomendaciones generadas por el modelo activo)

recomendaciones_ml >── transferencias   (opcional: creada al confirmar recomendación)

inferencias ──> drift_metricas          (mape_rolling calculado desde inferencias.error_absoluto)
movimientos_inventario ──> inferencias  (backfill de valor_real vía pg_cron Job 4)
```

---

## Features para el modelo híbrido SARIMA + XGBoost

### Serie temporal — input principal de SARIMA

| Feature | Tabla | Columna | Notas |
|---|---|---|---|
| Demanda histórica | `movimientos_inventario` | `cantidad` + `created_at` | Solo `tipo_movimiento = 'salida'` |
| Fecha de cada movimiento | `movimientos_inventario` | `created_at` | Base para derivaciones temporales |

### Features temporales derivadas (calculadas en Python)

| Feature derivada | Cálculo | Uso |
|---|---|---|
| `dia_semana` | `created_at.weekday()` | Patrones semanales |
| `semana_del_anio` | `created_at.isocalendar().week` | Ciclos anuales |
| `mes` | `created_at.month` | Estacionalidad mensual |
| `es_inicio_mes` | `created_at.day <= 5` | Picos de compra por quincena |
| `dias_para_vencimiento` | `fecha_vencimiento - created_at` | Presión de rotación por lote |

### Features de producto — XGBoost

| Feature | Tabla | Columna |
|---|---|---|
| Código de producto | `productos` | `codigo_interno` |
| Principio activo | `productos` | `principio_activo` |
| Categoría terapéutica | `productos` | `categoria_terapeutica` |
| Laboratorio | `productos` | `laboratorio` |
| Forma farmacéutica | `productos` | `forma_farmaceutica` |
| Concentración | `productos` | `concentracion` |
| Requiere receta | `productos` | `requiere_receta` |

### Features de inventario — XGBoost

| Feature | Tabla | Columna |
|---|---|---|
| Stock actual | `stock_ubicaciones` | `cantidad_disponible` |
| Stock mínimo | `stock_ubicaciones` | `stock_minimo` |
| Fecha de vencimiento | `lotes` | `fecha_vencimiento` |

### Features de precio — XGBoost

| Feature | Tabla | Columna |
|---|---|---|
| Precio de venta | `precios` | `precio_venta` |
| Costo de compra | `precios` | `precio_costo` |

### Features geográficas y de proveedor — XGBoost

| Feature | Tabla | Columna |
|---|---|---|
| Distrito de la botica | `boticas` | `distrito` |
| Lead time del proveedor | `proveedores` | `lead_time_dias` |

---

## Cobertura del dataset del contacto

| Columna del contacto | Cubierta por | Estado |
|---|---|---|
| `fecha_venta` | `movimientos_inventario.created_at` | ✅ |
| `codigo_producto` | `productos.codigo_interno` | ✅ |
| `nombre_producto` | `productos.nombre_comercial` | ✅ |
| `cantidad_vendida` | `movimientos_inventario.cantidad` (salidas) | ✅ |
| `tipo_movimiento` | `movimientos_inventario.tipo_movimiento` | ✅ |
| `stock_actual` | `stock_ubicaciones.cantidad_disponible` | ✅ |
| `precio_venta` | `precios.precio_venta` | ✅ |
| `categoria_producto` | `productos.categoria_terapeutica` | ✅ |
| `principio_activo` | `productos.principio_activo` | ✅ |
| `laboratorio` | `productos.laboratorio` | ✅ |
| `requiere_receta` | `productos.requiere_receta` | ✅ |
| `forma_farmaceutica` | `productos.forma_farmaceutica` | ✅ |
| `concentracion` | `productos.concentracion` | ✅ |
| `stock_minimo` | `stock_ubicaciones.stock_minimo` | ✅ |
| `fecha_vencimiento` | `lotes.fecha_vencimiento` | ✅ |
| `distrito` | `boticas.distrito` | ✅ |
| `lead_time_proveedor` | `proveedores.lead_time_dias` | ✅ |
| `proveedor` | `proveedores.razon_social` | ✅ |
| `lote` | `lotes.numero_lote` | ✅ |
| `costo_compra` | `precios.precio_costo` | ✅ |
| `dia_semana` | Derivado de `created_at` en Python | ✅ |
| `mes` | Derivado de `created_at` en Python | ✅ |
| `promociones` | — | ❌ Excluido del alcance (ACP) |
| `temporada` | Derivado de `mes` en Python | ⚠️ Parcial — sin registro explícito |
| `feriado` | — | ❌ Excluido del alcance (ACP) |
| Variables exógenas (clima, epidemiología) | — | ❌ Excluido del alcance (ACP) |

---

## Diagnóstico de datos — Boticas Jhodaal

| Dato ausente | Impacto en ML | Acción |
|---|---|---|
| Tipo de movimiento (distinción salida/ajuste/merma) | **Crítico** — sin esto el dataset de entrenamiento es inválido | Implementación obligatoria desde Fase 1 (ya implementada) |
| Registro de merma con `tipo_movimiento` | **Alto** — contamina la demanda | Campo obligatorio en el formulario |
| Lead time de reposición | **Alto** — crítico para punto de pedido | Obtener del equipo de compras |
| Stock mínimo por producto | Medio — afecta alertas | Definir con control de stock |
| Motivo del movimiento | Medio — útil para auditoría | Campo obligatorio en el formulario |
| Registro de devoluciones | Medio — contamina demanda si no se filtra | Cubierto con `tipo_movimiento = 'devolucion'` |
| Código de barras | Bajo — `codigo_interno` lo reemplaza | Registrar desde el inicio |

**Conclusión:** El modelo híbrido SARIMA + XGBoost es viable siempre que la plataforma registre `tipo_movimiento` correctamente desde el primer día. La Fase 1 ya implementa el formulario con este campo como obligatorio. Se recomienda un mínimo de 6 meses de datos limpios antes del primer entrenamiento formal y 12 meses para que SARIMA detecte estacionalidad anual con confianza.
