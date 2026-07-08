import { useEffect, useMemo, useState } from "react";

function isStandaloneMode() {
  return window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
}

function isIosDevice() {
  const platform = window.navigator.platform || "";
  const userAgent = window.navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(userAgent) || (platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
}

function isAndroidDevice() {
  return /Android/i.test(window.navigator.userAgent || "");
}

function summarizeUserAgent() {
  return (window.navigator.userAgent || "")
    .replace(/\s+/g, " ")
    .slice(0, 120);
}

function isSecureAppContext() {
  return window.isSecureContext !== false;
}

function getInitialDiagnostics({ standalone, hasDeferredPrompt }) {
  return {
    protocol: window.location.protocol.replace(":", "") || "unknown",
    isSecureContext: Boolean(window.isSecureContext),
    serviceWorkerAvailable: "serviceWorker" in navigator,
    serviceWorkerReady: false,
    manifestLinkFound: Boolean(document.querySelector("link[rel='manifest']")),
    displayMode: standalone ? "standalone" : "browser",
    userAgent: summarizeUserAgent(),
    hasDeferredPrompt,
  };
}

async function readInstallDiagnostics({ standalone, hasDeferredPrompt }) {
  const serviceWorkerAvailable = "serviceWorker" in navigator;
  const registration = serviceWorkerAvailable
    ? await navigator.serviceWorker.getRegistration().catch(() => null)
    : null;

  return {
    protocol: window.location.protocol.replace(":", "") || "unknown",
    isSecureContext: Boolean(window.isSecureContext),
    serviceWorkerAvailable,
    serviceWorkerReady: Boolean(navigator.serviceWorker?.controller || registration?.active),
    manifestLinkFound: Boolean(document.querySelector("link[rel='manifest']")),
    displayMode: standalone ? "standalone" : "browser",
    userAgent: summarizeUserAgent(),
    hasDeferredPrompt,
  };
}

async function detectBraveBrowser() {
  if (navigator.brave?.isBrave) {
    return navigator.brave.isBrave().catch(() => false);
  }
  return /Brave|Brave\//i.test(window.navigator.userAgent || "");
}

export default function InstallAppButton({ t }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [standalone, setStandalone] = useState(() => isStandaloneMode());
  const [showAndroidHelp, setShowAndroidHelp] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isBrave, setIsBrave] = useState(false);
  const [diagnostics, setDiagnostics] = useState(() => getInitialDiagnostics({
    standalone: isStandaloneMode(),
    hasDeferredPrompt: false,
  }));
  const device = useMemo(() => ({
    android: isAndroidDevice(),
    ios: isIosDevice(),
  }), []);
  const secureContext = useMemo(() => isSecureAppContext(), []);

  useEffect(() => {
    const installPromptHandler = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
      setDismissed(false);
    };
    const appInstalledHandler = () => {
      setStandalone(true);
      setDeferredPrompt(null);
    };
    const displayMode = window.matchMedia?.("(display-mode: standalone)");
    const displayModeHandler = (event) => setStandalone(event.matches || isStandaloneMode());

    window.addEventListener("beforeinstallprompt", installPromptHandler);
    window.addEventListener("appinstalled", appInstalledHandler);
    displayMode?.addEventListener?.("change", displayModeHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", installPromptHandler);
      window.removeEventListener("appinstalled", appInstalledHandler);
      displayMode?.removeEventListener?.("change", displayModeHandler);
    };
  }, []);

  useEffect(() => {
    let active = true;
    readInstallDiagnostics({ standalone, hasDeferredPrompt: Boolean(deferredPrompt) })
      .then((nextDiagnostics) => {
        if (active) setDiagnostics(nextDiagnostics);
      });
    return () => {
      active = false;
    };
  }, [deferredPrompt, standalone]);

  useEffect(() => {
    let active = true;
    detectBraveBrowser().then((result) => {
      if (active) setIsBrave(result);
    });
    return () => {
      active = false;
    };
  }, []);

  if (standalone || dismissed) return null;

  const installWithPrompt = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (choice.outcome === "accepted") setStandalone(true);
  };

  const openAndroidInstall = () => {
    if (deferredPrompt) {
      installWithPrompt();
      return;
    }
    setShowAndroidHelp(true);
  };

  const renderDiagnostics = () => (
    <div className="install-diagnostics" aria-live="polite">
      {device.android && isBrave && !deferredPrompt && (
        <p className="install-brave-note">{t("install.braveAndroidManual")}</p>
      )}
      <dl>
        <div>
          <dt>{t("install.diagnosticSecureContext")}</dt>
          <dd>{diagnostics.protocol.toUpperCase()} / {diagnostics.isSecureContext ? "isSecureContext=true" : "isSecureContext=false"}</dd>
        </div>
        <div>
          <dt>{t("install.diagnosticServiceWorkerAvailable")}</dt>
          <dd>{diagnostics.serviceWorkerAvailable ? "true" : "false"}</dd>
        </div>
        <div>
          <dt>{t("install.diagnosticServiceWorkerReady")}</dt>
          <dd>{diagnostics.serviceWorkerReady ? "true" : "false"}</dd>
        </div>
        <div>
          <dt>{t("install.diagnosticManifest")}</dt>
          <dd>{diagnostics.manifestLinkFound ? "true" : "false"}</dd>
        </div>
        <div>
          <dt>{t("install.diagnosticDisplayMode")}</dt>
          <dd>{diagnostics.displayMode}</dd>
        </div>
        <div>
          <dt>{t("install.diagnosticUserAgent")}</dt>
          <dd>{diagnostics.userAgent || "unknown"}</dd>
        </div>
        <div>
          <dt>{t("install.diagnosticDeferredPrompt")}</dt>
          <dd>{diagnostics.hasDeferredPrompt ? "true" : "false"}</dd>
        </div>
      </dl>
    </div>
  );

  const renderInstallHelpModal = ({ title, steps, onClose }) => (
    <div className="meal-modal modal-open">
      <div className="meal-modal-content install-help-modal">
        <header>
          <div>
            <p className="eyebrow">PWA</p>
            <h3>{title}</h3>
          </div>
          <button className="secondary-button icon-button" type="button" onClick={onClose}>x</button>
        </header>
        <ol className="install-help-list">
          {steps.map((step) => <li key={step}>{step}</li>)}
        </ol>
        <footer>
          <button className="secondary-button" type="button" onClick={() => setDismissed(true)}>{t("install.hide")}</button>
          <button type="button" onClick={onClose}>{t("common.cancel")}</button>
        </footer>
      </div>
    </div>
  );

  if (device.ios) {
    return (
      <div className="install-app-card">
        <button type="button" onClick={() => setShowIosHelp(true)}>{t("install.iosButton")}</button>
        {!deferredPrompt && renderDiagnostics()}
        {showIosHelp && renderInstallHelpModal({
          title: t("install.iosTitle"),
          steps: [
            t("install.iosStepSafari"),
            t("install.iosStepShare"),
            t("install.iosStepAdd"),
            t("install.iosStepOpen"),
          ],
          onClose: () => setShowIosHelp(false),
        })}
      </div>
    );
  }

  if (device.android) {
    const androidSteps = secureContext
      ? [
        t("install.androidFallbackNote"),
        t("install.androidStepBrowser"),
        t("install.androidStepMenu"),
        t("install.androidStepInstall"),
        t("install.androidStepOpen"),
      ]
      : [
        t("install.androidFallbackNote"),
        t("install.installRequiresHttps"),
        t("install.localIpHttpNotSupported"),
        t("install.androidStepMenu"),
        t("install.androidStepInstall"),
      ];

    return (
      <div className="install-app-card">
        <button type="button" onClick={openAndroidInstall}>{t("install.androidButton")}</button>
        {!deferredPrompt && <p className="settings-help">{t("install.promptUnavailable")}</p>}
        {!deferredPrompt && renderDiagnostics()}
        {showAndroidHelp && renderInstallHelpModal({
          title: t("install.androidTitle"),
          steps: androidSteps,
          onClose: () => setShowAndroidHelp(false),
        })}
      </div>
    );
  }

  if (deferredPrompt) {
    return (
      <div className="install-app-card">
        <button type="button" onClick={installWithPrompt}>{t("install.button")}</button>
      </div>
    );
  }

  return (
    <div className="install-app-card">
      <p className="settings-help">{t("install.promptUnavailable")}</p>
      {renderDiagnostics()}
    </div>
  );
}
