import "./Crud.css";

export function CrudField({ id, label, children }) {
  return (
    <div className="crud-field">
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}

export function CrudInput({ id, label, ...props }) {
  return (
    <CrudField id={id} label={label}>
      <input id={id} {...props} />
    </CrudField>
  );
}

export function CrudSelect({ id, label, children, ...props }) {
  return (
    <CrudField id={id} label={label}>
      <select id={id} {...props}>{children}</select>
    </CrudField>
  );
}

export function CrudTextarea({ id, label, children, ...props }) {
  return (
    <CrudField id={id} label={label}>
      <textarea id={id} {...props}>{children}</textarea>
    </CrudField>
  );
}

export default function CrudForm({
  title,
  editing = false,
  onSubmit,
  onReset,
  saving = false,
  submitLabel,
  savingLabel = "Guardando...",
  submitDisabled = false,
  newLabel = "Nuevo",
  children
}) {
  return (
    <section className="crud-panel crud-form-panel">
      <div className="crud-panel-header">
        <h2>{title}</h2>
        {editing && (
          <button
            type="button"
            className="crud-new-button"
            onClick={onReset}
            disabled={saving}
          >
            {newLabel}
          </button>
        )}
      </div>

      <form className="crud-form" onSubmit={onSubmit}>
        {children}
        <div className="crud-form-actions">
          {editing && (
            <button
              type="button"
              className="crud-cancel-button"
              onClick={onReset}
              disabled={saving}
            >
              Cancelar
            </button>
          )}
          <button
            type="submit"
            className="crud-submit-button"
            disabled={saving || submitDisabled}
          >
            {saving ? savingLabel : submitLabel}
          </button>
        </div>
      </form>
    </section>
  );
}
