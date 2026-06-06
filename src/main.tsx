import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

const root = createRoot(document.getElementById('root')!);

// Public customer pin-location page — kept on its own light bundle (no Firebase,
// no full app) so recipients on slow connections load it instantly.
if (window.location.pathname.startsWith('/pin/')) {
  const token = decodeURIComponent(window.location.pathname.slice('/pin/'.length));
  import('./components/PinLocation').then(({ PinLocation }) => {
    root.render(
      <StrictMode>
        <ErrorBoundary>
          <PinLocation token={token} />
        </ErrorBoundary>
      </StrictMode>,
    );
  });
} else {
  // Register service worker for PWA (main app only)
  registerSW({
    onNeedRefresh() {
      // Let the user refresh manually to avoid the previous refresh-loop issue.
      console.log('Versi baru tersedia.');
    },
    onOfflineReady() {
      console.log('Aplikasi sedia untuk kegunaan offline');
    },
  });

  import('./App').then(({ default: App }) => {
    root.render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>,
    );
  });
}
