
import { useEffect, useState } from "react";
import PageTitle from "../../components/common/PageTitle";
import Notification from "../../components/common/Notification";
import { guardarUsuarioActual, obtenerUsuarioActual } from "../../utils/session";
import { normalizarRol } from "../../utils/roles";
import { apiRequest } from "../../services/api";
import "./Usuarios.css";

const formularioInicial = {
  nombre: "",
  correo: "",
  password: "",
  confirmarPassword: "",
  rol: "empleado",
  activo: "1"
};

function headersAutorizacion() {
  return { Authorization: `Bearer ${localStorage.getItem("token")}` };
}

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
    <div className="campo-usuario">
      <label htmlFor={id}>{label}</label>
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
    </div>
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
  const puedeInicializarDueno =
    rolActual === "administrador" &&
    !usuarios.some((usuario) => normalizarRol(usuario.rol) === "dueno") &&
    Number(usuarioEditando?.id) === Number(usuarioActual?.id);

  const [formulario, setFormulario] = useState(formularioInicial);

  async function cargarUsuarios() {
    try {
      const datos = await apiRequest("/usuarios", {
        headers: headersAutorizacion()
      });
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

  function handleChange(event) {
    const { name, value } = event.target;

    setFormulario((prev) => ({
      ...prev,
      [name]: value
    }));
  }

  function puedeEditarUsuario(usuario) {
    return !motivoBloqueo(usuario, "editar");
  }

  function puedeEliminarUsuario(usuario) {
    return !motivoBloqueo(usuario, "eliminar");
  }

  function motivoBloqueo(usuario, accion) {
    const esPropio = Number(usuario.id) === Number(usuarioActual?.id);
    const verbo = accion === "editar" ? "modificar" : "eliminar";
    const rol = normalizarRol(usuario.rol);

    if (esPropio && (accion === "eliminar" || esDueno)) {
      return `No puedes ${verbo} tu propia cuenta`;
    }

    if (rol === "dueno" && !esDueno) {
      return `Solo el Dueño puede ${verbo} esta cuenta`;
    }

    if (accion === "eliminar" && rol === "administrador" && !esDueno) {
      return "Solo el Dueño puede eliminar cuentas administradoras";
    }

    return "";
  }

  function abrirFormulario(usuario = null) {
    if (usuario && !puedeEditarUsuario(usuario)) {
      return;
    }

    setUsuarioEditando(usuario);
    setFormulario(usuario ? {
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
    setFormulario(formularioInicial);
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
          headers: headersAutorizacion(),
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
        method: "DELETE",
        headers: headersAutorizacion()
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

  return (
    <div className="usuarios-page">
      <Notification notification={notificacion} onClose={() => setNotificacion(null)} />
      <PageTitle
        title="Usuarios"
      />

      <div className="usuarios-layout">
        <section className="usuarios-panel usuarios-form-panel">
          <div className="usuarios-panel-header">
            <h2>{usuarioEditando ? "Editar usuario" : "Agregar usuario"}</h2>
            {usuarioEditando && (
              <button
                type="button"
                className="btn-nuevo-usuario"
                onClick={limpiarFormulario}
                disabled={guardando}
              >
                Nuevo
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="usuarios-formulario">
            <div className="campo-usuario">
              <label htmlFor="nombre">Nombre completo</label>
              <input
                id="nombre"
                name="nombre"
                type="text"
                value={formulario.nombre}
                onChange={handleChange}
                maxLength={100}
                required
              />
            </div>

            <div className="campo-usuario">
              <label htmlFor="correo">Correo electrónico</label>
              <input
                id="correo"
                name="correo"
                type="email"
                value={formulario.correo}
                onChange={handleChange}
                maxLength={150}
                required
              />
            </div>

            <CampoPassword
              id="password"
              label={usuarioEditando ? "Nueva contraseña (opcional)" : "Contraseña"}
              value={formulario.password}
              onChange={handleChange}
              visible={mostrarPassword}
              onToggle={() => setMostrarPassword(!mostrarPassword)}
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
              onToggle={() => setMostrarConfirmarPassword(!mostrarConfirmarPassword)}
              required={!usuarioEditando || Boolean(formulario.password)}
            />

            <div className="usuarios-formulario-fila">
              <div className="campo-usuario">
                <label htmlFor="rol">Rol</label>
                <select
                  id="rol"
                  name="rol"
                  value={formulario.rol}
                  onChange={handleChange}
                >
                  <option value="empleado">Empleado</option>
                  {(esDueno || puedeInicializarDueno) && (
                    <option value="dueno">Dueño</option>
                  )}
                  <option value="administrador">Administrador</option>
                </select>
              </div>

              <div className="campo-usuario">
                <label htmlFor="activo">Estado</label>
                <select
                  id="activo"
                  name="activo"
                  value={formulario.activo}
                  onChange={handleChange}
                >
                  <option value="1">Activo</option>
                  <option value="0">Inactivo</option>
                </select>
              </div>
            </div>

            <div className="usuarios-formulario-acciones">
              {usuarioEditando && (
                <button
                  type="button"
                  className="btn-cancelar-usuario"
                  onClick={limpiarFormulario}
                  disabled={guardando}
                >
                  Cancelar
                </button>
              )}
              <button
                type="submit"
                className="btn-guardar-usuario"
                disabled={guardando}
              >
                {guardando
                  ? "Guardando..."
                  : usuarioEditando
                    ? "Guardar cambios"
                    : "Agregar usuario"}
              </button>
            </div>
          </form>
        </section>

        <section className="usuarios-panel usuarios-lista-panel">
          <div className="usuarios-panel-header">
            <h2>Usuarios registrados</h2>
            <span className="usuarios-total">{usuarios.length}</span>
          </div>

          <div className="usuarios-tabla-contenedor">
            {cargando ? (
              <p className="usuarios-mensaje">Cargando usuarios...</p>
            ) : usuarios.length === 0 ? (
              <p className="usuarios-mensaje">No hay usuarios registrados.</p>
            ) : (
              <table className="usuarios-tabla">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Correo electrónico</th>
                    <th>Rol</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {usuarios.map((usuario) => {
                    const bloqueoEdicion = motivoBloqueo(usuario, "editar");
                    const bloqueoEliminacion = motivoBloqueo(usuario, "eliminar");

                    return (
                      <tr key={usuario.id}>
                        <td>{usuario.nombre}</td>
                        <td>{usuario.correo}</td>
                        <td>{etiquetaRol(usuario.rol)}</td>
                        <td>
                          <span className={
                            Number(usuario.activo) === 1
                              ? "estado-activo"
                              : "estado-inactivo"
                          }>
                            {Number(usuario.activo) === 1 ? "Activo" : "Inactivo"}
                          </span>
                        </td>
                        <td>
                          <div className="usuarios-acciones-fila">
                            <button
                              type="button"
                              className="btn-editar-usuario"
                              onClick={() => abrirFormulario(usuario)}
                              disabled={Boolean(bloqueoEdicion)}
                              title={bloqueoEdicion || "Editar usuario"}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              className="btn-eliminar-usuario"
                              onClick={() => eliminarUsuario(usuario)}
                              disabled={Boolean(bloqueoEliminacion) || eliminandoId === usuario.id}
                              title={bloqueoEliminacion || "Eliminar usuario"}
                            >
                              {eliminandoId === usuario.id ? "Eliminando..." : "Eliminar"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
