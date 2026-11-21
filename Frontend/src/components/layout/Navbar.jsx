import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import DropdownMenu from "./DropdownMenu";
import { obtenerUsuarioActual } from "../../utils/session";
import { normalizarRol } from "../../utils/roles";

const ENLACES_PRINCIPALES = [
  { label: "Inicio", to: "/dashboard", end: true },
  { label: "Movimientos", to: "/movimientos", end: true },
  { label: "Medicamentos", to: "/productos" },
  { label: "Lotes", to: "/inventario" },
];

const ETIQUETAS_ROL = {
  administrador: "Administrador",
  dueno: "Dueño",
};

export default function Navbar() {
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState(obtenerUsuarioActual);
  const [enLinea, setEnLinea] = useState(() => navigator.onLine);
  const [menuAbierto, setMenuAbierto] = useState(null);
  const rol = normalizarRol(usuario?.rol);
  const puedeAdministrar = ["administrador", "dueno"].includes(rol);
  const categoriasAdministracion = [
    { label: "Categorías", to: "/categorias" },
    { label: "Usuarios", to: "/usuarios" },
  ];

  useEffect(() => {
    const actualizarUsuario = () => setUsuario(obtenerUsuarioActual());
    const actualizarConexion = () => setEnLinea(navigator.onLine);

    window.addEventListener("session-updated", actualizarUsuario);
    window.addEventListener("online", actualizarConexion);
    window.addEventListener("offline", actualizarConexion);

    return () => {
      window.removeEventListener("session-updated", actualizarUsuario);
      window.removeEventListener("online", actualizarConexion);
      window.removeEventListener("offline", actualizarConexion);
    };
  }, []);

  function cerrarSesion() {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    navigate("/login", { replace: true });
  }

  return (
    <header>
      <NavLink to="/dashboard" aria-label="Ir al dashboard">
        <img className="navbar-logo" src="/img2.jpg" alt="" />
        <strong>Farmacia Dulce María</strong>
      </NavLink>

      <nav aria-label="Navegación principal">
        {ENLACES_PRINCIPALES.map(({ label, to, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={() => setMenuAbierto(null)}
          >
            {label}
          </NavLink>
        ))}

        {puedeAdministrar && (
          <DropdownMenu
            label="Administración"
            items={categoriasAdministracion}
            open={menuAbierto === "administracion"}
            onToggle={() => setMenuAbierto((actual) => (
              actual === "administracion" ? null : "administracion"
            ))}
            onClose={() => setMenuAbierto(null)}
          />
        )}
      </nav>

      <nav aria-label="Cuenta">
        <div className="navbar-usuario" aria-label="Sesión iniciada">
          <span className="navbar-usuario-nombre">{usuario?.nombre || "Usuario"}</span>
          <span className="navbar-usuario-rol">
            {ETIQUETAS_ROL[rol] || "Empleado"}
          </span>
          <span
            className={`navbar-estado ${enLinea ? "en-linea" : "sin-conexion"}`}
            role="status"
          >
            {enLinea ? "En línea" : "Sin conexión"}
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
