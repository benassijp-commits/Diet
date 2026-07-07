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

export default function InstallAppButton({ t }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [standalone, setStandalone] = useState(() => isStandaloneMode());
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const device = useMemo(() => ({
    android: isAndroidDevice(),
    ios: isIosDevice(),
  }), []);

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

  if (deferredPrompt) {
    return (
      <div className="install-app-card">
        <button type="button" onClick={installWithPrompt}>{t("install.button")}</button>
      </div>
    );
  }

  if (device.ios) {
    return (
      <div className="install-app-card">
        <button type="button" onClick={() => setShowIosHelp(true)}>{t("install.iosButton")}</button>
        {showIosHelp && (
          <div className="meal-modal modal-open">
            <div className="meal-modal-content install-help-modal">
              <header>
                <div>
                  <p className="eyebrow">PWA</p>
                  <h3>{t("install.iosTitle")}</h3>
                </div>
                <button className="secondary-button icon-button" type="button" onClick={() => setShowIosHelp(false)}>x</button>
              </header>
              <ol className="install-help-list">
                <li>{t("install.iosStepSafari")}</li>
                <li>{t("install.iosStepShare")}</li>
                <li>{t("install.iosStepAdd")}</li>
                <li>{t("install.iosStepOpen")}</li>
              </ol>
              <footer>
                <button className="secondary-button" type="button" onClick={() => setDismissed(true)}>{t("install.hide")}</button>
                <button type="button" onClick={() => setShowIosHelp(false)}>{t("common.cancel")}</button>
              </footer>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (device.android) {
    return <p className="settings-help">{t("install.androidManual")}</p>;
  }

  return null;
}
