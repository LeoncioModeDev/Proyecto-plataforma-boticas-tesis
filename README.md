# botica-demand-ml

Plataforma web inteligente para la gestión de inventario y predicción de demanda de medicamentos en boticas del Perú.
Proyecto de tesis — **Universidad Peruana de Ciencias Aplicadas (UPC)**, 2026.
Empresa: **D&R Farma**

---

## Estado actual — Fase 1 (Frontend con datos mock)

El frontend está **completamente construido y funcional**. No hay conexión real a Supabase ni al servicio de Machine Learning. Todos los datos provienen de archivos mock en `src/mock-data/` alineados con la **Arquitectura Física v3** y **Arquitectura Lógica v4**.

---

## Características implementadas

### Sistema de autenticación y roles

- Login real con Supabase Auth (email + contraseña); sin selector mock
- Página 403 (`/no-autorizado`) cuando el rol no tiene permiso para una ruta
- Tres roles con portales y permisos completamente distintos:
  - **Admin Central** (`ADMIN_CENTRAL`) — acceso total a los 3 portales (Central, Operaciones, Botica) y Panel ML completo. Sin restricción RLS.
  - **Operador Logístico Central** (`OPERADOR_DROGUERIA`) — acceso al Portal Operaciones (dashboard, inventario, distribución, proveedores, órdenes de compra) y al Portal Botica. Sin restricción RLS. Sin acceso al Portal Central ni al Panel ML.
  - **Visor de Botica** (`VISOR_BOTICA`) — acceso solo al Portal Botica con datos filtrados por RLS a su botica asignada.
- Protección de rutas por rol con `RutaProtegida` (4 grupos: Portal Central, Portal Operaciones, Portal Botica, Panel ML)
- Redirección automática desde `/` según el rol activo
- Sidebar con branding dinámico ("Portal Central", "Portal Operaciones", "Portal Botica") según el rol
- Breadcrumbs contextuales por portal en `MigaDePan.jsx`
- `RutaSegunRol` — componente que renderiza children según el rol del usuario (vía props o objeto `roles`), con fallback a 403 si no hay match
- `RutaProtegida` redirige a `/no-autorizado` en vez de `/iniciar-sesion` cuando el rol no corresponde
- El store `useAutenticacion.js` expone `usuario.boticaId` para filtrado RLS en frontend
- Sistema de permisos RLS centralizado en `src/utilities/permisos.js`

### Portal Central (Admin Central)

- **Dashboard** — KPI cards, gráfica de tendencia de stock, alertas recientes y predicciones destacadas
- **Módulo de Inventario** con 6 submódulos:
  - **Catálogo de Productos** — con codigoInterno, categoriaTerapeutica, requiereReceta, clasificación OTC/receta/generico
    - Formulario de alta/edición con validaciones Zod
    - Vista de detalle del producto con botón editar y desactivar/activar
  - **Stock** — por ubicación con alertas visuales (verde/amarillo/rojo)
  - **Lotes** — ordenados por FEFO, colores de urgencia por vencimiento
    - Formulario de alta de lote
  - **Movimientos** — historial inmutable con tipos: entrada/salida/ajuste/merma/devolucion
    - Formulario de movimiento (entrada/salida)
  - **Ajustes** — ajustes positivos/negativos y mermas
    - Formulario de ajuste de inventario
  - **Reportes** — Kardex, Stock Crítico, Resumen de Movimientos
- **Módulo de Distribución** — gestión unificada de transferencias (Despachos y Recepciones eliminados como módulos independientes):
  - **Transferencias** — tabla integral con ID, Tipo (Transferencia/Redistribución), Origen, Destino, Productos, Lotes FEFO (modal ordenado por vencimiento con alerta ≤30 días), Cant. Total, Creación, Envío, Recepción, Estado, Creador, Acciones (Crear/Enviar/Cancelar según estado). Scroll horizontal con `min-w-max`.
  - **Nueva Transferencia** — formulario con Origen predeterminado (Droguería Central), selector de Botica Destino, productos a transferir (selector + cantidad), observaciones. Validación con Zod.
  - **Redistribución** — `PanelRedistribucion.jsx` con análisis ML completo: stock actual/mínimo, alertas ML, predicciones ML, sobrestock, riesgo de quiebre, proximidad de vencimiento, lotes FEFO. Propuestas con origen, destino, productos, lotes sugeridos, cantidades, criterio FEFO, motivo y prioridad. Botones Aceptar (crea transferencia mock) y Rechazar.
  - **Historial** — historial filtrable por año y búsqueda
