import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import DropdownMenu from "./DropdownMenu";
import { obtenerUsuarioActual } from "../../utils/session";
import { normalizarRol } from "../../utils/roles";

export default function Navbar() {
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState(obtenerUsuarioActual);
  const rol = normalizarRol(usuario?.rol);
  const puedeAdministrarUsuarios = ["administrador", "dueno"].includes(rol);

  useEffect(() => {
    function actualizarUsuario() {
      setUsuario(obtenerUsuarioActual());
    }

    window.addEventListener("session-updated", actualizarUsuario);
    return () => window.removeEventListener("session-updated", actualizarUsuario);
  }, []);

  function cerrarSesion() {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    navigate("/login", { replace: true });
  }

  return (
    <header>
      <NavLink to="/dashboard" aria-label="Ir al dashboard">
        <strong>Farmacia Dulce María</strong>
      </NavLink>

      <nav aria-label="Navegación principal">
        <NavLink to="/dashboard" end>Inicio</NavLink>
        <NavLink to="/productos">Productos</NavLink>

        <DropdownMenu
          label="Inventario"
          items={[
            { label: "Lotes", to: "/inventario" },
            { label: "Movimientos", to: "/movimientos" },
          ]}
        />

        <DropdownMenu
          label="Administración"
          items={[
            { label: "Categorías", to: "/categorias" },
            ...(puedeAdministrarUsuarios ? [{ label: "Usuarios", to: "/usuarios" }] : []),
          ]}
        />
      </nav>

      <nav aria-label="Cuenta">
        <div className="navbar-usuario" aria-label="Sesión iniciada">
          <span className="navbar-usuario-nombre">{usuario?.nombre || "Usuario"}</span>
          <span className="navbar-usuario-rol">
            {rol === "administrador"
              ? "Administrador"
              : rol === "dueno"
                ? "Dueño"
                : "Empleado"}
          </span>
        </div>
        <button
          type="button"
          className="navbar-cerrar-sesion"
          onClick={cerrarSesion}
        >
          Cerrar sesión
        </button>
      </nav>
    </header>
  );
}
