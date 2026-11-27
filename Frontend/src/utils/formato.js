export function codigoMedicamento(id) {
  return `MED-${String(id).padStart(3, "0")}`;
}

export function fechaISO(valor) {
  if (valor instanceof Date) {
    const mes = String(valor.getMonth() + 1).padStart(2, "0");
    const dia = String(valor.getDate()).padStart(2, "0");
    return `${valor.getFullYear()}-${mes}-${dia}`;
  }

  return String(valor || "").slice(0, 10);
}

export function fechaHoraLocal(valor) {
  if (valor instanceof Date) {
    return Number.isNaN(valor.getTime()) ? null : valor;
  }

  if (typeof valor !== "string") {
    return null;
  }

  const texto = valor.trim();
  if (!/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/i.test(texto)) {
    return null;
  }

  let iso = texto.replace(" ", "T");
  if (!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(iso)) {
    // DATETIME values from the database are UTC even when they have no zone suffix.
    iso += "Z";
  }
  iso = iso.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");

  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

export function formatearFecha(valor, sinFecha = "—") {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaISO(valor));
  return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : sinFecha;
}

export function diaUTC(valor) {
  const texto = fechaISO(valor);
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (!partes) {
    return null;
  }

  const [, anio, mes, dia] = partes;
  const fecha = Date.UTC(Number(anio), Number(mes) - 1, Number(dia));
  return new Date(fecha).toISOString().slice(0, 10) === texto
    ? Math.floor(fecha / 86400000)
    : null;
}
