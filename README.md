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
- Tres roles con vistas completamente distintas:
  - **Admin Central** — acceso completo al portal central, portal boticas y panel ML
  - **Operador de Droguería** — acceso solo al portal de su botica
  - **Visor de Botica** — acceso solo al panel ML (predicciones, alertas, recomendaciones)
- Protección de rutas por rol con `RutaProtegida`
- Redirección automática desde `/` según el rol activo
- Sidebar con highlight visual indicando módulo activo y sub-items activos

### Portal Central (Admin Central)
- **Dashboard** — KPI cards, gráfica de tendencia de stock, alertas recientes y predicciones destacadas
- **Módulo de Inventario** con 6 submódulos:
  - **Catálogo de Productos** — con codigoInterno, categoriaTerapeutica, requiereReceta, clasificación OTC/receta/generico
  - **Stock** — por ubicación con alertas visuales (verde/amarillo/rojo)
  - **Lotes** — ordenados por FEFO, colores de urgencia por vencimiento
  - **Movimientos** — historial inmutable con tipos: entrada/salida/ajuste/merma/devolucion
  - **Ajustes** — ajustes positivos/negativos y mermas
  - **Reportes** — Kardex, Stock Crítico, Resumen de Movimientos
- **Módulo de Distribución** completo:
  - **Transferencias** — crear, enviar, recibir, estados: creada/en_transito/recibida
  - **Despachos** — programación de envíos
  - **Recepciones** — seguimiento de transferencias en tránsito
  - **Historial** — historial filtrable por año y búsqueda
- **Módulo de Proveedores**:
  - Listado con identificación polimórfica (RUC/NIT/Tax ID/VAT por país)
  - Formulario con tipo de identificación, país de origen, lead time

### Portal Boticas (Operador de Droguería)
- Stock filtrado por la botica asignada
- Lotes activos con orden FEFO
- Movimientos de la botica

### Panel ML (Visor de Botica / Admin Central)
- **Predicciones** — serie histórica + pronóstico a 3 meses con intervalos de confianza
- **Alertas** — diferenciadas: regla (quiebre/vencimiento/sobrestock) vs predictiva (modelo)
- **Recomendaciones** — cantidad sugerida y justificación

