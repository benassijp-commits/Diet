export default function Topbar({ title, language, t }) {
  const locale = language === "en" ? "en-US" : "pt-BR";
  return (
    <section className="topbar">
      <div>
        <p className="eyebrow">{t("app.eyebrow")}</p>
        <h2>{title}</h2>
      </div>
      <div className="date-chip">
        {new Intl.DateTimeFormat(locale, { weekday: "short", day: "2-digit", month: "short" }).format(new Date())}
      </div>
    </section>
  );
}
