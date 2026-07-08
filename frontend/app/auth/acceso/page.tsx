"use client";

import React, { useState } from "react";
import styles from "./login.module.css";

// Hardcoded basePath para evitar dependencia del módulo interno de next-auth/react
const AUTH_BASE = "/reportesmba/api/auth";

export default function LoginPage() {
  const [cedula, setCedula] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // 1. Obtener token CSRF desde el endpoint correcto
      const csrfRes = await fetch(`${AUTH_BASE}/csrf`);
      const { csrfToken } = await csrfRes.json();

      // 2. Enviar credenciales al callback correcto
      const res = await fetch(`${AUTH_BASE}/callback/credentials`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-Auth-Return-Redirect": "1",
        },
        body: new URLSearchParams({
          csrfToken,
          cedula,
          password,
          callbackUrl: `${window.location.origin}/reportesmba/panel`,
          json: "true",
        }),
      });

      const data = await res.json();

      // Verificar si hubo error de autenticación
      if (data.url) {
        try {
          const urlObj = new URL(data.url);
          if (urlObj.searchParams.get("error")) {
            setError("Cédula o contraseña incorrectas. Por favor, verifique sus datos.");
            return;
          }
        } catch {
          // URL parsing failed, continue
        }
      }

      if (!res.ok) {
        setError("Cédula o contraseña incorrectas. Por favor, verifique sus datos.");
      } else {
        // Redirección completa del navegador (no client-side router):
        // fuerza documento fresco del servidor y evita payloads RSC cacheados por el CDN
        window.location.assign("/reportesmba/panel");
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
            <img src="/reportesmba/logo.svg" alt="Novicompu Logo" style={{ width: "240px", height: "auto" }} />
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
