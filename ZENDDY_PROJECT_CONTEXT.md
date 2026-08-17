# Zenddy — Projectcontext voor Claude Code

Dit bestand is de startbasis voor het bouwen van Zenddy. Lees dit volledig voordat je begint met bouwen — dit is het resultaat van meerdere rondes afstemming met de founder en mag niet zomaar afwijken zonder het te bespreken.

## Wat we bouwen
Een bezorgplatform voor fashion (bezorging binnen 30-60 min), bestaande uit:
1. **Backend** (Node.js + TypeScript, PostgreSQL)
2. **Koeriers-app** (React Native + Expo)
3. **Winkeldashboard** (Next.js webapp)

De **klant-app bestaat niet** in deze fase. Zenddy is een verzendmethode die de klant kiest bij het afrekenen op de webshop van de winkel (via een Shopify/WooCommerce-koppeling), niet een los platform waar klanten inloggen.

## De kernflow (samengevat — volledige versie in use case hieronder)

```
(voorraadcheck bepaalt of Zenddy zichtbaar is bij checkout van de winkel)

AANGEMAAKT
  → BETAALD  (betaling loopt via de webshop van de winkel, niet via Zenddy)
    → ZOEKEN_KOERIER  (max. 5 min, klok herstart volledig als toegewezen koerier alsnog afzegt)
        ├─ koerier gevonden → KOERIER_TOEGEWEZEN
        │     → KLAARSTAAN_VOOR_OPHALEN  (pas nu krijgt de winkel bericht)
        │       → OPGEHAALD  (uitsluitend bevestigd door de WINKEL — geen vangnet via koerier)
        │         → ONDERWEG_NAAR_KLANT  (live GPS tracking)
        │           → AFGELEVERD  (bevestigd door de KOERIER)  [einde]
        │
        └─ geen koerier na 5 min → KEUZE_VEREIST_GEEN_KOERIER  (klant krijgt 5 min bedenktijd)
              ├─ andere verzendmethode → OMGEZET_ANDERE_VERZENDING  [einde]
              ├─ klant annuleert → GEANNULEERD → TERUGBETAALD  [einde]
              └─ geen reactie na 5 min → automatisch GEANNULEERD → TERUGBETAALD  [einde]
```

## Belangrijke architectuurprincipes
- **Voorraadkoppelingen zijn adapters.** Eén interne standaard ("op voorraad: ja/nee"), met per systeem (Shopify, WooCommerce, later meer) een eigen vertaallaag. Begin met Shopify + WooCommerce, bouw uitbreidbaar.
- **1 winkel = 1 adres = 1 voorraadkoppeling.** Geen multi-vestiging in dit schema.
- **1 koerier = maximaal 1 actieve rit tegelijk.**
- **Geen klant-accounts in deze fase.** Klantgegevens staan los per bestelling.
- Elke statuswijziging van een bestelling wordt gelogd in een aparte historie-tabel (audit trail) — niet alleen de huidige status bijhouden.

## Database-schema
Zie het volledig uitgewerkte schema hieronder — dit is leidend voor de eerste migratie.

### Tabellen
- `stores` — id, name, address, latitude, longitude, contact_email, contact_phone, is_active, webshop_platform (enum: shopify/woocommerce/other), created_at
- `store_inventory_integrations` — id, store_id (FK), provider (enum), api_credentials (versleuteld), status (enum: connected/error/disconnected), last_synced_at
- `couriers` — id, name, phone, vehicle_type (enum: bike/scooter/car), status (enum: offline/online_available/on_delivery), current_latitude, current_longitude, balance, rating_average, created_at
- `orders` — id, store_id (FK), courier_id (FK, nullable), external_order_ref, status (enum, zie flow hierboven), customer_name, customer_phone, delivery_address, delivery_latitude, delivery_longitude, item_description, item_value, delivery_fee_paid_by_customer, store_fee, courier_payout, payment_status (enum: pending/paid/refunded), courier_search_started_at, courier_search_expires_at, customer_choice_expires_at, pickup_confirmed_by_store_at, delivered_confirmed_by_courier_at, created_at, updated_at
- `order_status_history` — id, order_id (FK), status, changed_at, changed_by (enum: system/store/courier/customer)
- `courier_offers` — id, order_id (FK), courier_id (FK), offered_at, expires_at, response (enum: pending/accepted/declined/expired), responded_at
- `payouts` — id, courier_id (FK), order_id (FK), amount, status (enum: pending/paid), paid_at
- `ratings` — id, order_id (FK), rated_by (enum: customer/store), courier_id (FK), score (1-5), comment, created_at

## Belangrijk: hoe met de founder samenwerken
De founder heeft weinig/geen codeervaring. Werk in **kleine, testbare stappen**. Leg bij elke stap kort uit *wat* er gebouwd wordt en *waarom*, in gewone taal, voordat je verdergaat naar de volgende stap. Vraag bevestiging bij belangrijke keuzes, ga niet in bulk grote hoeveelheden code tegelijk bouwen zonder tussentijdse check.

## Volgende stap (Fase 0)
1. Repo-structuur opzetten (backend / courier-app / store-dashboard als aparte mappen of monorepo — jouw advies hierover mag je aan de founder voorleggen)
2. PostgreSQL database opzetten met bovenstaand schema als eerste migratie
3. Backend skeleton (Node.js + TypeScript project, health-check endpoint werkend)
4. Daarna pas verder naar Fase 1: echte API-endpoints voor het aanmaken en opvolgen van een bestelling

---

*Dit bestand is samengesteld op basis van meerdere afstemrondes met de founder over de use case en het datamodel. Bij twijfel: vraag het na in plaats van aannames te doen die hiervan afwijken.*