- **Módulo de Proveedores**:
  - Listado con identificación polimórfica (RUC/NIT/Tax ID/VAT por país)
  - Formulario con tipo de identificación, país de origen, lead time
  - Activar/desactivar proveedor con confirmación
  - **Órdenes de Compra** — registro, aprobación/rechazo (solo Admin), historial con filtros por proveedor/estado/fecha/producto
- **Módulo de Administración** (solo Admin Central):
  - **Usuarios** — CRUD completo: tabla con búsqueda y filtros, modal crear/editar, toggle activo/inactivo
  - **Boticas** — CRUD completo: gestión de ubicaciones tipo droguería/botica, modal crear/editar, toggle activa/inactiva
  - **Configuración General** — nombre del sistema, zona horaria, idioma, formato fecha, alertas, seguridad
  - **Auditoría** — tabla de logs con búsqueda, filtros por nivel/acción y modal de detalle
  - **Configuración Avanzada** — API endpoints, ML service, base de datos, cache, rate limiting, feature flags

### Portal Operaciones (solo Operador Logístico Central; Admin Central también accede)

- **Dashboard** — métricas operativas centrales
- **Módulo de Inventario** — Catálogo, Stock Global, Lotes, Movimientos, Ajustes, Reportes
- **Módulo de Distribución** — Transferencias (crear, enviar, cancelar), Redistribución (propuestas automáticas entre boticas con `PanelRedistribucion`)
- **Módulo de Proveedores** — Listar Proveedores y Órdenes de Compra
- **Alertas** — alertas operativas
- **Machine Learning** — Predicciones de demanda con selector de producto, gráfica con intervalos de confianza, insignia MAPE y tabla detallada con límites inferior/superior; Alertas de Demanda

### Portal Botica (Visor de Botica + Admin Central + Operador Logístico Central)

- **Dashboard** — métricas y resumen de la botica
- **Stock** — filtrado por botica asignada (RLS)
- **Lotes** — activos con orden FEFO, filtrados por botica (RLS)
- **Movimientos** — historial de la botica (RLS)
- **Transferencias** — tabla con columna Tipo, detalle expandible con lotes FEFO (nº lote, vencimiento, alerta ≤30 días), fechas de envío/recepción. Solo puede Confirmar Recepción (estado En Tránsito); no puede crear/enviar/cancelar. Filtrado RLS por botica.
- **Alertas** — alertas activas de la botica (RLS)
- **Pronóstico ML** — predicciones filtradas por botica (RLS)
- **Recomendaciones** — sugerencias de compra filtradas por botica (RLS)

### Panel ML (solo Admin Central)

El Panel ML en `/ml/*` es de acceso exclusivo para **Admin Central**:

- **Predicciones** — serie histórica + pronóstico a 3 meses con intervalos de confianza
- **Alertas** — diferenciadas: regla (quiebre/vencimiento/sobrestock) vs predictiva (modelo)
- **Recomendaciones Operativas** — sugerencias inteligentes de transferencia central o redistribución basadas en análisis ML completo (stock actual/mínimo, alertas, predicciones, sobrestock, quiebre, vencimiento, FEFO). Incluye botones Aceptar/Rechazar. Al aceptar, crea automáticamente la transferencia o redistribución mock correspondiente.
- **Monitoreo ML** — monitoreo técnico del modelo (solo Admin Central)

> El Operador Logístico Central tiene funcionalidades ML reducidas dentro del Portal Operaciones en `/operaciones/ml/*` (Predicciones de demanda y Alertas de Demanda), sin acceso al panel central.

### Diseño

- Estilo **Microsoft Fluent** — plano, limpio
- Paleta verde (`#107C41`) / blanco / negro
- Soporte nativo para **Modo Oscuro** (Dark Mode) y temas personalizados a través de variables CSS globales (`--color-fondo`, `--color-texto`).
- Sistema de diseño "Theme-aware" en Tailwind CSS (ej: `bg-fondo`, `text-principal`).
- Soporte para vista de pantalla completa (Fullscreen).
- Sidebar colapsable con highlight verde en módulo y sub-items activos, detección de hermanos con ruta prefijada para evitar selección múltiple, branding dinámico por portal
- Header fijo con breadcrumbs dinámicos, icono de portal contextual y contador de alertas

