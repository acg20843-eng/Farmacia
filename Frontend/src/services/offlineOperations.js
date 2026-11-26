import {
  confirmarCambioPendiente,
  guardarCambioPendiente,
  guardarUno,
  obtenerCambiosPendientes,
  obtenerTodos
} from "./offlineDB";

const ENTIDADES = {
  "/productos": "productos",
  "/categorias": "categorias",
  "/lotes": "lotes",
  "/movimientos": "movimientos",
  "/usuarios": "usuarios"
};
const ROLES_ADMINISTRACION = ["administrador", "dueno"];
const CLAVE_CIFRADO_ID = "clave-cola-offline";
let sincronizacionActiva = null;

function obtenerPropietario() {
  try {
    const usuario = JSON.parse(localStorage.getItem("usuario") || "null");
    const id = Number(usuario?.id);

    if (!Number.isSafeInteger(id) || id < 1) {
      throw new Error("Se necesita una sesión válida para guardar cambios offline.");
    }

    return { id, rol: usuario.rol, nombre: usuario.nombre };
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("No se encontró el usuario de la sesión offline.", {
        cause: error
      });
    }
    throw error;
  }
}

function normalizarRol(rol) {
  return String(rol || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function validarRolAdministrador(propietario) {
  if (!ROLES_ADMINISTRACION.includes(
    String(propietario.rol || "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  )) {
    throw new Error("No tienes permiso para realizar esta acción.");
  }
}

function obtenerEntrada(body) {
  if (typeof body !== "string") {
    return body && typeof body === "object" ? { ...body } : {};
  }

  try {
    return JSON.parse(body);
  } catch {
    throw new Error("No se pudieron leer los datos para guardarlos offline.");
  }
}

async function obtenerClaveCifrado() {
  const [registro] = await obtenerTodos("clavesSeguridad");
  if (registro?.clave) {
    return registro.clave;
  }

  if (!globalThis.crypto?.subtle) {
    throw new Error("El navegador no admite el cifrado necesario para guardar usuarios offline.");
  }

  const clave = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );

  try {
    await guardarUno("clavesSeguridad", {
      id: CLAVE_CIFRADO_ID,
      clave
    });
    return clave;
  } catch (error) {
    const [claveExistente] = await obtenerTodos("clavesSeguridad");
    if (claveExistente?.clave) {
      return claveExistente.clave;
    }
    throw error;
  }
}

async function cifrarPassword(password) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("El navegador no admite el cifrado necesario para guardar usuarios offline.");
  }

  const clave = await obtenerClaveCifrado();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const datos = new TextEncoder().encode(password);
  const cifrado = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    clave,
    datos
  );

  return {
    iv: Array.from(iv),
    datos: Array.from(new Uint8Array(cifrado))
  };
}

export async function descifrarPassword(cifradoPassword) {
  if (!cifradoPassword) {
    return undefined;
  }

  const clave = await obtenerClaveCifrado();
  const datos = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: new Uint8Array(cifradoPassword.iv)
    },
    clave,
    new Uint8Array(cifradoPassword.datos)
  );

  return new TextDecoder().decode(datos);
}

function buscarPorId(registros, id) {
  return registros.find((registro) => Number(registro.id) === Number(id));
}

async function comprobarClaveUnica(entidad, cuerpo, idExcluir) {
  const registros = await obtenerTodos(entidad);

  if (entidad === "categorias") {
    const nombre = String(cuerpo.nombre || "").trim().toLocaleLowerCase();
    if (registros.some((categoria) =>
      Number(categoria.id) !== Number(idExcluir) &&
      String(categoria.nombre).trim().toLocaleLowerCase() === nombre
    )) {
      throw new Error("Esta categoría ya existe.");
    }
  }

  if (entidad === "usuarios") {
    const correo = String(cuerpo.correo || "").trim().toLowerCase();
    if (registros.some((usuario) =>
      Number(usuario.id) !== Number(idExcluir) &&
      String(usuario.correo).trim().toLowerCase() === correo
    )) {
      throw new Error("Ya existe un usuario registrado con ese correo.");
    }
  }

  if (entidad === "lotes") {
    const repetido = registros.some((lote) =>
      Number(lote.id) !== Number(idExcluir) &&
      Number(lote.producto_id) === Number(cuerpo.producto_id) &&
      lote.numero_lote === cuerpo.numero_lote
    );
    if (repetido) {
      throw new Error("Ese número de lote ya está registrado para este medicamento.");
    }
  }
}

