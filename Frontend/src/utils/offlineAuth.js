
const DB_NAME = "farmacia-offline";
const DB_VERSION = 1;
const STORE_NAME = "credenciales";

const VIGENCIA_OFFLINE = 7 * 24 * 60 * 60 * 1000;
const ITERACIONES = 310000;

// Abrir base de datos local
function abrirDB() {
  return new Promise((resolve, reject) => {
    const solicitud = indexedDB.open(DB_NAME, DB_VERSION);

    solicitud.onupgradeneeded = () => {
      const db = solicitud.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, {
          keyPath: "correo"
        });
      }
    };

    solicitud.onsuccess = () => resolve(solicitud.result);
    solicitud.onerror = () => reject(solicitud.error);
  });
}

// Ejecutar una operación sobre IndexedDB
async function ejecutarOperacion(tipo, operacion) {
  const db = await abrirDB();

  return new Promise((resolve, reject) => {
    const transaccion = db.transaction(STORE_NAME, tipo);
    const almacen = transaccion.objectStore(STORE_NAME);

    let resultado;

    try {
      resultado = operacion(almacen);
    } catch (error) {
      db.close();
      reject(error);
      return;
    }

    transaccion.oncomplete = () => {
      db.close();
      resolve(resultado?.result);
    };

    transaccion.onerror = () => {
      db.close();
      reject(transaccion.error);
    };

    transaccion.onabort = () => {
      db.close();
      reject(transaccion.error);
    };
  });
}

// Generar un verificador de contraseña
async function generarVerificador(password, salt) {
  const encoder = new TextEncoder();

  const clave = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const resultado = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: ITERACIONES,
      hash: "SHA-256"
    },
    clave,
    256
  );

  return Array.from(new Uint8Array(resultado))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

// Comparar verificadores sin detenerse en el primer carácter diferente
function compararVerificadores(a, b) {
  if (a.length !== b.length) return false;

  let diferencia = 0;

  for (let i = 0; i < a.length; i++) {
    diferencia |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return diferencia === 0;
}

// Guardar autorización después de un inicio de sesión online exitoso
export async function guardarCredencialOffline(
  correo,
  password,
  usuario
) {
  if (!correo || !password || !usuario) {
    throw new Error("Faltan datos para guardar la credencial offline.");
  }

  if (!crypto.subtle || !indexedDB) {
    throw new Error("El navegador no admite almacenamiento offline seguro.");
  }

  const correoNormalizado = correo.trim().toLowerCase();

  const salt = crypto.getRandomValues(new Uint8Array(16));

  const verificador = await generarVerificador(password, salt);

  // Evitar guardar contraseñas o tokens dentro del objeto usuario
  const {
    password: _password,
    contrasena: _contrasena,
    token: _token,
    accessToken: _accessToken,
    refreshToken: _refreshToken,
    ...usuarioSeguro
  } = usuario;

  const ahora = Date.now();

  const registro = {
    correo: correoNormalizado,
    salt: Array.from(salt),
    verificador,
    usuario: usuarioSeguro,
    ultimaValidacion: ahora,
    vence: ahora + VIGENCIA_OFFLINE
  };

  await ejecutarOperacion("readwrite", almacen =>
    almacen.put(registro)
  );

  return true;
}

// Validar credenciales cuando no hay conexión a Internet
export async function validarCredencialOffline(
  correo,
  password
) {
  if (!correo || !password) {
    return {
      ok: false,
      motivo: "credenciales-invalidas"
    };
  }

  if (!crypto.subtle || !indexedDB) {
    return {
      ok: false,
      motivo: "no-autorizado"
    };
  }

  try {
    const correoNormalizado = correo.trim().toLowerCase();

    const registro = await ejecutarOperacion(
      "readonly",
      almacen => almacen.get(correoNormalizado)
    );

    if (!registro) {
      return {
        ok: false,
        motivo: "no-autorizado"
      };
    }

    // Comprobar vigencia de 7 días
    if (
      Date.now() >= registro.vence ||
      Date.now() < registro.ultimaValidacion
    ) {
      return {
        ok: false,
        motivo: "vencido"
      };
    }

    // Recuperar la sal original
    const salt = new Uint8Array(registro.salt);

    // Generar verificador de la contraseña ingresada
    const verificadorIngresado = await generarVerificador(
      password,
      salt
    );

    // Comparar contraseña
    if (
      !compararVerificadores(
        verificadorIngresado,
        registro.verificador
      )
    ) {
      return {
        ok: false,
        motivo: "credenciales-invalidas"
      };
    }

    return {
      ok: true,
      usuario: registro.usuario
    };

  } catch (error) {
    console.error("Error en autenticación offline:", error);

    return {
      ok: false,
      motivo: "no-autorizado"
    };
  }
}
    