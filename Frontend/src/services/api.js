
import {
  obtenerTodos,
  reemplazarTodos,
  guardarUno,
  obtenerTodos as obtenerRegistros
} from "./offlineDB";

const API_URL = `${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api`;

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

  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers
    });

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

    if (metodo === "GET" && almacen && Array.isArray(data)) {
      try {
        await reemplazarTodos(almacen, data);
        await guardarUno("estadoCache", {
          id: almacen,
          actualizado: new Date().toISOString()
        });
      } catch (error) {
        console.error("Error al guardar los datos localmente:", error);
      }
    }

    return data;

  } catch (error) {
    if (metodo === "GET" && almacen) {
      const cache = await obtenerTodos("estadoCache");

      const existeCache = cache.some(
        (registro) => registro.id === almacen
      );

      if (existeCache) {
        return obtenerRegistros(almacen);
      }
    }

    throw error;
  }
}
