# AGENTS.md - botica-demand-ml

## Key Commands
```bash
npm run dev      # Start dev server
npm run build   # Production build
npm run lint    # Run ESLint (only quality check)
npm run preview # Preview production build
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
- Phase 1: Frontend with mock data only. No Supabase or ML service connected.
- Mock data lives in `src/mock-data/`
- `modelo-ml/` directory exists but is empty (future ML service)
- State management: Zustand stores in `src/estado/`
- Theme store: `src/state/useTema.js` (persisted, handles dark mode + fullscreen)

## What You'll Miss
- No TypeScript — JavaScript only
- No test framework configured
- No pre-commit hooks
- No CI/CD workflows
- No type checking