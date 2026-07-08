const listeners = new Set();

const installPromptState = {
  deferredPrompt: null,
  capturedAt: null,
  installed: false,
  lastOutcome: "",
};

function emitChange() {
  listeners.forEach((listener) => listener(getInstallPromptSnapshot()));
}

function setDeferredPrompt(event) {
  installPromptState.deferredPrompt = event;
  installPromptState.capturedAt = new Date().toISOString();
  installPromptState.installed = false;
  installPromptState.lastOutcome = "";
  window.__pwaDeferredPrompt = event;
  emitChange();
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    setDeferredPrompt(event);
  });

  window.addEventListener("appinstalled", () => {
    installPromptState.deferredPrompt = null;
    installPromptState.installed = true;
    installPromptState.lastOutcome = "installed";
    window.__pwaDeferredPrompt = null;
    emitChange();
  });
}

export function getInstallPromptSnapshot() {
  return {
    deferredPrompt: installPromptState.deferredPrompt,
    capturedAt: installPromptState.capturedAt,
    hasDeferredPrompt: Boolean(installPromptState.deferredPrompt),
    installed: installPromptState.installed,
    lastOutcome: installPromptState.lastOutcome,
  };
}

export function subscribeInstallPrompt(listener) {
  listeners.add(listener);
  listener(getInstallPromptSnapshot());
  return () => listeners.delete(listener);
}

export async function promptInstallApp() {
  const promptEvent = installPromptState.deferredPrompt;
  if (!promptEvent) return null;

  promptEvent.prompt();
  const choice = await promptEvent.userChoice.catch(() => null);
  installPromptState.deferredPrompt = null;
  installPromptState.lastOutcome = choice?.outcome || "dismissed";
  window.__pwaDeferredPrompt = null;
  emitChange();
  return choice;
}
