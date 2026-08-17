# iOS / App Store – förberedelser

Detta dokument rör endast native-bygget. Ingenting här påverkar webbappen.

## 1. Capacitor-konfiguration

`capacitor.config.ts` innehåller **ingen** `server.url`. Det är avsiktligt: med
`server.url` skulle appen ladda sandbox-URL:en istället för den bundlade koden,
vilket ger avslag i granskningen och en app som slutar fungera om preview stängs.

Lägg aldrig tillbaka `server.url` i en build som ska till App Store. Vill du köra
hot-reload mot sandbox under utveckling, lägg till det lokalt och ta bort det
före `Product → Archive`.

## 2. Behörighetstexter (Info.plist)

Apple avvisar appar där behörighetsdialogerna saknar eller har generiska
förklaringar. Texterna ligger i `scripts/ios-info-plist.mjs` och skrivs in
automatiskt:

```bash
npx cap add ios          # första gången
npm run build
npx cap sync ios
node scripts/ios-info-plist.mjs
npx cap open ios
```

Skriptet är idempotent — kör det igen efter varje `cap sync` om Info.plist
återställts.

Nycklar som sätts:

| Nyckel | Används av |
| --- | --- |
| `NSCameraUsageDescription` | Videoinspelning, profilbild |
| `NSMicrophoneUsageDescription` | Videoinspelning |
| `NSPhotoLibraryUsageDescription` | Uppladdning av bild/video |
| `NSPhotoLibraryAddUsageDescription` | Spara nedladdat innehåll |
| `NSLocationWhenInUseUsageDescription` | Jobb nära dig, adressifyllnad |
| `NSLocationAlwaysAndWhenInUseUsageDescription` | Bakgrundsposition |
| `NSUserTrackingUsageDescription` | ATT-dialog (om den någonsin visas) |
| `NSFaceIDUsageDescription` | Biometrisk inloggning |

## 3. Bakgrundsposition – beslut krävs före submit

`@capacitor-community/background-geolocation` används i
`src/hooks/useBackgroundLocation.ts`. "Always"-läget kräver stark motivering i
granskningen. Rekommendation: kör endast "When in use" om funktionen inte är
affärskritisk, alternativt plocka bort pluginet inför första submit.

## 4. Övrigt inför submit

- Kontoradering måste vara nåbar i appen (`delete-my-account` finns).
- Sign in with Apple krävs endast om appen erbjuder annan social inloggning
  (Google/Facebook). Idag används e-post + lösenord, så kravet gäller inte.
- Köp/prenumerationer får inte ske i appen utan Apples IAP. Håll köpflödet på
  webben och nämn inte priser i appen.
- APNs-nyckel behöver laddas upp i Firebase för att push ska nå iOS.
