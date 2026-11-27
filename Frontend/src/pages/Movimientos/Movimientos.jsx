import { useEffect, useState } from "react";
import PageTitle from "../../components/common/PageTitle";
import Notification from "../../components/common/Notification";
import CrudForm, { CrudInput, CrudSelect, CrudTextarea } from "../../components/common/CrudForm";
import CrudList from "../../components/common/CrudList";
import CrudTable from "../../components/common/CrudTable";
import useCrudForm from "../../hooks/useCrudForm";
import { apiRequest } from "../../services/api";
import { obtenerUsuarioActual } from "../../utils/session";
import { normalizarRol } from "../../utils/roles";
import { codigoMedicamento, fechaHoraLocal, fechaISO, formatearFecha } from "../../utils/formato";

const formularioInicial = {
  lote_id: "",
  cantidad: "1",
  motivo: ""
};

function mostrarFechaHora(valor) {
  const fechaLocal = fechaHoraLocal(valor);
  if (!fechaLocal) {
    return formatearFecha(valor);
  }

  const dia = formatearFecha(fechaISO(fechaLocal));
  if (dia === "—") {
    return dia;
  }

  const hora = `${String(fechaLocal.getHours()).padStart(2, "0")}:${String(fechaLocal.getMinutes()).padStart(2, "0")}`;
  return `${dia} ${hora}`;
}

