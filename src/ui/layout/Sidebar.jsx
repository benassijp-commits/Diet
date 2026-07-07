import { Activity, Bell, ChefHat, Dumbbell, History, Package, Settings, ShoppingCart, Sun } from "lucide-react";
import { currentDayLog, getShoppingRows, tabs } from "../../state/app-state.js";
import { formatQty, todayKey } from "../../utils.js";

const tabIcons = {
  meals: ChefHat,
  workouts: Dumbbell,
  shopping: ShoppingCart,
  stock: Package,
  log: History,
  settings: Settings,
};

export default function Sidebar({ state, auth, activeTab, onTabChange, dispatch, notify, t }) {
  const water = formatQty(currentDayLog(state).water);
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark"><Activity /></div>
        <div className="brand-text">
          <h1>{t("app.brandTitle")}</h1>
          <p>{t("app.brandSubtitle")}</p>
        </div>
        <div className="header-status">
          <div className="status-chip"><span className="status-dot" /><span>{t("app.weight")}: 84,1 kg</span></div>
          <div className="status-chip">{t("app.water")}: {water} L / 3.8 L</div>
          <button className="theme-toggle" type="button" onClick={() => dispatch({ type: "theme/toggle" })}>
            <Sun size={16} /><span>{state.theme === "light" ? t("app.dark") : t("app.light")}</span>
          </button>
          <button className="theme-toggle alerts-toggle" type="button"><Bell size={16} /><span>{globalAlerts(state).length}</span></button>
        </div>
      </div>

      <section className="data-panel">
        <h2>{t("app.memory")}</h2>
        <p>{auth.syncStatus}</p>
        <div className="account-card">
          <div>
            <strong>{auth.user?.displayName || t("app.noLogin")}</strong>
            <span>{auth.user?.email || t("app.firestoreOff")}</span>
          </div>
        </div>
        <div className="data-actions">
          {auth.user ? (
            <button type="button" onClick={() => auth.signOut().then(() => notify(t("app.signOutSuccess")))}>{t("app.signOut")}</button>
          ) : (
            <button type="button" onClick={() => auth.signIn().catch(() => notify(t("app.signInError")))}>{t("app.signInGoogle")}</button>
          )}
        </div>
        <div className="data-actions">
          <button type="button" onClick={() => exportState(state)}>{t("app.export")}</button>
          <label className="import-button">
            {t("app.import")}
            <input type="file" accept="application/json" onChange={(event) => importStateFile(event, dispatch, notify, t)} />
          </label>
        </div>
      </section>

      <nav className="nav-tabs" aria-label={t("app.mainTabs")}>
        {tabs.map((tab) => {
          const Icon = tabIcons[tab.id];
          return (
            <button key={tab.id} className={`nav-tab ${activeTab === tab.id ? "active" : ""}`} type="button" onClick={() => onTabChange(tab.id)}>
              <Icon size={18} /> {t(`tabs.${tab.id}`)}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

function exportState(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `plano-alimentar-joao-${todayKey()}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function importStateFile(event, dispatch, notify, t) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    dispatch({ type: "replace", state: JSON.parse(await file.text()) });
    notify(t("app.importSuccess"));
  } catch {
    notify(t("app.importInvalid"));
  } finally {
    event.target.value = "";
  }
}

function globalAlerts(state) {
  return getShoppingRows(state).filter((row) => row.toBuy > 0).slice(0, 8);
}
