# Panduan Deployment ke Google Cloud Run

Aplikasi ini telah disediakan dengan `Dockerfile` dan `server.ts` yang serasi dengan Google Cloud Run. Ikuti langkah-langkah di bawah untuk deploy:

### 1. Prasyarat
*   Pastikan anda mempunyai akaun [Google Cloud Console](https://console.cloud.google.com/).
*   Pasang [Google Cloud SDK (gcloud CLI)](https://cloud.google.com/sdk/docs/install) di komputer anda.
*   Aktifkan API berikut dalam projek Google Cloud anda:
    *   Cloud Run API
    *   Artifact Registry API
    *   Cloud Build API

### 2. Sediakan Environment Variables
Anda perlu menyediakan kunci-kunci berikut dalam Cloud Run (Environment Variables):
*   `GEMINI_API_KEY`: Kunci API Gemini anda.
*   `GOOGLE_MAPS_API_KEY`: Kunci API Google Maps anda.
*   `TOYYIBPAY_SECRET_KEY`: Kunci rahsia ToyyibPay.
*   `TOYYIBPAY_CATEGORY_CODE`: Kod kategori ToyyibPay.
*   `TOYYIBPAY_SANDBOX`: `true` untuk testing, `false` untuk production.
*   `APP_URL`: URL aplikasi anda (cth: `https://routeking-xyz.a.run.app`).

### 3. Langkah Deployment (Guna gcloud CLI)

Jalankan arahan ini di terminal dalam folder projek anda:

```bash
# 1. Login ke Google Cloud
gcloud auth login

# 2. Set projek ID anda
gcloud config set project [PROJECT_ID_ANDA]

# 3. Deploy terus dari source code (Google akan build image secara automatik)
gcloud run deploy routeking \
  --source . \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --set-env-vars="GEMINI_API_KEY=[KUNCI_ANDA],GOOGLE_MAPS_API_KEY=[KUNCI_ANDA],TOYYIBPAY_SANDBOX=true"
```

### 4. Nota Penting untuk Firebase
Oleh kerana aplikasi ini menggunakan Firebase, pastikan:
1.  **Authorized Domains:** Tambah domain Cloud Run anda (cth: `routeking-xyz.a.run.app`) ke dalam senarai "Authorized Domains" di **Firebase Console > Authentication > Settings**.
2.  **Firestore Rules:** Pastikan rules anda telah di-deploy ke Firebase.
3.  **Service Account:** Cloud Run secara lalai menggunakan Service Account projek. Pastikan ia mempunyai akses ke Firestore.

---

### Tips Jimat Kos (Cloud Run)
*   **Min Instances:** Set kepada `0` supaya anda tidak dicaj bila tiada trafik.
*   **Concurrency:** Set kepada `80` atau lebih untuk membolehkan satu instance mengendalikan banyak request serentak.
*   **Memory:** `512MB` sudah mencukupi untuk aplikasi ini.
