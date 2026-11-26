
const DB_NAME = "farmacia_dm_offline";
const DB_VERSION = 1;

// Almacenes compartidos para los diferentes módulos.
const ALMACENES = [
  "productos",
  "categorias",
  "lotes",
  "movimientos",
  "usuarios",
  "operacionesPendientes",
  "estadoCache"
];

let conexionDB = null;

function abrirDB() {
  if (conexionDB) {
    return conexionDB;
  }

  conexionDB = new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("Este navegador no permite utilizar IndexedDB."));
      return;
    }

    const solicitud = indexedDB.open(DB_NAME, DB_VERSION);

    solicitud.onupgradeneeded = (event) => {
      const db = event.target.result;

      ALMACENES.forEach((nombre) => {
        if (!db.objectStoreNames.contains(nombre)) {
          if (nombre === "operacionesPendientes") {
            db.createObjectStore(nombre, {
              keyPath: "localId",
              autoIncrement: true
            });
          } else {
            db.createObjectStore(nombre, {
              keyPath: "id"
            });
          }
        }
      });
    };

    solicitud.onsuccess = () => {
      const db = solicitud.result;

      db.onversionchange = () => {
        db.close();
        conexionDB = null;
      };

      resolve(db);
    };

    solicitud.onerror = () => {
      conexionDB = null;
      reject(solicitud.error);
    };

    solicitud.onblocked = () => {
      conexionDB = null;
      reject(new Error("La base de datos está bloqueada por otra conexión."));
    };
  });

  return conexionDB;
}

function validarAlmacen(nombre) {
  if (!ALMACENES.includes(nombre)) {
    throw new Error(`El almacén "${nombre}" no existe.`);
  }
}

async function ejecutarTransaccion(nombre, modo, operacion) {
  validarAlmacen(nombre);

  const db = await abrirDB();

  return new Promise((resolve, reject) => {
    const transaccion = db.transaction(nombre, modo);
    const almacen = transaccion.objectStore(nombre);

    let resultado;
    let errorOperacion = null;

    try {
      resultado = operacion(almacen);
    } catch (error) {
      errorOperacion = error;
      transaccion.abort();
    }

    transaccion.oncomplete = () => {
      if (errorOperacion) {
        reject(errorOperacion);
      } else {
        resolve(resultado);
      }
    };

    transaccion.onerror = () => {
      reject(
        errorOperacion ||
        transaccion.error ||
        new Error("Error en la base de datos local.")
      );
    };

    transaccion.onabort = () => {
      reject(
        errorOperacion ||
        transaccion.error ||
        new Error("La operación local fue cancelada.")
      );
    };
  });
}


// Consultar todos los registros de un módulo.
export async function obtenerTodos(nombre) {
  return ejecutarTransaccion(nombre, "readonly", (almacen) => {
    return new Promise((resolve, reject) => {
      const solicitud = almacen.getAll();

      solicitud.onsuccess = () => resolve(solicitud.result);
      solicitud.onerror = () => reject(solicitud.error);
    });
  }).then((resultado) => resultado);
}

// Guardar o actualizar un registro.
export async function guardarUno(nombre, registro) {
  return ejecutarTransaccion(nombre, "readwrite", (almacen) => {
    if (registro.id === undefined || registro.id === null) {
      throw new Error("El registro necesita un identificador.");
    }

    return almacen.put(registro);
  });
}

// Guardar varios registros sin borrar los existentes.
export async function guardarVarios(nombre, registros) {
  if (!Array.isArray(registros)) {
    throw new Error("Se esperaba una lista de registros.");
  }

  return ejecutarTransaccion(nombre, "readwrite", (almacen) => {
    registros.forEach((registro) => {
      if (registro.id === undefined || registro.id === null) {
        throw new Error("Un registro no tiene identificador.");
      }

      almacen.put(registro);
    });
  });
}

// Eliminar un registro por su identificador.
export async function eliminarUno(nombre, id) {
  return ejecutarTransaccion(nombre, "readwrite", (almacen) => {
    return almacen.delete(id);
  });
}

// Vaciar los registros de un almacén.
export async function limpiarAlmacen(nombre) {
  return ejecutarTransaccion(nombre, "readwrite", (almacen) => {
    return almacen.clear();
  });
}

// Reemplazar todos los registros de un almacén.
export async function reemplazarTodos(nombre, registros) {
  if (!Array.isArray(registros)) {
    throw new Error("Se esperaba una lista de registros.");
  }

  return ejecutarTransaccion(nombre, "readwrite", (almacen) => {
    almacen.clear();

    registros.forEach((registro) => {
      if (registro.id === undefined || registro.id === null) {
        throw new Error("Un registro no tiene identificador.");
      }

      almacen.put(registro);
    });
  });
}