---

## Requisitos

- Node.js 18+
- npm 9+

---

## Instalación y uso

```bash
npm install
npm run dev
# → http://localhost:5173
```

### Scripts

```bash
npm run dev      # Servidor de desarrollo con HMR
npm run build    # Build de producción
npm run preview  # Preview del build
npm run lint     # Linter ESLint
```

---

## Stack tecnológico

| Categoría | Tecnología |
|---|---|
| Framework UI | React 19 |
| Bundler | Vite 5+ |
| Routing | React Router DOM v6 |
| Estilos | Tailwind CSS v3 |
| Tablas | TanStack Table v8 |
| Gráficas | Recharts v2 |
| Formularios | React Hook Form v7 |
| Validación | Zod v3 |
| Estado | Zustand v4 |
| Fechas | date-fns v3 |
| Iconos | Lucide React |

### Backend (no conectado — Fase 2+)

- **Supabase** — PostgreSQL, Auth JWT, Row-Level Security, Edge Functions, Realtime

### Servicio ML (no conectado — Fase 3+)

- **Python 3.10+** con **FastAPI**, SARIMA, XGBoost, scikit-learn

---

## Estructura del proyecto

```
botica-demand-ml/
├── src/
│   ├── App.jsx                    # Componente raíz
│   ├── main.jsx                  # Entry point React
│   │
│   ├── components/
│   │   ├── charts/
│   │   │   ├── GraficaArea.jsx
│   │   │   ├── GraficaBarras.jsx
│   │   │   ├── GraficaLinea.jsx
│   │   │   ├── GraficaRadar.jsx
│   │   │   ├── TarjetaMetrica.jsx
│   │   │   └── TarjetaMetricaKPI.jsx
│   │   │
│   │   ├── common/
│   │   │   ├── Alerta.jsx
│   │   │   ├── Boton.jsx
│   │   │   ├── CampoBusqueda.jsx
│   │   │   ├── Cargando.jsx
│   │   │   ├── ControlesInterfaz.jsx
│   │   │   ├── ErrorFrontend.jsx
│   │   │   ├── Insignia.jsx
│   │   │   ├── Modal.jsx
│   │   │   ├── ProveedorTema.jsx
│   │   │   ├── SinDatos.jsx
│   │   │   ├── Tabla.jsx
│   │   │   └── Tarjeta.jsx
│   │   │
│   │   ├── forms/
│   │   │   ├── CampoFecha.jsx
│   │   │   ├── CampoNumero.jsx
│   │   │   ├── CampoSeleccion.jsx
│   │   │   ├── CampoTexto.jsx
│   │   │   └── CampoTextoArea.jsx
│   │   │
│   │   └── navigation/
│   │       ├── BarraLateral.jsx
│   │       ├── BarraSuperior.jsx
│   │       ├── MigaDePan.jsx
│   │       └── MenuMovil.jsx
│   │
│   ├── constants/
│   │   ├── clasificacionProducto.js
│   │   ├── estadoProducto.js
│   │   ├── familiasATC.js
│   │   ├── roles.js
│   │   ├── tiposAlerta.js
│   │   └── tiposMovimiento.js
│   │
│   ├── mock-data/
│   │   ├── alertas.js            # 9 alertas
│   │   ├── auditoria.js          # Logs de auditoría (nuevo)
│   │   ├── boticas.js            # Droguería Central + 4 boticas, ubigeo, distrito
│   │   ├── lotes.js
│   │   ├── metricasKPI.js
│   │   ├── movimientos.js
│   │   ├── organizaciones.js
│   │   ├── predicciones.js      # 5 predicciones
│   │   ├── precios.js
│   │   ├── productos.js         # 12 productos
│   │   ├── proveedores.js
│   │   ├── stock.js
│   │   ├── transferencias.js     # 6 transferencias enriquecidas
│   │   ├── ubigeos.js
│   │   └── usuarios.js           # 8 usuarios con datos expandidos
│   │
│   ├── pages/
│   │   ├── auth/
│   │   │   ├── InicioSesion.jsx
│   │   │   ├── PaginaNoAutorizado.jsx
│   │   │   └── RestablecerContrasena.jsx
│   │   │
│   │   ├── central-portal/
│   │   │   ├── PaginaDashboardCentral.jsx
│   │   │   │
│   │   │   ├── administration-module/    # Nuevo — solo Admin Central
│   │   │   │   ├── PaginaUsuarios.jsx
│   │   │   │   ├── PaginaBoticas.jsx
│   │   │   │   ├── PaginaConfiguracionGeneral.jsx
│   │   │   │   ├── PaginaAuditoria.jsx
│   │   │   │   └── PaginaConfiguracionAvanzada.jsx
│   │   │   │
│   │   │   ├── distribution-module/
│   │   │   │   ├── FormularioTransferencia.jsx
│   │   │   │   ├── PaginaTransferencias.jsx
│   │   │   │   ├── historial/
│   │   │   │   │   └── PaginaHistorialDistribucion.jsx
│   │   │   │
│   │   │   ├── inventory-module/
│   │   │   │   ├── adjustments/
│   │   │   │   │   ├── FormularioAjuste.jsx
│   │   │   │   │   └── PaginaAjustes.jsx
│   │   │   │   ├── catalog/
│   │   │   │   │   ├── DetalleProducto.jsx
│   │   │   │   │   ├── FormularioProducto.jsx
│   │   │   │   │   └── PaginaCatalogo.jsx
│   │   │   │   ├── lots/
│   │   │   │   │   ├── FormularioLote.jsx
│   │   │   │   │   └── PaginaLotes.jsx
│   │   │   │   ├── movements/
│   │   │   │   │   ├── FormularioMovimiento.jsx
│   │   │   │   │   └── PaginaMovimientos.jsx
│   │   │   │   ├── reports/
│   │   │   │   │   ├── PaginaReportes.jsx
│   │   │   │   │   ├── ReporteKardex.jsx
│   │   │   │   │   ├── ReporteMovimientos.jsx
│   │   │   │   │   └── ReporteStockCritico.jsx
│   │   │   │   └── stock/
│   │   │   │       └── PaginaStock.jsx
│   │   │   │
│   │   │   └── suppliers-module/
│   │   │       ├── common/
│   │   │       │   └── FormularioProveedor.jsx
│   │   │       ├── edit/
│   │   │       │   └── PaginaEditarProveedor.jsx
│   │   │       ├── new/
│   │   │       │   └── PaginaNuevoProveedor.jsx
│   │   │       └── PaginaProveedores.jsx
│   │   │
│   │   ├── ml-panel/
│   │   │   ├── PaginaAlertas.jsx
│   │   │   ├── PaginaMonitoreoML.jsx      # Nuevo — solo Admin Central
│   │   │   ├── PaginaPredicciones.jsx
│   │   │   └── PaginaRecomendaciones.jsx
│   │   │
│   │   └── pharmacy-portal/              # Portal Botica — 8 páginas
│   │       ├── PaginaAlertasBotica.jsx
│   │       ├── PaginaDashboardBotica.jsx
│   │       ├── PaginaLotesBotica.jsx
│   │       ├── PaginaMLBotica.jsx
│   │       ├── PaginaMovimientosBotica.jsx
│   │       ├── PaginaRecomendacionesBotica.jsx
│   │       ├── PaginaStockBotica.jsx
│   │       └── PaginaTransferenciasBotica.jsx
│   │
│   ├── routing/
│   │   ├── RutaProtegida.jsx
│   │   ├── RutaSegunRol.jsx
│   │   └── Rutas.jsx
│   │
│   ├── schemas/
│   │   ├── ajusteEsquema.js
│   │   ├── loteEsquema.js
│   │   ├── movimientoEsquema.js
│   │   ├── productoEsquema.js
│   │   ├── proveedorEsquema.js
│   │   └── transferenciaEsquema.js
│   │
│   ├── services/
│   │   ├── ml-model/
│   │   │   ├── clienteML.js
│   │   │   ├── metricas.js
│   │   │   └── prediccion.js
│   │   │
│   │   └── supabase/
│   │       ├── autenticacion.js
│   │       ├── cliente.js
│   │       ├── lotes.js
│   │       ├── movimientos.js
│   │       ├── predicciones.js
│   │       ├── productos.js
│   │       ├── stock.js
│   │       └── transferencias.js
│   │
│   ├── state/
│   │   ├── useAlertas.js
│   │   ├── useAutenticacion.js
│   │   ├── useBarraLateral.js
│   │   ├── useInventario.js
│   │   ├── usePredicciones.js
│   │   └── useTema.js
│   │
│   ├── styles/
│   │   ├── global.css
│   │   └── tema.js
│   │
│   └── utilities/
│       ├── calcularFEFO.js
│       ├── calcularMAPE.js
│       ├── clasificarAlerta.js
│       ├── cn.js
│       ├── formatearFecha.js
│       ├── formatearMoneda.js
│       ├── generarColorATC.js
│       └── permisos.js                  # Nuevo — RLS y permisos centralizados
│
├── public/
│   └── index.html
│
├── modelo-ml/                      # Servicio Python (vacío — Fase 3)
├── dist/                           # Build de producción
├── node_modules/
│
├── .env.example
├── .gitignore
├── AGENTS.md
├── index.html
├── package.json
├── postcss.config.js
├── README.md
├── tailwind.config.js
└── vite.config.js
```

