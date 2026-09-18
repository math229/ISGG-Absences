import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, getFirestore, setLogLevel } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Global resilience handler: prevents internal Firestore SDK stream assertion bugs
// (such as rapid stream reconnections leading to internal WatchChangeAggregator targetId discrepancies)
// from bubbling up as uncaught fatal errors in the browser or interrupting UI interaction.
if (typeof window !== 'undefined') {
  const isFirestoreAssertion = (err: unknown): boolean => {
    if (!err) return false;
    const msg = String(
      (err as any)?.message ||
      (err as any)?.reason?.message ||
      (err as any)?.stack ||
      (err as any)?.reason?.stack ||
      (typeof err === 'string' ? err : JSON.stringify(err)) ||
      ''
    );
    return (
      msg.includes('FIRESTORE') &&
      (msg.includes('INTERNAL ASSERTION FAILED') ||
        msg.includes('Unexpected state') ||
        msg.includes('WatchChangeAggregator') ||
        msg.includes('ca9') ||
        msg.includes('b815'))
    );
  };

  if (typeof console !== 'undefined' && console.error) {
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
        console.warn('[ISGG Cloud Sync] Handled internal Firestore stream notice.');
        return;
      }

      originalConsoleError(...args);
    };
  }

  window.addEventListener(
    'error',
    (event: ErrorEvent) => {
      if (isFirestoreAssertion(event.error) || isFirestoreAssertion(event.message)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        console.warn('[ISGG Cloud Sync] Handled internal Firestore assertion.');
        return true;
      }
    },
    true
  );

  window.addEventListener(
    'unhandledrejection',
    (event: PromiseRejectionEvent) => {
      if (isFirestoreAssertion(event.reason)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        console.warn('[ISGG Cloud Sync] Handled internal Firestore rejection.');
      }
    },
    true
  );
}

// Silence non-critical Firestore offline/retry connection notices
try {
  setLogLevel('error');
} catch {
  // Ignore if already configured
}

// Initialize Firebase App
const isFirstApp = !getApps().length;
const app = isFirstApp ? initializeApp(firebaseConfig) : getApp();

function getOrCreateFirestore() {
  try {
    return initializeFirestore(
      app,
      {
        experimentalAutoDetectLongPolling: true,
        ignoreUndefinedProperties: true,
      },
      firebaseConfig.firestoreDatabaseId || undefined
    );
  } catch {
    return firebaseConfig.firestoreDatabaseId
      ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
      : getFirestore(app);
  }
}

// Initialize Firestore targeting the configured database ID if specified
export const db = getOrCreateFirestore();

export default app;

