# SvitloE Stats

Dashboard for visualizing Svitloe bot access statistics.

It includes:
- total coverage metrics (hits, users/groups, date range, per-type totals)
- interactive time-series chart with range presets and zoom
- outage and request-load insights split by area tabs (R0, R1-R2)
- light/dark theme toggle and cached window status in footer

## Tech stack

- React 19
- TypeScript
- Vite
- LESS
- ECharts

## Configuration

Environment variables:
- `VITE_API_PATH` (required): API base path, e.g. `/api/v1/light-bot`
- `VITE_API_URL` (required): upstream API host

Example `.env`:

```env
VITE_API_URL="https://svitloe.coderak.net"
VITE_API_PATH="/api/v1/light-bot"
```

## Build and run

```bash
npm install
```

Run development server:

```bash
npm run dev
```

Build production bundle:

```bash
npm run build
```

Preview production build locally:

```bash
npm run preview
```

## License

MIT. See `LICENSE`.
