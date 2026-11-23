const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/database");
const normalizarRol = require("../utils/roles");

const router = express.Router();

async function autenticarGestorUsuarios(req, res, next) {
    const autorizacion = req.headers.authorization || "";
    const [esquema, token] = autorizacion.split(" ");

    if (esquema !== "Bearer" || !token) {
        return res.status(401).json({
            mensaje: "Debes iniciar sesión para administrar usuarios"
        });
    }

    if (!process.env.JWT_SECRET) {
        console.error("Falta configurar JWT_SECRET");
        return res.status(500).json({
            mensaje: "Error de configuración del servidor"
        });
    }

    try {
        req.usuario = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
        return res.status(401).json({
            mensaje: "La sesión no es válida o ha expirado"
        });
    }

    if (!Number.isSafeInteger(Number(req.usuario.id)) || Number(req.usuario.id) < 1) {
        return res.status(403).json({
            mensaje: "La sesión no es válida o ha expirado"
        });
    }

    try {
        const [usuarios] = await db.query(
            "SELECT rol, activo FROM usuarios WHERE id = ? LIMIT 1",
            [req.usuario.id]
        );

        if (usuarios.length === 0 || Number(usuarios[0].activo) !== 1) {
            return res.status(401).json({
                mensaje: "La sesión no es válida o ha expirado"
            });
        }

        const rol = normalizarRol(usuarios[0].rol);

        if (!["administrador", "dueno"].includes(rol)) {
            return res.status(403).json({
                mensaje: "No tienes permiso para administrar usuarios"
            });
        }

        req.usuario.rol = rol;
        return next();
    } catch (error) {
        console.error("Error al verificar permisos de usuario:", error.message);
        return res.status(500).json({
            mensaje: "Error al verificar permisos"
        });
    }
}

router.use(autenticarGestorUsuarios);

//Listar usuarios
router.get("/", async (req, res) => {
    try {
        const [usuarios] = await db.query(
            `SELECT id, nombre, correo, rol, activo
             FROM usuarios
             ORDER BY nombre ASC`
        );

        return res.json({
            usuarios: usuarios.map((usuario) => ({
                ...usuario,
                rol: normalizarRol(usuario.rol)
            }))
        });
    } catch (error) {
        console.error("Error al consultar usuarios:", error.message);
        return res.status(500).json({ mensaje: "Error al consultar usuarios" });
    }
});

//Agregar usuario
router.post("/", async (req, res) => {
    try {
        const { nombre, correo, password, activo } = req.body;
        const rol = normalizarRol(req.body?.rol);

        if (
            typeof nombre !== "string" ||
            typeof correo !== "string" ||
            typeof password !== "string" ||
            !nombre.trim() ||
            !correo.trim() ||
            !password
        ) {
            return res.status(400).json({
                mensaje: "Completa todos los campos obligatorios"
            });
        }

        const nombreLimpio = nombre.trim();
        const correoLimpio = correo.trim().toLowerCase();
        const estadoActivo = Number(activo);

        if (nombreLimpio.length > 100 || correoLimpio.length > 150) {
            return res.status(400).json({
                mensaje: "El nombre o correo supera la longitud permitida"
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                mensaje: "La contraseña debe tener al menos 8 caracteres"
            });
        }

        if (!["empleado", "dueno", "administrador"].includes(rol)) {
            return res.status(400).json({
                mensaje: "El rol seleccionado no es válido"
            });
        }

        if (req.usuario.rol !== "dueno" && rol === "dueno") {
            return res.status(403).json({
                mensaje: "Solo el Dueño puede asignar ese rol"
            });
        }

        if (!["0", "1"].includes(String(activo))) {
            return res.status(400).json({
                mensaje: "El estado seleccionado no es válido"
            });
        }

        const [existentes] = await db.query(
            "SELECT id FROM usuarios WHERE correo = ? LIMIT 1",
            [correoLimpio]
        );

        if (existentes.length > 0) {
            return res.status(409).json({
                mensaje: "Ya existe un usuario registrado con ese correo"
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const [resultado] = await db.query(
            `INSERT INTO usuarios (nombre, correo, password, rol, activo)
             VALUES (?, ?, ?, ?, ?)`,
            [nombreLimpio, correoLimpio, passwordHash, rol, estadoActivo]
        );

        return res.status(201).json({
            mensaje: "Usuario registrado correctamente",
            id: resultado.insertId
        });
    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                mensaje: "Ya existe un usuario registrado con ese correo"
            });
        }

        console.error("Error al registrar usuario:", error.message);
        return res.status(500).json({ mensaje: "Error al registrar usuario" });
    }
});

