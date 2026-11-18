#!/bin/bash
# Zenddy — alles-in-één opstartscript voor op je eigen computer (Mac/Linux).
#
# Wat dit doet, stap voor stap:
#   1. Checkt of Node.js en PostgreSQL zijn geïnstalleerd
#   2. Maakt de database aan (als die er nog niet is)
#   3. Installeert alle benodigde pakketten (eenmalig, duurt de eerste keer even)
#   4. Maakt .env-bestanden aan met automatisch gegenereerde wachtwoorden/sleutels
#   5. Bouwt de databasetabellen
#   6. Maakt één testwinkel + één testbestelling aan, zodat je meteen iets ziet
#   7. Start de backend en het winkeldashboard
#
# Gebruik: open een Terminal-venster, ga naar de Zendy-map, en typ:
#   bash start-zenddy.sh
#
# Stoppen: druk op Ctrl+C in dit venster.

set -e
cd "$(dirname "$0")"

GROEN='\033[0;32m'
GEEL='\033[1;33m'
ROOD='\033[0;31m'
RESET='\033[0m'

stap() { echo -e "\n${GROEN}==>${RESET} $1"; }
waarschuwing() { echo -e "${GEEL}LET OP:${RESET} $1"; }
fout() { echo -e "${ROOD}FOUT:${RESET} $1"; exit 1; }

stap "Controleren of Node.js is geïnstalleerd..."
if ! command -v node >/dev/null 2>&1; then
  fout "Node.js is niet gevonden. Download en installeer het via https://nodejs.org (kies de LTS-versie) en probeer dit script dan opnieuw."
fi
echo "Node.js gevonden: $(node -v)"

stap "Controleren of PostgreSQL is geïnstalleerd..."
if ! command -v psql >/dev/null 2>&1; then
  fout "PostgreSQL is niet gevonden. Download en installeer het via https://www.postgresql.org/download en probeer dit script dan opnieuw."
fi
echo "PostgreSQL gevonden."

stap "Uitzoeken hoe we met PostgreSQL mogen praten..."
# Dit verschilt per installatiemethode (Postgres.app, Homebrew, officiële installer).
# We proberen een paar gangbare manieren totdat er eentje werkt.
PSQL_ADMIN=""
if psql -d postgres -c "SELECT 1" >/dev/null 2>&1; then
  PSQL_ADMIN="psql -d postgres"
elif psql -U postgres -d postgres -c "SELECT 1" >/dev/null 2>&1; then
  PSQL_ADMIN="psql -U postgres -d postgres"
elif psql -U "$(whoami)" -d postgres -c "SELECT 1" >/dev/null 2>&1; then
  PSQL_ADMIN="psql -U $(whoami) -d postgres"
fi

if [ -z "$PSQL_ADMIN" ]; then
  fout "Kan niet met PostgreSQL verbinden. Controleer of PostgreSQL echt draait (bij Postgres.app: staat het olifantje-icoontje aan in de menubalk?) en probeer dan opnieuw. Lukt het nog steeds niet, draai dan: psql -d postgres   en kijk welke foutmelding je krijgt."
fi
echo "Verbinding met PostgreSQL gelukt."

stap "Database 'zenddy' klaarzetten..."
if $PSQL_ADMIN -lqt 2>/dev/null | cut -d '|' -f 1 | grep -qw zenddy; then
  echo "Database bestaat al, niets te doen."
else
  $PSQL_ADMIN -c "CREATE USER zenddy WITH PASSWORD 'zenddy';" 2>/dev/null || true
  $PSQL_ADMIN -c "CREATE DATABASE zenddy OWNER zenddy;" || fout "Kon de database niet aanmaken."
  echo "Database aangemaakt."
fi

stap "Pakketten installeren voor de backend (kan even duren)..."
(cd backend && npm install --silent)

stap "Pakketten installeren voor het winkeldashboard (kan even duren)..."
(cd store-dashboard && npm install --silent)

stap ".env-bestanden klaarzetten..."
if [ ! -f backend/.env ]; then
  JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  ADMIN_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  ENC_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  cat > backend/.env <<EOF
PORT=3000
DATABASE_URL=postgres://zenddy:zenddy@localhost:5432/zenddy
JWT_SECRET=$JWT_SECRET
ADMIN_API_KEY=$ADMIN_KEY
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:8081
ENCRYPTION_KEY=$ENC_KEY
EOF
  echo "backend/.env aangemaakt met automatisch gegenereerde sleutels."
else
  echo "backend/.env bestaat al, niet overschreven."
fi

stap "Databasetabellen bouwen..."
(cd backend && set -a && source .env && set +a && npm run migrate:up)

stap "Backend kort opstarten om testdata aan te maken..."
(cd backend && set -a && source .env && set +a && npx tsx src/index.ts > /tmp/zenddy-backend-setup.log 2>&1 &)
sleep 3

SEED_FILE=".zenddy-seed-done"
if [ ! -f "$SEED_FILE" ]; then
  stap "Testwinkel en testbestelling aanmaken..."
  STORE_RESPONSE=$(curl -s -X POST http://localhost:3000/stores -H "Content-Type: application/json" -d '{
    "name": "Mijn Testwinkel", "address": "Kalverstraat 1, Amsterdam",
    "latitude": 52.3702, "longitude": 4.8952,
    "contact_email": "test@voorbeeld.nl", "contact_phone": "0611111111",
    "webshop_platform": "shopify"
  }')
  STORE_API_KEY=$(echo "$STORE_RESPONSE" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).api_key))")

  curl -s -X POST http://localhost:3000/orders -H "Content-Type: application/json" -H "Authorization: Bearer $STORE_API_KEY" -d '{
    "external_order_ref": "TEST-0001", "customer_name": "Jan Jansen", "customer_phone": "0612345678",
    "delivery_address": "Damstraat 5, Amsterdam", "delivery_latitude": 52.3731, "delivery_longitude": 4.8926,
    "item_description": "Jas maat M", "item_value": 89.95,
    "delivery_fee_paid_by_customer": 4.95, "store_fee": 3.00
  }' > /dev/null

  echo "$STORE_API_KEY" > "$SEED_FILE"
  echo "Testwinkel + testbestelling aangemaakt."
else
  STORE_API_KEY=$(cat "$SEED_FILE")
  echo "Testwinkel bestond al, hergebruik API-sleutel."
fi

# Stop de tijdelijke backend weer, zodat we hem straks "voor echt" kunnen starten met logs zichtbaar.
pkill -f "tsx src/index.ts" 2>/dev/null || true
sleep 1

stap "Winkeldashboard koppelen aan de testwinkel..."
cat > store-dashboard/.env <<EOF
NEXT_PUBLIC_API_URL=http://localhost:3000
STORE_API_KEY=$STORE_API_KEY
EOF

echo ""
echo -e "${GROEN}Alles staat klaar!${RESET} Nu starten we de backend en het dashboard."
echo "Je kan zo naar deze adressen in je browser:"
echo "  - Backend (technisch, hoef je niet te openen): http://localhost:3000"
echo "  - Winkeldashboard: http://localhost:3001"
echo ""
echo "Druk op Ctrl+C in dit venster om alles weer te stoppen."
echo ""

cleanup() {
  echo ""
  echo "Alles aan het stoppen..."
  kill $BACKEND_PID $DASHBOARD_PID 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM

(cd backend && set -a && source .env && set +a && npx tsx src/index.ts) &
BACKEND_PID=$!

sleep 2

(cd store-dashboard && npm run dev) &
DASHBOARD_PID=$!

wait
