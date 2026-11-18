# Zenddy

Bezorgplatform voor fashion (bezorging binnen 30-60 min). Zie `ZENDDY_PROJECT_CONTEXT.md` voor de volledige projectcontext.

## Structuur

Monorepo met drie onderdelen:
- `backend/` — Node.js + TypeScript API + PostgreSQL (in ontwikkeling)
- `courier-app/` — React Native + Expo koeriers-app
- `store-dashboard/` — Next.js winkeldashboard

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

Daarnaast staat `ALLOWED_ORIGINS` in `.env`: alleen browsers die vanaf die domeinen
een aanroep doen (zoals het winkeldashboard) worden toegelaten. De mobiele koeriers-app
gebruikt geen browser en valt hier niet onder.

## Verder gebouwd

- **Uitbetalingen**: zodra een koerier een bestelling aflevert, wordt automatisch een
  openstaande uitbetaling (`payouts`) aangemaakt. Koeriers zien hun eigen uitbetalingen via
  `GET /couriers/me/payouts`; met de `ADMIN_API_KEY` kun je alle uitbetalingen bekijken en
  met `PATCH /payouts/:id/mark-paid` markeren als betaald.
- **Beoordelingen**: na aflevering kan de winkel de koerier beoordelen
  (`POST /orders/:id/rating`, score 1-5), waarna `couriers.rating_average` automatisch
  wordt bijgewerkt. Een bestelling kan maar één keer beoordeeld worden.
- **Live locatie**: `GET /orders/:id/courier-location` geeft de laatst bekende locatie van de
  toegewezen koerier terug (die de koerier zelf bijwerkt via de app). Het winkeldashboard
  toont dit automatisch op de detailpagina van een bestelling.
- **Winkeldashboard-acties**: de detailpagina van een bestelling heeft nu een knop
  "Bevestig ophalen door koerier" zodra de status dat toelaat.
- **Voorraadkoppelingen (Shopify/WooCommerce)**: één interne standaard
  ("op voorraad: ja/nee"), met per platform een eigen adapter
  (`backend/src/inventory/`). Een winkel koppelt via
  `POST /stores/me/inventory-integration` (credentials worden versleuteld
  opgeslagen met `ENCRYPTION_KEY`), en de webshop-checkout kan
  `GET /stores/me/inventory-check?sku=...` aanroepen om te bepalen of Zenddy
  getoond mag worden. Er is ook een `other`/mock-adapter om zonder echte
  webshop te testen.

  **Belangrijke kanttekening:** de Shopify- en WooCommerce-adapters zijn
  geschreven volgens de echte API's van beide platformen, maar zijn hier
  nooit tegen een echte winkel getest (ik heb geen Shopify/WooCommerce-winkel
  tot mijn beschikking). Getest is wel: de encryptie/decryptie, de mock-adapter
  volledig end-to-end, en de foutafhandeling wanneer een koppeling niet werkt
  (nette 502 + status wordt 'error', geen crash). Voordat dit echt gebruikt
  wordt, moet het tegen een testwinkel van beide platformen gecontroleerd
  worden.
