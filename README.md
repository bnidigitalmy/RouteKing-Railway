# RouteKing

RouteKing is a courier rider PWA for Malaysia. It helps riders scan AWB labels, extract parcel details with Gemini OCR, geocode delivery addresses, optimize delivery order, navigate stop by stop, and track COD/POD records.

## Stack

- React 19 + Vite
- Express backend served with `tsx`
- Firebase Auth, Firestore, and Firebase Storage
- Gemini OCR via backend proxy
- OpenStreetMap/Nominatim/OSRM with optional Google Maps geocoding proxy
- ToyyibPay subscription billing
- Google Cloud Run deployment

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env` from `.env.example` and fill the required secrets:

   ```bash
   GEMINI_API_KEY=
   GOOGLE_MAPS_API_KEY=
   TOYYIBPAY_SECRET_KEY=
   TOYYIBPAY_CATEGORY_CODE=
   TOYYIBPAY_SANDBOX=true
   APP_URL=http://localhost:3000
   PUBLIC_URL=http://localhost:3000
   ALLOWED_DOMAINS=localhost,routeking.my,app.routeking.my,www.routeking.my
   ```

3. Start the app:

   ```bash
   npm run dev
   ```

The app runs through `server.ts`, which mounts Vite middleware in development and serves the built `dist` folder in production.

## Scripts

- `npm run dev` - start local Express + Vite dev server
- `npm run build` - build the production PWA
- `npm run lint` - run TypeScript checks
- `npm run rules:test` - run Firestore security rules tests with the emulator

`rules:test` requires Java on `PATH` because the Firebase Firestore emulator runs on the JVM.

## Firebase

Deploy Firestore and Storage rules after changes:

```bash
firebase deploy --only firestore:rules,storage
```

POD and failed-delivery photos are stored in Firebase Storage under:

```text
users/{uid}/parcels/{parcelId}/{pod|failed}-{timestamp}.jpg
```

Firestore stores only the resulting download URL.

## Deployment

Cloud Build is configured in `cloudbuild.yaml` for Cloud Run in `asia-southeast1` with `min-instances=0` for low idle cost.

Before first deployment, create the Artifact Registry repository in the same region:

```bash
gcloud artifacts repositories create routeking \
  --repository-format=docker \
  --location=asia-southeast1
```

Cloud Run requires these environment variables in production:

- `NODE_ENV=production`
- `GEMINI_API_KEY`
- `GOOGLE_MAPS_API_KEY`
- `TOYYIBPAY_SECRET_KEY`
- `TOYYIBPAY_CATEGORY_CODE`
- `TOYYIBPAY_SANDBOX`
- `APP_URL`
- `PUBLIC_URL`
- `ALLOWED_DOMAINS`

## Security Notes

- Gemini OCR and Google Maps geocoding keys stay on the backend.
- ToyyibPay payment activation verifies successful transactions through ToyyibPay's transaction API before updating subscriptions.
- Firestore rules block cross-user parcel reads/writes and client-side subscription escalation.
- Firebase Storage rules restrict parcel photo access to the owning user.
