
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/database");
const normalizarRol = require("../utils/roles");

const router = express.Router();

// POST /api/auth/login
router.post("/login", async (req, res) => {
    try {
        const { correo, password } = req.body;

        // Validar campos
        if (!correo || !password) {
            return res.status(400).json({
                mensaje: "Ingresa tu correo y contraseña"
            });
        }

        if (!process.env.JWT_SECRET) {
            console.error("Falta configurar JWT_SECRET");
            return res.status(500).json({
                mensaje: "Error de configuración del servidor"
            });
        }

        // Buscar usuario por correo
        const [usuarios] = await db.query(
            `SELECT id, nombre, correo, password, rol, activo
             FROM usuarios
             WHERE correo = ?
             LIMIT 1`,
            [correo.trim().toLowerCase()]
        );

        if (usuarios.length === 0) {
            return res.status(401).json({
                mensaje: "Correo o contraseña incorrectos"
            });
        }

        const usuario = usuarios[0];
        const rol = normalizarRol(usuario.rol);

        // Comprobar si está activo
        if (Number(usuario.activo) !== 1) {
            return res.status(403).json({
                mensaje: "Tu cuenta está desactivada"
            });
        }

        // Comparar contraseña con el hash almacenado
        const passwordValida = await bcrypt.compare(
            password,
            usuario.password
        );

        if (!passwordValida) {
            return res.status(401).json({
                mensaje: "Correo o contraseña incorrectos"
            });
        }

        // Generar token de autenticación
        const token = jwt.sign(
            {
                id: usuario.id,
                rol
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "8h"
            }
        );

        // Responder sin exponer la contraseña
        return res.json({
            mensaje: "Inicio de sesión exitoso",
            token,
            usuario: {
                id: usuario.id,
                nombre: usuario.nombre,
                correo: usuario.correo,
                rol
            }
        });

    } catch (error) {
        console.error("Error al iniciar sesión:", error.message);

        return res.status(500).json({
            mensaje: "Error interno al iniciar sesión"
        });
    }
});

module.exports = router;
