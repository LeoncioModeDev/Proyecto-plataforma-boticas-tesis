# botica-demand-ml

Plataforma web inteligente para la gestión de inventario y predicción de demanda de medicamentos en boticas del Perú.
Proyecto de tesis — **Universidad Peruana de Ciencias Aplicadas (UPC)**, 2026.

---

## Estado actual — Fase 1 (Frontend con datos mock)

El frontend está **completamente construido y funcional**. No hay conexión real a Supabase ni al servicio de Machine Learning. Todos los datos provienen de archivos mock en `src/datos-prueba/`. Los servicios de Supabase y del modelo ML existen como carpetas con funciones simuladas, listas para conectarse en fases posteriores sin cambios en la arquitectura del frontend.

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

### Portal Central (Admin Central)
- **Dashboard** con 4 KPI cards, gráfica de tendencia de stock, alertas recientes y predicciones destacadas
- **Módulo de Inventario** con 6 submódulos completos:
  - **Catálogo de Productos** — tabla con filtros por clasificación y estado, formulario de creación/edición con validación Zod, vista de detalle con stock y lotes por ubicación
  - **Stock y Existencias** — 4 KPI cards, filtros por ubicación y estado, tabla con indicadores visuales de alerta
  - **Lotes y Vencimientos** — tabla ordenada por FEFO, colores de urgencia (rojo <30d, amarillo <90d, verde), formulario de registro en modal
  - **Movimientos de Inventario** — historial inmutable de auditoría, filtro por tipo, formulario de registro manual
  - **Ajustes y Mermas** — registro de ajustes positivos/negativos y mermas con motivo obligatorio
  - **Reportes** — Kardex por producto (con saldo acumulado), Stock Crítico, Resumen de Movimientos con gráfica de barras
- **Módulo de Distribución** — placeholder preparado para próximo sprint
- **Módulo de Proveedores** — placeholder preparado para próximo sprint

### Portal Boticas (Operador de Droguería)
- Stock filtrado por la botica asignada al usuario
- Lotes activos de la botica con orden FEFO
- Movimientos registrados en la botica

### Panel ML (Visor de Botica / Admin Central)
- **Predicciones** — selector de producto/botica, gráfica de área con serie histórica y pronóstico a 3 meses con intervalos de confianza, tabla de detalle, métricas MAPE y RMSE
- **Alertas Inteligentes** — diferenciadas entre alertas por reglas (quiebre, vencimiento, sobrestock) y alertas predictivas del modelo
- **Recomendaciones** — tarjetas de reposición con cantidad sugerida, justificación basada en predicción, confianza del modelo

### Diseño
- Estilo **Microsoft Fluent** — plano, limpio, espaciado generoso, sin gradientes
- Paleta **verde (`#107C41`) / blanco / negro** como colores principales
- Fuente **Segoe UI** con fallback a **Inter** (Google Fonts)
- Sidebar colapsable con navegación por rol y estado activo visual
- Header fijo con breadcrumbs, contador de alertas no leídas y menú de usuario

---

## Requisitos

- Node.js 18+
- npm 9+

---

## Instalación y uso

```bash
# Instalar dependencias
npm install

# Copiar variables de entorno (opcional en Fase 1 — no hay conexión real)
cp .env.example .env

# Iniciar servidor de desarrollo
npm run dev
# → http://localhost:5173
```

### Scripts disponibles

```bash
npm run dev      # Servidor de desarrollo con HMR
npm run build    # Build de producción (compila a dist/)
npm run preview  # Preview del build de producción
npm run lint     # Linter ESLint
```

---

## Stack tecnológico

| Categoría | Tecnología | Versión |
|---|---|---|
| Framework UI | React | 18 (actualmente instalado v19) |
| Bundler | Vite | 5+ |
| Routing | React Router DOM | v6 |
| Estilos | Tailwind CSS | v3 |
| Tablas | TanStack Table | v8 |
| Gráficas | Recharts | v2 |
| Formularios | React Hook Form | v7 |
| Validación | Zod | v3 |
| Estado global | Zustand | v4 |
| Fechas | date-fns | v3 |
| Iconos | Lucide React | — |
| CSS utils | clsx + tailwind-merge | — |

### Backend (no conectado aún)
- **Supabase** — PostgreSQL, Auth JWT, Row-Level Security, Edge Functions, tiempo real
- Variables de entorno: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

### Servicio ML (no conectado aún)
- **Python 3.10+** con **FastAPI**, SARIMA (statsmodels), XGBoost, scikit-learn
- Despliegue futuro: Docker + Google Cloud Run
- Variable de entorno: `VITE_ML_API_URL`

