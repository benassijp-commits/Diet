export default function Modal({ title, children, onClose }) {
  return (
    <div className="meal-modal modal-open">
      <div className="meal-modal-content">
        <header>
          <div>
            <p className="eyebrow">Editor</p>
            <h3>{title}</h3>
          </div>
          <button className="secondary-button icon-button" type="button" onClick={onClose}>x</button>
        </header>
        {children}
      </div>
    </div>
  );
}