> **Tabla.jsx** soporta filas expandibles vía `renderFilaExpandida` con flatMap + colSpan, y scroll horizontal configurable con `min-w-max`.

---

## Mock Data — Alineado con Arquitectura Lógica v4

| Archivo | Campos Clave |
|---|---|
| `organizaciones.js` | `tipoIdentificacion` (ruc/nit/tax_id/vat), `numeroIdentificacion`, `paisOrigen` |
| `proveedores.js` | `tipoIdentificacion`, `numeroIdentificacion`, `paisOrigen`, `leadTimeDias` |
| `productos.js` | `codigoInterno`, `categoriaTerapeutica`, `requiereReceta`, `clasificacion` (OTC/receta/generico) |
| `boticas.js` | `ubigeo` (char(6)), `distrito`, `tipo` (drogueria/botica) |
| `stock.js` | `ubicacionTipo` (drogueria/botica), `cantidadDisponible` |
| `lotes.js` | `ubicacionTipo`, `fechaVencimiento` |
| `movimientos.js` | `ubicacionTipo`, `transferenciaId`, `tipo` (entrada/salida/ajuste/merma/devolucion) |
| `transferencias.js` | `tipoTransferencia`, `origenTipo`, `origenId`, `destinoTipo`, `destinoId`, `estado` (creada/en_transito/recibida/cancelada), `items[]`, `fechaDespacho`, `fechaRecepcion`, `creadoPor`, `createdAt` |
| `precios.js` | `precioVenta`, `precioCosto` |
| `alertas.js` | `tipoOrigen` (regla/modelo), `tipo` (+prediccion), `resuelta` |
| `ubigeos.js` | Seed INEI con `codigo`, `distrito`, `provincia`, `departamento` |
| `usuarios.js` | `rol` (admin_central/operador_drogueria/visor_botica), `boticaId` |
| `auditoria.js` | `nivel` (info/advertencia/error), `accion`, `entidad`, `detalle` |

