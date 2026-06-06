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
import crypto from "crypto";
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
function normalizeHost(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return '';

  try {
    return new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`).hostname;
  } catch {
    return trimmed.replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
  }
}

const ALLOWED_DOMAINS: string[] = [
  process.env.ALLOWED_DOMAINS || 'routeking.my,app.routeking.my,www.routeking.my',
  process.env.RAILWAY_PUBLIC_DOMAIN || '',
  process.env.RAILWAY_STATIC_URL || '',
]
  .flatMap(d => d.split(','))
  .map(normalizeHost)
  .filter(Boolean);

const VALID_TIERS = new Set(['lite', 'standard', 'ultimate']);
const VALID_TYPES = new Set(['monthly', 'yearly']);
const GEMINI_OCR_MODEL = (process.env.GEMINI_OCR_MODEL || 'gemini-2.5-flash').replace(/['"]/g, '').trim();
const GEMINI_QUOTA_ERROR_CODE = 'GEMINI_QUOTA_OR_RATE_LIMIT';
const GEMINI_QUOTA_ERROR_MESSAGE =
  "Had penggunaan (Quota) Gemini anda telah tamat atau terlalu laju. Sila tunggu sebentar atau semak baki kredit di Google AI Studio.";

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

function redactSensitive(value: string): string {
  return value.replace(/AIza[0-9A-Za-z\-_]{20,}/g, 'AIza...[redacted]');
}

function getGeminiErrorDetails(error: any): { status?: number; code: string; message: string } {
  const statusValue =
    error?.status ??
    error?.response?.status ??
    error?.error?.code ??
    error?.cause?.status;
  const status = Number(statusValue) || undefined;
  const code = String(
    error?.code ||
    error?.response?.data?.error?.status ||
    error?.error?.status ||
    ''
  );
  const message = redactSensitive(String(
    error?.message ||
    error?.response?.data?.error?.message ||
    error?.error?.message ||
    ''
  ));

  return { status, code, message };
}

function isGeminiQuotaError(error: any): boolean {
  const details = getGeminiErrorDetails(error);
  const code = details.code.toUpperCase();
  const message = details.message.toLowerCase();

  return details.status === 429 ||
    code.includes('RESOURCE_EXHAUSTED') ||
    code.includes('QUOTA') ||
    message.includes('429') ||
    message.includes('resource_exhausted') ||
    message.includes('quota') ||
    message.includes('rate limit');
}

function getGeminiKeyConfig(): { key: string; source: 'GEMINI_API_KEY' | 'CUSTOM_GEMINI_KEY' | 'none' } {
  const rawKey = process.env.GEMINI_API_KEY || process.env.CUSTOM_GEMINI_KEY || '';
  const source = process.env.GEMINI_API_KEY
    ? 'GEMINI_API_KEY'
    : process.env.CUSTOM_GEMINI_KEY
      ? 'CUSTOM_GEMINI_KEY'
      : 'none';

  return {
    key: rawKey.replace(/['"]/g, '').trim(),
    source,
  };
}

// ---------------------------------------------------------------------------
// CSRF / Origin validation
// ---------------------------------------------------------------------------
function hostMatches(host: string, allowedHost: string): boolean {
  return host === allowedHost || host.endsWith(`.${allowedHost}`);
}

function hostFromHeaderUrl(value: string): string {
  if (!value) return '';

  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function isValidOrigin(req: Request): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  const origin = (req.get('origin') || '').toLowerCase();
  const referer = (req.get('referer') || '').toLowerCase();
  const requestHost = normalizeHost(req.get('x-forwarded-host') || req.get('host') || '');
  const originHost = hostFromHeaderUrl(origin);
  const refererHost = hostFromHeaderUrl(referer);

  // Same-origin fetches do not always include Origin/Referer, especially
  // through hosting proxies. Protected API routes still require Firebase
  // Bearer tokens, so empty-origin requests can proceed to auth validation.
  if (!origin && !referer) return true;
  if (requestHost && (originHost === requestHost || refererHost === requestHost)) return true;

  return ALLOWED_DOMAINS.some(d =>
    (originHost && hostMatches(originHost, d)) ||
    (refererHost && hostMatches(refererHost, d)) ||
    (requestHost && hostMatches(requestHost, d))
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
  const requestHost = normalizeHost(req.get('x-forwarded-host') || req.get('host') || '');
  if (ALLOWED_DOMAINS.some(d => hostMatches(requestHost, d))) {
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
// Customer location-pin tokens — HMAC-signed, stateless (no DB lookup needed)
// ---------------------------------------------------------------------------
const MY_BOUNDS = { latMin: 0.8, latMax: 7.5, lngMin: 99.5, lngMax: 119.5 };
function isWithinMalaysia(lat: number, lng: number): boolean {
  return lat >= MY_BOUNDS.latMin && lat <= MY_BOUNDS.latMax &&
         lng >= MY_BOUNDS.lngMin && lng <= MY_BOUNDS.lngMax;
}

// These MUST match the client-side hashes so cache entries the server writes
// are found later by the app (see src/lib/gemini.ts and src/App.tsx).
function geocacheHash(address: string): string {
  return address.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 100);
}
function verifiedAddressHash(address: string): string {
  return address.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 200);
}

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const LOCATION_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function signLocationToken(parcelId: string): string | null {
  const secret = process.env.LOCATION_TOKEN_SECRET;
  if (!secret) return null;
  const payload = base64url(Buffer.from(JSON.stringify({ pid: parcelId, exp: Date.now() + LOCATION_TOKEN_TTL_MS })));
  const sig = base64url(crypto.createHmac('sha256', secret).update(payload).digest());
  return `${payload}.${sig}`;
}

function verifyLocationToken(token: unknown): string | null {
  const secret = process.env.LOCATION_TOKEN_SECRET;
  if (!secret || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = base64url(crypto.createHmac('sha256', secret).update(payload).digest());
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  try {
    const json = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    if (!json || typeof json.pid !== 'string' || typeof json.exp !== 'number' || Date.now() > json.exp) return null;
    return json.pid;
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

    const { key: geminiKey, source: geminiKeySource } = getGeminiKeyConfig();
    if (!geminiKey || geminiKey.length < 10 || geminiKey === 'MY_GEMINI_API_KEY') {
      return res.status(503).json({
        error: "Gemini OCR not configured",
        code: "GEMINI_NOT_CONFIGURED",
      });
    }

    const mimeType = image.split(';')[0].split(':')[1] || 'image/jpeg';
    const base64Data = image.split(',')[1];
    if (!base64Data) {
      return res.status(400).json({ error: "Invalid image payload" });
    }

    try {
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const response = await ai.models.generateContent({
        model: GEMINI_OCR_MODEL,
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
        return res.status(422).json({
          error: "Tiada teks dikesan dalam gambar.",
          code: "OCR_EMPTY_RESPONSE",
        });
      }

      return res.json(JSON.parse(response.text));
    } catch (error: any) {
      const details = getGeminiErrorDetails(error);
      console.error("Gemini OCR failed:", {
        model: GEMINI_OCR_MODEL,
        keySource: geminiKeySource,
        status: details.status || "unknown",
        code: details.code || "unknown",
        message: details.message.slice(0, 500) || "unknown",
      });

      if (isGeminiQuotaError(error)) {
        return res.status(429).json({
          error: GEMINI_QUOTA_ERROR_MESSAGE,
          code: GEMINI_QUOTA_ERROR_CODE,
        });
      }
      return res.status(502).json({
        error: "Gagal membaca label melalui Gemini OCR.",
        code: "GEMINI_OCR_FAILED",
      });
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
  // Customer location pin — rider generates a shareable link for one parcel
  // -------------------------------------------------------------------------
  app.post("/api/parcel/location-link", async (req: Request, res: Response) => {
    if (!isValidOrigin(req)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const token = await verifyFirebaseBearer(req);
    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }
    if (!process.env.LOCATION_TOKEN_SECRET) {
      return res.status(503).json({ error: "Location sharing not configured" });
    }

    const { parcelId } = req.body;
    if (!parcelId || typeof parcelId !== 'string' || parcelId.length > 128) {
      return res.status(400).json({ error: "Invalid parcel" });
    }

    try {
      const doc = await db.collection('parcels').doc(parcelId).get();
      if (!doc.exists || (doc.data() as any).uid !== token.uid) {
        return res.status(404).json({ error: "Parcel not found" });
      }
      const signed = signLocationToken(parcelId);
      if (!signed) {
        return res.status(503).json({ error: "Location sharing not configured" });
      }
      return res.json({ url: `${getSafeAppUrl(req)}/pin/${signed}` });
    } catch (error) {
      console.error("location-link error:", error instanceof Error ? error.message : 'unknown');
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Public: minimal parcel info to render the pin page (the token IS the secret)
  app.get("/api/parcel/location-info", async (req: Request, res: Response) => {
    const pid = verifyLocationToken(firstValue(req.query.token));
    if (!pid) {
      return res.status(410).json({ error: "Link tidak sah atau telah luput." });
    }
    try {
      const doc = await db.collection('parcels').doc(pid).get();
      if (!doc.exists) {
        return res.status(404).json({ error: "Parcel tidak dijumpai." });
      }
      const d = doc.data() as any;
      return res.json({
        trackingNumber: d.trackingNumber || '',
        recipientName: d.recipientName || '',
        alreadyPinned: d.isCustomerPinned === true,
      });
    } catch (error) {
      console.error("location-info error:", error instanceof Error ? error.message : 'unknown');
      return res.status(500).json({ error: "Ralat pelayan." });
    }
  });

  // Public: customer submits their exact GPS location for a parcel
  app.post("/api/parcel/location", async (req: Request, res: Response) => {
    const { token, lat, lng } = req.body;
    const pid = verifyLocationToken(token);
    if (!pid) {
      return res.status(410).json({ error: "Link tidak sah atau telah luput." });
    }
    if (typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({ error: "Koordinat tidak sah." });
    }
    if (!isWithinMalaysia(lat, lng)) {
      return res.status(422).json({ error: "Lokasi di luar Malaysia. Sila pastikan GPS anda betul." });
    }
    if (isRateLimited(`pin_${pid}`, 10, 60 * 60 * 1000)) {
      return res.status(429).json({ error: "Terlalu banyak percubaan. Sila cuba sebentar lagi." });
    }

    try {
      const ref = db.collection('parcels').doc(pid);
      const doc = await ref.get();
      if (!doc.exists) {
        return res.status(404).json({ error: "Parcel tidak dijumpai." });
      }
      const d = doc.data() as any;

      await ref.update({
        lat,
        lng,
        isLocationVerified: true,
        isCustomerPinned: true,
      });

      // Make the app smarter: cache this verified location so the same address
      // resolves instantly next time without hitting the geocoding APIs.
      const address = typeof d.address === 'string' ? d.address : '';
      const uid = typeof d.uid === 'string' ? d.uid : '';
      if (address) {
        const now = Date.now();
        try {
          await db.collection('geocache').doc(geocacheHash(address)).set(
            { address, lat, lng, isApproximate: false, lastUpdated: now },
            { merge: true }
          );
        } catch (e) {
          console.error("geocache write failed:", e instanceof Error ? e.message : 'unknown');
        }
        if (uid) {
          try {
            await db.collection('users').doc(uid)
              .collection('verified_addresses').doc(verifiedAddressHash(address))
              .set({ address, lat, lng, lastUpdated: now }, { merge: true });
          } catch (e) {
            console.error("verified_addresses write failed:", e instanceof Error ? e.message : 'unknown');
          }
        }
      }

      return res.json({ ok: true });
    } catch (error) {
      console.error("Location pin error:", error instanceof Error ? error.message : 'unknown');
      return res.status(500).json({ error: "Gagal menyimpan lokasi. Sila cuba lagi." });
    }
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
