
const express = require("express");
const router = express.Router();
const db = require("../config/database");

// Consultar categorías
router.get("/", async (req, res) => {
    try {
        const [categorias] = await db.query(
            "SELECT * FROM categorias ORDER BY nombre ASC"
        );

        res.json(categorias);
    } catch (error) {
        res.status(500).json({ mensaje: "Error al consultar categorías" });
    }
});

// Registrar categoría
router.post("/", async (req, res) => {
    try {
        const { nombre, descripcion } = req.body;

        if (!nombre || !nombre.trim()) {
            return res.status(400).json({
                mensaje: "El nombre es obligatorio"
            });
        }

        const nombreLimpio = nombre.trim();

        if (nombreLimpio.length > 100) {
            return res.status(400).json({
                mensaje: "El nombre no puede superar los 100 caracteres"
            });
        }

        const [existente] = await db.query(
            "SELECT id FROM categorias WHERE nombre = ?",
            [nombreLimpio]
        );

        if (existente.length > 0) {
            return res.status(409).json({
                mensaje: "Esta categoría ya existe"
            });
        }

        const [resultado] = await db.query(
            "INSERT INTO categorias (nombre, descripcion) VALUES (?, ?)",
            [nombreLimpio, descripcion?.trim() || null]
        );

        res.status(201).json({
            mensaje: "Categoría registrada correctamente",
            id: resultado.insertId
        });

    } catch (error) {
        res.status(500).json({ mensaje: "Error al registrar categoría" });
    }
});

// Actualizar categoría
router.put("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, descripcion } = req.body;

        if (!nombre || !nombre.trim()) {
            return res.status(400).json({
                mensaje: "El nombre es obligatorio"
            });
        }

        const nombreLimpio = nombre.trim();

        if (nombreLimpio.length > 100) {
            return res.status(400).json({
                mensaje: "El nombre no puede superar los 100 caracteres"
            });
        }

        const [existente] = await db.query(
            "SELECT id FROM categorias WHERE nombre = ? AND id != ?",
            [nombreLimpio, id]
        );

        if (existente.length > 0) {
            return res.status(409).json({
                mensaje: "Esta categoría ya existe"
            });
        }

        const [resultado] = await db.query(
            "UPDATE categorias SET nombre = ?, descripcion = ? WHERE id = ?",
            [nombreLimpio, descripcion?.trim() || null, id]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({
                mensaje: "Categoría no encontrada"
            });
        }

        res.json({ mensaje: "Categoría actualizada correctamente" });

    } catch (error) {
        res.status(500).json({ mensaje: "Error al actualizar categoría" });
    }
});

// Eliminar categoría
router.delete("/:id", async (req, res) => {
    try {
        const [resultado] = await db.query(
            "DELETE FROM categorias WHERE id = ?",
            [req.params.id]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({
                mensaje: "Categoría no encontrada"
            });
        }

        res.json({ mensaje: "Categoría eliminada correctamente" });

    } catch (error) {
        if (error.code === "ER_ROW_IS_REFERENCED_2") {
            return res.status(409).json({
                mensaje: "No se puede eliminar porque tiene productos asociados"
            });
        }

        res.status(500).json({ mensaje: "Error al eliminar categoría" });
    }
});

module.exports = router;