> El esquema de validación de transferencias (`transferenciaEsquema.js`) usa Zod con campos `destinoId`, `items` (productoId + cantidad) y `observaciones`.

---

## Constantes del Dominio

| Archivo | Enum |
|---|---|
| `tiposMovimiento.js` | `entrada`, `salida`, `ajuste`, `merma`, `devolucion` |
| `tiposAlerta.js` | `quiebre`, `sobrestock`, `vencimiento`, `prediccion` |
| `clasificacionProducto.js` | `OTC`, `receta`, `generico` |
| `estadoProducto.js` | `activo`, `inactivo`, `descontinuado` |
| `roles.js` | `ADMIN_CENTRAL`, `OPERADOR_DROGUERIA`, `VISOR_BOTICA` |

---

## Rutas del Sistema

### Portal Central (solo Admin Central)

| Ruta | Página |
|---|---|
| `/central/dashboard` | Dashboard |
| `/central/inventario/catalogo` | Catálogo Productos |
| `/central/inventario/catalogo/nuevo` | Nuevo Producto |
| `/central/inventario/catalogo/:id` | Detalle Producto |
| `/central/inventario/catalogo/:id/editar` | Editar Producto |
| `/central/inventario/stock` | Stock |
| `/central/inventario/lotes` | Lotes |
| `/central/inventario/lotes/nuevo` | Nuevo Lote |
| `/central/inventario/movimientos` | Movimientos |
| `/central/inventario/movimientos/nuevo` | Nuevo Movimiento |
| `/central/inventario/ajustes` | Ajustes |
| `/central/inventario/reportes` | Reportes |
| `/central/inventario/reportes/kardex` | Kardex |
| `/central/inventario/reportes/stock-critico` | Stock Crítico |
| `/central/inventario/reportes/movimientos` | Resumen Movimientos |
| `/central/distribucion/transferencias` | Transferencias |
| `/central/distribucion/transferencias/nueva` | Nueva Transferencia |
| `/central/distribucion/redistribucion` | Redistribución |
| `/central/distribucion/historial` | Historial |
| `/central/proveedores` | Proveedores |
| `/central/proveedores/nuevo` | Nuevo Proveedor |
| `/central/proveedores/:id` | Editar Proveedor |
| `/central/proveedores/ordenes` | Órdenes de Compra |
| `/central/proveedores/ordenes/nueva` | Nueva Orden de Compra |
| `/central/proveedores/ordenes/historial` | Historial de Órdenes |

