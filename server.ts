import express from "express";
import type { Request, Response } from "express";
import "dotenv/config";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import bodyParser from "body-parser";
import cors from "cors";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import { GoogleGenAI, Type } from "@google/genai";

// Load Firebase Config
const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));

function getFirebaseAdminOptions(): admin.AppOptions | undefined {
  const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!rawServiceAccount) return undefined;

  try {
    const serviceAccount = JSON.parse(rawServiceAccount) as admin.ServiceAccount;
    return {
      credential: admin.credential.cert(serviceAccount),
    };
  } catch (error) {
    console.error("Invalid FIREBASE_SERVICE_ACCOUNT_JSON:", error instanceof Error ? error.message : "unknown");
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON must be valid Firebase service account JSON.");
  }
}

// Cloud Run can use Application Default Credentials. Railway needs
// FIREBASE_SERVICE_ACCOUNT_JSON because it runs outside Google Cloud.
const firebaseApp = admin.apps.length ? admin.app() : admin.initializeApp(getFirebaseAdminOptions());
const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
const db = getFirestore(firebaseApp, databaseId);

// ---------------------------------------------------------------------------
// Security configuration
// ---------------------------------------------------------------------------

// Domains allowed to make requests and receive redirects.
// Set ALLOWED_DOMAINS env var as comma-separated list in production.
const ALLOWED_DOMAINS: string[] = (
  process.env.ALLOWED_DOMAINS || 'routeking.my,app.routeking.my,www.routeking.my'
)
  .split(',')
  .map(d => d.trim().toLowerCase())
  .filter(Boolean);

const VALID_TIERS = new Set(['lite', 'standard', 'ultimate']);
const VALID_TYPES = new Set(['monthly', 'yearly']);

// Server-authoritative pricing (sen / RM × 100)
const TIER_AMOUNTS: Record<string, number> = {
  lite: 1490,
  standard: 2990,
  ultimate: 4990,
};

type PendingPayment = {
  uid: string;
  email: string;
  type: 'monthly' | 'yearly';
  tier: 'lite' | 'standard' | 'ultimate';
  amount: number;
  billCode?: string;
  status?: 'pending' | 'completed';
};

// ---------------------------------------------------------------------------
// In-memory rate limiter — 5 payment requests per UID per hour
// ---------------------------------------------------------------------------
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(uid: string, max = 5, windowMs = 60 * 60 * 1000): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(uid);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(uid, { count: 1, resetAt: now + windowMs });
    return false;
  }
  if (entry.count >= max) return true;
  entry.count++;
  return false;
}

// ---------------------------------------------------------------------------
// CSRF / Origin validation
// ---------------------------------------------------------------------------
function isValidOrigin(req: Request): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  const origin = (req.get('origin') || '').toLowerCase();
  const referer = (req.get('referer') || '').toLowerCase();
  const requestHost = (req.get('x-forwarded-host') || req.get('host') || '').split(':')[0].toLowerCase();

  return ALLOWED_DOMAINS.some(d =>
    origin.includes(d) ||
    referer.includes(d) ||
    requestHost === d ||
    requestHost.endsWith(`.${d}`)
  );
}

// ---------------------------------------------------------------------------
// Safe app URL — never derives host from untrusted request headers without
// validating against the allowed-domains whitelist.
// ---------------------------------------------------------------------------
function getSafeAppUrl(req: Request): string {
  const envUrl = process.env.APP_URL;
  if (envUrl && !envUrl.includes('.run.app')) return envUrl;

  // PUBLIC_URL is the preferred env var for Cloud Run with a custom domain
  const publicUrl = process.env.PUBLIC_URL;
  if (publicUrl) return publicUrl;

  // Derive from request only when host is in the allowlist
  const requestHost = (req.get('x-forwarded-host') || req.get('host') || '').split(':')[0].toLowerCase();
  if (ALLOWED_DOMAINS.some(d => requestHost === d || requestHost.endsWith(`.${d}`))) {
    const proto = req.get('x-forwarded-proto') || 'https';
    return `${proto}://${req.get('x-forwarded-host') || req.get('host')}`;
  }

  return `http://localhost:${process.env.PORT || 3000}`;
}

function firstValue(value: unknown): string | undefined {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : undefined;
  return typeof value === 'string' ? value : undefined;
}

