
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const db = require("./config/database");
const categoriasRoutes = require("./routes/categorias");
const productosRoutes = require("./routes/productos");
const authRoutes = require("./routes/auth");
const usuariosRoutes = require("./routes/usuarios");

const app = express();



app.use(cors());
app.use(express.json());
app.use("/api/categorias", categoriasRoutes);
app.use("/api/productos", productosRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/usuarios", usuariosRoutes);

// Ruta principal
app.get("/", (req, res) => {
    res.send("Servidor de Farmacia Dulce María funcionando");
});

// Comprobar conexión con MariaDB
app.get("/api/health/db", async (req, res) => {
    try {
        const [rows] = await db.query(
            "SELECT DATABASE() AS database_name"
        );

        res.json({
            conectado: true,
            mensaje: "Conexión con MariaDB exitosa",
            baseDatos: rows[0].database_name
        });

    } catch (error) {
        console.error("Error de conexión:", error.message);

        res.status(500).json({
            conectado: false,
            mensaje: "No se pudo conectar con la base de datos"
        });
    }
});

// Iniciar servidor
const PORT = 3000;

async function iniciarServidor() {
    try {
        const [rows] = await db.query("SELECT 1");

        console.log("Conexión con MariaDB exitosa");
        console.log(`Base de datos: ${process.env.DB_NAME}`);

        app.listen(PORT, () => {
            console.log(`Servidor funcionando en http://localhost:${PORT}`);
        });

    } catch (error) {
        console.error("Error al conectar con MariaDB:");
        console.error(error.message);
        process.exit(1);
    }
}

iniciarServidor();
