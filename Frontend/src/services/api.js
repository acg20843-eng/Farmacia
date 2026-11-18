const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

export async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
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

  return data;
}
