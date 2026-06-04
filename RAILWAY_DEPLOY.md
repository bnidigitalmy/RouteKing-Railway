# RouteKing Railway Deploy

This copy is prepared for a separate Railway deployment. Do not commit `.env`
files or Firebase service account JSON files.

## Railway Environment Variables

Set these in Railway service variables:

```env
NODE_ENV=production
APP_URL=https://your-railway-temp-url.up.railway.app
PUBLIC_URL=https://your-railway-temp-url.up.railway.app
ALLOWED_DOMAINS=your-railway-temp-url.up.railway.app,routeking.my,app.routeking.my,www.routeking.my

GEMINI_API_KEY=
GOOGLE_MAPS_API_KEY=
TOYYIBPAY_SECRET_KEY=
TOYYIBPAY_CATEGORY_CODE=
TOYYIBPAY_SANDBOX=false

FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"..."}
```

## Deploy Flow

1. Push this folder to a new GitHub repo, for example `bnidigitalmy/RouteKing-Railway`.
2. Create a new Railway project from that GitHub repo.
3. Add the variables above in Railway.
4. Deploy and test the Railway temp URL first.
5. Update `APP_URL`, `PUBLIC_URL`, and `ALLOWED_DOMAINS` after adding a custom domain.
6. Point `app.routeking.my` to Railway only after login, scan, map, and payment are verified.

## Firebase Service Account

Create a Firebase Admin service account JSON from Firebase Console or Google
Cloud IAM. Paste the full JSON as a single Railway variable named
`FIREBASE_SERVICE_ACCOUNT_JSON`.

Keep the JSON out of Git.
