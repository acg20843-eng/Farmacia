const express = require("express");
const jwt = require("jsonwebtoken");
const db = require("../config/database");

const router = express.Router();

async function autenticarUsuario(req, res, next) {
    const autorizacion = req.headers.authorization || "";
    const [esquema, token] = autorizacion.split(" ");

    if (esquema !== "Bearer" || !token) {
        return res.status(401).json({ mensaje: "Debes iniciar sesión para consultar movimientos" });
    }

    if (!process.env.JWT_SECRET) {
        console.error("Falta configurar JWT_SECRET");
        return res.status(500).json({ mensaje: "Error de configuración del servidor" });
    }

    try {
        const usuario = jwt.verify(token, process.env.JWT_SECRET);
        const usuarioId = Number(usuario.id);
        if (!Number.isSafeInteger(usuarioId) || usuarioId < 1) {
            return res.status(401).json({ mensaje: "La sesión no es válida o ha expirado" });
        }

        const [usuarios] = await db.query(
            "SELECT id FROM usuarios WHERE id = ? AND activo = 1 LIMIT 1",
            [usuarioId]
        );
        if (usuarios.length === 0) {
            return res.status(401).json({ mensaje: "La sesión no es válida o ha expirado" });
        }

        req.usuario = { id: usuarioId };
        return next();
    } catch (error) {
        if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
            return res.status(401).json({ mensaje: "La sesión no es válida o ha expirado" });
        }

        console.error("Error al verificar la sesión para movimientos:", error.message);
        return res.status(500).json({ mensaje: "Error al verificar la sesión" });
    }
}

router.use(autenticarUsuario);

router.get("/", async (req, res) => {
    try {
        const [movimientos] = await db.query(
            `SELECT m.id, m.lote_id, m.usuario_id, m.tipo, m.cantidad, m.motivo, m.fecha,
                    l.numero_lote, l.producto_id, p.nombre AS medicamento_nombre,
                    u.nombre AS usuario_nombre
             FROM movimientos m
             JOIN lotes l ON l.id = m.lote_id
             JOIN productos p ON p.id = l.producto_id
             JOIN usuarios u ON u.id = m.usuario_id
             ORDER BY m.fecha DESC, m.id DESC`
        );
        return res.json(movimientos);
    } catch (error) {
        console.error("Error al consultar movimientos:", error.message);
        return res.status(500).json({ mensaje: "Error al consultar movimientos" });
    }
});

router.post("/", async (req, res) => {
    const entrada = req.body && typeof req.body === "object" ? req.body : {};
    const loteId = Number(entrada.lote_id);
    const cantidadTexto = String(entrada.cantidad ?? "");
    const motivo = entrada.motivo == null ? "" : entrada.motivo;

    if (!Number.isSafeInteger(loteId) || loteId < 1) {
        return res.status(400).json({ mensaje: "Selecciona un lote válido" });
    }

    if (entrada.tipo !== "SALIDA") {
        return res.status(400).json({
            mensaje: "Esta sección solo permite salidas; registra las entradas al actualizar el lote"
        });
    }

    if (!/^[1-9]\d*$/.test(cantidadTexto) || Number(cantidadTexto) > 2147483647) {
        return res.status(400).json({ mensaje: "La cantidad debe ser un entero positivo" });
    }

    if (typeof motivo !== "string" || motivo.trim().length > 255) {
        return res.status(400).json({ mensaje: "El motivo no puede superar los 255 caracteres" });
    }

    const cantidad = Number(cantidadTexto);
    let conexion;

    try {
        conexion = await db.getConnection();
        await conexion.beginTransaction();

        const [lotes] = await conexion.query(
            "SELECT cantidad FROM lotes WHERE id = ? FOR UPDATE",
            [loteId]
        );

        if (lotes.length === 0) {
            await conexion.rollback();
            return res.status(404).json({ mensaje: "El lote seleccionado no existe" });
        }

        const cantidadActual = Number(lotes[0].cantidad);
        const cantidadSiguiente = cantidadActual - cantidad;

        if (cantidadSiguiente < 0) {
            await conexion.rollback();
            return res.status(400).json({
                mensaje: `No hay existencias suficientes en el lote. Disponibles: ${cantidadActual}`
            });
        }

        await conexion.query(
            "UPDATE lotes SET cantidad = ? WHERE id = ?",
            [cantidadSiguiente, loteId]
        );
        const [resultado] = await conexion.query(
            `INSERT INTO movimientos (lote_id, usuario_id, tipo, cantidad, motivo)
             VALUES (?, ?, ?, ?, ?)`,
            [loteId, req.usuario.id, entrada.tipo, cantidad, motivo.trim() || null]
        );

        await conexion.commit();
        return res.status(201).json({
            mensaje: "Movimiento registrado",
            id: resultado.insertId,
            existencia: cantidadSiguiente
        });
    } catch (error) {
        if (conexion) {
            try {
                await conexion.rollback();
            } catch (errorRollback) {
                console.error("Error al revertir la transacción del movimiento:", errorRollback.message);
            }
        }
        console.error("Error al registrar movimiento:", error.message);
        return res.status(500).json({ mensaje: "Error al registrar movimiento" });
    } finally {
        if (conexion) {
            conexion.release();
        }
    }
});

module.exports = router;
