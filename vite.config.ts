import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import dotenv from 'dotenv';
import fs from 'fs';

export default defineConfig(({mode}) => {
  // Force load from .env file directly to bypass any harness overrides
  if (fs.existsSync('.env')) {
    const envConfig = dotenv.parse(fs.readFileSync('.env'));
    for (const k in envConfig) {
      process.env[k] = envConfig[k];
    }
  }

  const env = loadEnv(mode, process.cwd(), '');
  
  console.log("VITE CONFIG DEBUG:");
  console.log("process.env.GEMINI_API_KEY:", process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.substring(0, 5) + "..." : "undefined");
  console.log("env.GEMINI_API_KEY:", env.GEMINI_API_KEY ? env.GEMINI_API_KEY.substring(0, 5) + "..." : "undefined");

  // 1. Get from process.env (AI Studio Secrets)
  // 2. Fallback to env (from .env files)
  let apiKey = process.env.CUSTOM_GEMINI_KEY || env.CUSTOM_GEMINI_KEY || process.env.GEMINI_API_KEY || env.GEMINI_API_KEY || "";
  let googleMapsKey = process.env.GOOGLE_MAPS_API_KEY || env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || env.VITE_GOOGLE_MAPS_API_KEY || "";
  
  console.log("apiKey before strip:", apiKey ? apiKey.substring(0, 5) + "..." : "empty");
  
  // Strip out the placeholder
  if (apiKey === "MY_GEMINI_API_KEY" || apiKey === "undefined") {
    apiKey = "";
  }

  if (googleMapsKey === "undefined") {
    googleMapsKey = "";
  }

  // Force expose to Vite's import.meta.env as a backup
  process.env.VITE_GEMINI_API_KEY = apiKey;
  process.env.VITE_GOOGLE_MAPS_API_KEY = googleMapsKey;

  return {
    plugins: [react(), tailwindcss()],
    define: {
      '__GEMINI_API_KEY__': JSON.stringify(apiKey),
      'process.env.GEMINI_API_KEY': JSON.stringify(apiKey),
      'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(apiKey),
      '__GOOGLE_MAPS_API_KEY__': JSON.stringify(googleMapsKey),
      'import.meta.env.VITE_GOOGLE_MAPS_API_KEY': JSON.stringify(googleMapsKey),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