async function crearRegistro(entidad, cuerpo, propietario) {
  const ahora = new Date().toISOString();

  if (entidad === "categorias") {
    validarRolAdministrador(propietario);
    const registro = {
      nombre: String(cuerpo.nombre || "").trim(),
      descripcion: String(cuerpo.descripcion || "").trim() || null
    };
    if (!registro.nombre) throw new Error("El nombre es obligatorio.");
    await comprobarClaveUnica(entidad, registro);
    return registro;
  }

  if (entidad === "productos") {
    const categoria = buscarPorId(
      await obtenerTodos("categorias"),
      cuerpo.categoria_id
    );
    if (!categoria) throw new Error("La categoría seleccionada no existe.");
    return {
      ...cuerpo,
      nombre: String(cuerpo.nombre || "").trim(),
      categoria_id: Number(cuerpo.categoria_id),
      categoria_nombre: categoria.nombre,
      fecha_registro: ahora
    };
  }

  if (entidad === "lotes") {
    const producto = buscarPorId(
      await obtenerTodos("productos"),
      cuerpo.producto_id
    );
    if (!producto) throw new Error("El medicamento seleccionado no existe.");
    const registro = {
      ...cuerpo,
      producto_id: Number(cuerpo.producto_id),
      cantidad: Number(cuerpo.cantidad),
      precio_compra: Number(cuerpo.precio_compra),
      medicamento_nombre: producto.nombre,
      fecha_registro: ahora
    };
    await comprobarClaveUnica(entidad, registro);
    return registro;
  }

  if (entidad === "movimientos") {
    if (cuerpo.tipo !== "SALIDA") {
      throw new Error("Esta sección solo permite registrar salidas.");
    }
    const lotes = await obtenerTodos("lotes");
    const lote = buscarPorId(lotes, cuerpo.lote_id);
    if (!lote) throw new Error("El lote seleccionado no existe.");

    const cantidad = Number(cuerpo.cantidad);
    if (!Number.isSafeInteger(cantidad) || cantidad < 1) {
      throw new Error("La cantidad debe ser un entero positivo.");
    }
    if (Number(lote.cantidad) < cantidad) {
      throw new Error(`No hay existencias suficientes. Disponibles: ${lote.cantidad}`);
    }

    const producto = buscarPorId(
      await obtenerTodos("productos"),
      lote.producto_id
    );
    const usuario = buscarPorId(
      await obtenerTodos("usuarios"),
      propietario.id
    );
    return {
      ...cuerpo,
      lote_id: Number(lote.id),
      usuario_id: propietario.id,
      tipo: "SALIDA",
      cantidad,
      motivo: String(cuerpo.motivo || "").trim() || null,
      numero_lote: lote.numero_lote,
      producto_id: Number(lote.producto_id),
      medicamento_nombre: producto?.nombre || lote.medicamento_nombre,
      usuario_nombre: usuario?.nombre || propietario.nombre || "Usuario",
      fecha: ahora
    };
  }

  if (entidad === "usuarios") {
    validarRolAdministrador(propietario);
    const registro = {
      nombre: String(cuerpo.nombre || "").trim(),
      correo: String(cuerpo.correo || "").trim().toLowerCase(),
      rol: cuerpo.rol,
      activo: Number(cuerpo.activo)
    };
    if (normalizarRol(registro.rol) === "dueno" && normalizarRol(propietario.rol) !== "dueno") {
      throw new Error("Solo el Dueño puede asignar ese rol.");
    }
    await comprobarClaveUnica(entidad, registro);
    return registro;
  }

  throw new Error("Esta operación no está disponible offline.");
}

