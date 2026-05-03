# AGENTS.md - botica-demand-ml

## Key Commands
```bash
npm run dev      # Start dev server
npm run build   # Production build
npm run lint    # Run ESLint
npm run preview # Preview production build
```

## Important Conventions
- **All code is in Spanish** — variables, comments, component names, everything
- Components/pages: PascalCase (`FormularioProducto.jsx`)
- Hooks/utils: camelCase (`useInventario.js`, `formatearFecha.js`)
- Constants: SCREAMING_SNAKE_CASE (`ROLES.ADMIN_CENTRAL`)

## Architecture
- Phase 1: Frontend with mock data only. No Supabase or ML service connected.
- Mock data lives in `src/datos-prueba/`
- `modelo-ml/` directory exists but is empty (future ML service)
- State management: Zustand stores in `src/estado/`

## What You'll Miss
- No TypeScript — JavaScript only
- No test framework configured (no `vitest`, `jest`, or test scripts)
- No pre-commit hooks
- No CI/CD workflows
- No type checking (no `tsc` or similar)
- `npm run lint` is the only quality check