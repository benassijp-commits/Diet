import { useState } from "react";
import { Bell, Database, Download, Globe2, Sparkles } from "lucide-react";
import { clearAiSettings, loadAiSettings, saveAiSettings } from "../../ai-settings.js";
import { SUPPORTED_LANGUAGES } from "../../i18n/index.js";
import { enablePushNotifications, getPushEnvironmentStatus, pushStatusMessage } from "../../services/push-notifications.js";
import InstallAppButton from "../shared/InstallAppButton.jsx";

export default function SettingsTab({ state, dispatch, notify, t, language }) {
  const [settings, setSettings] = useState(() => {
    const local = loadAiSettings();
    const saved = state.appSettings?.aiSettings || {};
    return { ...local, ...saved, apiKey: local.apiKey || saved.apiKey || "" };
  });
  const [notificationStatus, setNotificationStatus] = useState(() => pushStatusMessage(getPushEnvironmentStatus(), t));
  const [isEnablingNotifications, setIsEnablingNotifications] = useState(false);
  const [showAdvancedAi, setShowAdvancedAi] = useState(false);
  const publicSettings = ({ apiKey, ...rest }) => rest;

  const handleEnableNotifications = async () => {
    setIsEnablingNotifications(true);
    try {
      const result = await enablePushNotifications();
      const message = pushStatusMessage(result, t);
      setNotificationStatus(message);
      dispatch({ type: "settings/notifications-enabled", value: result.ok && result.code === "enabled" });
      notify(message);
    } catch (error) {
      console.error(error);
      setNotificationStatus(t("notifications.error"));
      notify(t("notifications.error"));
    } finally {
      setIsEnablingNotifications(false);
    }
  };

  return (
    <section className="tab-panel active">
      <div className="settings-layout">
        <section className="stock-editor">
          <h4><Globe2 size={16} /> {t("settings.interface")}</h4>
          <div className="stock-editor-grid compact">
            <label>
              {t("settings.language")}
              <select value={language} onChange={(event) => dispatch({ type: "settings/language", language: event.target.value })}>
                {SUPPORTED_LANGUAGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
          </div>
        </section>

        <section className="stock-editor">
          <h4><Bell size={16} /> {t("notifications.title")}</h4>
          <div className="stock-editor-grid compact">
            <p className="settings-help">{notificationStatus}</p>
            <button type="button" onClick={handleEnableNotifications} disabled={isEnablingNotifications}>
              {isEnablingNotifications ? t("notifications.enabling") : t("notifications.enable")}
            </button>
            <label className="toggle-control">
              <input
                type="checkbox"
                checked={Boolean(state.appSettings?.notificationTypes?.mealReminders)}
                onChange={(event) => dispatch({ type: "settings/notification-type", notificationType: "mealReminders", value: event.target.checked })}
              />
              {t("notifications.mealReminders")}
            </label>
            <p className="settings-help">{t("notifications.localMealReminderHelp")}</p>
          </div>
        </section>

        <section className="stock-editor">
          <h4><Download size={16} /> {t("install.title")}</h4>
          <InstallAppButton t={t} />
        </section>

        <section className="stock-editor">
          <h4><Sparkles size={16} /> {t("settings.ai")}</h4>
          <p className="settings-help">{t("settings.aiProxyReady")}</p>
          <p className="settings-help">{t("settings.aiProxyModel", { model: "deepseek/deepseek-latest" })}</p>
          <p className="settings-help">{t("settings.aiProxySetup")}</p>
          <button className="secondary-button" type="button" onClick={() => setShowAdvancedAi(!showAdvancedAi)}>{showAdvancedAi ? t("settings.hideAdvancedAi") : t("settings.showAdvancedAi")}</button>
          {showAdvancedAi && (
            <div className="stock-editor-grid compact">
              <label>{t("settings.provider")}<select value={settings.provider} onChange={(event) => setSettings({ ...settings, mode: "local", provider: event.target.value })}><option value="nanogpt">NanoGPT</option><option value="custom">OpenAI-compatible</option></select></label>
              <label>Base URL<input value={settings.baseUrl || "https://nano-gpt.com/api/v1"} onChange={(event) => setSettings({ ...settings, mode: "local", baseUrl: event.target.value })} /></label>
              <label>{t("settings.model")}<input value={settings.model || "deepseek/deepseek-latest"} onChange={(event) => setSettings({ ...settings, mode: "local", model: event.target.value })} /></label>
              <label>{t("settings.key")}<input type="password" value={settings.apiKey || ""} onChange={(event) => setSettings({ ...settings, mode: "local", apiKey: event.target.value })} /></label>
              <button type="button" onClick={() => { const saved = saveAiSettings({ ...settings, mode: "local" }); dispatch({ type: "replace", state: { ...state, appSettings: { ...state.appSettings, aiSettings: publicSettings(saved) } } }); notify(t("settings.aiSaved")); }}>{t("settings.saveAi")}</button>
              <button className="secondary-button" type="button" onClick={() => { clearAiSettings(); setSettings(loadAiSettings()); notify(t("settings.keyRemoved")); }}>{t("settings.useDefaultAi")}</button>
            </div>
          )}
        </section>

        <section className="stock-editor">
          <h4><Database size={16} /> {t("settings.diets")}</h4>
          <div className="alert-list">{state.dietVersions.map((version) => <div className="alert-item" key={version.id}><strong>{version.name}</strong><span>{version.status === "active" ? t("common.active") : t("common.archived")} - {t("settings.started")} {version.activatedAt}</span></div>)}</div>
        </section>
      </div>
    </section>
  );
}
