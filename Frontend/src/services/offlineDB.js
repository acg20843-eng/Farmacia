
const DB_NAME = "farmacia_dm_offline";
const DB_VERSION = 3;

// Almacenes compartidos para todos los módulos.
const ALMACENES = [
  "productos",
  "categorias",
  "lotes",
  "movimientos",
  "usuarios",
  "operacionesPendientes",
  "estadoCache",
  "clavesSeguridad"
];

let conexionDB = null;

// Abrir o crear la base de datos local.
function abrirDB() {
  if (conexionDB) {
    return conexionDB;
  }

  conexionDB = new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      conexionDB = null;
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
      reject(
        new Error("La base de datos está bloqueada por otra conexión.")
      );
    };
  });

  return conexionDB;
}

// Comprobar que el almacén exista.
function validarAlmacen(nombre) {
  if (!ALMACENES.includes(nombre)) {
    throw new Error(`El almacén "${nombre}" no existe.`);
  }
}

// Ejecutar operaciones dentro de una transacción.
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

      try {
        transaccion.abort();
      } catch {
        reject(error);
      }
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
  });
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
    registros.forEach((registro) => {
      if (registro.id === undefined || registro.id === null) {
        throw new Error("Un registro no tiene identificador.");
      }
    });

    almacen.clear();

    registros.forEach((registro) => {
      almacen.put(registro);
    });
  });
}

export async function guardarCambioPendiente({
  almacenNombre,
  metodo,
  ruta,
  cuerpo,
  registro,
  id,
  propietarioId,
  actualizaciones = []
}) {
  validarAlmacen(almacenNombre);
  const db = await abrirDB();

  return new Promise((resolve, reject) => {
    const transaccion = db.transaction(
      [...new Set([
        almacenNombre,
        "operacionesPendientes",
        ...actualizaciones.map(({ almacenNombre: nombre }) => nombre)
      ])],
      "readwrite"
    );
    const almacen = transaccion.objectStore(almacenNombre);
    const pendientes = transaccion.objectStore("operacionesPendientes");
    const rutaRaiz = ruta.replace(/\/-?\d+$/, "");
    for (const actualizacion of actualizaciones) {
      transaccion.objectStore(actualizacion.almacenNombre).put(
        actualizacion.registro
      );
    }
    const cambio = {
      metodo,
      ruta,
      cuerpo,
      propietarioId,
      creado: new Date().toISOString()
    };
    let idRegistro = id;

    if (metodo === "POST") {
      const solicitud = pendientes.add(cambio);
      solicitud.onsuccess = () => {
        idRegistro = -Number(solicitud.result);
        pendientes.put({
          ...cambio,
          localId: solicitud.result,
          idRegistro
        });
        almacen.put({ ...registro, id: idRegistro });
      };
      solicitud.onerror = () => reject(solicitud.error);
    } else {
      const solicitud = pendientes.getAll();
      solicitud.onsuccess = () => {
        const creacionPendiente = solicitud.result.find((pendiente) =>
          pendiente.metodo === "POST" &&
          Number(pendiente.idRegistro) === Number(idRegistro) &&
          pendiente.ruta === rutaRaiz
        );
        const operacionPendiente = solicitud.result.find((pendiente) =>
          pendiente.ruta === ruta &&
          ["PUT", "DELETE"].includes(pendiente.metodo)
        );

        if (creacionPendiente) {
          if (Number(creacionPendiente.propietarioId) !== Number(propietarioId)) {
            transaccion.abort();
            reject(new Error("Solo el usuario que creó el registro puede modificarlo offline."));
            return;
          }

          if (metodo === "PUT") {
            pendientes.put({
              ...creacionPendiente,
              cuerpo: { ...creacionPendiente.cuerpo, ...cuerpo }
            });
            almacen.put(registro);
          } else if (metodo === "DELETE") {
            pendientes.delete(creacionPendiente.localId);
            almacen.delete(idRegistro);
          } else {
            transaccion.abort();
            reject(new Error("Esta operación no está disponible offline."));
          }
          return;
        }

        if (operacionPendiente) {
          if (Number(operacionPendiente.propietarioId) !== Number(propietarioId)) {
            transaccion.abort();
            reject(new Error("Solo el usuario que guardó el cambio puede modificarlo offline."));
            return;
          }

          if (metodo === "PUT") {
            pendientes.put({
              ...operacionPendiente,
              cuerpo: { ...operacionPendiente.cuerpo, ...cuerpo }
            });
            almacen.put(registro);
          } else if (metodo === "DELETE") {
            pendientes.put({
              ...operacionPendiente,
              metodo: "DELETE",
              cuerpo: undefined
            });
            almacen.delete(idRegistro);
          } else {
            transaccion.abort();
            reject(new Error("Esta operación no está disponible offline."));
          }
          return;
        }

        const solicitudPendiente = pendientes.add({ ...cambio, idRegistro });
        solicitudPendiente.onerror = () => reject(solicitudPendiente.error);

        if (metodo === "DELETE") {
          almacen.delete(idRegistro);
        } else {
          almacen.put(registro);
        }
      };
      solicitud.onerror = () => reject(solicitud.error);
    }

    transaccion.oncomplete = () => resolve(idRegistro);
    transaccion.onerror = () => reject(
      transaccion.error || new Error("No se pudo guardar el cambio offline.")
    );
    transaccion.onabort = () => reject(
      transaccion.error || new Error("No se pudo guardar el cambio offline.")
    );
  });
}

