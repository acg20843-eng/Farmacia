require("dotenv").config();

const bcrypt = require("bcryptjs");
const db = require("../config/database");

let ignoreNextLineFeed = false;

function preguntar(texto, oculto = false) {
    return new Promise((resolve, reject) => {
        const entrada = process.stdin;
        const salida = process.stdout;
        let respuesta = "";

        salida.write(texto);

        function alRecibirDato(datos) {
            for (const caracter of datos) {
                if (ignoreNextLineFeed && caracter === "\n") {
                    ignoreNextLineFeed = false;
                    continue;
                }
                ignoreNextLineFeed = false;

                if (caracter === "\u0003") {
                    entrada.removeListener("data", alRecibirDato);
                    return reject(new Error("Operación cancelada"));
                }

                if (caracter === "\r" || caracter === "\n") {
                    ignoreNextLineFeed = caracter === "\r";
                    entrada.removeListener("data", alRecibirDato);
                    salida.write("\n");
                    return resolve(respuesta);
                }

                if (caracter === "\u007f" || caracter === "\b") {
                    if (respuesta.length > 0) {
                        respuesta = Array.from(respuesta).slice(0, -1).join("");
                        salida.write(oculto ? "\b \b" : "\b \b");
                    }
                    continue;
                }

                if (caracter >= " ") {
                    respuesta += caracter;
                    salida.write(oculto ? "*" : caracter);
                }
            }
        }

        entrada.on("data", alRecibirDato);
    });
}

async function crearAdministrador() {
    if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
        throw new Error("Ejecuta este comando desde una terminal interactiva.");
    }

    process.stdin.setEncoding("utf8");
    process.stdin.setRawMode(true);
    process.stdin.resume();

    try {
        const [administradores] = await db.query(
            "SELECT id FROM usuarios WHERE rol = ? LIMIT 1",
            ["administrador"]
        );

        if (administradores.length > 0) {
            throw new Error("Ya existe una cuenta administradora. Inicia sesión con ella.");
        }

        const nombre = (await preguntar("Nombre del administrador: ")).trim();
        const correo = (await preguntar("Correo electrónico: ")).trim().toLowerCase();
        const password = await preguntar("Contraseña (mínimo 8 caracteres): ", true);
        const confirmarPassword = await preguntar("Confirma la contraseña: ", true);

        if (!nombre || nombre.length > 100) {
            throw new Error("El nombre es obligatorio y no debe superar los 100 caracteres.");
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) || correo.length > 150) {
            throw new Error("Ingresa un correo electrónico válido de hasta 150 caracteres.");
        }

        if (password.length < 8) {
            throw new Error("La contraseña debe tener al menos 8 caracteres.");
        }

        if (password !== confirmarPassword) {
            throw new Error("Las contraseñas no coinciden.");
        }

        const [usuariosExistentes] = await db.query(
            "SELECT id FROM usuarios WHERE correo = ? LIMIT 1",
            [correo]
        );

        if (usuariosExistentes.length > 0) {
            throw new Error("Ya existe una cuenta con ese correo electrónico.");
        }

        const passwordHash = await bcrypt.hash(password, 10);
        await db.query(
            `INSERT INTO usuarios (nombre, correo, password, rol, activo)
             VALUES (?, ?, ?, ?, 1)`,
            [nombre, correo, passwordHash, "administrador"]
        );

        console.log(`Administrador creado correctamente para ${correo}. Ya puedes iniciar sesión.`);
    } finally {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        await db.end();
    }
}

crearAdministrador().catch((error) => {
    console.error(`No se pudo crear el administrador: ${error.message}`);
    process.exitCode = 1;
});
