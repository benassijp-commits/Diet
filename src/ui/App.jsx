import { useEffect, useState } from "react";
import { useAppStore } from "../hooks/useAppStore.js";
import { tabs } from "../state/app-state.js";
import { createTranslator, normalizeLanguage } from "../i18n/index.js";
import { listenForForegroundMessages } from "../services/push-notifications.js";
import Sidebar from "./layout/Sidebar.jsx";
import Topbar from "./layout/Topbar.jsx";
import MealsTab from "./meals/MealsTab.jsx";
import WorkoutsTab from "./workouts/WorkoutsTab.jsx";
import LogTab from "./tabs/LogTab.jsx";
import SettingsTab from "./tabs/SettingsTab.jsx";
import ShoppingTab from "./tabs/ShoppingTab.jsx";
import StockTab from "./tabs/StockTab.jsx";

export default function App() {
  const { state, dispatch, auth } = useAppStore();
  const [activeTab, setActiveTab] = useState("meals");
  const [toast, setToast] = useState("");
  const language = normalizeLanguage(state.appSettings?.language);
  const t = createTranslator(language);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((error) => console.warn("Service worker registration failed", error));
  }, []);

  useEffect(() => {
    let unsubscribe = null;
    listenForForegroundMessages((message) => notify(message)).then((stopListening) => {
      unsubscribe = stopListening;
    }).catch((error) => console.warn("FCM foreground listener unavailable", error));

    return () => unsubscribe?.();
  }, []);

  const notify = (message) => {
    setToast(message);
    window.clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => setToast(""), 2400);
  };

  useEffect(() => {
    const reminder = state.mealReminder;
    const nextMealReminderAt = reminder?.nextMealReminderAt;
    if (!state.appSettings?.notificationsEnabled || !state.appSettings?.notificationTypes?.mealReminders) return;
    if (!nextMealReminderAt || reminder?.lastMealReminderNotifiedAt) return;

    const targetTime = new Date(nextMealReminderAt).getTime();
    if (Number.isNaN(targetTime)) return;

    const delay = Math.max(0, targetTime - Date.now());
    const timer = window.setTimeout(() => {
      const title = t("notifications.mealReminderTitle");
      const message = t("notifications.mealReminderBody");
      let shownNotification = false;

      if ("Notification" in window && Notification.permission === "granted") {
        try {
          new Notification(title, { body: message, tag: "meal-reminder" });
          shownNotification = true;
        } catch (error) {
          console.warn("Local meal reminder notification failed", error);
        }
      }

      notify(shownNotification ? `${title}: ${message}` : message);
      dispatch({ type: "meal-reminder/notified", nextMealReminderAt, notifiedAt: new Date().toISOString() });
    }, Math.min(delay, 2147483647));

    return () => window.clearTimeout(timer);
  }, [
    dispatch,
    state.appSettings?.notificationTypes?.mealReminders,
    state.appSettings?.notificationsEnabled,
    state.mealReminder?.lastMealReminderNotifiedAt,
    state.mealReminder?.nextMealReminderAt,
    t,
  ]);

  const currentTab = tabs.find((tab) => tab.id === activeTab) || tabs[0];
  const currentTitle = t(`tabs.${currentTab.id}`);

  return (
    <div className="app-shell">
      <Sidebar state={state} auth={auth} activeTab={activeTab} onTabChange={setActiveTab} dispatch={dispatch} notify={notify} t={t} />
      <main className="main-content">
        <Topbar title={currentTitle} language={language} t={t} />
        {activeTab === "meals" && <MealsTab state={state} dispatch={dispatch} notify={notify} t={t} language={language} />}
        {activeTab === "workouts" && <WorkoutsTab state={state} dispatch={dispatch} notify={notify} t={t} language={language} />}
        {activeTab === "shopping" && <ShoppingTab state={state} dispatch={dispatch} t={t} language={language} />}
        {activeTab === "stock" && <StockTab state={state} dispatch={dispatch} notify={notify} t={t} language={language} />}
        {activeTab === "log" && <LogTab state={state} dispatch={dispatch} t={t} language={language} />}
        {activeTab === "settings" && <SettingsTab state={state} dispatch={dispatch} auth={auth} notify={notify} t={t} language={language} />}
      </main>
      <div className={`toast ${toast ? "show" : ""}`} role="status" aria-live="polite">{toast}</div>
    </div>
  );
}
