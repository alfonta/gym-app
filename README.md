# יומן כושר

אפליקציית רשת מותקנת (PWA) למעקב אימוני כוח והיפרטרופיה. עברית, מימין לשמאל, עובדת בלי רשת.
כל הנתונים נשמרים מקומית על המכשיר (IndexedDB).

## Development

```bash
npm install
npm run dev        # local dev server
npm test           # engine unit tests
npm run build      # type-check + production build into dist/
```

## Structure

- `src/types.ts` – data model
- `src/data/` – exercises, equipment, workout templates (PPL and full body)
- `src/engine/` – equipment fallback, progression, plate calculator, stats (unit tested)
- `src/store.ts` – state + local persistence + backup
- `src/screens/` – UI

Pushing to `main` deploys to GitHub Pages (Settings → Pages → Source: GitHub Actions).

## Credits

Exercise images: [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (public domain).
