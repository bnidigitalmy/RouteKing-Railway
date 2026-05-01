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

// Load Firebase Config
const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));

// Initialize Firebase Admin (uses default service account on Cloud Run)
const firebaseApp = admin.apps.length ? admin.app() : admin.initializeApp();
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
  return ALLOWED_DOMAINS.some(d => origin.includes(d) || referer.includes(d));
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
        "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://maps.googleapis.com https://maps.gstatic.com",
        "connect-src 'self' https://firestore.googleapis.com wss://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://nominatim.openstreetmap.org https://router.project-osrm.org https://generativelanguage.googleapis.com https://toyyibpay.com https://dev.toyyibpay.com",
        "frame-src 'none'",
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
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));

  const TOYYIBPAY_SECRET = process.env.TOYYIBPAY_SECRET_KEY;
  const TOYYIBPAY_CATEGORY = process.env.TOYYIBPAY_CATEGORY_CODE;
  const TOYYIBPAY_BASE_URL = process.env.TOYYIBPAY_SANDBOX === 'true'
    ? "https://dev.toyyibpay.com/index.php/api"
    : "https://toyyibpay.com/index.php/api";

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

    const { uid, email, name, phone, type, tier } = req.body;

    if (!uid || !email || !type || !tier) {
      return res.status(400).json({ error: "Missing required fields" });
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
    const { refno, status, billcode } = req.body;

    // ToyyibPay status 1 = success
    if (status !== '1' || !refno) {
      return res.send("OK");
    }

    try {
      // Trust ONLY the pending_payments document — never query params
      const pendingDoc = await db.collection('pending_payments').doc(refno as string).get();
      if (!pendingDoc.exists) {
        return res.send("OK");
      }

      const { uid, type, tier } = pendingDoc.data()!;
      const now = Date.now();
      const expiryDate = type === 'yearly'
        ? now + 366 * 24 * 60 * 60 * 1000
        : now + 31 * 24 * 60 * 60 * 1000;

      await db.collection('profiles').doc(uid).set({
        isPro: true,
        subscriptionTier: tier,
        expiryDate,
        lastPaymentDate: now,
        lastBillCode: billcode || null,
        subscriptionType: type,
        updatedAt: now,
      }, { merge: true });

      // Remove pending record after successful activation
      await db.collection('pending_payments').doc(refno as string).delete();
    } catch (error) {
      console.error("Callback error:", error instanceof Error ? error.message : 'unknown');
    }

    res.send("OK");
  });

  // -------------------------------------------------------------------------
  // 3. Payment Return URL (browser redirect after payment)
  // -------------------------------------------------------------------------
  app.get("/api/payment/return", async (req: Request, res: Response) => {
    const { status, billcode, refno } = req.query;

    if (status === '1' && refno) {
      try {
        const pendingDoc = await db.collection('pending_payments').doc(refno as string).get();
        if (pendingDoc.exists) {
          const { uid, type, tier } = pendingDoc.data()!;
          const now = Date.now();
          const expiryDate = type === 'yearly'
            ? now + 366 * 24 * 60 * 60 * 1000
            : now + 31 * 24 * 60 * 60 * 1000;

          await db.collection('profiles').doc(uid).set({
            isPro: true,
            subscriptionTier: tier,
            expiryDate,
            lastPaymentDate: now,
            lastBillCode: (billcode as string) || null,
            subscriptionType: type,
            updatedAt: now,
          }, { merge: true });

          await db.collection('pending_payments').doc(refno as string).delete();
        }
      } catch (error) {
        console.error("Return activation error:", error instanceof Error ? error.message : 'unknown');
      }
    }

    // Always redirect to a fixed path — no open redirect possible
    if (status === '1') {
      return res.redirect('/?payment=success');
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
