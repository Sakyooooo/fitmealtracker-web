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
