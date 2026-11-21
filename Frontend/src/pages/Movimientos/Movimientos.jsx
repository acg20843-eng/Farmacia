import { useEffect, useState } from "react";
import PageTitle from "../../components/common/PageTitle";
import Notification from "../../components/common/Notification";
import { apiRequest } from "../../services/api";
import "./Movimientos.css";

const formularioInicial = {
  lote_id: "",
  cantidad: "1",
  motivo: ""
};

function mostrarFecha(valor) {
  const fecha = valor instanceof Date
    ? `${valor.getFullYear()}-${String(valor.getMonth() + 1).padStart(2, "0")}-${String(valor.getDate()).padStart(2, "0")} ${String(valor.getHours()).padStart(2, "0")}:${String(valor.getMinutes()).padStart(2, "0")}`
    : String(valor || "");
  const partes = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha);
  if (!partes) {
    return "—";
  }
  const hora = fecha.slice(11, 16);
  return `${partes[3]}/${partes[2]}/${partes[1]}${hora ? ` ${hora}` : ""}`;
}

function codigoMedicamento(id) {
  return `MED-${String(id).padStart(3, "0")}`;
}

function fechaParaOrdenar(valor) {
  if (valor instanceof Date) {
    const mes = String(valor.getMonth() + 1).padStart(2, "0");
    const dia = String(valor.getDate()).padStart(2, "0");
    return `${valor.getFullYear()}-${mes}-${dia}`;
  }
  return String(valor || "").slice(0, 10);
}

