
const express = require("express");
const router = express.Router();
const db = require("../config/database");

function obtenerDatosCategoria(body) {
    const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";
    const descripcion = typeof body.descripcion === "string"
        ? body.descripcion.trim() || null
        : null;

    if (!nombre) {
        return { error: "El nombre es obligatorio" };
    }

    if (nombre.length > 100) {
        return { error: "El nombre no puede superar los 100 caracteres" };
    }

    return { nombre, descripcion };
}

//Listar categorías
router.get("/", async (req, res) => {
    try {
        const [categorias] = await db.query(
            "SELECT * FROM categorias ORDER BY nombre ASC"
        );
        return res.json(categorias);
    } catch (error) {
        console.error("Error al consultar categorías:", error.message);
        return res.status(500).json({ mensaje: "Error al consultar categorías" });
    }
});

//Agregar categoría
router.post("/", async (req, res) => {
    try {
        const datos = obtenerDatosCategoria(req.body);
        if (datos.error) {
            return res.status(400).json({ mensaje: datos.error });
        }

        const [existente] = await db.query(
            "SELECT id FROM categorias WHERE nombre = ?",
            [datos.nombre]
        );

        if (existente.length > 0) {
            return res.status(409).json({ mensaje: "Esta categoría ya existe" });
        }

        const [resultado] = await db.query(
            "INSERT INTO categorias (nombre, descripcion) VALUES (?, ?)",
            [datos.nombre, datos.descripcion]
        );

        return res.status(201).json({
            mensaje: "Categoría registrada correctamente",
            id: resultado.insertId
        });
    } catch (error) {
        console.error("Error al registrar categoría:", error.message);
        return res.status(500).json({ mensaje: "Error al registrar categoría" });
    }
});

//Actualizar categoría
router.put("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const datos = obtenerDatosCategoria(req.body);
        if (datos.error) {
            return res.status(400).json({ mensaje: datos.error });
        }

        const [existente] = await db.query(
            "SELECT id FROM categorias WHERE nombre = ? AND id != ?",
            [datos.nombre, id]
        );

        if (existente.length > 0) {
            return res.status(409).json({ mensaje: "Esta categoría ya existe" });
        }

        const [resultado] = await db.query(
            "UPDATE categorias SET nombre = ?, descripcion = ? WHERE id = ?",
            [datos.nombre, datos.descripcion, id]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ mensaje: "Categoría no encontrada" });
        }

        return res.json({ mensaje: "Categoría actualizada correctamente" });
    } catch (error) {
        console.error("Error al actualizar categoría:", error.message);
        return res.status(500).json({ mensaje: "Error al actualizar categoría" });
    }
});

//Eliminar categoría
router.delete("/:id", async (req, res) => {
    try {
        const [resultado] = await db.query(
            "DELETE FROM categorias WHERE id = ?",
            [req.params.id]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ mensaje: "Categoría no encontrada" });
        }

        return res.json({ mensaje: "Categoría eliminada correctamente" });
    } catch (error) {
        if (error.code === "ER_ROW_IS_REFERENCED_2") {
            return res.status(409).json({
                mensaje: "No se puede eliminar porque tiene productos asociados"
            });
        }

        console.error("Error al eliminar categoría:", error.message);
        return res.status(500).json({ mensaje: "Error al eliminar categoría" });
    }
});

module.exports = router;