async function verifyFirebaseBearer(req: Request): Promise<admin.auth.DecodedIdToken | null> {
  const header = req.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  try {
    return await admin.auth().verifyIdToken(match[1]);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Server bootstrap
// ---------------------------------------------------------------------------
async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Security headers on every response
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://apis.google.com https://accounts.google.com https://www.gstatic.com https://www.google.com https://ssl.gstatic.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com https://www.gstatic.com",
        "font-src 'self' https://fonts.gstatic.com https://www.gstatic.com",
        "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://maps.googleapis.com https://maps.gstatic.com https://lh3.googleusercontent.com https://www.gstatic.com https://ssl.gstatic.com https://www.google.com https://firebasestorage.googleapis.com",
        "connect-src 'self' https://*.googleapis.com wss://*.googleapis.com https://apis.google.com https://www.google.com https://www.gstatic.com https://nominatim.openstreetmap.org https://router.project-osrm.org https://toyyibpay.com https://dev.toyyibpay.com https://firebasestorage.googleapis.com",
        "frame-src https://accounts.google.com https://gen-lang-client-0580807845.firebaseapp.com https://www.google.com https://gen-lang-client-0580807845.web.app",
        "worker-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'self'",
      ].join('; ')
    );
    next();
  });

  const corsOrigins = process.env.NODE_ENV === 'production'
    ? ALLOWED_DOMAINS.flatMap(d => [`https://${d}`, `http://${d}`])
    : true;

  app.use(cors({ origin: corsOrigins }));
  app.use(bodyParser.json({ limit: '8mb' }));
  app.use(bodyParser.urlencoded({ extended: true, limit: '8mb' }));

  const TOYYIBPAY_SECRET = process.env.TOYYIBPAY_SECRET_KEY;
  const TOYYIBPAY_CATEGORY = process.env.TOYYIBPAY_CATEGORY_CODE;
  const TOYYIBPAY_BASE_URL = process.env.TOYYIBPAY_SANDBOX === 'true'
    ? "https://dev.toyyibpay.com/index.php/api"
    : "https://toyyibpay.com/index.php/api";

  async function verifyToyyibPayTransaction(payment: PendingPayment, refNo: string, billCode: string): Promise<Record<string, unknown> | null> {
    const formData = new URLSearchParams();
    formData.append('billCode', billCode);
    formData.append('billpaymentStatus', '1');

    const response = await axios.post<any>(`${TOYYIBPAY_BASE_URL}/getBillTransactions`, formData, {
      timeout: 10000,
    });

    if (!Array.isArray(response.data)) return null;

    const expectedAmount = (payment.amount / 100).toFixed(2);
    const transaction = response.data.find((tx: any) => {
      const externalRef = String(tx.billExternalReferenceNo || '');
      const paymentStatus = String(tx.billpaymentStatus || tx.billStatus || '');
      const amount = Number.parseFloat(String(tx.billpaymentAmount || '0')).toFixed(2);
      return externalRef === refNo && paymentStatus === '1' && amount === expectedAmount;
    });

    return transaction || null;
  }

  async function activateVerifiedPayment(refNo: string, billCodeFromGateway?: string | null): Promise<boolean> {
    const pendingRef = db.collection('pending_payments').doc(refNo);
    const pendingDoc = await pendingRef.get();
    if (!pendingDoc.exists) return false;

    const payment = pendingDoc.data() as PendingPayment;
    if (payment.status === 'completed') return true;

    const billCode = billCodeFromGateway || payment.billCode;
    if (!billCode) return false;

    const transaction = await verifyToyyibPayTransaction(payment, refNo, billCode);
    if (!transaction) return false;

    const now = Date.now();
    const expiryDate = payment.type === 'yearly'
      ? now + 366 * 24 * 60 * 60 * 1000
      : now + 31 * 24 * 60 * 60 * 1000;

    await db.collection('profiles').doc(payment.uid).set({
      isPro: true,
      subscriptionTier: payment.tier,
      expiryDate,
      lastPaymentDate: now,
      lastBillCode: billCode,
      subscriptionType: payment.type,
      updatedAt: now,
    }, { merge: true });

    await pendingRef.set({
      status: 'completed',
      billCode,
      verifiedAt: now,
      transaction,
    }, { merge: true });

    return true;
  }

  // -------------------------------------------------------------------------
  // Gemini OCR proxy - keeps the Gemini API key server-side only
  // -------------------------------------------------------------------------
  app.post("/api/ocr/extract", async (req: Request, res: Response) => {
    if (!isValidOrigin(req)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const token = await verifyFirebaseBearer(req);
    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { image } = req.body;
    if (!image || typeof image !== 'string' || !image.startsWith('data:image/')) {
      return res.status(400).json({ error: "Valid base64 image data URL required" });
    }

    const geminiKey = (process.env.CUSTOM_GEMINI_KEY || process.env.GEMINI_API_KEY || '').replace(/['"]/g, '').trim();
    if (!geminiKey || geminiKey.length < 10 || geminiKey === 'MY_GEMINI_API_KEY') {
      return res.status(503).json({ error: "Gemini OCR not configured" });
    }

    const mimeType = image.split(';')[0].split(':')[1] || 'image/jpeg';
    const base64Data = image.split(',')[1];
    if (!base64Data) {
      return res.status(400).json({ error: "Invalid image payload" });
    }

    try {
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: {
          parts: [
            {
              text: "Extract from Malaysian AWB: recipientName, recipientPhone, address, trackingNumber, isCOD (bool), codAmount (number). Return JSON only.",
            },
            { inlineData: { data: base64Data, mimeType } },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              recipientName: { type: Type.STRING, description: "Recipient's full name" },
              recipientPhone: { type: Type.STRING, description: "Recipient's phone number" },
              address: { type: Type.STRING, description: "Full recipient delivery address" },
              trackingNumber: { type: Type.STRING, description: "Courier tracking number" },
              isCOD: { type: Type.BOOLEAN, description: "True if COD is mentioned" },
              codAmount: { type: Type.NUMBER, description: "The RM amount for COD if applicable" },
            },
            required: ['recipientName', 'address', 'trackingNumber'],
          },
        },
      });

      if (!response.text) {
        return res.status(422).json({ error: "Tiada teks dikesan dalam gambar." });
      }

      return res.json(JSON.parse(response.text));
    } catch (error: any) {
      const message = String(error?.message || '');
      if (message.includes('429') || message.includes('RESOURCE_EXHAUSTED') || message.toLowerCase().includes('quota')) {
        return res.status(429).json({
          error: "Had penggunaan (Quota) Gemini anda telah tamat atau terlalu laju. Sila tunggu sebentar atau semak baki kredit di Google AI Studio.",
        });
      }
      return res.status(502).json({ error: "Gagal membaca label melalui Gemini OCR." });
    }
  });

  // -------------------------------------------------------------------------
  // Google Maps Geocoding proxy — keeps the API key server-side only
  // -------------------------------------------------------------------------
  app.get("/api/geocode", async (req: Request, res: Response) => {
    const { address } = req.query;
    if (!address || typeof address !== 'string' || address.trim().length === 0) {
      return res.status(400).json({ error: "Address required" });
    }

    const googleMapsKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!googleMapsKey) {
      return res.status(503).json({ error: "Geocoding not configured" });
    }

    try {
      const response = await axios.get<any>(
        'https://maps.googleapis.com/maps/api/geocode/json',
        {
          params: { address: address.trim(), components: 'country:MY', key: googleMapsKey },
          timeout: 8000,
        }
      );
      const data = response.data;
      if (data.status === 'OK' && data.results?.length > 0) {
        const loc = data.results[0].geometry.location;
        return res.json({ lat: loc.lat, lng: loc.lng });
      }
      return res.status(404).json({ error: "Address not found", status: data.status });
    } catch {
      return res.status(502).json({ error: "Geocoding request failed" });
    }
  });

  // -------------------------------------------------------------------------
  // 1. Create Payment Bill
  // -------------------------------------------------------------------------
  app.post("/api/payment/create", async (req: Request, res: Response) => {
    if (!isValidOrigin(req)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const token = await verifyFirebaseBearer(req);
    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { uid, email, name, phone, type, tier } = req.body;

    if (!uid || !email || !type || !tier) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (token.uid !== uid || token.email !== email) {
      return res.status(403).json({ error: "Authenticated user does not match payment request" });
    }

    if (!VALID_TIERS.has(tier) || !VALID_TYPES.has(type)) {
      return res.status(400).json({ error: "Invalid tier or subscription type" });
    }

    if (isRateLimited(uid)) {
      return res.status(429).json({ error: "Too many payment requests. Please wait before trying again." });
    }

    if (!TOYYIBPAY_SECRET || !TOYYIBPAY_CATEGORY) {
      return res.status(500).json({ error: "Payment gateway not configured." });
    }

    // Compute price server-side — never trust client-supplied amount
    let amount = TIER_AMOUNTS[tier as string];
    if (type === 'yearly') amount *= 10; // 10-month price for 12 months

    const currentAppUrl = getSafeAppUrl(req);
    const billName = `RK ${(tier as string).toUpperCase()} ${type === 'monthly' ? 'Monthly' : 'Yearly'}`.substring(0, 30);

    const shortUid = (uid as string).substring(0, 8);
    const typeCode = type === 'monthly' ? 'M' : 'Y';
    const tierCode = tier === 'lite' ? 'L' : tier === 'standard' ? 'S' : 'U';
    const refNo = `${shortUid}_${typeCode}_${tierCode}_${Math.floor(Date.now() / 1000)}`;

    try {
      // Store mapping BEFORE creating bill — this is the authoritative source for callback
      await db.collection('pending_payments').doc(refNo).set({
        uid, email, type, tier, amount,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const formData = new URLSearchParams();
      formData.append('userSecretKey', TOYYIBPAY_SECRET);
      formData.append('categoryCode', TOYYIBPAY_CATEGORY);
      formData.append('billName', billName);
      formData.append('billDescription', 'RouteKing subscription');
      formData.append('billPriceSetting', '1');
      formData.append('billPayorInfo', '1');
      formData.append('billAmount', amount.toString());
      // Return/callback URLs carry only refNo — no uid/tier/type in query params
      formData.append('billReturnUrl', `${currentAppUrl}/api/payment/return?refno=${refNo}`);
      formData.append('billCallbackUrl', `${currentAppUrl}/api/payment/callback`);
      formData.append('billExternalReferenceNo', refNo);
      formData.append('billTo', (name as string) || 'Rider');
      formData.append('billEmail', email as string);
      // Only append phone if it looks valid
      if (phone && /^[0-9+\s\-()‪-‬]{7,20}$/.test(String(phone))) {
        formData.append('billPhone', String(phone));
      }

      const response = await axios.post<any>(`${TOYYIBPAY_BASE_URL}/createBill`, formData);

      if (response.data?.[0]?.BillCode) {
        const billCode = response.data[0].BillCode;
        await db.collection('pending_payments').doc(refNo).set({
          billCode,
          status: 'pending',
          updatedAt: Date.now(),
        }, { merge: true });
        const paymentUrl = `${process.env.TOYYIBPAY_SANDBOX === 'true' ? 'https://dev.toyyibpay.com' : 'https://toyyibpay.com'}/${billCode}`;
        return res.json({ paymentUrl });
      }

      const errorMsg = response.data?.[0]?.msg || "Failed to create bill";
      return res.status(500).json({ error: errorMsg });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return res.status(500).json({ error: "Payment gateway connection error" });
      }
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // -------------------------------------------------------------------------
  // 2. Payment Callback (Webhook from ToyyibPay — POST from ToyyibPay servers)
  // -------------------------------------------------------------------------
  app.post("/api/payment/callback", async (req: Request, res: Response) => {
    const { order_id, refno, status, billcode } = req.body;

    // ToyyibPay status 1 = success
    // order_id = our billExternalReferenceNo; refno = ToyyibPay's internal ref (fallback)
    const ourRef = (order_id || refno) as string | undefined;
    if (status !== '1' || !ourRef) {
      return res.send("OK");
    }

    try {
      // Trust ONLY the pending_payments document — never query params
      await activateVerifiedPayment(ourRef, billcode || null);
    } catch (error) {
      console.error("Callback error:", error instanceof Error ? error.message : 'unknown');
    }

    res.send("OK");
  });

  // -------------------------------------------------------------------------
  // 3. Payment Return URL (browser redirect after payment)
  // -------------------------------------------------------------------------
  app.get("/api/payment/return", async (req: Request, res: Response) => {
    const { status, status_id, billcode, refno, order_id } = req.query;

    // refno is pre-set by us in the return URL; order_id may be appended by ToyyibPay
    // Use the first non-array, non-empty value
    const rawRef = firstValue(refno);
    const rawOrderId = firstValue(order_id);
    const ourRef = rawRef || rawOrderId;
    const paymentStatus = firstValue(status_id) || firstValue(status);
    const gatewayBillCode = firstValue(billcode);
    let verified = false;

    if (paymentStatus === '1' && ourRef) {
      try {
        verified = await activateVerifiedPayment(ourRef, gatewayBillCode || null);
      } catch (error) {
        console.error("Return activation error:", error instanceof Error ? error.message : 'unknown');
      }
    }

    // Always redirect to a fixed path — no open redirect possible
    if (verified) {
      return res.redirect('/?payment=success');
    }
    if (paymentStatus === '1') {
      return res.redirect('/?payment=pending');
    }
    return res.redirect('/?payment=failed');
  });

  // -------------------------------------------------------------------------
  // Vite middleware (dev) / static files (prod)
  // -------------------------------------------------------------------------
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
