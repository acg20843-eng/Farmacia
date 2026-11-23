import { useState } from "react";
import "./Crud.css";

export default function CrudTable({ className, columns, rows }) {
  const [paginacion, setPaginacion] = useState({ ids: "", pagina: 1 });
  const ids = rows.map((row) => row.id).join(",");
  const pagina = paginacion.ids === ids ? paginacion.pagina : 1;
  const filasPorPagina = 10;
  const totalPaginas = Math.ceil(rows.length / filasPorPagina);
  const inicio = (pagina - 1) * filasPorPagina;
  const filasVisibles = rows.slice(inicio, inicio + filasPorPagina);

  return (
    <>
      <table className={className}>
        <thead>
          <tr>{columns.map(({ label }) => <th key={label}>{label}</th>)}</tr>
        </thead>
        <tbody>
          {filasVisibles.map((row) => (
            <tr key={row.id}>
              {columns.map(({ label, render }) => (
                <td key={label}>{render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {totalPaginas > 1 && (
        <nav className="crud-pagination" aria-label="Paginación de la tabla">
          <span>
            Mostrando {inicio + 1}-{Math.min(inicio + filasPorPagina, rows.length)} de {rows.length}
          </span>
          <div className="crud-pagination-controls">
            <button
              type="button"
              onClick={() => setPaginacion({ ids, pagina: pagina - 1 })}
              disabled={pagina === 1}
            >
              Anterior
            </button>
            <span>Página {pagina} de {totalPaginas}</span>
            <button
              type="button"
              onClick={() => setPaginacion({ ids, pagina: pagina + 1 })}
              disabled={pagina === totalPaginas}
            >
              Siguiente
            </button>
          </div>
        </nav>
      )}
    </>
  );
}
