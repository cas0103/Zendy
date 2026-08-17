# Zenddy

Bezorgplatform voor fashion (bezorging binnen 30-60 min). Zie `ZENDDY_PROJECT_CONTEXT.md` voor de volledige projectcontext.

## Structuur

Monorepo met drie onderdelen:
- `backend/` — Node.js + TypeScript API + PostgreSQL (in ontwikkeling)
- `courier-app/` — React Native + Expo koeriers-app (nog niet gestart)
- `store-dashboard/` — Next.js winkeldashboard (nog niet gestart)

## Backend starten (lokaal)

```bash
cd backend
npm install
cp .env.example .env   # pas DATABASE_URL aan indien nodig
npm run migrate:up     # database-schema opzetten
npm run dev            # start op http://localhost:3000
curl http://localhost:3000/health
```