export async function obtenerCambiosPendientes() {
  return obtenerTodos("operacionesPendientes");
}

export async function tieneOperacionPendiente(ruta) {
  const pendientes = await obtenerCambiosPendientes();
  return pendientes.some((pendiente) => pendiente.ruta === ruta);
}

export async function confirmarCambioPendiente(
  localId,
  idLocalRegistro,
  idServidor,
  tipoEntidad
) {
  const db = await abrirDB();
  const nombres = ALMACENES.filter((nombre) => nombre !== "clavesSeguridad");

  return new Promise((resolve, reject) => {
    const transaccion = db.transaction(nombres, "readwrite");
    const pendientes = transaccion.objectStore("operacionesPendientes");

    if (idLocalRegistro == null || idServidor == null) {
      pendientes.delete(localId);
      transaccion.oncomplete = resolve;
      transaccion.onerror = () => reject(transaccion.error);
      transaccion.onabort = () => reject(transaccion.error);
      return;
    }

    const almacenesConReferencias = {
      categorias: [["productos", "categoria_id"]],
      productos: [["lotes", "producto_id"]],
      lotes: [["movimientos", "lote_id"]],
      usuarios: [["movimientos", "usuario_id"]]
    };
    const nombresLectura = [
      ...new Set([
        tipoEntidad,
        ...(almacenesConReferencias[tipoEntidad] || []).map(([nombre]) => nombre),
        "operacionesPendientes"
      ])
    ];
    let lecturasRestantes = nombresLectura.length;
    const resultados = {};

    for (const nombre of nombresLectura) {
      const solicitud = transaccion.objectStore(nombre).getAll();
      solicitud.onsuccess = () => {
        resultados[nombre] = solicitud.result;
        lecturasRestantes -= 1;

        if (lecturasRestantes !== 0) {
          return;
        }

        const registroLocal = resultados[tipoEntidad].find(
          (registro) => Number(registro.id) === Number(idLocalRegistro)
        );
        if (registroLocal) {
          transaccion.objectStore(tipoEntidad).put({
            ...registroLocal,
            id: Number(idServidor)
          });
        }

        for (const [nombreReferencia, campo] of (
          almacenesConReferencias[tipoEntidad] || []
        )) {
          for (const registro of resultados[nombreReferencia]) {
            if (Number(registro[campo]) === Number(idLocalRegistro)) {
              transaccion.objectStore(nombreReferencia).put({
                ...registro,
                [campo]: Number(idServidor)
              });
            }
          }
        }

        for (const pendiente of resultados.operacionesPendientes) {
          if (pendiente.localId === localId) {
            continue;
          }

          const ruta = pendiente.ruta.replace(
            new RegExp(`/${idLocalRegistro}(?=$|\\?)`),
            `/${idServidor}`
          );
          const cuerpo = pendiente.cuerpo && { ...pendiente.cuerpo };
          if (cuerpo) {
            for (const campo of [
              "categoria_id",
              "producto_id",
              "lote_id",
              "usuario_id"
            ]) {
              if (Number(cuerpo[campo]) === Number(idLocalRegistro)) {
                cuerpo[campo] = Number(idServidor);
              }
            }
          }

          pendientes.put({
            ...pendiente,
            ruta,
            cuerpo,
            idRegistro: Number(pendiente.idRegistro) === Number(idLocalRegistro)
              ? Number(idServidor)
              : pendiente.idRegistro
          });
        }

        pendientes.delete(localId);
      };
      solicitud.onerror = () => {
        transaccion.abort();
        reject(solicitud.error);
      };
    }

    transaccion.oncomplete = resolve;
    transaccion.onerror = () => reject(transaccion.error);
    transaccion.onabort = () => reject(transaccion.error);
  });
}