export default function Movimientos() {
  const [lotes, setLotes] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [formulario, setFormulario] = useState(formularioInicial);
  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [notificacion, setNotificacion] = useState(null);

  async function cargarDatos() {
    setCargando(true);
    try {
      const [lotesDatos, movimientosDatos] = await Promise.all([
        apiRequest("/lotes"),
        apiRequest("/movimientos")
      ]);
      if (!Array.isArray(lotesDatos) || !Array.isArray(movimientosDatos)) {
        throw new Error("El servidor devolvió datos de inventario inválidos.");
      }
      setLotes(lotesDatos);
      setMovimientos(movimientosDatos);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(cargarDatos).catch((error) => {
      setNotificacion({
        type: "error",
        message: error.message || "Error al cargar los movimientos."
      });
    });
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;
    setFormulario((prev) => ({ ...prev, [name]: value }));
    if (name === "lote_id") {
      setNotificacion(null);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const lote = lotes.find((item) => Number(item.id) === Number(formulario.lote_id));
    if (!lote) {
      setNotificacion({ type: "error", message: "Selecciona un lote válido." });
      return;
    }

    if (Number(formulario.cantidad) > Number(lote.cantidad)) {
      setNotificacion({
        type: "error",
        message: `La cantidad supera las existencias del lote (${lote.cantidad}).`
      });
      return;
    }

    if (!window.confirm(`¿Registrar la salida de ${formulario.cantidad} unidades del lote "${lote.numero_lote}"?`)) {
      return;
    }

    setGuardando(true);
    let movimientoRegistrado = false;

    try {
      await apiRequest("/movimientos", {
        method: "POST",
        body: JSON.stringify({
          ...formulario,
          tipo: "SALIDA",
          lote_id: Number(formulario.lote_id),
          cantidad: Number(formulario.cantidad)
        })
      });
      movimientoRegistrado = true;
      setFormulario(formularioInicial);
      await cargarDatos();
      setNotificacion({
        type: "success",
        message: "Salida registrada"
      });
    } catch (error) {
      setNotificacion({
        type: "error",
        message: movimientoRegistrado
          ? `Movimiento registrado, pero no se pudo actualizar la lista: ${error.message}`
          : error.message || "Error al registrar el movimiento."
      });
    } finally {
      setGuardando(false);
    }
  }

  const lotesParaSeleccionar = lotes
    .filter((lote) => Number(lote.cantidad) > 0)
    .sort((a, b) => (
      fechaParaOrdenar(a.fecha_caducidad).localeCompare(fechaParaOrdenar(b.fecha_caducidad)) ||
      String(a.numero_lote).localeCompare(String(b.numero_lote), undefined, { numeric: true })
    ));
  const consulta = busqueda.trim().toLocaleLowerCase();
  const movimientosFiltrados = movimientos.filter((movimiento) => (
    (!filtroTipo || movimiento.tipo === filtroTipo) &&
    [
      movimiento.medicamento_nombre,
      movimiento.numero_lote,
      movimiento.usuario_nombre,
      movimiento.motivo
    ].some((valor) => valor?.toLocaleLowerCase().includes(consulta))
  ));

  return (
    <div className="movimientos-page">
      <Notification notification={notificacion} onClose={() => setNotificacion(null)} />
      <PageTitle title="Movimientos" />

      <div className="movimientos-layout">
        <section className="movimientos-panel movimientos-form-panel">
          <div className="movimientos-panel-header">
            <h2>Registrar salida</h2>
          </div>

          <form onSubmit={handleSubmit} className="movimientos-formulario">
            <div className="campo-movimiento">
              <label htmlFor="lote-movimiento">Lote para salida</label>
              <select
                id="lote-movimiento"
                name="lote_id"
                value={formulario.lote_id}
                onChange={handleChange}
                required
              >
                <option value="">Selecciona un lote disponible</option>
                {lotesParaSeleccionar.map((lote) => (
                  <option key={lote.id} value={lote.id}>
                    {codigoMedicamento(lote.producto_id)} · {lote.medicamento_nombre} · Lote {lote.numero_lote} ({lote.cantidad} disp.)
                  </option>
                ))}
              </select>
            </div>

            {!cargando && lotes.length > 0 && lotesParaSeleccionar.length === 0 && (
              <p className="movimientos-ayuda">
                No hay lotes con existencias disponibles para registrar una salida.
              </p>
            )}

            <div className="campo-movimiento">
              <label htmlFor="cantidad-movimiento">Cantidad</label>
              <input
                id="cantidad-movimiento"
                name="cantidad"
                type="number"
                min="1"
                max="2147483647"
                step="1"
                value={formulario.cantidad}
                onChange={handleChange}
                required
              />
            </div>

            <div className="campo-movimiento">
              <label htmlFor="motivo-movimiento">Motivo <span>(opcional)</span></label>
              <textarea
                id="motivo-movimiento"
                name="motivo"
                value={formulario.motivo}
                onChange={handleChange}
                maxLength={255}
                rows={3}
                placeholder="Ej. Venta"
              />
            </div>

            <div className="movimientos-formulario-acciones">
              <button
                type="submit"
                className="btn-registrar-movimiento"
                disabled={guardando || cargando || lotesParaSeleccionar.length === 0}
              >
                {guardando ? "Registrando..." : "Registrar salida"}
              </button>
            </div>
            {!cargando && lotes.length === 0 && (
              <p className="movimientos-ayuda">Registra un lote con existencias en Inventario antes de registrar una salida.</p>
            )}
          </form>
        </section>

        <section className="movimientos-panel">
          <div className="movimientos-panel-header">
            <h2>Historial de movimientos</h2>
            <span className="movimientos-total">{movimientosFiltrados.length}</span>
          </div>

          <div className="movimientos-filtros">
            <div className="campo-filtro-movimiento">
              <label htmlFor="buscar-movimiento">Buscar</label>
              <input
                id="buscar-movimiento"
                type="search"
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
                placeholder="Medicamento, lote, usuario o motivo"
              />
            </div>
            <div className="campo-filtro-movimiento">
              <label htmlFor="filtro-tipo-movimiento">Tipo</label>
              <select
                id="filtro-tipo-movimiento"
                value={filtroTipo}
                onChange={(event) => setFiltroTipo(event.target.value)}
              >
                <option value="">Todos</option>
                <option value="SALIDA">Salidas</option>
              </select>
            </div>
          </div>

          <div className="movimientos-tabla-contenedor">
            {cargando ? (
              <p className="movimientos-mensaje">Cargando movimientos...</p>
            ) : movimientosFiltrados.length === 0 ? (
              <p className="movimientos-mensaje">
                {busqueda || filtroTipo ? "No se encontraron movimientos." : "Aún no hay movimientos registrados."}
              </p>
            ) : (
              <table className="movimientos-tabla">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Medicamento / lote</th>
                    <th>Tipo</th>
                    <th>Cantidad</th>
                    <th>Usuario</th>
                    <th>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientosFiltrados.map((movimiento) => (
                    <tr key={movimiento.id}>
                      <td>{mostrarFecha(movimiento.fecha)}</td>
                      <td>
                        <strong>{movimiento.medicamento_nombre}</strong>
                        <small>{codigoMedicamento(movimiento.producto_id)} · Lote {movimiento.numero_lote}</small>
                      </td>
                      <td>
                        <span className={`movimiento-tipo movimiento-tipo-${movimiento.tipo.toLocaleLowerCase()}`}>
                          {movimiento.tipo === "ENTRADA" ? "Entrada" : "Salida"}
                        </span>
                      </td>
                      <td>{movimiento.cantidad}</td>
                      <td>{movimiento.usuario_nombre}</td>
                      <td>{movimiento.motivo || "—"}</td>
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
