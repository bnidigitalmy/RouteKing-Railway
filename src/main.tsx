import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

// Register service worker for PWA
registerSW({
  onNeedRefresh() {
    // We will let the user refresh manually or handle via a dedicated UI if needed later
    // For now, removing the confirm loop to prevent the 8-10x refresh issue
    console.log('Versi baru tersedia.');
  },
  onOfflineReady() {
    console.log('Aplikasi sedia untuk kegunaan offline');
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
