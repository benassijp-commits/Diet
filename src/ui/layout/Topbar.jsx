export default function Topbar({ title }) {
  return (
    <section className="topbar">
      <div>
        <p className="eyebrow">Controle diario</p>
        <h2>{title}</h2>
      </div>
      <div className="date-chip">
        {new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short" }).format(new Date())}
      </div>
    </section>
  );
}
