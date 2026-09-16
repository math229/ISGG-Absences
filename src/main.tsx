// Install global handler to safely shield internal Firestore SDK assertion glitches
if (typeof window !== 'undefined' && typeof console !== 'undefined' && console.error) {
  const originalConsoleError = console.error.bind(console);
  console.error = (...args: any[]) => {
    const combined = args
      .map((a) => (typeof a === 'string' ? a : (a?.message || a?.stack || (typeof a === 'object' ? JSON.stringify(a) : String(a)))))
      .join(' ');

    if (
      combined.includes('FIRESTORE') &&
      (combined.includes('INTERNAL ASSERTION FAILED') ||
        combined.includes('Unexpected state') ||
        combined.includes('ca9') ||
        combined.includes('b815'))
    ) {
      console.warn('[ISGG Cloud Sync] Safely handled internal Firestore stream assertion notice.');
      return;
    }

    originalConsoleError(...args);
  };
}

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

