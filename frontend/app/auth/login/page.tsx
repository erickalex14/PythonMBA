"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import styles from "./login.module.css";

export default function LoginPage() {
  const [cedula, setCedula] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await signIn("credentials", {
        redirect: false,
        cedula,
        password,
      });

      if (res?.error) {
        setError("Cédula o contraseña incorrectas. Por favor, verifique sus datos.");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err) {
      setError("Ocurrió un error inesperado al intentar iniciar sesión.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.loginContainer}>
      <div className={styles.backgroundGlow}></div>
      <div className={styles.loginCard}>
        <div className={styles.cardHeader}>
          {/* Logotipo SVG oficial de Novicompu */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.5rem" }}>
            <img src="/logo.svg" alt="Novicompu Logo" style={{ width: "240px", height: "auto" }} />
          </div>
          <h1>Iniciar Sesión</h1>
          <p>Ingrese sus credenciales de acceso corporativo</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.errorMessage}>{error}</div>}

          <div className={styles.inputGroup}>
            <label htmlFor="cedula">Número de Cédula</label>
            <input
              type="text"
              id="cedula"
              placeholder="Ej. 1712345678"
              value={cedula}
              onChange={(e) => setCedula(e.target.value)}
              required
              disabled={loading}
              autoComplete="username"
            />
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="password">Contraseña</label>
            <input
              type="password"
              id="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? <span className={styles.spinner}></span> : "Iniciar Sesión"}
          </button>
        </form>

        <div className={styles.cardFooter}>
          <span>Novicompu BI Portal &copy; 2026</span>
        </div>
      </div>
    </div>
  );
}
