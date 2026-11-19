import { useEffect, useState } from "react";
import PageTitle from "../../components/common/PageTitle";
import Notification from "../../components/common/Notification";
import { apiRequest } from "../../services/api";
import "./Productos.css";

const formularioInicial = {
  nombre: "",
  principio_activo: "",
  concentracion: "",
  presentacion: "",
  precio_venta: "0",
  stock_minimo: "5",
  categoria_id: "",
  estado: "ACTIVO"
};

export default function Productos() {
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [productoEditando, setProductoEditando] = useState(null);
  const [formulario, setFormulario] = useState(formularioInicial);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [eliminandoId, setEliminandoId] = useState(null);
  const [notificacion, setNotificacion] = useState(null);

  async function cargarDatos() {
    try {
      const [productosDatos, categoriasDatos] = await Promise.all([
        apiRequest("/productos"),
        apiRequest("/categorias")
      ]);
      if (!Array.isArray(productosDatos) || !Array.isArray(categoriasDatos)) {
        throw new Error("El servidor devolvió datos de medicamentos o categorías inválidos.");
      }
      setProductos(productosDatos);
      setCategorias(categoriasDatos);
    } catch (error) {
      setNotificacion({
        type: "error",
        message: error.message || "Error al conectar con el servidor."
      });
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(cargarDatos);
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;
    setFormulario((prev) => ({ ...prev, [name]: value }));
  }

  function abrirFormulario(producto = null) {
    setProductoEditando(producto);
    setFormulario(producto ? {
      nombre: producto.nombre,
      principio_activo: producto.principio_activo || "",
      concentracion: producto.concentracion || "",
      presentacion: producto.presentacion || "",
      precio_venta: String(producto.precio_venta),
      stock_minimo: String(producto.stock_minimo),
      categoria_id: String(producto.categoria_id),
      estado: producto.estado
    } : formularioInicial);
  }

  function limpiarFormulario() {
    setProductoEditando(null);
    setFormulario(formularioInicial);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const editando = Boolean(productoEditando);

    const confirmacion = editando
      ? `¿Guardar los cambios del medicamento "${productoEditando.nombre}"?`
      : `¿Agregar el medicamento "${formulario.nombre.trim()}"?`;
    if (!window.confirm(confirmacion)) {
      return;
    }

    setGuardando(true);

    try {
      const datos = {
        ...formulario,
        precio_venta: Number(formulario.precio_venta),
        stock_minimo: Number(formulario.stock_minimo),
        categoria_id: Number(formulario.categoria_id)
      };
      await apiRequest(
        productoEditando ? `/productos/${productoEditando.id}` : "/productos",
        {
          method: productoEditando ? "PUT" : "POST",
          body: JSON.stringify(datos)
        }
      );

      limpiarFormulario();
      await cargarDatos();
      setNotificacion({
        type: "success",
        message: editando
          ? "Medicamento actualizado"
          : "Medicamento agregado"
      });
    } catch (error) {
      setNotificacion({
        type: "error",
        message: error.message || "Error al guardar el medicamento."
      });
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarProducto(producto) {
    if (!window.confirm(`¿Eliminar el medicamento "${producto.nombre}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    setEliminandoId(producto.id);

    try {
      await apiRequest(`/productos/${producto.id}`, { method: "DELETE" });
      await cargarDatos();
      setNotificacion({
        type: "success",
        message: "Medicamento eliminado"
      });
    } catch (error) {
      setNotificacion({
        type: "error",
        message: error.message || "Error al eliminar el medicamento."
      });
    } finally {
      setEliminandoId(null);
    }
  }

  const productosFiltrados = productos.filter((producto) => {
    const consulta = busqueda.trim().toLocaleLowerCase();
    return [
      producto.nombre,
      producto.principio_activo,
      producto.categoria_nombre
    ].some((valor) => valor?.toLocaleLowerCase().includes(consulta));
  });

  return (
    <div className="productos-page">
      <Notification notification={notificacion} onClose={() => setNotificacion(null)} />
      <PageTitle title="Medicamentos" />

      <div className="productos-layout">
        <section className="productos-panel productos-form-panel">
          <div className="productos-panel-header">
            <h2>{productoEditando ? "Editar medicamento" : "Agregar medicamento"}</h2>
            {productoEditando && (
              <button
                type="button"
                className="btn-nuevo-producto"
                onClick={limpiarFormulario}
                disabled={guardando}
              >
                Nuevo
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="productos-formulario">
            <div className="campo-producto">
              <label htmlFor="nombre-producto">Nombre</label>
              <input
                id="nombre-producto"
                name="nombre"
                value={formulario.nombre}
                onChange={handleChange}
                placeholder="Ej. Marca"
                maxLength={150}
                required
              />
            </div>

            <div className="campo-producto">
              <label htmlFor="principio-activo">Principio activo</label>
              <input
                id="principio-activo"
                name="principio_activo"
                value={formulario.principio_activo}
                onChange={handleChange}
                placeholder="Ej. Paracetamol"
                maxLength={150}
              />
            </div>

            <div className="productos-campos-fila">
              <div className="campo-producto">
                <label htmlFor="concentracion-producto">Concentración</label>
                <input
                  id="concentracion-producto"
                  name="concentracion"
                  value={formulario.concentracion}
                  onChange={handleChange}
                  placeholder="Ej. 500 mg"
                  maxLength={100}
                />
              </div>
              <div className="campo-producto">
                <label htmlFor="presentacion-producto">Presentación</label>
                <input
                  id="presentacion-producto"
                  name="presentacion"
                  value={formulario.presentacion}
                  onChange={handleChange}
                  placeholder="Ej. Caja con 20 tabletas"
                  maxLength={100}
                />
              </div>
            </div>

            <div className="productos-campos-fila">
              <div className="campo-producto">
                <label htmlFor="precio-venta">Precio de venta</label>
                <input
                  id="precio-venta"
                  name="precio_venta"
                  type="number"
                  min="0"
                  max="99999999.99"
                  step="0.01"
                  value={formulario.precio_venta}
                  onChange={handleChange}
                  placeholder="Ej. 25.50"
                  required
                />
              </div>
              <div className="campo-producto">
                <label htmlFor="stock-minimo">Stock mínimo</label>
                <input
                  id="stock-minimo"
                  name="stock_minimo"
                  type="number"
                  min="0"
                  step="1"
                  value={formulario.stock_minimo}
                  onChange={handleChange}
                  placeholder="Ej. 10"
                  required
                />
              </div>
            </div>

            <div className="campo-producto">
              <label htmlFor="categoria-producto">Categoría</label>
              <select
                id="categoria-producto"
                name="categoria_id"
                value={formulario.categoria_id}
                onChange={handleChange}
                required
              >
                <option value="">Selecciona una categoría</option>
                {categorias.map((categoria) => (
                  <option key={categoria.id} value={categoria.id}>
                    {categoria.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="campo-producto">
              <label htmlFor="estado-producto">Estado</label>
              <select
                id="estado-producto"
                name="estado"
                value={formulario.estado}
                onChange={handleChange}
              >
                <option value="ACTIVO">Activo</option>
                <option value="INACTIVO">Inactivo</option>
              </select>
            </div>

            <div className="productos-formulario-acciones">
              {productoEditando && (
                <button
                  type="button"
                  className="btn-cancelar-producto"
                  onClick={limpiarFormulario}
                  disabled={guardando}
                >
                  Cancelar
                </button>
              )}
              <button
                type="submit"
                className="btn-guardar-producto"
                disabled={guardando || cargando || categorias.length === 0}
              >
                {guardando
                  ? "Guardando..."
                  : productoEditando
                    ? "Guardar cambios"
                    : "Agregar medicamento"}
              </button>
            </div>
          </form>
        </section>

        <section className="productos-panel">
          <div className="productos-panel-header">
            <h2>Medicamentos registrados</h2>
            <span className="productos-total">{productosFiltrados.length}</span>
          </div>

          <div className="productos-busqueda">
            <label htmlFor="buscar-producto">Buscar medicamento</label>
            <input
              id="buscar-producto"
              type="search"
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Nombre, principio activo o categoría"
            />
          </div>

          <div className="productos-tabla-contenedor">
            {cargando ? (
              <p className="productos-mensaje">Cargando medicamentos...</p>
            ) : productosFiltrados.length === 0 ? (
              <p className="productos-mensaje">
                {busqueda ? "No se encontraron medicamentos." : "No hay medicamentos registrados."}
              </p>
            ) : (
              <table className="productos-tabla">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Medicamento</th>
                    <th>Presentación</th>
                    <th>Precio</th>
                    <th>Stock mínimo</th>
                    <th>Categoría</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {productosFiltrados.map((producto) => (
                    <tr key={producto.id}>
                      <td>MED-{String(producto.id).padStart(3, "0")}</td>
                      <td>
                        <strong>{producto.nombre}</strong>
                        {producto.principio_activo && <small>{producto.principio_activo}</small>}
                      </td>
                      <td>
                        {[producto.concentracion, producto.presentacion].filter(Boolean).join(" · ") || "—"}
                      </td>
                      <td>${Number(producto.precio_venta).toFixed(2)}</td>
                      <td>{producto.stock_minimo}</td>
                      <td>{producto.categoria_nombre || "—"}</td>
                      <td>{producto.estado === "ACTIVO" ? "Activo" : "Inactivo"}</td>
                      <td>
                        <div className="productos-acciones-fila">
                          <button
                            type="button"
                            className="btn-editar-producto"
                            onClick={() => abrirFormulario(producto)}
                            disabled={guardando || eliminandoId !== null}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="btn-eliminar-producto"
                            onClick={() => eliminarProducto(producto)}
                            disabled={guardando || eliminandoId !== null}
                          >
                            {eliminandoId === producto.id ? "Eliminando..." : "Eliminar"}
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
