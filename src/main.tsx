import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initializeSyncService } from './services/syncService';

// On startup, detect and unregister older service workers that may be
// intercepting requests with incorrect cached paths (this helps GitHub Pages
// users who previously had an old sw.js registered). We only reload once
// after unregistering to avoid infinite reload loops.
async function cleanupOldServiceWorkers() {
  if (!('serviceWorker' in navigator)) return false;
  try {
    const expectedSwUrl = `${(import.meta as any).env?.BASE_URL || '/'}sw.js`;
    const regs = await navigator.serviceWorker.getRegistrations();
    let foundOld = false;
    for (const reg of regs) {
      const scriptUrl = (reg as any).active?.scriptURL || (reg as any).scriptURL || '';
      if (scriptUrl && scriptUrl.includes('sw.js') && !scriptUrl.endsWith(expectedSwUrl)) {
        // Found an old service worker installed at a different scope/path
        foundOld = true;
        try {
          await reg.unregister();
          // eslint-disable-next-line no-console
          console.log('Unregistered old service worker:', scriptUrl);
        } catch (e) {
          // ignore
        }
      }
    }
    return foundOld;
  } catch (e) {
    return false;
  }
}

(async () => {
  const hadOld = await cleanupOldServiceWorkers();
  if (hadOld && !localStorage.getItem('sw-unregistered')) {
    // Mark so we only reload once automatically
    localStorage.setItem('sw-unregistered', '1');
    // Reload so the page loads without the old service worker intercepting
    window.location.reload();
    return;
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );

  // initialize background sync
  try {
    initializeSyncService();
  } catch (e) {
    // ignore
  }
})();
