import { useEffect, useState } from "react";
import PageTitle from "../../components/common/PageTitle";
import Notification from "../../components/common/Notification";
import { apiRequest } from "../../services/api";
import "./Inventario.css";

const formularioInicial = {
  producto_id: "",
  numero_lote: "",
  cantidad: "0",
  precio_compra: "0.00",
  fecha_caducidad: ""
};

function fechaParaInput(valor) {
  if (valor instanceof Date) {
    const mes = String(valor.getMonth() + 1).padStart(2, "0");
    const dia = String(valor.getDate()).padStart(2, "0");
    return `${valor.getFullYear()}-${mes}-${dia}`;
  }

  return String(valor || "").slice(0, 10);
}

function mostrarFecha(valor) {
  const [anio, mes, dia] = fechaParaInput(valor).split("-");
  return anio && mes && dia ? `${dia}/${mes}/${anio}` : "—";
}

function codigoMedicamento(id) {
  return `MED-${String(id).padStart(3, "0")}`;
}

export default function Inventario() {
  const [lotes, setLotes] = useState([]);
  const [medicamentos, setMedicamentos] = useState([]);
  const [loteEditando, setLoteEditando] = useState(null);
  const [formulario, setFormulario] = useState(formularioInicial);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [eliminandoId, setEliminandoId] = useState(null);
  const [notificacion, setNotificacion] = useState(null);

  async function cargarDatos() {
    try {
      const [lotesDatos, medicamentosDatos] = await Promise.all([
        apiRequest("/lotes"),
        apiRequest("/productos")
      ]);

      if (!Array.isArray(lotesDatos) || !Array.isArray(medicamentosDatos)) {
        throw new Error("El servidor devolvió datos de lotes o medicamentos inválidos.");
      }

      setLotes(lotesDatos);
      setMedicamentos(medicamentosDatos);
    } catch (error) {
      setNotificacion({
        type: "error",
        message: error.message || "Error al cargar los lotes."
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

  function abrirFormulario(lote = null) {
    setLoteEditando(lote);
    setFormulario(lote ? {
      producto_id: String(lote.producto_id),
      numero_lote: lote.numero_lote,
      cantidad: String(lote.cantidad),
      precio_compra: String(lote.precio_compra),
      fecha_caducidad: fechaParaInput(lote.fecha_caducidad)
    } : formularioInicial);
  }

  function limpiarFormulario() {
    setLoteEditando(null);
    setFormulario(formularioInicial);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const editando = Boolean(loteEditando);
    const medicamento = medicamentos.find(
      (item) => Number(item.id) === Number(formulario.producto_id)
    );
    const descripcion = formulario.numero_lote.trim();
    const confirmacion = editando
      ? `¿Guardar los cambios del lote "${descripcion}"?`
      : `¿Registrar el lote "${descripcion}" para "${medicamento?.nombre || "el medicamento seleccionado"}"?`;

    if (!window.confirm(confirmacion)) {
      return;
    }

    setGuardando(true);

    try {
      await apiRequest(
        editando ? `/lotes/${loteEditando.id}` : "/lotes",
        {
          method: editando ? "PUT" : "POST",
          body: JSON.stringify({
            ...formulario,
            producto_id: Number(formulario.producto_id),
            cantidad: Number(formulario.cantidad),
            precio_compra: Number(formulario.precio_compra)
          })
        }
      );

      limpiarFormulario();
      await cargarDatos();
      setNotificacion({
        type: "success",
        message: editando ? "Lote actualizado" : "Lote registrado"
      });
    } catch (error) {
      setNotificacion({
        type: "error",
        message: error.message || "Error al guardar el lote."
      });
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarLote(lote) {
    if (!window.confirm(`¿Eliminar el lote "${lote.numero_lote}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    setEliminandoId(lote.id);

    try {
      await apiRequest(`/lotes/${lote.id}`, { method: "DELETE" });
      await cargarDatos();
      setNotificacion({ type: "success", message: "Lote eliminado" });
    } catch (error) {
      setNotificacion({
        type: "error",
        message: error.message || "Error al eliminar el lote."
      });
    } finally {
      setEliminandoId(null);
    }
  }

  const lotesFiltrados = lotes.filter((lote) => {
    const consulta = busqueda.trim().toLocaleLowerCase();
    return [
      lote.numero_lote,
      lote.medicamento_nombre,
      codigoMedicamento(lote.producto_id)
    ].some((valor) => valor?.toLocaleLowerCase().includes(consulta));
  });

  return (
    <div className="inventario-page">
      <Notification notification={notificacion} onClose={() => setNotificacion(null)} />
      <PageTitle title="Lotes" />

      <div className="inventario-layout">
        <section className="inventario-panel inventario-form-panel">
          <div className="inventario-panel-header">
            <h2>{loteEditando ? "Editar lote" : "Registrar lote"}</h2>
            {loteEditando && (
              <button
                type="button"
                className="btn-nuevo-lote"
                onClick={limpiarFormulario}
                disabled={guardando}
              >
                Nuevo
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="lotes-formulario">
            <div className="campo-lote">
              <label htmlFor="medicamento-lote">Medicamento</label>
              <select
                id="medicamento-lote"
                name="producto_id"
                value={formulario.producto_id}
                onChange={handleChange}
                required
              >
                <option value="">Selecciona un medicamento</option>
                {medicamentos.map((medicamento) => (
                  <option key={medicamento.id} value={medicamento.id}>
                    {codigoMedicamento(medicamento.id)} · {medicamento.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="campo-lote">
              <label htmlFor="numero-lote">Número de lote</label>
              <input
                id="numero-lote"
                name="numero_lote"
                value={formulario.numero_lote}
                onChange={handleChange}
                maxLength={100}
                required
              />
            </div>

            <div className="lotes-campos-fila">
              <div className="campo-lote">
                <label htmlFor="cantidad-lote">Cantidad</label>
                <input
                  id="cantidad-lote"
                  name="cantidad"
                  type="number"
                  min="0"
                  step="1"
                  value={formulario.cantidad}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="campo-lote">
                <label htmlFor="precio-compra">Precio de compra</label>
                <input
                  id="precio-compra"
                  name="precio_compra"
                  type="number"
                  min="0"
                  max="99999999.99"
                  step="0.01"
                  value={formulario.precio_compra}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="campo-lote">
              <label htmlFor="fecha-caducidad">Fecha de caducidad</label>
              <input
                id="fecha-caducidad"
                name="fecha_caducidad"
                type="date"
                value={formulario.fecha_caducidad}
                onChange={handleChange}
                required
              />
            </div>

            <div className="lotes-formulario-acciones">
              {loteEditando && (
                <button
                  type="button"
                  className="btn-cancelar-lote"
                  onClick={limpiarFormulario}
                  disabled={guardando}
                >
                  Cancelar
                </button>
              )}
              <button
                type="submit"
                className="btn-guardar-lote"
                disabled={guardando || cargando || medicamentos.length === 0}
              >
                {guardando
                  ? "Guardando..."
                  : loteEditando
                    ? "Guardar cambios"
                    : "Registrar lote"}
              </button>
            </div>
          </form>
        </section>

        <section className="inventario-panel">
          <div className="inventario-panel-header">
            <h2>Lotes registrados</h2>
            <span className="inventario-total">{lotesFiltrados.length}</span>
          </div>

          <div className="lotes-busqueda">
            <label htmlFor="buscar-lote">Buscar lote</label>
            <input
              id="buscar-lote"
              type="search"
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Número de lote, código o medicamento"
            />
          </div>

          <div className="lotes-tabla-contenedor">
            {cargando ? (
              <p className="lotes-mensaje">Cargando lotes...</p>
            ) : lotesFiltrados.length === 0 ? (
              <p className="lotes-mensaje">
                {busqueda ? "No se encontraron lotes." : "No hay lotes registrados."}
              </p>
            ) : (
              <table className="lotes-tabla">
                <thead>
                  <tr>
                    <th>Medicamento</th>
                    <th>Número de lote</th>
                    <th>Cantidad</th>
                    <th>Precio compra</th>
                    <th>Caducidad</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {lotesFiltrados.map((lote) => (
                    <tr key={lote.id}>
                      <td>
                        <strong>{codigoMedicamento(lote.producto_id)}</strong>
                        <small>{lote.medicamento_nombre}</small>
                      </td>
                      <td>{lote.numero_lote}</td>
                      <td>{lote.cantidad}</td>
                      <td>${Number(lote.precio_compra).toFixed(2)}</td>
                      <td>{mostrarFecha(lote.fecha_caducidad)}</td>
                      <td>
                        <div className="lotes-acciones-fila">
                          <button
                            type="button"
                            className="btn-editar-lote"
                            onClick={() => abrirFormulario(lote)}
                            disabled={guardando || eliminandoId !== null}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="btn-eliminar-lote"
                            onClick={() => eliminarLote(lote)}
                            disabled={guardando || eliminandoId !== null}
                          >
                            {eliminandoId === lote.id ? "Eliminando..." : "Eliminar"}
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
