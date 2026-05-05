import { registerSW } from 'virtual:pwa-register';

export interface WebUpdateState {
  available: boolean;
  offlineReady: boolean;
  supported: boolean;
  message: string;
}

type Listener = (state: WebUpdateState) => void;

const listeners = new Set<Listener>();
let initialized = false;
let updateSW: ((reloadPage?: boolean) => Promise<void>) | null = null;

let state: WebUpdateState = {
  available: false,
  offlineReady: false,
  supported: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
  message: 'READY',
};

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && !!(window as { __TAURI__?: unknown }).__TAURI__;
}

function setState(next: Partial<WebUpdateState>): void {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener(state));
}

export function initWebUpdater(): void {
  if (initialized || isTauriRuntime()) return;
  initialized = true;

  if (!state.supported) {
    setState({ message: 'SERVICE WORKER UNSUPPORTED' });
    return;
  }

  updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      setState({
        available: true,
        message: 'UPDATE READY',
      });
    },
    onOfflineReady() {
      setState({
        offlineReady: true,
        message: 'OFFLINE CACHE READY',
      });
    },
    onRegisterError(error) {
      console.warn('PWA update registration failed:', error);
      setState({
        message: error instanceof Error ? error.message : 'UPDATE REGISTRATION FAILED',
      });
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      window.setInterval(() => {
        registration.update().catch((error) => {
          console.warn('PWA update check failed:', error);
        });
      }, 60 * 60 * 1000);
    },
  });
}

export function subscribeWebUpdate(listener: Listener): () => void {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
}

export async function checkWebUpdate(): Promise<WebUpdateState> {
  initWebUpdater();

  if (!state.supported || isTauriRuntime()) return state;

  const registration = await navigator.serviceWorker.getRegistration();
  if (registration) {
    await registration.update();
  }

  return state;
}

export async function installWebUpdate(): Promise<void> {
  if (updateSW && state.available) {
    await updateSW(true);
    return;
  }

  window.location.reload();
}
