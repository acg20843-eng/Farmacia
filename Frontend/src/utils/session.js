
export function obtenerUsuarioActual() {
  try {
    const usuario = JSON.parse(localStorage.getItem("usuario") || "null");
    return usuario && typeof usuario === "object" ? usuario : null;
  } catch {
    return null;
  }
}

export function tieneSesionIniciada() {
  const token = localStorage.getItem("token");
  const modoOffline = localStorage.getItem("modoOffline") === "true";
  const usuario = obtenerUsuarioActual();

  return Boolean(
    usuario &&
    Number.isSafeInteger(Number(usuario.id)) &&
    Number(usuario.id) > 0 &&
    (token || modoOffline)
  );
}

export function guardarUsuarioActual(usuario) {
  localStorage.setItem("usuario", JSON.stringify(usuario));
  window.dispatchEvent(new Event("session-updated"));
}
