# Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Hono + @hono/node-server |
| Database | PostgreSQL (pg) + Drizzle ORM |
| Frontend | React 19, TypeScript, Tailwind CSS |
| Build | Vite (frontend), tsx (server dev), tsc (server build) |
| Testing | Vitest |
| Container | Docker + Docker Compose |

## Development (`npm run dev`)

- `tsx watch src/server/index.ts` → Hono server on port 3001
- `vite` → Frontend dev server on port 5173
- Vite proxies `/api/*` → `http://localhost:3001`
- Browser: `http://localhost:5173`

## Production (`npm run build && npm start`)

- `vite build` → Static files in `dist/client/`
- `tsc -p tsconfig.server.json` → Server in `dist/server/`
- `node dist/server/index.js` → Single process serving API + static files

## Docker

- `npm run docker:dev` → Development with hot reload
- `npm run docker:prod` → Production build

## Database

- `npm run db:generate` → Generate Drizzle migrations
- `npm run db:migrate` → Apply migrations
