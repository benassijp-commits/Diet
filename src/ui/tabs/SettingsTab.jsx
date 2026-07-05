import { useState } from "react";
import { Database, Sparkles } from "lucide-react";
import { clearAiSettings, loadAiSettings, saveAiSettings } from "../../ai-settings.js";

export default function SettingsTab({ state, dispatch, notify }) {
  const [settings, setSettings] = useState(loadAiSettings());
  return (
    <section className="tab-panel active">
      <div className="settings-layout">
        <section className="stock-editor">
          <h4><Sparkles size={16} /> Inteligencia artificial</h4>
          <div className="stock-editor-grid compact">
            <label>Provedor<select value={settings.provider} onChange={(event) => setSettings({ ...settings, provider: event.target.value })}><option value="nanogpt">NanoGPT</option><option value="custom">OpenAI-compatible</option></select></label>
            <label>Base URL<input value={settings.baseUrl} onChange={(event) => setSettings({ ...settings, baseUrl: event.target.value })} /></label>
            <label>Modelo<input value={settings.model} onChange={(event) => setSettings({ ...settings, model: event.target.value })} /></label>
            <label>Chave<input type="password" value={settings.apiKey || ""} onChange={(event) => setSettings({ ...settings, apiKey: event.target.value })} /></label>
            <button type="button" onClick={() => { const saved = saveAiSettings(settings); dispatch({ type: "replace", state: { ...state, appSettings: { ...state.appSettings, aiSettings: saved } } }); notify("IA salva."); }}>Salvar IA</button>
            <button className="secondary-button" type="button" onClick={() => { clearAiSettings(); setSettings(loadAiSettings()); notify("Chave removida."); }}>Limpar chave</button>
          </div>
        </section>
        <section className="stock-editor">
          <h4><Database size={16} /> Dietas</h4>
          <div className="alert-list">{state.dietVersions.map((version) => <div className="alert-item" key={version.id}><strong>{version.name}</strong><span>{version.status} - inicio {version.activatedAt}</span></div>)}</div>
        </section>
      </div>
    </section>
  );
}