### Portal Operaciones (Operador Logístico Central + Admin Central)

| Ruta | Página |
|---|---|
| `/operaciones/dashboard` | Dashboard Operaciones |
| `/operaciones/inventario/catalogo` | Catálogo |
| `/operaciones/inventario/stock` | Stock Global |
| `/operaciones/inventario/lotes` | Lotes |
| `/operaciones/inventario/movimientos` | Movimientos |
| `/operaciones/inventario/ajustes` | Ajustes |
| `/operaciones/inventario/reportes` | Reportes |
| `/operaciones/distribucion/transferencias` | Transferencias |
| `/operaciones/distribucion/transferencias/nueva` | Nueva Transferencia |
| `/operaciones/distribucion/redistribucion` | Redistribución |
| `/operaciones/proveedores` | Proveedores |
| `/operaciones/ordenes-compra` | Órdenes de Compra |
| `/operaciones/ordenes-compra/nueva` | Nueva Orden de Compra |
| `/operaciones/alertas` | Alertas |
| `/operaciones/ml/predicciones` | Predicciones Demanda |
| `/operaciones/ml/alertas-demanda` | Alertas de Demanda |

### Admin Central (solo Admin Central)

| Ruta | Página |
|---|---|
| `/central/administracion/usuarios` | Gestión de Usuarios |
| `/central/administracion/boticas` | Gestión de Boticas |
| `/central/administracion/configuracion` | Configuración General |
| `/central/administracion/auditoria` | Logs y Auditoría |
| `/central/administracion/configuracion-avanzada` | Configuración Avanzada |

### Portal Botica (Visor de Botica + Admin Central + Operador Logístico Central)

| Ruta | Página |
|---|---|
| `/botica/dashboard` | Dashboard Botica |
| `/botica/stock` | Stock Botica |
| `/botica/lotes` | Lotes Botica |
| `/botica/movimientos` | Movimientos Botica |
| `/botica/transferencias` | Transferencias Botica |
| `/botica/alertas` | Alertas Botica |
| `/botica/ml` | Pronóstico ML Botica |
| `/botica/recomendaciones` | Recomendaciones Botica |

### Panel ML (solo Admin Central)

| Ruta | Página |
|---|---|
| `/ml/predicciones` | Predicciones ML |
| `/ml/alertas` | Alertas ML |
| `/ml/recomendaciones` | Recomendaciones |
| `/ml/monitoreo` | Monitoreo ML |

### Autenticación

| Ruta | Página | Acceso |
|---|---|---|
| `/` | Redirección por rol | — |
| `/iniciar-sesion` | Login | Público |
| `/restablecer-contrasena` | Restablecer Contraseña | Público |
| `/no-autorizado` | 403 Acceso no autorizado | Autenticado |
| `*` | Redirección a `/` | — |

---

## Sistema de Permisos (RLS)

Archivo `src/utilities/permisos.js` — lógica centralizada de Row-Level Security:

