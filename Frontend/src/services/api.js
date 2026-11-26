
import {
  obtenerTodos,
  reemplazarTodos
} from "./offlineDB";

const API_URL = `${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api`;

// Relación entre las rutas del backend y los almacenes locales.
const ALMACENES = {
  "/productos": "productos",
  "/categorias": "categorias"
};

export async function apiRequest(path, options = {}) {
  const token = localStorage.getItem("token");
  const metodo = (options.method || "GET").toUpperCase();

  const ruta = path.split("?")[0];
  const almacen = ALMACENES[ruta];

  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };

  let response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers
    });
  } catch (error) {
    // Si falla la conexión, intentar recuperar los datos locales.
    if (metodo === "GET" && almacen) {
      const datosLocales = await obtenerTodos(almacen);

      if (datosLocales.length > 0) {
        return datosLocales;
      }
    }

    throw error;
  }

  let data;

  try {
    data = await response.json();
  } catch {
    if (response.ok) {
      throw new Error("El servidor devolvió una respuesta inválida.");
    }
  }

  if (!response.ok) {
    throw new Error(
      data?.mensaje ||
      data?.message ||
      "Ocurrió un error al comunicarse con el servidor."
    );
  }

  // Guardar automáticamente las consultas exitosas.
  if (metodo === "GET" && almacen && Array.isArray(data)) {
    try {
      await reemplazarTodos(almacen, data);
    } catch (error) {
      console.error("Error al guardar los datos localmente:", error);
    }
  }

  return data;
}
