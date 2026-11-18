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
cp .env.example .env   # pas DATABASE_URL aan, en vul JWT_SECRET en ADMIN_API_KEY met iets willekeurigs
npm run migrate:up     # database-schema opzetten
npm run dev            # start op http://localhost:3000
curl http://localhost:3000/health
```

## Authenticatie

Er zijn geen klant-accounts (zie projectcontext), maar winkels en koeriers moeten wel
bewijzen wie ze zijn voordat ze iets mogen aanmaken of wijzigen:

- **Winkels** krijgen bij het aanmaken (`POST /stores`) één keer een **API-sleutel** te zien.
  Die stuur je voortaan mee als `Authorization: Bearer <sleutel>` bij elke aanroep namens die winkel
  (bestelling aanmaken, betalen, ophalen bevestigen, eigen bestellingen opvragen).
- **Koeriers** registreren met een wachtwoord (`POST /couriers`) en loggen daarna in
  (`POST /auth/courier/login`) om een tijdelijk **token** te krijgen, dat ze meesturen als
  `Authorization: Bearer <token>` (12 uur geldig).
- **Admin-endpoints** (alle winkels/koeriers in één lijst) vereisen de `ADMIN_API_KEY` uit je `.env`.

Zonder geldige sleutel/token geeft de backend een `401`-fout terug, en je kan nooit bij
gegevens van een andere winkel of koerier.