export default function Movimientos() {
  const rolUsuario = normalizarRol(obtenerUsuarioActual()?.rol);
  const puedeAdministrar = ["administrador", "dueno"].includes(rolUsuario);
  const [lotes, setLotes] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [movimientoEditando, setMovimientoEditando] = useState(null);
  const {
    values: formulario,
    handleChange: actualizarFormulario,
    fill: llenarFormulario,
    reset: reiniciarFormulario
  } = useCrudForm(formularioInicial);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [eliminandoId, setEliminandoId] = useState(null);
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
    const manejarErrorCarga = (error) => {
      setNotificacion({
        type: "error",
        message: error.message || "Error al cargar los movimientos."
      });
    };
    const actualizarTrasSincronizar = () => {
      void cargarDatos().catch(manejarErrorCarga);
    };
    window.addEventListener("offline-sync-complete", actualizarTrasSincronizar);
    void Promise.resolve().then(cargarDatos).catch(manejarErrorCarga);

    return () => {
      window.removeEventListener("offline-sync-complete", actualizarTrasSincronizar);
    };
  }, []);

  function handleChange(event) {
    actualizarFormulario(event);
    if (event.target.name === "lote_id") {
      setNotificacion(null);
    }
  }

  function limpiarFormulario() {
    setMovimientoEditando(null);
    reiniciarFormulario();
  }

  function abrirEdicion(movimiento) {
    setMovimientoEditando(movimiento);
    llenarFormulario({
      lote_id: String(movimiento.lote_id),
      cantidad: String(movimiento.cantidad),
      motivo: movimiento.motivo || ""
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const lote = lotes.find((item) => Number(item.id) === Number(formulario.lote_id));
    if (!lote) {
      setNotificacion({ type: "error", message: "Selecciona un lote válido." });
      return;
    }

    const editando = Boolean(movimientoEditando);
    const existenciasDisponibles = Number(lote.cantidad) + (
      movimientoEditando?.tipo === "SALIDA"
        ? Number(movimientoEditando.cantidad)
        : 0
    );
    if (
      (!editando || movimientoEditando.tipo === "SALIDA") &&
      Number(formulario.cantidad) > existenciasDisponibles
    ) {
      setNotificacion({
        type: "error",
        message: `La cantidad supera las existencias disponibles (${existenciasDisponibles}).`
      });
      return;
    }

    const confirmacion = editando
      ? `¿Guardar los cambios del movimiento #${movimientoEditando.id}?`
      : `¿Registrar la salida de ${formulario.cantidad} unidades del lote "${lote.numero_lote}"?`;
    if (!window.confirm(confirmacion)) {
      return;
    }

    setGuardando(true);
    let movimientoGuardado = false;

    try {
      const datos = editando
        ? {
          cantidad: Number(formulario.cantidad),
          motivo: formulario.motivo
        }
        : {
          ...formulario,
          tipo: "SALIDA",
          lote_id: Number(formulario.lote_id),
          cantidad: Number(formulario.cantidad)
        };
      await apiRequest(
        editando ? `/movimientos/${movimientoEditando.id}` : "/movimientos",
        {
          method: editando ? "PUT" : "POST",
          body: JSON.stringify(datos)
        }
      );
      movimientoGuardado = true;
      limpiarFormulario();
      await cargarDatos();
      setNotificacion({
        type: "success",
        message: editando ? "Movimiento actualizado" : "Salida registrada"
      });
    } catch (error) {
      setNotificacion({
        type: "error",
        message: movimientoGuardado
          ? `Movimiento guardado, pero no se pudo actualizar la lista: ${error.message}`
          : error.message || "Error al guardar el movimiento."
      });
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarMovimiento(movimiento) {
    if (!window.confirm(`¿Eliminar el movimiento #${movimiento.id}? Las existencias del lote se ajustarán y esta acción no se puede deshacer.`)) {
      return;
    }

    setEliminandoId(movimiento.id);
    try {
      await apiRequest(`/movimientos/${movimiento.id}`, { method: "DELETE" });
      await cargarDatos();
      setNotificacion({ type: "success", message: "Movimiento eliminado" });
    } catch (error) {
      setNotificacion({
        type: "error",
        message: error.message || "Error al eliminar el movimiento."
      });
    } finally {
      setEliminandoId(null);
    }
  }

  const lotesParaSeleccionar = lotes
    .filter((lote) => (
      Number(lote.cantidad) > 0 ||
      Number(lote.id) === Number(movimientoEditando?.lote_id)
    ))
    .sort((a, b) => (
      fechaISO(a.fecha_caducidad).localeCompare(fechaISO(b.fecha_caducidad)) ||
      String(a.numero_lote).localeCompare(String(b.numero_lote), undefined, { numeric: true })
    ));
  const consulta = busqueda.trim().toLocaleLowerCase();
  const movimientosFiltrados = movimientos.filter((movimiento) => (
    [
      movimiento.medicamento_nombre,
      movimiento.numero_lote,
      movimiento.usuario_nombre,
      movimiento.motivo
    ].some((valor) => valor?.toLocaleLowerCase().includes(consulta))
  ));
  const columnas = [
    { label: "Fecha", render: (movimiento) => mostrarFechaHora(movimiento.fecha) },
    {
      label: "Medicamento / lote",
      render: (movimiento) => (
        <>
          <strong>{movimiento.medicamento_nombre}</strong>
          <small>{codigoMedicamento(movimiento.producto_id)} · Lote {movimiento.numero_lote}</small>
        </>
      )
    },
    {
      label: "Tipo",
      render: (movimiento) => {
        const entrada = movimiento.tipo === "ENTRADA";
        return (
          <span className={`crud-status crud-status--${entrada ? "positive" : "negative"}`}>
            {entrada ? "Entrada" : "Salida"}
          </span>
        );
      }
    },
    { label: "Cantidad", render: (movimiento) => movimiento.cantidad },
    { label: "Usuario", render: (movimiento) => movimiento.usuario_nombre },
    { label: "Motivo", render: (movimiento) => movimiento.motivo || "—" },
    {
      label: "Acciones",
      render: (movimiento) => (
        <div className="crud-row-actions">
          <button
            type="button"
            className="crud-action-edit"
            onClick={() => abrirEdicion(movimiento)}
            disabled={!puedeAdministrar || guardando || eliminandoId !== null}
          >
            Editar
          </button>
          <button
            type="button"
            className="crud-action-delete"
            onClick={() => eliminarMovimiento(movimiento)}
            disabled={!puedeAdministrar || guardando || eliminandoId !== null}
          >
            {eliminandoId === movimiento.id ? "Eliminando..." : "Eliminar"}
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="crud-page">
      <Notification notification={notificacion} onClose={() => setNotificacion(null)} />
      <PageTitle title="Movimientos" />

      <div className="crud-layout">
        <CrudForm
          title={movimientoEditando ? "Editar movimiento" : "Registrar salida"}
          editing={Boolean(movimientoEditando)}
          onSubmit={handleSubmit}
          onReset={limpiarFormulario}
          saving={guardando}
          submitLabel={movimientoEditando ? "Guardar cambios" : "Registrar salida"}
          savingLabel={movimientoEditando ? "Guardando..." : "Registrando..."}
          submitDisabled={cargando || lotesParaSeleccionar.length === 0}
        >
          <CrudSelect
            id="lote-movimiento"
            label="Lote para salida"
            name="lote_id"
            value={formulario.lote_id}
            onChange={handleChange}
            disabled={Boolean(movimientoEditando)}
            required
          >
            <option value="">Selecciona un lote disponible</option>
            {lotesParaSeleccionar.map((lote) => (
              <option key={lote.id} value={lote.id}>
                {codigoMedicamento(lote.producto_id)} · {lote.medicamento_nombre} · Lote {lote.numero_lote} ({lote.cantidad} disp.)
              </option>
            ))}
          </CrudSelect>

          {!cargando && lotes.length > 0 && lotesParaSeleccionar.length === 0 && (
            <p className="crud-help">
              No hay lotes con existencias disponibles para registrar una salida.
            </p>
          )}

          <CrudInput
            id="cantidad-movimiento"
            label="Cantidad"
            name="cantidad"
            type="number"
            min="1"
            max="2147483647"
            step="1"
            value={formulario.cantidad}
            onChange={handleChange}
            required
          />

          <CrudTextarea
            id="motivo-movimiento"
            label={<>Motivo <span>(opcional)</span></>}
            name="motivo"
            value={formulario.motivo}
            onChange={handleChange}
            maxLength={255}
            rows={3}
            placeholder="Ej. Venta"
          />

          {!cargando && lotes.length === 0 && (
            <p className="crud-help">
          
            </p>
          )}
        </CrudForm>

        <CrudList
          title="Historial de movimientos"
          count={movimientosFiltrados.length}
          loading={cargando}
          loadingMessage="Cargando movimientos..."
          emptyMessage={
            busqueda
              ? "No se encontraron movimientos."
              : "Aún no hay movimientos registrados."
          }
          toolbar={
            <div className="crud-field crud-search">
              <label htmlFor="buscar-movimiento">Buscar</label>
              <input
                id="buscar-movimiento"
                type="search"
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
                placeholder="Medicamento, lote, usuario o motivo"
              />
            </div>
          }
        >
          <CrudTable
            className="crud-table crud-table--movements"
            columns={columnas}
            rows={movimientosFiltrados}
          />
        </CrudList>
      </div>
    </div>
  );
}
