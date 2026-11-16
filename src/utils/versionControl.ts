/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const APP_VERSION: string =
  typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '57.5.0';

export const APP_BUILD_ID: string =
  typeof __APP_BUILD_ID__ !== 'undefined' ? __APP_BUILD_ID__ : 'dev';

const RELOAD_STORAGE_KEY = 'prodexus_reloaded_build_id';
const VERSION_CHECK_INTERVAL_MS = 3 * 60 * 1000;

interface RemoteVersionPayload {
  version?: string;
  buildId?: string;
}

let isReloadScheduled = false;
let initialized = false;
let swRegistration: ServiceWorkerRegistration | null = null;

async function purgeBrowserCaches(): Promise<void> {
  try {
    if ('caches' in window) {
      const keys = await window.caches.keys();
      await Promise.all(keys.map((key) => window.caches.delete(key)));
    }
  } catch {
    // Ignore storage access errors in restricted contexts
  }

  try {
    if (swRegistration?.active) {
      swRegistration.active.postMessage({ type: 'PURGE_CACHES' });
    }
  } catch {
    // Ignore postMessage failures
  }
}

function showUpdatingBanner(): void {
  if (typeof document === 'undefined' || document.getElementById('prodexus-update-banner')) {
    return;
  }
  const banner = document.createElement('div');
  banner.id = 'prodexus-update-banner';
  banner.style.cssText =
    'position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:99999;background:#0f172a;color:#ffffff;padding:10px 16px;border-radius:10px;font-family:Plus Jakarta Sans,system-ui,sans-serif;font-size:12px;font-weight:600;box-shadow:0 10px 25px rgba(15,23,42,0.25);border:1px solid #334155;';
  banner.textContent = 'Nueva versión detectada. Actualizando recursos de Prodexus CMMS...';
  document.body?.appendChild(banner);
}

async function applyVersionReload(targetBuildId: string): Promise<void> {
  if (isReloadScheduled) return;

  try {
    const alreadyReloaded = window.sessionStorage.getItem(RELOAD_STORAGE_KEY);
    if (alreadyReloaded === targetBuildId) return;
    window.sessionStorage.setItem(RELOAD_STORAGE_KEY, targetBuildId);
  } catch {
    // Continue even if sessionStorage is unavailable
  }

  isReloadScheduled = true;
  showUpdatingBanner();
  await purgeBrowserCaches();

  if (swRegistration?.waiting) {
    try {
      swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
    } catch {
      // Ignore
    }
  }

  window.setTimeout(() => {
    try {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set('_pv', targetBuildId);
      window.location.replace(nextUrl.toString());
    } catch {
      window.location.reload();
    }
  }, 350);
}

export async function checkForNewVersion(): Promise<void> {
  if (typeof window === 'undefined' || isReloadScheduled) return;

  try {
    if (swRegistration) {
      void swRegistration.update().catch(() => {});
    }

    const versionUrl = new URL('./version.json', window.location.href);
    versionUrl.searchParams.set('_ts', String(Date.now()));

    const res = await fetch(versionUrl.toString(), {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache'
      }
    });

    if (!res.ok) return;
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return;

    const payload = (await res.json()) as RemoteVersionPayload;
    const remoteBuildId = typeof payload?.buildId === 'string' ? payload.buildId.trim() : '';

    if (!remoteBuildId || remoteBuildId === '__PRODEXUS_BUILD_ID__') return;

    if (APP_BUILD_ID && APP_BUILD_ID !== 'dev' && remoteBuildId !== APP_BUILD_ID) {
      await applyVersionReload(remoteBuildId);
    }
  } catch {
    // Silent when offline or blocked by transient network issues
  }
}

export function initVersionControl(): void {
  if (typeof window === 'undefined' || initialized) return;
  initialized = true;

  // Strip temporary cache-bust query param after reload so URL stays clean
  try {
    const currentUrl = new URL(window.location.href);
    if (currentUrl.searchParams.has('_pv')) {
      currentUrl.searchParams.delete('_pv');
      window.history.replaceState(null, '', currentUrl.toString());
    }
  } catch {
    // Ignore URL cleanup issues
  }

  if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
    const swUrl = new URL('./sw.js', window.location.href).toString();
    let initialController = navigator.serviceWorker.controller;

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!initialController) {
        initialController = navigator.serviceWorker.controller;
        return;
      }
      void applyVersionReload(`sw-${Date.now()}`);
    });

    navigator.serviceWorker
      .register(swUrl, { updateViaCache: 'none' })
      .then((reg) => {
        swRegistration = reg;

        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        reg.addEventListener('updatefound', () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              installing.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      })
      .catch(() => {
        // Service worker may be disallowed in certain sandboxed iframes; JSON version check still works
      });
  }

  void checkForNewVersion();

  window.addEventListener('focus', () => {
    void checkForNewVersion();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void checkForNewVersion();
    }
  });

  window.setInterval(() => {
    void checkForNewVersion();
  }, VERSION_CHECK_INTERVAL_MS);
}