async function actualizarRegistro(entidad, registroActual, cuerpo, propietario) {
  if (entidad === "usuarios") {
    validarRolAdministrador(propietario);
    const rolActual = normalizarRol(registroActual.rol);
    const rolNuevo = normalizarRol(cuerpo.rol);
    const esPromocionInicial =
      normalizarRol(propietario.rol) === "administrador" &&
      Number(propietario.id) === Number(registroActual.id) &&
      rolActual === "administrador" &&
      rolNuevo === "dueno" &&
      !(await obtenerTodos("usuarios")).some(
        (usuario) => normalizarRol(usuario.rol) === "dueno"
      );
    if (rolActual === "dueno" && normalizarRol(propietario.rol) !== "dueno") {
      throw new Error("Solo el Dueño puede modificar su cuenta.");
    }
    if (
      rolNuevo === "dueno" &&
      normalizarRol(propietario.rol) !== "dueno" &&
      !esPromocionInicial
    ) {
      throw new Error("Solo el Dueño puede asignar ese rol.");
    }
    if (
      Number(propietario.id) === Number(registroActual.id) &&
      ["administrador", "dueno"].includes(rolActual) &&
      rolNuevo !== rolActual &&
      !esPromocionInicial
    ) {
      throw new Error("No puedes cambiar el rol de tu propia cuenta.");
    }
    await comprobarClaveUnica(entidad, cuerpo, registroActual.id);
  }

  if (entidad === "categorias") {
    validarRolAdministrador(propietario);
    await comprobarClaveUnica(entidad, cuerpo, registroActual.id);
    return {
      ...registroActual,
      nombre: String(cuerpo.nombre || "").trim(),
      descripcion: String(cuerpo.descripcion || "").trim() || null
    };
  }

  if (entidad === "productos") {
    const categoria = buscarPorId(
      await obtenerTodos("categorias"),
      cuerpo.categoria_id
    );
    if (!categoria) throw new Error("La categoría seleccionada no existe.");
    return {
      ...registroActual,
      ...cuerpo,
      categoria_id: Number(cuerpo.categoria_id),
      categoria_nombre: categoria.nombre
    };
  }

  if (entidad === "lotes") {
    const producto = buscarPorId(
      await obtenerTodos("productos"),
      cuerpo.producto_id
    );
    if (!producto) throw new Error("El medicamento seleccionado no existe.");
    const actualizado = {
      ...registroActual,
      ...cuerpo,
      producto_id: Number(cuerpo.producto_id),
      cantidad: Number(cuerpo.cantidad),
      precio_compra: Number(cuerpo.precio_compra),
      medicamento_nombre: producto.nombre
    };
    await comprobarClaveUnica(entidad, actualizado, registroActual.id);
    return actualizado;
  }

  if (entidad === "movimientos") {
    validarRolAdministrador(propietario);
    const cantidadNueva = Number(cuerpo.cantidad);
    const cantidadAnterior = Number(registroActual.cantidad);
    const lote = buscarPorId(
      await obtenerTodos("lotes"),
      registroActual.lote_id
    );
    if (!lote) throw new Error("El lote del movimiento no existe.");
    const existenciaSiguiente = registroActual.tipo === "SALIDA"
      ? Number(lote.cantidad) + cantidadAnterior - cantidadNueva
      : Number(lote.cantidad) - cantidadAnterior + cantidadNueva;
    if (existenciaSiguiente < 0) {
      throw new Error("No hay existencias suficientes para guardar ese cambio.");
    }
    return {
      ...registroActual,
      cantidad: cantidadNueva,
      motivo: String(cuerpo.motivo || "").trim() || null
    };
  }

  if (entidad === "usuarios") {
    const datosUsuario = { ...cuerpo };
    delete datosUsuario.password;
    delete datosUsuario.cifradoPassword;
    return {
      ...registroActual,
      ...datosUsuario,
      correo: String(datosUsuario.correo || "").trim().toLowerCase(),
      activo: Number(datosUsuario.activo)
    };
  }

  throw new Error("Esta operación no está disponible offline.");
}