| Función | Propósito |
|---|---|
| `debeFiltrarPorBotica(usuario)` | True si el usuario tiene restricción RLS (VISOR_BOTICA) |
| `obtenerFiltroBotica(usuario)` | Retorna el `boticaId` del usuario o null |
| `filtrarPorBotica(usuario, datos, campo)` | Filtra un array por ubicación |
| `puedeEditar(usuario)` | Admin Central u Operador Logístico |
| `puedeGestionarProveedores(usuario)` | Admin Central u Operador Logístico |
| `puedeGestionarOrdenesCompra(usuario)` | Admin Central u Operador Logístico |
| `puedeVerMLOperativo(usuario)` | Admin Central u Operador Logístico (predicciones y alertas de demanda en Portal Operaciones) |
| `puedeConfigurar(usuario)` | Solo Admin Central |
| `puedeVerMLTecnico(usuario)` | Solo Admin Central (monitoreo) |
| `puedeVerMLCompleto(usuario)` | Solo Admin Central (Panel ML completo) |
| `obtenerPortal(usuario)` | `central` / `operaciones` / `botica` según rol |

Las 8 páginas del Portal Botica usan `filtrarPorBotica()` en lugar de acceder directamente a `usuario.boticaId`.

---

## Convenciones de código

- **Idioma**: Todo en **español** (variables, comentarios, nombres de archivos)
- **Componentes/Pages**: `PascalCase` → `FormularioProducto.jsx`
- **Hooks/Utils**: `camelCase` → `useInventario.js`, `formatearFecha.js`
- **Constantes**: `SCREAMING_SNAKE_CASE` → `ROLES.ADMIN_CENTRAL`
- **Imports**: libs externas → `@` absolute → relativos
- Un componente por archivo
- Formularios con Zod + React Hook Form cuando aplica
- FEFO obligatorio en lógica de sortie de lotes

---

## Consideraciones de Desarrollo Actuales

- **No TypeScript**: El proyecto está construido enteramente en JavaScript (ES6+). No hay validación de tipos estática en tiempo de compilación.
- **Sin Testing**: No se ha configurado ningún framework de pruebas (unitarias, integración o e2e).
- **Sin CI/CD**: No existen hooks de pre-commit ni flujos de trabajo automatizados para despliegue por ahora.
- **Estado Global**: Manejado principalmente con Zustand en el directorio `src/state/`. Configuraciones como el tema oscuro (`useTema.js`) son persistidas en el almacenamiento local.

---

## Roadmap

| Fase | Descripción | Estado |
|---|---|---|
| **Fase 1** | Frontend completo + Auth real con Supabase + seed PostgreSQL + pg_net + RLS Phase 2 | ✅ Completado |
| Fase 2 | Supabase: auth real, PostgreSQL, RLS, Realtime, seed INEI | Pendiente |
| Fase 3 | FastAPI + Docker: SARIMA + XGBoost | Pendiente |
| Fase 4 | Integración frontend ↔ Supabase ↔ ML | Pendiente |
| Fase 5 | Despliegue: Vercel + Google Cloud Run | Pendiente |

---

## Diferenciador arquitectónico

**Closed-Loop MLOps in-Database:**

| Componente | Función | Schedule |
|---|---|---|
| `pg_cron` Job 1 | `calc_drift_semanal()` — PSI + MAPE rolling | Lunes 03:00 UTC |
| `pg_cron` Job 2 | `decide_retrain()` — evaluar umbrales y disparar | Lunes 03:15 UTC |
| `pg_cron` Job 3 | `cleanup()` — lotes expirados | Diario 02:00 UTC |
| `pg_cron` Job 4 | `backfill_inferencias()` — valor_real desde movimientos | Diario 02:30 UTC |
| `pg_net` | `http_post` a Cloud Run `/retrain` | Disparado por Job 2 |
| Edge Fn `promote_model.ts` | Champion-challenger: promote si MAPE mejora ≥5% | Post-retrain |
| Edge Fn `alert_dispatch.ts` | Alertas críticas cuando PSI>0.3 o ratio_mape>1.5 | Post-drift |

**Costos estimados**: < $5 USD/mes (Supabase free tier + Cloud Run scale-to-zero)

---

## Licencia

Proyecto académico — Universidad Peruana de Ciencias Aplicadas (UPC) — 2026
