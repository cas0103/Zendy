# Zenddy Koeriers-app

React Native + Expo app waarmee koeriers inloggen, hun beschikbaarheid aan/uit zetten,
ritaanbiedingen accepteren/weigeren en een aflevering bevestigen.

## Starten (lokaal)

```bash
npm install
cp .env.example .env   # EXPO_PUBLIC_API_URL moet naar de draaiende backend wijzen
npm run web            # test in de browser (snelst om mee te ontwikkelen)
npm run android        # of npm run ios, met Expo Go op een telefoon/simulator
```

Zorg dat de backend (`../backend`) al draait. Registreer eerst een koerier via
`POST /couriers` (zie backend-README) om in te kunnen loggen.
