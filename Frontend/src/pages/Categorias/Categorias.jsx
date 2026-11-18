import { useEffect, useState } from "react";
import PageTitle from "../../components/common/PageTitle";
import { apiRequest } from "../../services/api";
import "./Categorias.css";

const formularioInicial = {
  nombre: "",
  descripcion: ""
};

export default function Categorias() {
  const [categorias, setCategorias] = useState([]);
  const [categoriaEditando, setCategoriaEditando] = useState(null);
  const [formulario, setFormulario] = useState(formularioInicial);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [eliminandoId, setEliminandoId] = useState(null);
  const [error, setError] = useState("");

  async function cargarCategorias() {
    try {
      const datos = await apiRequest("/categorias");
      if (!Array.isArray(datos)) {
        throw new Error("El servidor devolvió una lista de categorías inválida.");
      }
      setCategorias(datos);
    } catch (error) {
      setError(error.message || "Error al conectar con el servidor.");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(cargarCategorias);
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;
    setFormulario((prev) => ({ ...prev, [name]: value }));
  }

  function abrirFormulario(categoria = null) {
    setCategoriaEditando(categoria);
    setFormulario(categoria ? {
      nombre: categoria.nombre,
      descripcion: categoria.descripcion || ""
    } : formularioInicial);
    setError("");
  }

  function limpiarFormulario() {
    setCategoriaEditando(null);
    setFormulario(formularioInicial);
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setGuardando(true);

    try {
      await apiRequest(
        categoriaEditando ? `/categorias/${categoriaEditando.id}` : "/categorias",
        {
          method: categoriaEditando ? "PUT" : "POST",
          body: JSON.stringify({
            nombre: formulario.nombre.trim(),
            descripcion: formulario.descripcion.trim()
          })
        }
      );

      limpiarFormulario();
      await cargarCategorias();
    } catch (error) {
      setError(error.message || "Error al guardar la categoría.");
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarCategoria(categoria) {
    if (!window.confirm(`¿Eliminar la categoría "${categoria.nombre}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    setEliminandoId(categoria.id);
    setError("");

    try {
      await apiRequest(`/categorias/${categoria.id}`, { method: "DELETE" });
      await cargarCategorias();
    } catch (error) {
      setError(error.message || "Error al eliminar la categoría.");
    } finally {
      setEliminandoId(null);
    }
  }

  return (
    <div className="categorias-page">
      <PageTitle title="Categorías" description="Organiza los productos de la farmacia." />

      <div className="categorias-layout">
        <section className="categorias-panel categorias-form-panel">
          <div className="categorias-panel-header">
            <h2>{categoriaEditando ? "Editar categoría" : "Agregar categoría"}</h2>
            {categoriaEditando && (
              <button
                type="button"
                className="btn-nueva-categoria"
                onClick={limpiarFormulario}
                disabled={guardando}
              >
                Nueva
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="categorias-formulario">
            {error && (
              <p className="categorias-error" role="alert">
                {error}
              </p>
            )}

            <div className="campo-categoria">
              <label htmlFor="nombre-categoria">Nombre</label>
              <input
                id="nombre-categoria"
                name="nombre"
                type="text"
                value={formulario.nombre}
                onChange={handleChange}
                maxLength={100}
                required
              />
            </div>

            <div className="campo-categoria">
              <label htmlFor="descripcion-categoria">Descripción</label>
              <textarea
                id="descripcion-categoria"
                name="descripcion"
                value={formulario.descripcion}
                onChange={handleChange}
                rows={5}
                placeholder="Descripción opcional de la categoría"
              />
            </div>

            <div className="categorias-formulario-acciones">
              {categoriaEditando && (
                <button
                  type="button"
                  className="btn-cancelar-categoria"
                  onClick={limpiarFormulario}
                  disabled={guardando}
                >
                  Cancelar
                </button>
              )}
              <button
                type="submit"
                className="btn-guardar-categoria"
                disabled={guardando}
              >
                {guardando
                  ? "Guardando..."
                  : categoriaEditando
                    ? "Guardar cambios"
                    : "Agregar categoría"}
              </button>
            </div>
          </form>
        </section>

        <section className="categorias-panel categorias-lista-panel">
          <div className="categorias-panel-header">
            <h2>Categorías registradas</h2>
            <span className="categorias-total">{categorias.length}</span>
          </div>

          {error && !categorias.length && !cargando && (
            <p className="categorias-error" role="alert">{error}</p>
          )}

          <div className="categorias-tabla-contenedor">
            {cargando ? (
              <p className="categorias-mensaje">Cargando categorías...</p>
            ) : categorias.length === 0 ? (
              <p className="categorias-mensaje">No hay categorías registradas.</p>
            ) : (
              <table className="categorias-tabla">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Descripción</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {categorias.map((categoria) => (
                    <tr key={categoria.id}>
                      <td>{categoria.nombre}</td>
                      <td>{categoria.descripcion || "—"}</td>
                      <td>
                        <div className="categorias-acciones-fila">
                          <button
                            type="button"
                            className="btn-editar-categoria"
                            onClick={() => abrirFormulario(categoria)}
                            disabled={guardando || eliminandoId !== null}
                            title="Editar categoría"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="btn-eliminar-categoria"
                            onClick={() => eliminarCategoria(categoria)}
                            disabled={guardando || eliminandoId !== null}
                            title="Eliminar categoría"
                          >
                            {eliminandoId === categoria.id ? "Eliminando..." : "Eliminar"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