async function eliminarRegistro(entidad, registro, propietario) {
  const relaciones = {
    categorias: ["productos", "categoria_id"],
    productos: ["lotes", "producto_id"],
    lotes: ["movimientos", "lote_id"],
    usuarios: ["movimientos", "usuario_id"]
  };

  if (entidad === "movimientos") {
    validarRolAdministrador(propietario);
    const lote = buscarPorId(
      await obtenerTodos("lotes"),
      registro.lote_id
    );
    if (lote) {
      const ajuste = registro.tipo === "SALIDA"
        ? Number(registro.cantidad)
        : -Number(registro.cantidad);
      if (Number(lote.cantidad) + ajuste < 0) {
        throw new Error("No se puede eliminar: el lote ya no tiene existencias suficientes.");
      }
      return [{
        almacenNombre: "lotes",
        registro: {
          ...lote,
          cantidad: Number(lote.cantidad) + ajuste
        }
      }];
    }
    return [];
  }

  if (entidad === "usuarios") {
    validarRolAdministrador(propietario);
    if (Number(registro.id) === propietario.id) {
      throw new Error("No puedes eliminar tu propia cuenta.");
    }
    const rolObjetivo = normalizarRol(registro.rol);
    const rolPropietario = normalizarRol(propietario.rol);
    if (rolObjetivo === "dueno" && rolPropietario !== "dueno") {
      throw new Error("Solo el Dueño puede eliminar su cuenta.");
    }
    if (rolObjetivo === "administrador" && rolPropietario !== "dueno") {
      throw new Error("Solo el Dueño puede eliminar cuentas administradoras.");
    }
  }

  if (["categorias", "productos", "lotes"].includes(entidad)) {
    validarRolAdministrador(propietario);
  }

  const relacion = relaciones[entidad];
  if (relacion) {
    const [almacenRelacionado, campoRelacionado] = relacion;
    const relacionados = await obtenerTodos(almacenRelacionado);
    if (relacionados.some((item) =>
      Number(item[campoRelacionado]) === Number(registro.id)
    )) {
      throw new Error("No se puede eliminar porque existen registros relacionados.");
    }
  }
  return [];
}

async function obtenerActualizacionesRelacionadas(entidad, id, registro) {
  const actualizaciones = [];
  const actualizarAlmacen = async (almacen, predicado, cambios) => {
    const registros = await obtenerTodos(almacen);
    for (const existente of registros) {
      if (predicado(existente)) {
        actualizaciones.push({
          almacenNombre: almacen,
          registro: { ...existente, ...cambios }
        });
      }
    }
  };

  if (entidad === "categorias") {
    await actualizarAlmacen(
      "productos",
      (producto) => Number(producto.categoria_id) === Number(id),
      { categoria_nombre: registro.nombre }
    );
  } else if (entidad === "productos") {
    await actualizarAlmacen(
      "lotes",
      (lote) => Number(lote.producto_id) === Number(id),
      { medicamento_nombre: registro.nombre }
    );
    await actualizarAlmacen(
      "movimientos",
      (movimiento) => Number(movimiento.producto_id) === Number(id),
      { medicamento_nombre: registro.nombre }
    );
  } else if (entidad === "lotes") {
    await actualizarAlmacen(
      "movimientos",
      (movimiento) => Number(movimiento.lote_id) === Number(id),
      { numero_lote: registro.numero_lote }
    );
  } else if (entidad === "usuarios") {
    await actualizarAlmacen(
      "movimientos",
      (movimiento) => Number(movimiento.usuario_id) === Number(id),
      { usuario_nombre: registro.nombre }
    );
  }

  return actualizaciones;
}

export async function obtenerDatosOffline(ruta) {
  const rutaBase = ruta.split("?")[0];
  const entidad = ENTIDADES[rutaBase];
  if (!entidad) {
    throw new Error("No hay una copia local para esta información.");
  }

  const registros = await obtenerTodos(entidad);
  return entidad === "usuarios" ? { usuarios: registros } : registros;
}

