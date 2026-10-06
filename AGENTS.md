# AGENTS.md - botica-demand-ml

## Key Commands
```bash
npm run dev      # Start dev server
npm run build   # Production build
npm run lint    # Run ESLint (only quality check)
npm run preview # Preview production build
cd modelo-ml-v2 && python -m uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload --reload-dir api --reload-dir src  # Start ML API v2
```

## Important Conventions
- **All code is in Spanish** — variables, comments, component names, everything
- Components/pages: PascalCase (`FormularioProducto.jsx`)
- Hooks/utils: camelCase (`useInventario.js`, `formatearFecha.js`)
- Constants: SCREAMING_SNAKE_CASE (`ROLES.ADMIN_CENTRAL`)

## Design System
- Theme: CSS variables in `src/styles/global.css` with `--color-fondo`, `--color-texto`, etc.
- Dark mode: use `dark:` prefix for dark styles, `bg-fondo` for theme-aware backgrounds
- Responsive: Use `sm:`, `md:`, `lg:` prefixes for mobile-first responsive design
- Components use theme-aware classes: `text-principal`, `text-secundario`, `border-estilo`, etc.

## Architecture
- ML API v2 is the official backend (FastAPI on port 8000 connecting to Supabase + artefacto_modelo.pkl)
- `modelo-ml/` is legacy reference only; do not use it for runtime changes
- Predicción individual POST /api/v1/predicciones → genera con pipeline XGBoost, persiste a predicciones_ml (upsert)
- Madurez: 0–3 SIN_DATOS, 4–12 HISTORIAL_INICIAL, 13–25 HISTORIAL_INTERMEDIO, 26–83 PREDICCION_LIMITADA, 84+ MODELO_COMPLETO
- Recomendaciones POST /api/v1/recomendaciones/compra usa prediction_service.predecir(guardar=False)
- Modelo v2: sklearn 1.6.1 requerido (artefacto_modelo.pkl entrenado con esa versión)
- CORS: localhost:5173
- Mock data lives in `src/mock-data/`
- State management: Zustand stores in `src/estado/`
- Theme store: `src/state/useTema.js` (persisted, handles dark mode + fullscreen)

## What You'll Miss
- No TypeScript — JavaScript only
- No test framework configured
- No pre-commit hooks
- No CI/CD workflows
- No type checking
