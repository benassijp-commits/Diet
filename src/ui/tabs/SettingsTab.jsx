import { useEffect, useState } from "react";
import { Bell, Database, Download, Globe2, Sparkles } from "lucide-react";
import { clearAiSettings, loadAiSettings, saveAiSettings } from "../../ai-settings.js";
import { SUPPORTED_LANGUAGES } from "../../i18n/index.js";
import {
  enablePushNotifications,
  getCurrentPushDiagnostics,
  getPushEnvironmentStatus,
  pushStatusMessage,
  recreateCurrentDeviceToken,
} from "../../services/push-notifications.js";
import {
  getRegisteredNotificationTokenCount,
  scheduleDeviceTestNotification,
  getScheduledNotificationDiagnostics,
  scheduleTestNotification,
} from "../../services/scheduled-notifications.js";
import InstallAppButton from "../shared/InstallAppButton.jsx";

export default function SettingsTab({ state, dispatch, auth, notify, t, language }) {
  const [settings, setSettings] = useState(() => {
    const local = loadAiSettings();
    const saved = state.appSettings?.aiSettings || {};
    return { ...local, ...saved, apiKey: local.apiKey || saved.apiKey || "" };
  });
  const [notificationStatus, setNotificationStatus] = useState(() => pushStatusMessage(getPushEnvironmentStatus(), t));
  const [isEnablingNotifications, setIsEnablingNotifications] = useState(false);
  const [registeredTokenCount, setRegisteredTokenCount] = useState(null);
  const [notificationDiagnostics, setNotificationDiagnostics] = useState(null);
  const [pushDiagnostics, setPushDiagnostics] = useState(null);
  const [isLoadingDiagnostics, setIsLoadingDiagnostics] = useState(false);
  const [isSchedulingTest, setIsSchedulingTest] = useState(false);
  const [isRecreatingToken, setIsRecreatingToken] = useState(false);
  const [isSendingDeviceTest, setIsSendingDeviceTest] = useState(false);
  const [showAdvancedAi, setShowAdvancedAi] = useState(false);
  const publicSettings = ({ apiKey, ...rest }) => rest;

  const refreshNotificationDiagnostics = async () => {
    setIsLoadingDiagnostics(true);
    try {
      const diagnostics = await getScheduledNotificationDiagnostics();
      const push = await getCurrentPushDiagnostics();
      setNotificationDiagnostics(diagnostics);
      setPushDiagnostics(push);
      setRegisteredTokenCount(diagnostics.tokenCount);
    } catch (error) {
      console.warn("Notification diagnostics failed:", error);
      setNotificationDiagnostics(null);
      setRegisteredTokenCount(await getRegisteredNotificationTokenCount().catch(() => 0));
    } finally {
      setIsLoadingDiagnostics(false);
    }
  };

  useEffect(() => {
    let active = true;
    getScheduledNotificationDiagnostics()
      .then(async (diagnostics) => {
        if (!active) return;
        setNotificationDiagnostics(diagnostics);
        setRegisteredTokenCount(diagnostics.tokenCount);
        setPushDiagnostics(await getCurrentPushDiagnostics());
      })
      .catch(() => {
        if (active) setRegisteredTokenCount(0);
      });
    return () => {
      active = false;
    };
  }, [auth?.user?.uid, state.appSettings?.notificationsEnabled]);

  const handleEnableNotifications = async () => {
    setIsEnablingNotifications(true);
    try {
      const result = await enablePushNotifications();
      const message = pushStatusMessage(result, t);
      setNotificationStatus(message);
      dispatch({ type: "settings/notifications-enabled", value: result.ok && result.code === "enabled" });
      setRegisteredTokenCount(result.token ? 1 : await getRegisteredNotificationTokenCount().catch(() => 0));
      refreshNotificationDiagnostics();
      notify(message);
    } catch (error) {
      console.error(error);
      setNotificationStatus(t("notifications.error"));
      notify(t("notifications.error"));
    } finally {
      setIsEnablingNotifications(false);
    }
  };

  const handleScheduleTestNotification = async () => {
    setIsSchedulingTest(true);
    try {
      await scheduleTestNotification({ t });
      await refreshNotificationDiagnostics();
      notify(t("notifications.testScheduled"));
    } catch (error) {
      console.error(error);
      notify(t("notifications.testScheduleError"));
    } finally {
      setIsSchedulingTest(false);
    }
  };

  const handleRecreateCurrentToken = async () => {
    setIsRecreatingToken(true);
    try {
      const result = await recreateCurrentDeviceToken();
      setPushDiagnostics(result.diagnostics);
      await refreshNotificationDiagnostics();
      notify(pushStatusMessage(result, t));
    } catch (error) {
      console.error(error);
      notify(t("notifications.recreateTokenError"));
    } finally {
      setIsRecreatingToken(false);
    }
  };

  const handleSendDeviceTest = async () => {
    setIsSendingDeviceTest(true);
    try {
      const diagnostics = pushDiagnostics?.token ? pushDiagnostics : await getCurrentPushDiagnostics();
      if (!diagnostics?.token) throw new Error("Token FCM ausente.");
      await scheduleDeviceTestNotification({ token: diagnostics.token, tokenId: diagnostics.tokenId, t });
      await refreshNotificationDiagnostics();
      notify(t("notifications.deviceTestScheduled"));
    } catch (error) {
      console.error(error);
      notify(t("notifications.deviceTestError"));
    } finally {
      setIsSendingDeviceTest(false);
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
                checked={Boolean(state.appSettings?.notificationsEnabled)}
                onChange={(event) => dispatch({ type: "settings/notifications-enabled", value: event.target.checked })}
              />
              {t("notifications.enabledToggle")}
            </label>
            <label className="toggle-control">
              <input
                type="checkbox"
                checked={Boolean(state.appSettings?.notificationTypes?.mealReminders)}
                onChange={(event) => dispatch({ type: "settings/notification-type", notificationType: "mealReminders", value: event.target.checked })}
              />
              {t("notifications.mealReminders")}
            </label>
            <label className="toggle-control">
              <input
                type="checkbox"
                checked={Boolean(state.appSettings?.notificationTypes?.workoutRestReminders)}
                onChange={(event) => dispatch({ type: "settings/notification-type", notificationType: "workoutRestReminders", value: event.target.checked })}
              />
              {t("notifications.workoutRestReminders")}
            </label>
            <p className="settings-help">
              {registeredTokenCount === 0 ? t("notifications.noRegisteredToken") : t("notifications.registeredTokenStatus", { count: registeredTokenCount ?? "-" })}
            </p>
            <div className="alert-list">
              <PushDiagnosticRow diagnostics={pushDiagnostics} t={t} />
            </div>
            <div className="alert-list">
              <NotificationDiagnosticRow label={t("notifications.nextMealDiagnostic")} item={notificationDiagnostics?.mealReminder} t={t} />
              <NotificationDiagnosticRow label={t("notifications.nextWorkoutDiagnostic")} item={notificationDiagnostics?.workoutRest} t={t} />
              <NotificationDiagnosticRow label={t("notifications.nextTestDiagnostic")} item={notificationDiagnostics?.testReminder} t={t} />
            </div>
            <button className="secondary-button" type="button" onClick={refreshNotificationDiagnostics} disabled={isLoadingDiagnostics}>
              {isLoadingDiagnostics ? t("notifications.refreshingDiagnostics") : t("notifications.refreshDiagnostics")}
            </button>
            <button className="secondary-button" type="button" onClick={handleScheduleTestNotification} disabled={isSchedulingTest || !auth?.user}>
              {isSchedulingTest ? t("notifications.schedulingTest") : t("notifications.scheduleTest")}
            </button>
            <button className="secondary-button" type="button" onClick={handleRecreateCurrentToken} disabled={isRecreatingToken || !auth?.user}>
              {isRecreatingToken ? t("notifications.recreatingToken") : t("notifications.recreateToken")}
            </button>
            <button className="secondary-button" type="button" onClick={handleSendDeviceTest} disabled={isSendingDeviceTest || !auth?.user || !pushDiagnostics?.token}>
              {isSendingDeviceTest ? t("notifications.schedulingTest") : t("notifications.sendDeviceTest")}
            </button>
            <p className="settings-help">{t("notifications.backendReminderHelp")}</p>
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

function PushDiagnosticRow({ diagnostics, t }) {
  const serviceWorker = diagnostics?.serviceWorker;
  return (
    <div className="alert-item">
      <strong>{t("notifications.pushDiagnostics")}</strong>
      <span>{t("notifications.permissionDiagnostic")}: {diagnostics?.permission || "-"}</span>
      <span>{t("notifications.currentToken")}: {diagnostics?.tokenPreview || "-"}</span>
      <span>{t("notifications.fcmServiceWorker")}: {serviceWorker ? `${serviceWorker.state || "-"} | ${serviceWorker.scope || "-"} | ${serviceWorker.scriptURL || "-"}` : "-"}</span>
      <span>{t("notifications.deviceInfo")}: {diagnostics?.platform || "-"} | {diagnostics?.userAgent || "-"}</span>
    </div>
  );
}

function NotificationDiagnosticRow({ label, item, t }) {
  return (
    <div className="alert-item">
      <strong>{label}</strong>
      <span>{item ? `${t("notifications.diagnosticStatus")}: ${item.status || "-"} | ${t("notifications.diagnosticDueAt")}: ${formatDiagnosticDate(item.dueAt)}` : t("notifications.noScheduledNotification")}</span>
      {item?.sentAt && <span>{t("notifications.diagnosticSentAt")}: {formatDiagnosticDate(item.sentAt)}</span>}
      {item?.cancelledAt && <span>{t("notifications.diagnosticCancelledAt")}: {formatDiagnosticDate(item.cancelledAt)}</span>}
    </div>
  );
}

function formatDiagnosticDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}