export async function obtenerRegistroOffline(ruta) {
  const coincidencia = ruta.split("?")[0].match(
    /^\/(productos|categorias|lotes|movimientos|usuarios)\/(-?\d+)$/
  );
  if (!coincidencia) {
    throw new Error("No hay una copia local para este registro.");
  }

  const registros = await obtenerTodos(ENTIDADES[`/${coincidencia[1]}`]);
  return buscarPorId(registros, Number(coincidencia[2])) || null;
}

export async function aplicarCambioOffline(ruta, metodo, options = {}) {
  const rutaBase = ruta.split("?")[0];
  const entidad = ENTIDADES[rutaBase];
  const coincidencia = rutaBase.match(
    /^\/(productos|categorias|lotes|movimientos|usuarios)\/(-?\d+)$/
  );
  const entidadRuta = coincidencia ? ENTIDADES[`/${coincidencia[1]}`] : entidad;
  const id = coincidencia ? Number(coincidencia[2]) : null;
  const rutaRaiz = coincidencia ? `/${coincidencia[1]}` : rutaBase;

  if (!entidadRuta || (metodo !== "POST" && !coincidencia)) {
    throw new Error("Esta operación no está disponible offline.");
  }

  const propietario = obtenerPropietario();
  let cuerpo = obtenerEntrada(options.body);
  let registro;
  const rutaOperacion = metodo === "POST" ? rutaRaiz : `${rutaRaiz}/${id}`;
  if (metodo === "POST") {
    delete cuerpo.id;
  }

  if (entidadRuta === "usuarios" && cuerpo.password) {
    const cifradoPassword = await cifrarPassword(cuerpo.password);
    cuerpo = { ...cuerpo, cifradoPassword };
    delete cuerpo.password;
  }

  if (metodo === "POST") {
    registro = await crearRegistro(entidadRuta, cuerpo, propietario);
    const actualizaciones = [];
    if (entidadRuta === "movimientos") {
      const lote = buscarPorId(
        await obtenerTodos("lotes"),
        registro.lote_id
      );
      actualizaciones.push({
        almacenNombre: "lotes",
        registro: {
          ...lote,
          cantidad: Number(lote.cantidad) - Number(registro.cantidad)
        }
      });
    }
    const idRegistro = await guardarCambioPendiente({
      almacenNombre: entidadRuta,
      metodo,
      ruta: rutaOperacion,
      cuerpo,
      registro,
      actualizaciones,
      propietarioId: propietario.id
    });
    return { mensaje: "Cambio guardado localmente.", id: idRegistro };
  }

  const registros = await obtenerTodos(entidadRuta);
  const registroActual = buscarPorId(registros, id);
  if (!registroActual) {
    throw new Error("No se encontró el registro local.");
  }

  let actualizaciones = [];
  if (metodo === "PUT") {
    registro = await actualizarRegistro(
      entidadRuta,
      registroActual,
      cuerpo,
      propietario
    );
    if (entidadRuta === "movimientos") {
      const lote = buscarPorId(
        await obtenerTodos("lotes"),
        registroActual.lote_id
      );
      const existenciaSiguiente = registroActual.tipo === "SALIDA"
        ? Number(lote.cantidad) + Number(registroActual.cantidad) - Number(registro.cantidad)
        : Number(lote.cantidad) - Number(registroActual.cantidad) + Number(registro.cantidad);
      actualizaciones = [{
        almacenNombre: "lotes",
        registro: { ...lote, cantidad: existenciaSiguiente }
      }];
    }
    actualizaciones = [
      ...actualizaciones,
      ...await obtenerActualizacionesRelacionadas(entidadRuta, id, registro)
    ];
  } else if (metodo === "DELETE") {
    registro = await eliminarRegistro(entidadRuta, registroActual, propietario);
    actualizaciones = registro;
  } else {
    throw new Error("Esta operación no está disponible offline.");
  }

  await guardarCambioPendiente({
    almacenNombre: entidadRuta,
    metodo,
    ruta: rutaOperacion,
    cuerpo,
    registro: metodo === "PUT" ? registro : undefined,
    id,
    actualizaciones,
    propietarioId: propietario.id
  });
  return { mensaje: "Cambio guardado localmente.", id };
}

