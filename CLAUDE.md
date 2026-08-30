# FitMealTracker Web

## Project

FitMealTracker is a personal-use MVP for tracking meals, exercise, weight, and gym sessions.

## Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Recharts

## Data

- App records are stored locally in `localStorage`.
- Meal photos are stored in IndexedDB.
- Gemini meal image analysis runs through `src/app/api/analyze-meal/route.ts`.
- `GEMINI_API_KEY` must stay server-side only.

## Commands

```bash
npm install
npm run lint
npm run build
```

## Design

UI/UX rules live in `docs/design/`. Read them before building or changing any screen.
This app is an iOS-home-screen PWA: Apple HIG is the platform baseline and wins when guidance conflicts.

- `docs/design/02-design-system.md` — color, type, spacing, radius, elevation tokens. Do not invent new values.
- `docs/design/03-components.md` — component contracts. Shared primitives belong in `src/components/ui/`.
- `docs/design/04-motion.md` — animate `transform`/`opacity` only; honor `prefers-reduced-motion`.
- `docs/design/05-accessibility.md` — WCAG 2.2 AA: 4.5:1 contrast, 44px targets, visible focus.
- `docs/design/06-checklist.md` — run through this before committing UI changes.
- `docs/design/07-audit-backlog.md` — known gaps; fix the ones in files you touch.
- `docs/design/08-3d.md` — Three.js rules: asset budget, `frameloop` gating, reduced-motion, WebGL fallback.
- `docs/design/09-apple-hig.md` — Apple HIG applied: 17pt/11pt type, 44pt targets, 12/24pt control spacing, sheets, alerts, Liquid Glass.

Do not write raw hex colors in components — use the tokens.
