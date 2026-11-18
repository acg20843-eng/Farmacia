export function normalizarRol(rol) {
  return typeof rol === "string"
    ? rol.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    : "";
}