//Actualizar usuario
router.put("/:id", async (req, res) => {
    try {
        const id = Number(req.params.id);
    const { nombre, correo, password, activo } = req.body || {};
    const rol = normalizarRol(req.body?.rol);

        if (!Number.isSafeInteger(id) || id < 1) {
            return res.status(400).json({
                mensaje: "El usuario seleccionado no es válido"
            });
        }

        if (
            typeof nombre !== "string" ||
            typeof correo !== "string" ||
            !nombre.trim() ||
            !correo.trim() ||
            (password !== undefined && typeof password !== "string")
        ) {
            return res.status(400).json({
                mensaje: "Completa todos los campos obligatorios"
            });
        }

        const nombreLimpio = nombre.trim();
        const correoLimpio = correo.trim().toLowerCase();
        const estadoActivo = Number(activo);

        if (nombreLimpio.length > 100 || correoLimpio.length > 150) {
            return res.status(400).json({
                mensaje: "El nombre o correo supera la longitud permitida"
            });
        }

        if (password && password.length < 8) {
            return res.status(400).json({
                mensaje: "La contraseña debe tener al menos 8 caracteres"
            });
        }

        if (!["empleado", "dueno", "administrador"].includes(rol)) {
            return res.status(400).json({
                mensaje: "El rol seleccionado no es válido"
            });
        }

        if (!["0", "1"].includes(String(activo))) {
            return res.status(400).json({
                mensaje: "El estado seleccionado no es válido"
            });
        }

        const [usuarios] = await db.query(
            "SELECT id, rol FROM usuarios WHERE id = ? LIMIT 1",
            [id]
        );

        if (usuarios.length === 0) {
            return res.status(404).json({
                mensaje: "No se encontró el usuario"
            });
        }

        const rolUsuario = normalizarRol(usuarios[0].rol);

        if (req.usuario.rol === "dueno" && Number(req.usuario.id) === id) {
            return res.status(403).json({
                mensaje: "No puedes modificar tu propia cuenta"
            });
        }

        if (rolUsuario === "dueno" && req.usuario.rol !== "dueno") {
            return res.status(403).json({
                mensaje: "Solo el Dueño puede modificar su cuenta"
            });
        }

        let promocionInicialDeDueno = false;
        if (req.usuario.rol !== "dueno" && rol === "dueno") {
            const [duenos] = await db.query(
                `SELECT id FROM usuarios
                 WHERE REPLACE(LOWER(TRIM(rol)), 'ñ', 'n') = 'dueno'
                 LIMIT 1`
            );
            promocionInicialDeDueno =
                req.usuario.rol === "administrador" &&
                Number(req.usuario.id) === id &&
                rolUsuario === "administrador" &&
                duenos.length === 0;

            if (!promocionInicialDeDueno) {
                return res.status(403).json({
                    mensaje: "Solo el Dueño puede asignar ese rol"
                });
            }
        }

        if (
            Number(req.usuario.id) === id &&
            ["administrador", "dueno"].includes(rolUsuario) &&
            rol !== rolUsuario &&
            !promocionInicialDeDueno
        ) {
            return res.status(403).json({
                mensaje: "No puedes cambiar el rol de tu propia cuenta"
            });
        }

        const passwordHash = password
            ? await bcrypt.hash(password, 10)
            : null;

        const [resultado] = await db.query(
            `UPDATE usuarios
             SET nombre = ?, correo = ?, password = COALESCE(?, password),
                 rol = ?, activo = ?
             WHERE id = ?
               AND (? = 'dueno' OR REPLACE(LOWER(TRIM(rol)), 'ñ', 'n') <> 'dueno')`,
            [nombreLimpio, correoLimpio, passwordHash, rol, estadoActivo, id, req.usuario.rol]
        );

        if (!resultado.affectedRows && req.usuario.rol !== "dueno") {
            const [usuarioActualizado] = await db.query(
                "SELECT rol FROM usuarios WHERE id = ? LIMIT 1",
                [id]
            );

            if (usuarioActualizado.length === 0) {
                return res.status(404).json({
                    mensaje: "No se encontró el usuario"
                });
            }

            if (normalizarRol(usuarioActualizado[0].rol) === "dueno") {
                return res.status(403).json({
                    mensaje: "Solo el Dueño puede modificar su cuenta"
                });
            }
        }

        return res.json({
            mensaje: "Usuario actualizado correctamente",
            id
        });
    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                mensaje: "Ya existe un usuario registrado con ese correo"
            });
        }

        console.error("Error al actualizar usuario:", error.message);
        return res.status(500).json({ mensaje: "Error al actualizar usuario" });
    }
});

//Eliminar usuario
router.delete("/:id", async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isSafeInteger(id) || id < 1) {
            return res.status(400).json({
                mensaje: "El usuario seleccionado no es válido"
            });
        }

        if (Number(req.usuario.id) === id) {
            return res.status(403).json({
                mensaje: "No puedes eliminar tu propia cuenta"
            });
        }

        const [usuarios] = await db.query(
            "SELECT rol FROM usuarios WHERE id = ? LIMIT 1",
            [id]
        );

        if (usuarios.length === 0) {
            return res.status(404).json({
                mensaje: "No se encontró el usuario"
            });
        }

        const rolObjetivo = normalizarRol(usuarios[0].rol);

        if (rolObjetivo === "dueno" && req.usuario.rol !== "dueno") {
            return res.status(403).json({
                mensaje: "Solo el Dueño puede eliminar su cuenta"
            });
        }

        if (rolObjetivo === "administrador" && req.usuario.rol !== "dueno") {
            return res.status(403).json({
                mensaje: "Solo el Dueño puede eliminar cuentas administradoras"
            });
        }

        const [resultado] = await db.query(
            `DELETE FROM usuarios
             WHERE id = ? AND id <> ?
               AND (? = 'dueno' OR REPLACE(LOWER(TRIM(rol)), 'ñ', 'n') <> 'dueno')
               AND (? = 'dueno' OR LOWER(TRIM(rol)) <> 'administrador')`,
            [id, req.usuario.id, req.usuario.rol, req.usuario.rol]
        );

        if (resultado.affectedRows === 0) {
            const [usuarios] = await db.query(
                "SELECT rol FROM usuarios WHERE id = ? LIMIT 1",
                [id]
            );

            if (usuarios.length === 0) {
                return res.status(404).json({
                    mensaje: "No se encontró el usuario"
                });
            }

            return res.status(403).json({
                mensaje: "No puedes eliminar tu propia cuenta"
            });
        }

        return res.json({ mensaje: "Usuario eliminado correctamente" });
    } catch (error) {
        console.error("Error al eliminar usuario:", error.message);
        return res.status(500).json({ mensaje: "Error al eliminar usuario" });
    }
});

module.exports = router;
