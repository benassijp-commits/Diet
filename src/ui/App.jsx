import { useEffect, useState } from "react";
import { useAppStore } from "../hooks/useAppStore.js";
import { tabs } from "../state/app-state.js";
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

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((error) => console.warn("Service worker registration failed", error));
  }, []);

  const notify = (message) => {
    setToast(message);
    window.clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => setToast(""), 2400);
  };

  const currentTab = tabs.find((tab) => tab.id === activeTab) || tabs[0];

  return (
    <div className="app-shell">
      <Sidebar state={state} auth={auth} activeTab={activeTab} onTabChange={setActiveTab} dispatch={dispatch} notify={notify} />
      <main className="main-content">
        <Topbar title={currentTab.title} />
        {activeTab === "meals" && <MealsTab state={state} dispatch={dispatch} notify={notify} />}
        {activeTab === "workouts" && <WorkoutsTab state={state} dispatch={dispatch} notify={notify} />}
        {activeTab === "shopping" && <ShoppingTab state={state} dispatch={dispatch} />}
        {activeTab === "stock" && <StockTab state={state} dispatch={dispatch} notify={notify} />}
        {activeTab === "log" && <LogTab state={state} dispatch={dispatch} />}
        {activeTab === "settings" && <SettingsTab state={state} dispatch={dispatch} auth={auth} notify={notify} />}
      </main>
      <div className={`toast ${toast ? "show" : ""}`} role="status" aria-live="polite">{toast}</div>
    </div>
  );
}
