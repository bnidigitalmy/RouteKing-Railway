import express from "express";
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

// Initialize Firebase Admin
// In AI Studio/Cloud Run, this uses the default service account
const firebaseApp = admin.apps.length ? admin.app() : admin.initializeApp();

// Use the specific database ID if provided
const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
console.log(`Initializing Firestore Admin with Database ID: ${databaseId}`);
const db = getFirestore(firebaseApp, databaseId);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(cors());
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));

  // ToyyibPay API Config
  const TOYYIBPAY_SECRET = process.env.TOYYIBPAY_SECRET_KEY;
  const TOYYIBPAY_CATEGORY = process.env.TOYYIBPAY_CATEGORY_CODE;
  
  console.log("ToyyibPay Config Check:", {
    hasSecret: !!TOYYIBPAY_SECRET,
    hasCategory: !!TOYYIBPAY_CATEGORY,
    sandbox: process.env.TOYYIBPAY_SANDBOX,
    secretPrefix: TOYYIBPAY_SECRET ? TOYYIBPAY_SECRET.substring(0, 5) + "..." : "none"
  });

  const TOYYIBPAY_BASE_URL = process.env.TOYYIBPAY_SANDBOX === 'true' 
    ? "https://dev.toyyibpay.com/index.php/api" 
    : "https://toyyibpay.com/index.php/api";
  
  const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;

  // 1. Create Bill
  app.post("/api/payment/create", async (req, res) => {
    const { uid, email, name, phone, type, tier } = req.body;
    
    if (!uid || !email || !type || !tier) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Dynamically determine APP_URL if not set or if it's the default internal URL
    let currentAppUrl = process.env.APP_URL;
    const requestHost = req.get('x-forwarded-host') || req.get('host');
    
    // If APP_URL is missing OR it matches the internal Cloud Run URL format, 
    // prioritize the host from the request headers
    if (!currentAppUrl || currentAppUrl.includes('.run.app')) {
      if (requestHost) {
        const protocol = req.get('x-forwarded-proto') || req.protocol;
        currentAppUrl = `${protocol}://${requestHost}`;
      }
    }

    let amount = 1490; // Default Lite
    if (tier === 'standard') amount = 2990;
    if (tier === 'ultimate') amount = 4990;

    if (type === 'yearly') {
      // Yearly discount (10 months price for 12 months)
      amount = amount * 10;
    }

    const billName = `RK ${tier.toUpperCase()} ${type === 'monthly' ? 'Monthly' : 'Yearly'}`.substring(0, 30);
    const billDescription = `Subscription for user ${uid}`;

    try {
      if (!TOYYIBPAY_SECRET || !TOYYIBPAY_CATEGORY) {
        console.error("ToyyibPay configuration missing");
        return res.status(500).json({ 
          error: "Payment gateway not configured. Please set TOYYIBPAY_SECRET_KEY and TOYYIBPAY_CATEGORY_CODE in environment variables." 
        });
      }

      const formData = new URLSearchParams();
      formData.append('userSecretKey', TOYYIBPAY_SECRET);
      formData.append('categoryCode', TOYYIBPAY_CATEGORY);
      formData.append('billName', billName);
      formData.append('billDescription', billDescription);
      formData.append('billPriceSetting', '1');
      formData.append('billPayorInfo', '1');
      formData.append('billAmount', amount.toString());
      formData.append('billReturnUrl', `${currentAppUrl}/api/payment/return?uid=${uid}&type=${type}&tier=${tier}`);
      formData.append('billCallbackUrl', `${currentAppUrl}/api/payment/callback?uid=${uid}&type=${type}&tier=${tier}`);
      
      // Shorten ref no to avoid potential length limits (ToyyibPay limit is often 30-50 chars)
      // Format: UID(8)_TYPE(1)_TIER(1)_TIMESTAMP(10)
      const shortUid = uid.substring(0, 8);
      const typeCode = type === 'monthly' ? 'M' : 'Y';
      const tierCode = tier === 'lite' ? 'L' : tier === 'standard' ? 'S' : 'U';
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const refNo = `${shortUid}_${typeCode}_${tierCode}_${timestamp}`;
      
      formData.append('billExternalReferenceNo', refNo);
      formData.append('billTo', name || 'Rider');
      formData.append('billEmail', email);
      formData.append('billPhone', phone || '0123456789');

      // Also store the full mapping in Firestore so we can recover the UID in callback
      try {
        await db.collection('pending_payments').doc(refNo).set({
          uid,
          email,
          type,
          tier,
          amount,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`Stored pending payment in Firestore: ${refNo}`);
      } catch (fsError) {
        console.error("Firestore Pending Payment Error (Admin SDK):", fsError);
        // We continue anyway because we have query params as fallback
      }

      const response = await axios.post(`${TOYYIBPAY_BASE_URL}/createBill`, formData);
      
      if (response.data && response.data[0] && response.data[0].BillCode) {
        const billCode = response.data[0].BillCode;
        const paymentUrl = `${process.env.TOYYIBPAY_SANDBOX === 'true' ? 'https://dev.toyyibpay.com' : 'https://toyyibpay.com'}/${billCode}`;
        res.json({ paymentUrl });
      } else {
        console.error("ToyyibPay Error Response:", JSON.stringify(response.data));
        let errorMsg = "Failed to create bill";
        if (Array.isArray(response.data) && response.data[0] && response.data[0].msg) {
          errorMsg = response.data[0].msg;
        } else if (typeof response.data === 'string') {
          errorMsg = response.data;
        }
        
        res.status(500).json({ error: errorMsg, details: response.data });
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error("ToyyibPay API Error:", error.response?.data || error.message);
        return res.status(500).json({ 
          error: "ToyyibPay API Connection Error", 
          details: error.response?.data || error.message 
        });
      }
      console.error("Payment Creation Error:", error);
      res.status(500).json({ error: "Internal server error", details: error instanceof Error ? error.message : String(error) });
    }
  });

  // 2. Callback (Webhook)
  app.post("/api/payment/callback", async (req, res) => {
    const { refno, status, reason, billcode, order_id } = req.body;
    // Fallback info from query params if Firestore lookup fails
    const { uid: qUid, type: qType, tier: qTier } = req.query;
    
    console.log("ToyyibPay Callback Received:", { refno, status, reason, billcode, qUid });

    // ToyyibPay status: 1 = Success, 2 = Pending, 3 = Failed
    if (status === '1' && (refno || qUid)) {
      try {
        let uid = qUid as string;
        let type = qType as string;
        let tier = qTier as string;

        // Try to look up the full info from pending_payments if we don't have it from query
        if (!uid && refno) {
          try {
            const pendingDoc = await db.collection('pending_payments').doc(refno).get();
            if (pendingDoc.exists) {
              const data = pendingDoc.data();
              uid = data?.uid;
              type = data?.type;
              tier = data?.tier;
            }
          } catch (fsLookupError) {
            console.error("Firestore Lookup Error in Callback:", fsLookupError);
          }
        }
        
        // Final fallback to parsing refno
        if (!uid && refno) {
          const parts = refno.split('_');
          uid = parts[0];
          type = parts[1] === 'M' ? 'monthly' : 'yearly';
          tier = parts[2] === 'L' ? 'lite' : parts[2] === 'S' ? 'standard' : 'ultimate';
        }

        if (!uid) {
          console.error("Could not determine UID for payment:", refno);
          return res.send("OK");
        }
      
        const now = Date.now();
        let expiryDate = now;

        if (type === 'yearly') {
          // 1 year + 1 day buffer
          expiryDate = now + (366 * 24 * 60 * 60 * 1000);
        } else {
          // 30 days + 1 day buffer
          expiryDate = now + (31 * 24 * 60 * 60 * 1000);
        }

        // Update Firestore using Admin SDK
        try {
          await db.collection('profiles').doc(uid).set({
            isPro: true,
            subscriptionTier: tier || 'lite',
            expiryDate: expiryDate,
            lastPaymentDate: now,
            lastBillCode: billcode,
            subscriptionType: type || 'monthly',
            updatedAt: now
          }, { merge: true });
          
          console.log(`Successfully updated subscription for user ${uid} (${tier} - ${type})`);
        } catch (fsUpdateError) {
          console.error("Firestore Profile Update Error (Admin SDK):", fsUpdateError);
        }
      } catch (error) {
        console.error("General Callback Error:", error);
      }
    }

    res.send("OK");
  });

  // 3. Return URL
  app.get("/api/payment/return", async (req, res) => {
    const { status, billcode, uid, type, tier } = req.query;
    
    if (status === '1' && uid && type) {
      // Instant activation on return
      const now = Date.now();
      let expiryDate = now;

      if (type === 'yearly') {
        expiryDate = now + (366 * 24 * 60 * 60 * 1000);
      } else {
        expiryDate = now + (31 * 24 * 60 * 60 * 1000);
      }

      try {
        await db.collection('profiles').doc(uid as string).set({
          isPro: true,
          subscriptionTier: tier || 'lite',
          expiryDate: expiryDate,
          lastPaymentDate: now,
          lastBillCode: billcode as string,
          subscriptionType: type as string,
          updatedAt: now
        }, { merge: true });
        console.log(`Instant activation for user ${uid} on return (Admin SDK)`);
      } catch (fsError) {
        console.error("Firestore Return Update Error (Admin SDK):", fsError);
      }
      
      res.redirect('/?payment=success');
    } else if (status === '1') {
      // Fallback if uid/type missing
      res.redirect('/?payment=success');
    } else {
      res.redirect('/?payment=failed');
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
