
import { Navigate, Route, Routes } from "react-router-dom";
import MainLayout from "../components/layout/MainLayout";
import { obtenerUsuarioActual, tieneSesionIniciada } from "../utils/session";
import { normalizarRol } from "../utils/roles";
import Login from "../pages/Login/Login";
import Dashboard from "../pages/Dashboard/Dashboard";
import Productos from "../pages/Productos/Productos";
import Categorias from "../pages/Categorias/Categorias";
import Inventario from "../pages/Inventario/Inventario";
import Movimientos from "../pages/Movimientos/Movimientos";
import Usuarios from "../pages/Usuarios/Usuarios";

const ROLES_ADMINISTRACION = ["administrador", "dueno"];

function RequiereAcceso({ children, roles }) {
  const usuario = obtenerUsuarioActual();

  if (!tieneSesionIniciada()) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(normalizarRol(usuario?.rol))) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />

      <Route
        element={
          <RequiereAcceso>
            <MainLayout />
          </RequiereAcceso>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/productos" element={<Productos />} />
        <Route
          path="/categorias"
          element={
            <RequiereAcceso roles={ROLES_ADMINISTRACION}>
              <Categorias />
            </RequiereAcceso>
          }
        />
        <Route path="/inventario" element={<Inventario />} />
        <Route path="/movimientos" element={<Movimientos />} />
        <Route
          path="/usuarios"
          element={
            <RequiereAcceso roles={ROLES_ADMINISTRACION}>
              <Usuarios />
            </RequiereAcceso>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
