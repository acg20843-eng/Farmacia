import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import DropdownMenu from "./DropdownMenu";
import { obtenerUsuarioActual } from "../../utils/session";
import { normalizarRol } from "../../utils/roles";

const ENLACES_PRINCIPALES = [
  { label: "Inicio", to: "/dashboard", end: true },
  { label: "Productos", to: "/productos" },
];

const INVENTARIO = [
  { label: "Lotes", to: "/inventario" },
  { label: "Movimientos", to: "/movimientos" },
];

const ETIQUETAS_ROL = {
  administrador: "Administrador",
  dueno: "Dueño",
};

export default function Navbar() {
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState(obtenerUsuarioActual);
  const rol = normalizarRol(usuario?.rol);
  const puedeAdministrarUsuarios = ["administrador", "dueno"].includes(rol);
  const categoriasAdministracion = [
    { label: "Categorías", to: "/categorias" },
    ...(puedeAdministrarUsuarios ? [{ label: "Usuarios", to: "/usuarios" }] : []),
  ];

  useEffect(() => {
    const actualizarUsuario = () => setUsuario(obtenerUsuarioActual());

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
        {ENLACES_PRINCIPALES.map(({ label, to, end }) => (
          <NavLink key={to} to={to} end={end}>{label}</NavLink>
        ))}

        <DropdownMenu label="Inventario" items={INVENTARIO} />
        <DropdownMenu label="Administración" items={categoriasAdministracion} />
      </nav>

      <nav aria-label="Cuenta">
        <div className="navbar-usuario" aria-label="Sesión iniciada">
          <span className="navbar-usuario-nombre">{usuario?.nombre || "Usuario"}</span>
          <span className="navbar-usuario-rol">
            {ETIQUETAS_ROL[rol] || "Empleado"}
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
