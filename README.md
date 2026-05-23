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

- Pantalla de login con selector de rol para modo desarrollo
- Tres roles con portales y permisos completamente distintos:
  - **Admin Central** (`ADMIN_CENTRAL`) — acceso total a los 3 portales (Central, Operaciones, Botica) y Panel ML completo
  - **Operador Logístico Central** (`OPERADOR_DROGUERIA`) — acceso al Portal Operaciones (dashboard, inventario, distribución, proveedores, boticas) y Panel ML (predicciones, alertas, recomendaciones). Sin restricción RLS.
  - **Visor Local de Botica** (`VISOR_BOTICA`) — acceso solo al Portal Botica con datos filtrados por RLS a su botica asignada
- Protección de rutas por rol con `RutaProtegia` (4 grupos: Portal Operaciones, Admin Central, Portal Botica, Panel ML)
- Redirección automática desde `/` según el rol activo
- Sidebar con branding dinámico ("Portal Central", "Portal Operaciones", "Portal Botica") según el rol
- Breadcrumbs contextuales por portal en `MigaDePan.jsx`
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
- **Módulo de Distribución** completo:
  - **Transferencias** — crear, enviar, recibir, estados: creada/en_transito/recibida
  - **Despachos** — programación de envíos
  - **Recepciones** — seguimiento de transferencias en tránsito
  - **Historial** — historial filtrable por año y búsqueda
- **Módulo de Proveedores**:
  - Listado con identificación polimórfica (RUC/NIT/Tax ID/VAT por país)
  - Formulario con tipo de identificación, país de origen, lead time
  - Activar/desactivar proveedor con confirmación
- **Módulo de Administración** (solo Admin Central):
  - **Usuarios** — CRUD completo: tabla con búsqueda y filtros, modal crear/editar, toggle activo/inactivo
  - **Boticas** — CRUD completo: gestión de ubicaciones tipo droguería/botica, modal crear/editar, toggle activa/inactiva
  - **Configuración General** — nombre del sistema, zona horaria, idioma, formato fecha, alertas, seguridad
  - **Auditoría** — tabla de logs con búsqueda, filtros por nivel/acción y modal de detalle
  - **Configuración Avanzada** — API endpoints, ML service, base de datos, cache, rate limiting, feature flags

### Portal Operaciones (Admin Central + Operador Logístico)

- Dashboard, Inventario, Distribución, Proveedores y Boticas (lectura global sin RLS)
- Panel ML con Predicciones, Alertas ML y Recomendaciones

### Portal Botica (Visor Local + Admin Central + Operador Logístico)

- **Dashboard** — métricas y resumen de la botica
- **Stock** — filtrado por botica asignada
- **Lotes** — activos con orden FEFO, filtrados por botica
- **Movimientos** — historial de la botica
- **Transferencias** — entrantes y salientes de la botica
- **Alertas** — alertas activas de la botica
- **Pronóstico ML** — predicciones filtradas por botica
- **Recomendaciones** — sugerencias de compra filtradas por botica

### Panel ML (segmentado por privilegio)

- **Predicciones** — serie histórica + pronóstico a 3 meses con intervalos de confianza (Admin + Operador)
- **Alertas** — diferenciadas: regla (quiebre/vencimiento/sobrestock) vs predictiva (modelo) (Admin + Operador)
- **Recomendaciones** — cantidad sugerida y justificación (Admin + Operador)
- **Monitoreo ML** — monitoreo técnico del modelo, solo Admin Central

### Diseño

- Estilo **Microsoft Fluent** — plano, limpio
- Paleta verde (`#107C41`) / blanco / negro
- Soporte nativo para **Modo Oscuro** (Dark Mode) y temas personalizados a través de variables CSS globales (`--color-fondo`, `--color-texto`).
- Sistema de diseño "Theme-aware" en Tailwind CSS (ej: `bg-fondo`, `text-principal`).
- Soporte para vista de pantalla completa (Fullscreen).
- Sidebar colapsable con highlight verde en módulo y sub-items activos, branding dinámico por portal
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
│   │   ├── alertas.js
│   │   ├── auditoria.js          # Logs de auditoría (nuevo)
│   │   ├── boticas.js            # ubigeo, distrito
│   │   ├── lotes.js
│   │   ├── metricasKPI.js
│   │   ├── movimientos.js
│   │   ├── organizaciones.js
│   │   ├── predicciones.js
│   │   ├── precios.js
│   │   ├── productos.js
│   │   ├── proveedores.js
│   │   ├── stock.js
│   │   ├── transferencias.js
│   │   ├── ubigeos.js
│   │   └── usuarios.js           # 8 usuarios con datos expandidos
│   │
│   ├── pages/
│   │   ├── auth/
│   │   │   ├── InicioSesion.jsx
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
│   │   │   │   ├── despachos/
│   │   │   │   │   └── PaginaDespachos.jsx
│   │   │   │   ├── historial/
│   │   │   │   │   └── PaginaHistorialDistribucion.jsx
│   │   │   │   └── recepciones/
│   │   │   │       └── PaginaRecepciones.jsx
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
| `transferencias.js` | `boticaId`, `estado` (creada/en_transito/recibida), `items[]` |
| `precios.js` | `precioVenta`, `precioCosto` |
| `alertas.js` | `tipoOrigen` (regla/modelo), `tipo` (+prediccion), `resuelta` |
| `ubigeos.js` | Seed INEI con `codigo`, `distrito`, `provincia`, `departamento` |
| `usuarios.js` | `rol` (admin_central/operador_drogueria/visor_botica), `boticaId` |
| `auditoria.js` | `nivel` (info/advertencia/error), `accion`, `entidad`, `detalle` |

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

### Portal Operaciones (Admin Central + Operador Logístico)

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
| `/central/distribucion/despachos` | Despachos |
| `/central/distribucion/recepciones` | Recepciones |
| `/central/distribucion/historial` | Historial |
| `/central/proveedores` | Proveedores |
| `/central/proveedores/nuevo` | Nuevo Proveedor |
| `/central/proveedores/:id` | Editar Proveedor |

### Admin Central (solo Admin Central)

| Ruta | Página |
|---|---|
| `/central/administracion/usuarios` | Gestión de Usuarios |
| `/central/administracion/boticas` | Gestión de Boticas |
| `/central/administracion/configuracion` | Configuración General |
| `/central/administracion/auditoria` | Logs y Auditoría |
| `/central/administracion/configuracion-avanzada` | Configuración Avanzada |

### Portal Botica (Visor Local + Admin Central + Operador Logístico)

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

### Panel ML (Admin Central + Operador Logístico; Monitoreo solo Admin)

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
| `puedeConfigurar(usuario)` | Solo Admin Central |
| `puedeVerMLTecnico(usuario)` | Solo Admin Central |
| `puedeVerMLCompleto(usuario)` | Admin Central u Operador Logístico |
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
| **Fase 1** | Frontend con mock alineado a Arquitectura | ✅ Completado |
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
