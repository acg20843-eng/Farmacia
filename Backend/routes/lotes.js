const express = require("express");
const router = express.Router();
const db = require("../config/database");

function fechaValida(fecha) {
    if (typeof fecha !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        return false;
    }

    const parsed = new Date(`${fecha}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === fecha;
}

function obtenerDatosLote(body) {
    const entrada = body && typeof body === "object" ? body : {};
    const productoId = Number(entrada.producto_id);
    const numeroLote = typeof entrada.numero_lote === "string"
        ? entrada.numero_lote.trim()
        : "";
    const cantidadTexto = String(entrada.cantidad ?? "");
    const precioTexto = String(entrada.precio_compra ?? "");
    const fechaCaducidad = entrada.fecha_caducidad;

    if (!Number.isSafeInteger(productoId) || productoId < 1) {
        return { error: "Selecciona un medicamento válido" };
    }

    if (!numeroLote) {
        return { error: "El número de lote es obligatorio" };
    }

    if (numeroLote.length > 100) {
        return { error: "El número de lote no puede superar los 100 caracteres" };
    }

    if (!/^\d+$/.test(cantidadTexto) || Number(cantidadTexto) > 2147483647) {
        return { error: "La cantidad debe ser un entero no negativo" };
    }

    if (!/^\d{1,8}(\.\d{1,2})?$/.test(precioTexto)) {
        return { error: "El precio de compra debe ser un número entre 0 y 99,999,999.99 con máximo 2 decimales" };
    }

    if (!fechaValida(fechaCaducidad)) {
        return { error: "Ingresa una fecha de caducidad válida" };
    }

    return {
        producto_id: productoId,
        numero_lote: numeroLote,
        cantidad: Number(cantidadTexto),
        precio_compra: Number(precioTexto),
        fecha_caducidad: fechaCaducidad
    };
}

async function existeMedicamento(id) {
    const [medicamentos] = await db.query(
        "SELECT id FROM productos WHERE id = ?",
        [id]
    );
    return medicamentos.length > 0;
}

async function existeNumeroLote(productoId, numeroLote, excluirId = null) {
    const [lotes] = await db.query(
        `SELECT id FROM lotes
         WHERE producto_id = ? AND numero_lote = ? AND id != COALESCE(?, 0)`,
        [productoId, numeroLote, excluirId]
    );
    return lotes.length > 0;
}

function manejarErrorDuplicado(error, res, fallback) {
    if (error.code === "ER_DUP_ENTRY") {
        return res.status(409).json({
            mensaje: "Ese número de lote ya está registrado para este medicamento"
        });
    }

    return res.status(500).json({ mensaje: fallback });
}

router.get("/", async (req, res) => {
    try {
        const [lotes] = await db.query(
            `SELECT l.*, p.nombre AS medicamento_nombre
             FROM lotes l
             JOIN productos p ON p.id = l.producto_id
             ORDER BY l.fecha_caducidad ASC, p.nombre ASC, l.numero_lote ASC`
        );
        res.json(lotes);
    } catch (error) {
        res.status(500).json({ mensaje: "Error al consultar lotes" });
    }
});

router.post("/", async (req, res) => {
    try {
        const datos = obtenerDatosLote(req.body);
        if (datos.error) {
            return res.status(400).json({ mensaje: datos.error });
        }

        if (!await existeMedicamento(datos.producto_id)) {
            return res.status(400).json({ mensaje: "El medicamento seleccionado no existe" });
        }

        if (await existeNumeroLote(datos.producto_id, datos.numero_lote)) {
            return res.status(409).json({
                mensaje: "Ese número de lote ya está registrado para este medicamento"
            });
        }

        const [resultado] = await db.query(
            `INSERT INTO lotes
             (producto_id, numero_lote, cantidad, precio_compra, fecha_caducidad)
             VALUES (?, ?, ?, ?, ?)`,
            [
                datos.producto_id,
                datos.numero_lote,
                datos.cantidad,
                datos.precio_compra,
                datos.fecha_caducidad
            ]
        );

        res.status(201).json({
            mensaje: "Lote registrado",
            id: resultado.insertId
        });
    } catch (error) {
        return manejarErrorDuplicado(error, res, "Error al registrar lote");
    }
});

router.put("/:id", async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isSafeInteger(id) || id < 1) {
            return res.status(400).json({ mensaje: "El lote seleccionado no es válido" });
        }

        const datos = obtenerDatosLote(req.body);
        if (datos.error) {
            return res.status(400).json({ mensaje: datos.error });
        }

        if (!await existeMedicamento(datos.producto_id)) {
            return res.status(400).json({ mensaje: "El medicamento seleccionado no existe" });
        }

        const [lotes] = await db.query("SELECT id FROM lotes WHERE id = ?", [id]);
        if (lotes.length === 0) {
            return res.status(404).json({ mensaje: "Lote no encontrado" });
        }

        if (await existeNumeroLote(datos.producto_id, datos.numero_lote, id)) {
            return res.status(409).json({
                mensaje: "Ese número de lote ya está registrado para este medicamento"
            });
        }

        await db.query(
            `UPDATE lotes
             SET producto_id = ?, numero_lote = ?, cantidad = ?, precio_compra = ?,
                 fecha_caducidad = ?
             WHERE id = ?`,
            [
                datos.producto_id,
                datos.numero_lote,
                datos.cantidad,
                datos.precio_compra,
                datos.fecha_caducidad,
                id
            ]
        );

        res.json({ mensaje: "Lote actualizado" });
    } catch (error) {
        return manejarErrorDuplicado(error, res, "Error al actualizar lote");
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const [resultado] = await db.query(
            "DELETE FROM lotes WHERE id = ?",
            [req.params.id]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ mensaje: "Lote no encontrado" });
        }

        res.json({ mensaje: "Lote eliminado" });
    } catch (error) {
        if (error.code === "ER_ROW_IS_REFERENCED_2" || error.code === "ER_ROW_IS_REFERENCED") {
            return res.status(409).json({
                mensaje: "No se puede eliminar porque tiene movimientos asociados"
            });
        }

        res.status(500).json({ mensaje: "Error al eliminar lote" });
    }
});

module.exports = router;