function obtenerCuerpoParaServidor(pendiente) {
  const cuerpo = pendiente.cuerpo && { ...pendiente.cuerpo };
  if (cuerpo?.cifradoPassword) {
    return descifrarPassword(cuerpo.cifradoPassword).then((password) => {
      delete cuerpo.cifradoPassword;
      cuerpo.password = password;
      return cuerpo;
    });
  }
  return Promise.resolve(cuerpo);
}

function tokenVigenteParaUsuario(token, usuario) {
  try {
    const segmento = token.split(".")[1];
    if (!segmento) return false;
    const base64 = segmento
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(segmento.length / 4) * 4, "=");
    const contenido = JSON.parse(atob(base64));
    return Number(contenido.id) === Number(usuario?.id) &&
      Number.isFinite(Number(contenido.exp)) &&
      Date.now() < Number(contenido.exp) * 1000;
  } catch {
    return false;
  }
}

async function procesarCambiosPendientes() {
  if (
    !navigator.onLine ||
    localStorage.getItem("modoOffline") === "true" ||
    !localStorage.getItem("token")
  ) {
    return;
  }

  const token = localStorage.getItem("token");
  let usuarioActual;
  try {
    usuarioActual = JSON.parse(localStorage.getItem("usuario") || "null");
  } catch {
    return;
  }
  if (!tokenVigenteParaUsuario(token, usuarioActual)) {
    return;
  }

  let huboCambios = false;
  const notificarCambiosSincronizados = () => {
    if (huboCambios && typeof window !== "undefined") {
      window.dispatchEvent(new Event("offline-sync-complete"));
    }
  };

  while (true) {
    const pendientes = (await obtenerCambiosPendientes())
      .sort((a, b) => a.localId - b.localId);
    const pendiente = pendientes[0];
    if (
      !pendiente ||
      Number(pendiente.propietarioId) !== Number(usuarioActual?.id)
    ) {
      notificarCambiosSincronizados();
      return;
    }

    try {
      const cuerpo = await obtenerCuerpoParaServidor(pendiente);
      const respuesta = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api${pendiente.ruta}`,
        {
          method: pendiente.metodo,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {})
        }
      );
      let datos = {};
      try {
        datos = await respuesta.json();
      } catch {
        if (respuesta.ok) {
          throw new Error("El servidor devolvió una respuesta inválida al sincronizar.");
        }
      }

      if (!respuesta.ok && !(
        pendiente.metodo === "DELETE" &&
        respuesta.status === 404
      )) {
        throw new Error(
          datos?.mensaje ||
          datos?.message ||
          "El servidor rechazó un cambio pendiente."
        );
      }

      const coincidencia = pendiente.ruta.match(
        /^\/(productos|categorias|lotes|movimientos|usuarios)(?:\/(-?\d+))?$/
      );
      const entidad = coincidencia ? ENTIDADES[`/${coincidencia[1]}`] : null;
      const idLocalRegistro = pendiente.idRegistro;
      const idServidor = pendiente.metodo === "POST"
        ? Number(datos.id)
        : null;

      if (pendiente.metodo === "POST" && (
        !Number.isSafeInteger(idServidor) || idServidor < 1
      )) {
        throw new Error("La API no devolvió un identificador válido al sincronizar.");
      }

      await confirmarCambioPendiente(
        pendiente.localId,
        pendiente.metodo === "POST" ? idLocalRegistro : null,
        idServidor,
        entidad
      );
      huboCambios = true;
    } catch (error) {
      console.error(
        `No se pudo sincronizar la operación local ${pendiente.localId}:`,
        error.message
      );
      notificarCambiosSincronizados();
      return;
    }
  }
}

export function sincronizarCambiosPendientes() {
  if (!sincronizacionActiva) {
    sincronizacionActiva = procesarCambiosPendientes()
      .catch((error) => {
        console.error("No se pudieron leer los cambios offline pendientes:", error);
      })
      .finally(() => {
        sincronizacionActiva = null;
      });
  }
  return sincronizacionActiva;
}
