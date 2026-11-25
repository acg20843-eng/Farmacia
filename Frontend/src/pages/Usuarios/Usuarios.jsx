
import { useEffect, useState } from "react";
import PageTitle from "../../components/common/PageTitle";
import Notification from "../../components/common/Notification";
import CrudForm, { CrudField, CrudInput, CrudSelect } from "../../components/common/CrudForm";
import CrudList from "../../components/common/CrudList";
import CrudTable from "../../components/common/CrudTable";
import useCrudForm from "../../hooks/useCrudForm";
import { guardarUsuarioActual, obtenerUsuarioActual } from "../../utils/session";
import { normalizarRol } from "../../utils/roles";
import { apiRequest } from "../../services/api";

const formularioInicial = {
  nombre: "",
  correo: "",
  password: "",
  confirmarPassword: "",
  rol: "empleado",
  activo: "1"
};

function etiquetaRol(rol) {
  const rolNormalizado = normalizarRol(rol);

  return {
    administrador: "Administrador",
    dueno: "Dueño",
    empleado: "Empleado"
  }[rolNormalizado] || rol || "Rol no reconocido";
}

function CampoPassword({
  id,
  label,
  value,
  onChange,
  visible,
  onToggle,
  required,
  minLength,
  placeholder
}) {
  return (
    <CrudField id={id} label={label}>
      <div className="password-input-contenedor">
        <input
          id={id}
          name={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
          minLength={minLength}
          placeholder={placeholder}
          autoComplete="new-password"
          required={required}
        />
        <button
          type="button"
          className="btn-ver-password"
          onClick={onToggle}
          aria-pressed={visible}
        >
          {visible ? "Ocultar" : "Ver"}
        </button>
      </div>
    </CrudField>
  );
}

export default function Usuarios() {
  const usuarioActual = obtenerUsuarioActual();
  const rolActual = normalizarRol(usuarioActual?.rol);
  const esDueno = rolActual === "dueno";
  const [usuarios, setUsuarios] = useState([]);
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [mostrarConfirmarPassword, setMostrarConfirmarPassword] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [eliminandoId, setEliminandoId] = useState(null);
  const [usuarioEditando, setUsuarioEditando] = useState(null);
  const [notificacion, setNotificacion] = useState(null);
  const {
    values: formulario,
    handleChange,
    fill: llenarFormulario,
    reset: reiniciarFormulario
  } = useCrudForm(formularioInicial);
  const puedeInicializarDueno =
    rolActual === "administrador" &&
    !usuarios.some((usuario) => normalizarRol(usuario.rol) === "dueno") &&
    Number(usuarioEditando?.id) === Number(usuarioActual?.id);

  async function cargarUsuarios() {
    try {
      const datos = await apiRequest("/usuarios");
      setUsuarios(datos.usuarios || []);
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
    void Promise.resolve().then(cargarUsuarios);
  }, []);

  function puedeEditarUsuario(usuario) {
    const esCuentaDueno = normalizarRol(usuario.rol) === "dueno";

    return !(esCuentaDueno && !esDueno);
  }

  function puedeEliminarUsuario(usuario) {
    const esPropio = Number(usuario.id) === Number(usuarioActual?.id);
    const rol = normalizarRol(usuario.rol);

    return !esPropio &&
      !(rol === "dueno" && !esDueno) &&
      !(rol === "administrador" && !esDueno);
  }

  function abrirFormulario(usuario = null) {
    if (usuario && !puedeEditarUsuario(usuario)) {
      return;
    }

    setUsuarioEditando(usuario);
    llenarFormulario(usuario ? {
      nombre: usuario.nombre,
      correo: usuario.correo,
      password: "",
      confirmarPassword: "",
      rol: usuario.rol,
      activo: String(usuario.activo)
    } : formularioInicial);
    setMostrarPassword(false);
    setMostrarConfirmarPassword(false);
  }

  function limpiarFormulario() {
    setMostrarPassword(false);
    setMostrarConfirmarPassword(false);
    setUsuarioEditando(null);
    reiniciarFormulario();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const editando = Boolean(usuarioEditando);

    if (
      (formulario.password || formulario.confirmarPassword) &&
      formulario.password !== formulario.confirmarPassword
    ) {
      setNotificacion({ type: "error", message: "Las contraseñas no coinciden." });
      return;
    }

    if ((!usuarioEditando || formulario.password) && formulario.password.length < 8) {
      setNotificacion({
        type: "error",
        message: "La contraseña debe tener al menos 8 caracteres."
      });
      return;
    }

    const confirmacion = editando
      ? `¿Guardar los cambios del usuario "${usuarioEditando.nombre}"?`
      : `¿Agregar al usuario "${formulario.nombre.trim()}"?`;
    if (!window.confirm(confirmacion)) {
      return;
    }

    setGuardando(true);

    try {
      await apiRequest(
        usuarioEditando ? `/usuarios/${usuarioEditando.id}` : "/usuarios",
        {
          method: usuarioEditando ? "PUT" : "POST",
          body: JSON.stringify({
            nombre: formulario.nombre.trim(),
            correo: formulario.correo.trim(),
            rol: formulario.rol,
            activo: Number(formulario.activo),
            ...(formulario.password ? { password: formulario.password } : {})
          })
        }
      );

      if (Number(usuarioEditando?.id) === Number(usuarioActual?.id)) {
        guardarUsuarioActual({
          ...usuarioActual,
          nombre: formulario.nombre.trim(),
          correo: formulario.correo.trim(),
          rol: formulario.rol
        });
      }

      limpiarFormulario();
      await cargarUsuarios();
      setNotificacion({
        type: "success",
        message: editando
          ? "Usuario actualizado"
          : "Usuario agregado"
      });

    } catch (error) {
      setNotificacion({
        type: "error",
        message: error.message || "Error al guardar el usuario."
      });
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarUsuario(usuario) {
    if (!puedeEliminarUsuario(usuario)) {
      return;
    }

    if (!window.confirm(`¿Eliminar al usuario "${usuario.nombre}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    setEliminandoId(usuario.id);

    try {
      await apiRequest(`/usuarios/${usuario.id}`, {
        method: "DELETE"
      });

      await cargarUsuarios();
      setNotificacion({
        type: "success",
        message: "Usuario eliminado"
      });
    } catch (error) {
      setNotificacion({
        type: "error",
        message: error.message || "Error al eliminar el usuario."
      });
    } finally {
      setEliminandoId(null);
    }
  }

  const columnas = [
    { label: "Nombre", render: (usuario) => usuario.nombre },
    { label: "Correo electrónico", render: (usuario) => usuario.correo },
    { label: "Rol", render: (usuario) => etiquetaRol(usuario.rol) },
    {
      label: "Estado",
      render: (usuario) => {
        const activo = Number(usuario.activo) === 1;
        return (
          <span className={`crud-status crud-status--${activo ? "active" : "inactive"}`}>
            {activo ? "Activo" : "Inactivo"}
          </span>
        );
      }
    },
    {
      label: "Acciones",
      render: (usuario) => {
        return (
          <div className="crud-row-actions">
            <button
              type="button"
              className="crud-action-edit"
              onClick={() => abrirFormulario(usuario)}
              disabled={!puedeEditarUsuario(usuario)}
            >
              Editar
            </button>
            <button
              type="button"
              className="crud-action-delete"
              onClick={() => eliminarUsuario(usuario)}
              disabled={!puedeEliminarUsuario(usuario) || eliminandoId === usuario.id}
            >
              {eliminandoId === usuario.id ? "Eliminando..." : "Eliminar"}
            </button>
          </div>
        );
      }
    }
  ];

  return (
    <div className="crud-page">
      <Notification notification={notificacion} onClose={() => setNotificacion(null)} />
      <PageTitle title="Usuarios" />

      <div className="crud-layout">
        <CrudForm
          title={usuarioEditando ? "Editar usuario" : "Agregar usuario"}
          editing={Boolean(usuarioEditando)}
          onSubmit={handleSubmit}
          onReset={limpiarFormulario}
          saving={guardando}
          submitLabel={usuarioEditando ? "Guardar cambios" : "Agregar usuario"}
        >
          <CrudInput
            id="nombre"
            label="Nombre completo"
            name="nombre"
            type="text"
            value={formulario.nombre}
            onChange={handleChange}
            maxLength={100}
            required
          />
          <CrudInput
            id="correo"
            label="Correo electrónico"
            name="correo"
            type="email"
            value={formulario.correo}
            onChange={handleChange}
            maxLength={150}
            required
          />

          <CampoPassword
            id="password"
            label={usuarioEditando ? "Nueva contraseña (opcional)" : "Contraseña"}
            value={formulario.password}
            onChange={handleChange}
            visible={mostrarPassword}
            onToggle={() => setMostrarPassword((visible) => !visible)}
            required={!usuarioEditando}
            minLength={8}
            placeholder={usuarioEditando ? "Deja vacío para conservarla" : ""}
          />

          <CampoPassword
            id="confirmarPassword"
            label={usuarioEditando ? "Confirmar nueva contraseña" : "Confirmar contraseña"}
            value={formulario.confirmarPassword}
            onChange={handleChange}
            visible={mostrarConfirmarPassword}
            onToggle={() => setMostrarConfirmarPassword((visible) => !visible)}
            required={!usuarioEditando || Boolean(formulario.password)}
          />

          <div className="crud-fields-row">
            <CrudSelect
              id="rol"
              label="Rol"
              name="rol"
              value={formulario.rol}
              onChange={handleChange}
              disabled={
                esDueno &&
                Number(usuarioEditando?.id) === Number(usuarioActual?.id)
              }
            >
              <option value="empleado">Empleado</option>
              {(esDueno || puedeInicializarDueno) && (
                <option value="dueno">Dueño</option>
              )}
              <option value="administrador">Administrador</option>
            </CrudSelect>

            <CrudSelect
              id="activo"
              label="Estado"
              name="activo"
              value={formulario.activo}
              onChange={handleChange}
            >
              <option value="1">Activo</option>
              <option value="0">Inactivo</option>
            </CrudSelect>
          </div>
        </CrudForm>

        <CrudList
          title="Usuarios registrados"
          count={usuarios.length}
          loading={cargando}
          loadingMessage="Cargando usuarios..."
          emptyMessage="No hay usuarios registrados."
        >
          <CrudTable
            className="crud-table crud-table--users"
            columns={columnas}
            rows={usuarios}
          />
        </CrudList>
      </div>
    </div>
  );
}
