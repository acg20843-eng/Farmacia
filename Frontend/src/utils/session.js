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
  const usuario = obtenerUsuarioActual();

  return Boolean(
    token &&
    usuario &&
    Number.isSafeInteger(Number(usuario.id)) &&
    Number(usuario.id) > 0
  );
}

export function guardarUsuarioActual(usuario) {
  localStorage.setItem("usuario", JSON.stringify(usuario));
  window.dispatchEvent(new Event("session-updated"));
}
