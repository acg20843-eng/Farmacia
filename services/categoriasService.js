
const API_URL = "http://localhost:3000/api/categorias";

export async function obtenerCategorias() {
    const response = await fetch(API_URL);

    if (!response.ok) {
        throw new Error("No se pudieron consultar las categorías");
    }

    return response.json();
}

export async function crearCategoria(datos) {
    const response = await fetch(API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(datos)
    });

    const resultado = await response.json();

    if (!response.ok) {
        throw new Error(resultado.mensaje);
    }

    return resultado;
}

export async function actualizarCategoria(id, datos) {
    const response = await fetch(`${API_URL}/${id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(datos)
    });

    const resultado = await response.json();

    if (!response.ok) {
        throw new Error(resultado.mensaje);
    }

    return resultado;
}

export async function eliminarCategoria(id) {
    const response = await fetch(`${API_URL}/${id}`, {
        method: "DELETE"
    });

    const resultado = await response.json();

    if (!response.ok) {
        throw new Error(resultado.mensaje);
    }

    return resultado;
}
