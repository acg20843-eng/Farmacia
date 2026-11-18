
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../../services/api";

export default function Login() {
  const navigate = useNavigate();

  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setCargando(true);

    try {
      const datos = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({ correo, password })
      });

      localStorage.setItem("token", datos.token);
      localStorage.setItem("usuario", JSON.stringify(datos.usuario));
      navigate("/dashboard");
    } catch (error) {
      setError(
        error instanceof TypeError
          ? "No se pudo conectar con el servidor"
          : error.message
      );
    } finally {
      setCargando(false);
    }
  }

  return (
    <main>
      <h1>Farmacia Dulce María</h1>
      <h2>Iniciar sesión</h2>

      <form onSubmit={handleSubmit}>
        <label htmlFor="correo">Correo electrónico</label>
        <input
          id="correo"
          name="correo"
          type="email"
          autoComplete="username"
          value={correo}
          onChange={(event) => setCorreo(event.target.value)}
          required
        />

        <label htmlFor="password">Contraseña</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />

        {error && <p role="alert">{error}</p>}

        <button type="submit" disabled={cargando}>
          {cargando ? "Ingresando..." : "Ingresar"}
        </button>
      </form>
    </main>
  );
}
