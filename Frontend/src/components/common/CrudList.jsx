import "./Crud.css";

export default function CrudList({
  title,
  count,
  loading,
  loadingMessage,
  emptyMessage,
  toolbar,
  children
}) {
  return (
    <section className="crud-panel">
      <div className="crud-panel-header">
        <h2>{title}</h2>
        <span className="crud-total">{count}</span>
      </div>

      {toolbar}

      <div className="crud-table-container">
        {loading ? (
          <p className="crud-message">{loadingMessage}</p>
        ) : count === 0 ? (
          <p className="crud-message">{emptyMessage}</p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
