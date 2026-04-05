import express from "express";
import "dotenv/config";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import bodyParser from "body-parser";
import cors from "cors";
import admin from "firebase-admin";
import fs from "fs";

// Load Firebase Config
const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));

// Initialize Firebase Admin
admin.initializeApp({
  projectId: firebaseConfig.projectId,
});
const db = admin.firestore();
if (firebaseConfig.firestoreDatabaseId) {
  // If a specific database ID is provided, we use it
  // Note: Standard firebase-admin might need additional setup for named databases
  // but usually it defaults to (default).
}

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
    const { uid, email, name, phone, type } = req.body;
    
    if (!uid || !email || !type) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const amount = type === 'monthly' ? 990 : 8900; // in cents
    const billName = `RouteKing ${type === 'monthly' ? 'Monthly' : 'Yearly'} Subscription`;
    const billDescription = `Subscription for user ${uid}`;

    try {
      const formData = new URLSearchParams();
      formData.append('userSecretKey', TOYYIBPAY_SECRET || '');
      formData.append('categoryCode', TOYYIBPAY_CATEGORY || '');
      formData.append('billName', billName);
      formData.append('billDescription', billDescription);
      formData.append('billPriceSetting', '1');
      formData.append('billPayorInfo', '1');
      formData.append('billAmount', amount.toString());
      formData.append('billReturnUrl', `${APP_URL}/api/payment/return`);
      formData.append('billCallbackUrl', `${APP_URL}/api/payment/callback`);
      formData.append('billExternalReferenceNo', `${uid}_${type}_${Date.now()}`);
      formData.append('billTo', name || 'Rider');
      formData.append('billEmail', email);
      formData.append('billPhone', phone || '0123456789');

      const response = await axios.post(`${TOYYIBPAY_BASE_URL}/createBill`, formData);
      
      if (response.data && response.data[0] && response.data[0].BillCode) {
        const billCode = response.data[0].BillCode;
        const paymentUrl = `${process.env.TOYYIBPAY_SANDBOX === 'true' ? 'https://dev.toyyibpay.com' : 'https://toyyibpay.com'}/${billCode}`;
        res.json({ paymentUrl });
      } else {
        console.error("ToyyibPay Error Response:", JSON.stringify(response.data));
        // ToyyibPay error message is usually in the first element's 'msg' field or just the response itself
        let errorMsg = "Failed to create bill";
        if (Array.isArray(response.data) && response.data[0] && response.data[0].msg) {
          errorMsg = response.data[0].msg;
        } else if (typeof response.data === 'string') {
          errorMsg = response.data;
        }
        
        res.status(500).json({ error: errorMsg, details: response.data });
      }
    } catch (error) {
      console.error("Payment Creation Error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // 2. Callback (Webhook)
  app.post("/api/payment/callback", async (req, res) => {
    const { refno, status, reason, billcode, order_id } = req.body;
    
    console.log("ToyyibPay Callback Received:", { refno, status, reason, billcode });

    // ToyyibPay status: 1 = Success, 2 = Pending, 3 = Failed
    if (status === '1' && refno) {
      const parts = refno.split('_');
      const uid = parts[0];
      const type = parts[1]; // 'monthly' or 'yearly'
      
      const now = Date.now();
      let expiryDate = now;

      if (type === 'yearly') {
        // 1 year + 1 day buffer
        expiryDate = now + (366 * 24 * 60 * 60 * 1000);
      } else {
        // 30 days + 1 day buffer
        expiryDate = now + (31 * 24 * 60 * 60 * 1000);
      }

      try {
        // Update Firestore
        await db.collection('profiles').doc(uid).set({
          isPro: true,
          expiryDate: expiryDate,
          lastPaymentDate: now,
          lastBillCode: billcode,
          subscriptionType: type,
          updatedAt: now
        }, { merge: true });
        
        console.log(`Successfully updated subscription for user ${uid} (${type})`);
      } catch (error) {
        console.error("Firestore Update Error in Callback:", error);
      }
    }

    res.send("OK");
  });

  // 3. Return URL
  app.get("/api/payment/return", (req, res) => {
    const { status, billcode } = req.query;
    if (status === '1') {
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
