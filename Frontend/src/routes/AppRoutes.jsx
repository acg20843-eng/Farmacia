
import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { obtenerUsuarioActual, tieneSesionIniciada } from "../utils/session";
import { normalizarRol } from "../utils/roles";

const MainLayout = lazy(() => import("../components/layout/MainLayout"));
const Login = lazy(() => import("../pages/Login/Login"));
const Dashboard = lazy(() => import("../pages/Dashboard/Dashboard"));
const Productos = lazy(() => import("../pages/Productos/Productos"));
const Categorias = lazy(() => import("../pages/Categorias/Categorias"));
const Inventario = lazy(() => import("../pages/Inventario/Inventario"));
const Movimientos = lazy(() => import("../pages/Movimientos/Movimientos"));
const Usuarios = lazy(() => import("../pages/Usuarios/Usuarios"));

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
    <Suspense fallback={null}>
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
              <RequiereAcceso roles={[...ROLES_ADMINISTRACION, "empleado"]}>
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
    </Suspense>
  );
}