---

## Estructura del proyecto

```
botica-demand-ml/
├── modelo-ml/                        # Servicio Python (Fase futura)
│   ├── api/                          # Endpoints FastAPI
│   ├── training/                     # Scripts de entrenamiento
│   ├── saved_models/                 # Modelos serializados
│   ├── data/                         # Datasets
│   ├── notebooks/                    # Exploración
│   ├── requirements.txt
│   └── Dockerfile
│
├── src/
│   ├── assets/                       # Recursos estáticos
│   │   ├── images/
│   │   ├── icons/
│   │   └── fonts/
│   │
│   ├── components/
│   │   ├── common/                   # Boton, Tarjeta, Modal, Tabla, Insignia,
│   │   │                             # Alerta, Cargando, CampoBusqueda,
│   │   │                             # ErrorFrontend, SinDatos
│   │   ├── forms/                    # CampoTexto, CampoSeleccion, CampoFecha,
│   │   │                             # CampoNumero, CampoTextoArea
│   │   ├── charts/                   # GraficaLinea, GraficaBarras, GraficaArea,
│   │   │                             # GraficaRadar, TarjetaMetrica
│   │   └── navigation/               # BarraLateral, BarraSuperior,
│   │                                 # MigaDePan, MenuMovil
│   │
│   ├── pages/
│   │   ├── auth/                     # InicioSesion, RestablecerContrasena
│   │   ├── central-portal/
│   │   │   ├── PaginaDashboardCentral.jsx
│   │   │   ├── inventory-module/
│   │   │   │   ├── catalog/          # PaginaCatalogo, FormularioProducto, DetalleProducto
│   │   │   │   ├── stock/            # PaginaStock
│   │   │   │   ├── lots/             # PaginaLotes
│   │   │   │   ├── movements/        # PaginaMovimientos
│   │   │   │   ├── adjustments/      # PaginaAjustes
│   │   │   │   └── reports/          # PaginaReportes, ReporteKardex,
│   │   │   │                         # ReporteStockCritico, ReporteMovimientos
│   │   │   ├── distribution-module/  # PaginaDistribucion (placeholder)
│   │   │   └── suppliers-module/     # PaginaProveedores (placeholder)
│   │   ├── pharmacy-portal/          # PaginaStockBotica, PaginaLotesBotica,
│   │   │                             # PaginaMovimientosBotica
│   │   └── ml-panel/                 # PaginaPredicciones, PaginaAlertas,
│   │                                 # PaginaRecomendaciones
│   │
│   ├── routing/
│   │   ├── Rutas.jsx                 # Todas las rutas con layouts anidados
│   │   └── RutaProtegida.jsx         # HOC de protección por rol
│   │
│   ├── state/                        # Zustand stores
│   │   ├── useAutenticacion.js
│   │   ├── useInventario.js
│   │   ├── useAlertas.js
│   │   └── usePredicciones.js
│   │
│   ├── services/
│   │   ├── supabase/                 # cliente, productos, stock, lotes,
│   │   │                             # movimientos, transferencias, predicciones,
│   │   │                             # autenticacion — todos mock con setTimeout
│   │   └── ml-model/                 # clienteML, prediccion, metricas — mock
│   │
│   ├── mock-data/                    # Datos mock farmacéuticos peruanos
│   │   ├── productos.js              # 12 productos (Paracetamol, Amoxicilina...)
│   │   ├── stock.js                  # 16 registros en 3 ubicaciones
│   │   ├── lotes.js                  # 14 lotes con fechas variadas
│   │   ├── movimientos.js            # 21 movimientos de todos los tipos
│   │   ├── transferencias.js         # 6 transferencias en distintos estados
│   │   ├── alertas.js                # 9 alertas activas
│   │   ├── predicciones.js           # 5 predicciones con serie histórica 11 meses
│   │   ├── boticas.js                # Droguería Central + 2 boticas Lima
│   │   └── usuarios.js               # 3 usuarios (1 por rol)
│   │
│   ├── schemas/                      # Validaciones Zod
│   │   ├── productoEsquema.js
│   │   ├── loteEsquema.js
│   │   ├── movimientoEsquema.js
│   │   ├── transferenciaEsquema.js
│   │   └── ajusteEsquema.js
│   │
│   ├── utilities/                    # Funciones puras
│   │   ├── cn.js                     # clsx + tailwind-merge
│   │   ├── formatearFecha.js         # date-fns con locale ES
│   │   ├── formatearMoneda.js        # Soles peruanos (S/)
│   │   ├── calcularFEFO.js           # First Expired First Out
│   │   ├── calcularMAPE.js           # MAPE y RMSE del modelo ML
│   │   ├── clasificarAlerta.js       # Estado de stock (normal/bajo/sin_stock/sobrestock)
│   │   └── generarColorATC.js        # Colores por familia ATC
│   │
│   ├── constants/                    # Valores fijos del dominio
│   │   ├── roles.js                  # ROLES, ETIQUETAS_ROLES
│   │   ├── tiposMovimiento.js        # entrada/salida/ajuste/merma
│   │   ├── clasificacionProducto.js  # OTC/receta/genérico
│   │   ├── estadoProducto.js         # activo/inactivo/descontinuado
│   │   ├── tiposAlerta.js            # quiebre/sobrestock/vencimiento/prediccion
│   │   └── familiasATC.js            # 14 familias ATC con código y descripción
│   │
│   └── styles/
│       ├── global.css                # Tailwind + variables CSS + scrollbar
│       └── tema.js                   # Tokens de diseño exportados como JS
│
├── .env.example                      # Plantilla de variables de entorno
├── .gitignore
├── tailwind.config.js                # Paleta extendida completa
├── vite.config.js                    # Alias @ → src/
├── postcss.config.js
└── AGENTS.md                         # Convenciones para agentes de IA
```