### Diseño
- Estilo **Microsoft Fluent** — plano, limpio
- Paleta verde (`#107C41`) / blanco / negro
- Soporte nativo para **Modo Oscuro** (Dark Mode) y temas personalizados a través de variables CSS globales (`--color-fondo`, `--color-texto`).
- Sistema de diseño "Theme-aware" en Tailwind CSS (ej: `bg-fondo`, `text-principal`).
- Soporte para vista de pantalla completa (Fullscreen).
- Sidebar colapsable con highlight verde en módulo y sub-items activos
- Header fijo con breadcrumbs y contador de alertas

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
npm run preview # Preview del build
npm run lint    # Linter ESLint
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
│   │   ├── alertas.js            # Alertas con tipoOrigen
│   │   ├── boticas.js            # ubigeo, distrito
│   │   ├── lotes.js              # ubicacionTipo
│   │   ├── metricasKPI.js
│   │   ├── movimientos.js        # devolucion
│   │   ├── organizaciones.js      # tipoIdentificacion polimórfico
│   │   ├── predicciones.js      # Serie histórica + forecasts
│   │   ├── precios.js           # precioVenta, precioCosto
│   │   ├── productos.js          # codigoInterno, categoriaTerapeutica
│   │   ├── proveedores.js        # leadTimeDias, paisOrigen
│   │   ├── stock.js            # cantidadDisponible
│   │   ├── transferencias.js   # boticaId, estados
│   │   ├── ubigeos.js           # Seed INEI
│   │   └── usuarios.js
│   │
│   ├── pages/
│   │   ├── auth/
│   │   │   ├── InicioSesion.jsx
│   │   │   └── RestablecerContrasena.jsx
│   │   │
│   │   ├── central-portal/
│   │   │   ├── PaginaDashboardCentral.jsx
│   │   │   │
│   │   │   ├── distribution-module/
│   │   │   │   ├── PaginaDistribucion.jsx
│   │   │   │   ├── despachos/
│   │   │   │   │   └── PaginaDespachos.jsx
│   │   │   │   ├── historial/
│   │   │   │   │   └── PaginaHistorialDistribucion.jsx
│   │   │   │   └── recepciones/
│   │   │   │       └── PaginaRecepciones.jsx
│   │   │   │
│   │   │   ├── inventory-module/
│   │   │   │   ├── adjustments/
│   │   │   │   │   ��── PaginaAjustes.jsx
│   │   │   │   ├── catalog/
│   │   │   │   │   ├── DetalleProducto.jsx
│   │   │   │   │   ├── FormularioProducto.jsx
│   │   │   │   │   └── PaginaCatalogo.jsx
│   │   │   │   ├── lots/
│   │   │   │   │   └── PaginaLotes.jsx
│   │   │   │   ├── movements/
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
│   │   │   ├── PaginaPredicciones.jsx
│   │   │   └── PaginaRecomendaciones.jsx
│   │   │
│   │   └── pharmacy-portal/
│   │       ├── PaginaLotesBotica.jsx
│   │       ├── PaginaMovimientosBotica.jsx
│   │       └── PaginaStockBotica.jsx
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
│       └── generarColorATC.js
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
| `boticas.js` | `ubigeo` (char(6)), `distrito` |
| `stock.js` | `ubicacionTipo` (drogueria/botica), `cantidadDisponible` |
| `lotes.js` | `ubicacionTipo`, `fechaVencimiento` |
| `movimientos.js` | `ubicacionTipo`, `transferenciaId`, `tipo` (entrada/salida/ajuste/merma/**devolucion**) |
| `transferencias.js` | `boticaId`, `estado` (creada/en_transito/recibida), `items[]` |
| `precios.js` | `precioVenta`, `precioCosto` |
| `alertas.js` | `tipoOrigen` (regla/modelo), `tipo` (+prediccion), `resuelta` |
| `ubigeos.js` | Seed INEI con `codigo`, `distrito`, `provincia`, `departamento` |

---

## Constantes del Dominio

| Archivo | Enum |
|---|---|
| `tiposMovimiento.js` | `entrada`, `salida`, `ajuste`, `merma`, **`devolucion`** |
| `tiposAlerta.js` | `quiebre`, `sobrestock`, `vencimiento`, **`prediccion`** |
| `clasificacionProducto.js` | `OTC`, `receta`, `generico` |
| `estadoProducto.js` | `activo`, `inactivo`, `descontinuado` |
| `roles.js` | `ADMIN_CENTRAL`, `OPERADOR_DROGUERIA`, `VISOR_BOTICA` |

---

## Rutas del Sistema

| Ruta | Página | Rol |
|---|---|---|
| `/` | Redirección por rol | — |
| `/iniciar-sesion` | Login | Público |
| `/central/dashboard` | Dashboard Central | Admin Central |
| `/central/inventario/catalogo` | Catálogo Productos | Admin Central |
| `/central/inventario/catalogo/nuevo` | Nuevo Producto | Admin Central |
| `/central/inventario/catalogo/:id` | Detalle Producto | Admin Central |
| `/central/inventario/stock` | Stock | Admin Central |
| `/central/inventario/lotes` | Lotes | Admin Central |
| `/central/inventario/movimientos` | Movimientos | Admin Central |
| `/central/inventario/ajustes` | Ajustes | Admin Central |
| `/central/inventario/reportes` | Reportes | Admin Central |
| `/central/inventario/reportes/kardex` | Kardex | Admin Central |
| `/central/inventario/reportes/stock-critico` | Stock Crítico | Admin Central |
| `/central/inventario/reportes/movimientos` | Resumen Movimientos | Admin Central |
| `/central/distribucion/transferencias` | Transferencias | Admin Central |
| `/central/distribucion/despachos` | Despachos | Admin Central |
| `/central/distribucion/recepciones` | Recepciones | Admin Central |
| `/central/distribucion/historial` | Historial | Admin Central |
| `/central/proveedores` | Proveedores | Admin Central |
| `/central/proveedores/nuevo` | Nuevo Proveedor | Admin Central |
| `/central/proveedores/:id` | Editar Proveedor | Admin Central |
| `/botica/stock` | Stock Botica | Operador |
| `/botica/lotes` | Lotes Botica | Operador |
| `/botica/movimientos` | Movimientos Botica | Operador |
| `/ml/predicciones` | Predicciones ML | Visor/Admin |
| `/ml/alertas` | Alertas ML | Visor/Admin |
| `/ml/recomendaciones` | Recomendaciones | Visor/Admin |
| `*` | 404 | — |

---

## Convenciones de código

- **Idioma**: Todo en **español** (variables, comentarios, nombres de archivos)
- **Componentes/Pages**: `PascalCase` → `FormularioProducto.jsx`
- **Hooks/Utils**: `camelCase` → `useInventario.js`, `formatearFecha.js`
- **Constantes**: `SCREAMING_SNAKE_CASE` → `ROLES.ADMIN_CENTRAL`
- **Imports**: libs externas → `@` absolute → relativos
- Un componente por archivo
- Todos los formularios con Zod + React Hook Form
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