
import {
  reemplazarTodos,
  guardarUno,
  obtenerCambiosPendientes,
  tieneOperacionPendiente
} from "./offlineDB";
import {
  aplicarCambioOffline,
  obtenerDatosOffline,
  obtenerRegistroOffline,
  sincronizarCambiosPendientes
} from "./offlineOperations";

const API_URL = `${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api`;

const ALMACENES = {
  "/productos": "productos",
  "/categorias": "categorias",
  "/lotes": "lotes",
  "/movimientos": "movimientos",
  "/usuarios": "usuarios"
};

function estaEnModoLocal() {
  return !navigator.onLine || localStorage.getItem("modoOffline") === "true";
}

async function guardarEnCache(almacen, data) {
  const registros = almacen === "usuarios" ? data?.usuarios : data;
  if (!Array.isArray(registros)) {
    return;
  }

  const pendientes = await obtenerCambiosPendientes();
  if (pendientes.some((pendiente) =>
    pendiente.ruta.split("?")[0].split("/")[1] === almacen
  )) {
    return true;
  }

  await reemplazarTodos(almacen, registros);
  await guardarUno("estadoCache", {
    id: almacen,
    actualizado: new Date().toISOString()
  });
  return false;
}

export async function apiRequest(path, options = {}) {
  const token = localStorage.getItem("token");
  const metodo = (options.method || "GET").toUpperCase();
  const ruta = path.split("?")[0];
  const almacen = ALMACENES[ruta];
  const rutaRegistro = /^\/(?:productos|categorias|lotes|movimientos|usuarios)\/-?\d+$/.test(ruta);

  if ((almacen || rutaRegistro) && estaEnModoLocal()) {
    if (metodo === "GET") {
      return almacen
        ? obtenerDatosOffline(path)
        : obtenerRegistroOffline(path);
    }
    return aplicarCambioOffline(path, metodo, options);
  }

  if (rutaRegistro) {
    if (metodo === "GET") {
      return obtenerRegistroOffline(path);
    }
    if (ruta.startsWith("/") && ruta.includes("/-")) {
      return aplicarCambioOffline(path, metodo, options);
    }
  }

  if (
    (almacen || rutaRegistro) &&
    metodo !== "GET" &&
    await tieneOperacionPendiente(ruta)
  ) {
    return aplicarCambioOffline(path, metodo, options);
  }

  if (metodo === "GET" && almacen && token) {
    await sincronizarCambiosPendientes();
  }

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

    if (metodo === "GET" && almacen) {
      try {
        const hayCambiosLocales = await guardarEnCache(almacen, data);
        if (hayCambiosLocales) {
          return await obtenerDatosOffline(path);
        }
      } catch (error) {
        console.error(
          "Error al guardar los datos localmente:",
          error
        );
      }
    }

    return data;

  } catch (error) {
    const sinConexion = !navigator.onLine || error instanceof TypeError;

    if (metodo === "GET" && almacen && sinConexion) {
      try {
        return await obtenerDatosOffline(path);
      } catch (errorLocal) {
        console.error(
          "Error al recuperar los datos locales:",
          errorLocal
        );
      }
    }

    if (metodo !== "GET" && almacen && sinConexion) {
      return aplicarCambioOffline(path, metodo, options);
    }

    throw error;
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    void sincronizarCambiosPendientes();
  });
  void sincronizarCambiosPendientes();
}

export { sincronizarCambiosPendientes };