---

## Rutas del sistema

| Ruta | Descripción | Rol requerido |
|---|---|---|
| `/` | Redirección automática según rol | — |
| `/iniciar-sesion` | Pantalla de login | Público |
| `/central/dashboard` | Dashboard del Admin Central | Admin Central |
| `/central/inventario/catalogo` | Catálogo de productos | Admin Central |
| `/central/inventario/catalogo/nuevo` | Formulario de nuevo producto | Admin Central |
| `/central/inventario/catalogo/:id` | Detalle de producto | Admin Central |
| `/central/inventario/stock` | Stock y existencias | Admin Central |
| `/central/inventario/lotes` | Lotes y vencimientos | Admin Central |
| `/central/inventario/movimientos` | Historial de movimientos | Admin Central |
| `/central/inventario/ajustes` | Ajustes y mermas | Admin Central |
| `/central/inventario/reportes` | Índice de reportes | Admin Central |
| `/central/inventario/reportes/kardex` | Reporte Kardex | Admin Central |
| `/central/inventario/reportes/stock-critico` | Reporte stock crítico | Admin Central |
| `/central/inventario/reportes/movimientos` | Reporte de movimientos | Admin Central |
| `/central/distribucion` | Módulo distribución (placeholder) | Admin Central |
| `/central/proveedores` | Módulo proveedores (placeholder) | Admin Central |
| `/botica/stock` | Stock de la botica | Operador |
| `/botica/lotes` | Lotes de la botica | Operador |
| `/botica/movimientos` | Movimientos de la botica | Operador |
| `/ml/predicciones` | Predicciones de demanda | Visor / Admin |
| `/ml/alertas` | Alertas inteligentes | Visor / Admin |
| `/ml/recomendaciones` | Recomendaciones de reposición | Visor / Admin |

---

## Convenciones de código

- Todo el código, comentarios y nombres están en **español**
- Componentes y páginas: `PascalCase` → `FormularioProducto.jsx`
- Hooks, utilidades y datos: `camelCase` → `useInventario.js`, `formatearFecha.js`
- Constantes globales: `SCREAMING_SNAKE_CASE` → `ROLES.ADMIN_CENTRAL`
- Imports: librerías externas → imports `@` absolutos → imports relativos (separados por línea en blanco)
- Un componente principal por archivo
- Todos los formularios validados con Zod + React Hook Form
- FEFO obligatorio en cualquier lógica de salida de lotes

---

## Lo que NO está configurado

- Sin TypeScript — JavaScript puro
- Sin framework de tests (`vitest`, `jest`)
- Sin pre-commit hooks
- Sin CI/CD
- Sin type checking (`tsc`)
- `npm run lint` es la única verificación de calidad automatizada

---

## Roadmap

| Fase | Descripción |
|---|---|
| **Fase 1** ✅ | Frontend completo con datos mock |
| Fase 2 | Conexión a Supabase (auth real, PostgreSQL, RLS) |
| Fase 3 | Implementación del servicio FastAPI con SARIMA + XGBoost |
| Fase 4 | Integración completa frontend ↔ Supabase ↔ modelo ML |
| Fase 5 | Despliegue en producción (Vercel + Google Cloud Run) |

---

## Licencia

Proyecto académico — Universidad Peruana de Ciencias Aplicadas (UPC) — 2026
