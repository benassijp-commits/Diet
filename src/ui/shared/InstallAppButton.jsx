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

function isSecureAppContext() {
  return window.isSecureContext !== false;
}

export default function InstallAppButton({ t }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [standalone, setStandalone] = useState(() => isStandaloneMode());
  const [showAndroidHelp, setShowAndroidHelp] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [dismissed, setDismissed] = useState(false);
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
    logInstallDiagnostics({ standalone, hasDeferredPrompt: Boolean(deferredPrompt) });
    setShowAndroidHelp(true);
  };

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

  return null;
}

async function logInstallDiagnostics({ standalone, hasDeferredPrompt }) {
  const manifestHref = document.querySelector("link[rel='manifest']")?.href || "/manifest.webmanifest";
  const serviceWorkerRegistered = "serviceWorker" in navigator
    ? Boolean(await navigator.serviceWorker.getRegistration().catch(() => null))
    : false;
  const manifestAccessible = await fetch(manifestHref, { method: "HEAD" })
    .then((response) => response.ok)
    .catch(() => false);

  console.info("PWA manual install fallback", {
    hasInstallPrompt: hasDeferredPrompt,
    displayMode: standalone ? "standalone" : "browser",
    isSecureContext: window.isSecureContext,
    userAgent: window.navigator.userAgent || "",
    serviceWorkerRegistered,
    manifestAccessible,
  });
}
