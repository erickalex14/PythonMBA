"use client";

import React, { useEffect, useState, useRef } from "react";

/**
 * NovBI — Login screen.
 */

const FONT = "'Helvetica Neue', Arial, sans-serif";

const KEYFRAMES = `
@keyframes novbi-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes novbi-fade-up { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
@keyframes novbi-grow-bar { from { transform: scaleY(0); } to { transform: scaleY(1); } }
@keyframes novbi-draw-line { to { stroke-dashoffset: 0; } }
@keyframes novbi-dot-in { from { opacity:0; transform:scale(0.4); } to { opacity:1; transform:scale(1); } }
@keyframes novbi-pulse-ring { 0% { transform:scale(0.6); opacity:0.55; } 100% { transform:scale(2.4); opacity:0; } }
@keyframes novbi-box-bounce {
  0% { transform: translateY(0) scale(1,1); }
  30% { transform: translateY(-14px) scale(1,1); }
  55% { transform: translateY(0) scale(1.1,0.88); }
  75% { transform: translateY(-4px) scale(0.97,1.04); }
  100% { transform: translateY(0) scale(1,1); }
}
`;

const BAR_HEIGHTS = [58, 92, 40, 130, 70, 110, 150];
const LINE_POINTS: [number, number][] = [
  [8, 150], [56, 110], [104, 160], [152, 70], [200, 95], [248, 45], [296, 75], [340, 20],
];
const LINE_PATH = "M8,150 L56,110 L104,160 L152,70 L200,95 L248,45 L296,75 L340,20";
const FEATURES = ["Reportes actualizados en tiempo real", "Indicadores clave centralizados"];

function validateCedula(v: string): string {
  if (!v) return "Ingresa tu número de cédula.";
  if (!/^\d{10}$/.test(v)) return "La cédula debe tener 10 dígitos numéricos.";
  return "";
}
function validatePassword(v: string): string {
  if (!v) return "Ingresa tu contraseña.";
  if (v.length < 6) return "Debe tener al menos 6 caracteres.";
  return "";
}

// Hardcoded basePath para evitar dependencia del módulo interno de next-auth/react
const AUTH_BASE = "/reportesmba/api/auth";

export default function NovBILogin() {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 900 : false
  );
  const [cedula, setCedula] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [cedulaError, setCedulaError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loginErrorMsg, setLoginErrorMsg] = useState("");
  const [barDrag, setBarDrag] = useState<{ index: number; y: number } | null>(null);
  const [logoHover, setLogoHover] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 900);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const inputBase: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    padding: "13px 14px",
    fontFamily: FONT,
    fontSize: 15,
    color: "#0a0a0a",
    background: "#ffffff",
    border: "1px solid #d1d5db",
    borderRadius: 8,
    outline: "none",
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cErr = validateCedula(cedula);
    const pErr = validatePassword(password);
    setCedulaError(cErr);
    setPasswordError(pErr);
    setLoginErrorMsg("");
    if (cErr || pErr) return;

    setSubmitting(true);
    try {
      const csrfRes = await fetch(`${AUTH_BASE}/csrf`);
      const { csrfToken } = await csrfRes.json();

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

      if (data.url) {
        try {
          const urlObj = new URL(data.url);
          if (urlObj.searchParams.get("error")) {
            setLoginErrorMsg("Cédula o contraseña incorrectas. Verifica tus datos e intenta de nuevo.");
            setSubmitting(false);
            return;
          }
        } catch {
          // URL parsing failed, continue
        }
      }

      if (!res.ok) {
        setLoginErrorMsg("Cédula o contraseña incorrectas. Verifica tus datos e intenta de nuevo.");
        setSubmitting(false);
      } else {
        // Redirección completa del navegador (no client-side router):
        // fuerza documento fresco del servidor y evita payloads RSC cacheados por el CDN
        window.location.assign("/reportesmba/panel");
      }
    } catch {
      setLoginErrorMsg("Ocurrió un error inesperado al intentar iniciar sesión.");
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", minHeight: "100vh", width: "100%", fontFamily: FONT }}>
      <style>{KEYFRAMES}</style>

      {/* Brand panel */}
      <div
        style={{
          position: "relative",
          flex: isMobile ? "none" : "0 0 52%",
          minHeight: isMobile ? 260 : "100vh",
          background: "#0a0a0a",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: isMobile ? "32px 32px 24px" : "56px 64px",
          overflow: "hidden",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
            pointerEvents: "none",
          }}
        />

        <div style={{ position: "relative", zIndex: 1 }}>
          <div
            style={{ display: "flex", alignItems: "center", gap: 14, animation: "novbi-fade-up 0.7s ease-out both", cursor: "pointer" }}
            onMouseEnter={() => setLogoHover(true)}
            onMouseLeave={() => setLogoHover(false)}
          >
            <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 34, letterSpacing: "-0.01em", color: "#ffffff", lineHeight: 1 }}>NOV</div>
            <div style={{ width: 2, height: 30, background: "#ffffff", opacity: 0.5 }} />
            <div
              style={{
                background: "#ffffff",
                padding: "4px 10px",
                display: "flex",
                alignItems: "center",
                transformOrigin: "center bottom",
                animation: logoHover ? "novbi-box-bounce 0.55s cubic-bezier(.34,1.56,.64,1) both" : undefined,
              } as React.CSSProperties}
            >
              <div style={{ fontFamily: FONT, fontWeight: 300, fontSize: 34, letterSpacing: "-0.015em", color: "#0a0a0a", lineHeight: 1 }}>BI</div>
            </div>
          </div>

          <div style={{ marginTop: 44, display: "flex", flexDirection: "column", gap: 18 }}>
            {FEATURES.map((text, i) => (
              <div key={text} style={{ display: "flex", alignItems: "center", gap: 12, animation: `novbi-fade-up 0.6s ease-out ${(0.3 + i * 0.1).toFixed(2)}s both` }}>
                <div style={{ flex: "none", width: 7, height: 7, background: "#ffffff", opacity: 0.55, marginTop: 1 }} />
                <div style={{ fontFamily: FONT, fontSize: 15, color: "#ffffff", opacity: 0.8, lineHeight: 1.4 }}>{text}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: "relative", zIndex: 1, display: isMobile ? "none" : "flex", alignItems: "center", justifyContent: "center", flex: 1 }}>
          <svg
            viewBox="0 0 360 220"
            width="100%"
            height={220}
            style={{ maxWidth: 420, overflow: "visible" }}
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const scale = Math.min(rect.width / 360, rect.height / 220);
              const offsetX = (rect.width - 360 * scale) / 2;
              const offsetY = (rect.height - 220 * scale) / 2;
              const svgX = (e.clientX - rect.left - offsetX) / scale;
              const svgY = (e.clientY - rect.top - offsetY) / scale;
              const index = Math.max(0, Math.min(BAR_HEIGHTS.length - 1, Math.floor((svgX - 4) / 48)));
              setBarDrag({ index, y: Math.max(15, Math.min(195, svgY)) });
            }}
            onMouseLeave={() => setBarDrag(null)}
          >
            <line x1={0} y1={200} x2={360} y2={200} stroke="#ffffff" strokeOpacity={0.18} strokeWidth={1} />
            {BAR_HEIGHTS.map((barH, i) => {
              const dragged = barDrag?.index === i;
              const top = dragged ? barDrag!.y : 200 - barH;
              const height = 200 - top;
              return (
                <rect
                  key={i}
                  x={i * 48 + 4}
                  y={top}
                  width={28}
                  height={height}
                  fill="#ffffff"
                  fillOpacity={dragged ? 1 : 0.22 + (i % 3) * 0.12}
                  rx={2}
                  style={{
                    transformBox: "fill-box",
                    transformOrigin: "bottom",
                    animation: `novbi-grow-bar 0.6s cubic-bezier(.2,.8,.2,1) ${(0.15 + i * 0.06).toFixed(2)}s both`,
                    filter: dragged ? "brightness(1.8) drop-shadow(0 0 8px rgba(255,255,255,0.75))" : "none",
                    transition: dragged
                      ? "filter 0.15s ease"
                      : "y 0.35s cubic-bezier(.2,.8,.2,1), height 0.35s cubic-bezier(.2,.8,.2,1), filter 0.2s ease, fill-opacity 0.2s ease",
                  } as React.CSSProperties}
                />
              );
            })}
            <path
              d={LINE_PATH}
              fill="none"
              stroke="#ffffff"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ strokeDasharray: 520, strokeDashoffset: 520, animation: "novbi-draw-line 1.4s ease-out 0.7s forwards" } as React.CSSProperties}
            />
            {LINE_POINTS.map(([x, y], i) => (
              <circle
                key={i}
                cx={x}
                cy={y}
                r={4.5}
                fill="#0a0a0a"
                stroke="#ffffff"
                strokeWidth={2.5}
                style={{ opacity: 0, animation: `novbi-dot-in 0.4s ease-out ${(1.0 + i * 0.09).toFixed(2)}s forwards` } as React.CSSProperties}
              />
            ))}
            <circle
              cx={340}
              cy={20}
              r={4.5}
              fill="none"
              stroke="#ffffff"
              strokeWidth={1.6}
              style={{ transformBox: "fill-box", transformOrigin: "center", opacity: 0, animation: "novbi-pulse-ring 1.8s ease-out 1.7s infinite" } as React.CSSProperties}
            />
          </svg>
        </div>

        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 26, color: "#ffffff", lineHeight: 1.35, maxWidth: 380, animation: "novbi-fade-up 0.7s ease-out 0.15s both" }}>
            Inteligencia de negocio, en tiempo real.
          </div>
          <div style={{ fontFamily: FONT, fontWeight: 400, fontSize: 15, color: "#ffffff", opacity: 0.55, marginTop: 14, animation: "novbi-fade-up 0.7s ease-out 0.25s both" }}>
            Novisolutions Cia. Ltda. Business Intelligence © 2026
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div
        style={{
          flex: "1 1 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: isMobile ? "40px 24px" : 40,
          background: "#f9fafb",
          boxSizing: "border-box",
        }}
      >
        <div style={{ width: "100%", maxWidth: 400 }}>
          <div style={{ marginBottom: 36, animation: "novbi-fade-up 0.6s ease-out both" }}>
            <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 30, color: "#0a0a0a", letterSpacing: "-0.01em" }}>Iniciar sesión</div>
            <div style={{ fontFamily: FONT, fontWeight: 400, fontSize: 15, color: "#6b7280", marginTop: 8 }}>
              Ingresa tus credenciales de acceso corporativo
            </div>
          </div>

          {loginErrorMsg && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "12px 14px", marginBottom: 22 }}>
              <svg width={18} height={18} viewBox="0 0 20 20" fill="none" style={{ flex: "none", marginTop: 2 }}>
                <circle cx={10} cy={10} r={9} stroke="#dc2626" strokeWidth={1.6} />
                <line x1={10} y1={6} x2={10} y2={11} stroke="#dc2626" strokeWidth={1.6} strokeLinecap="round" />
                <circle cx={10} cy={14} r={1} fill="#dc2626" />
              </svg>
              <div style={{ fontFamily: FONT, fontSize: 14, color: "#991b1b", lineHeight: 1.4 }}>
                {loginErrorMsg}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ animation: "novbi-fade-up 0.6s ease-out 0.1s both" }}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontFamily: FONT, fontWeight: 700, fontSize: 12, letterSpacing: "0.06em", color: "#374151", marginBottom: 8 }}>
                NÚMERO DE CÉDULA
              </label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="Ej. 1712345678"
                value={cedula}
                autoComplete="username"
                disabled={submitting}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^\d]/g, "").slice(0, 10);
                  setCedula(v);
                  setCedulaError("");
                  setLoginErrorMsg("");
                }}
                onBlur={() => setCedulaError(validateCedula(cedula))}
                style={{ ...inputBase, borderColor: cedulaError ? "#dc2626" : "#d1d5db" }}
              />
              {cedulaError && <div style={{ fontFamily: FONT, fontSize: 13, color: "#dc2626", marginTop: 6 }}>{cedulaError}</div>}
            </div>

            <div style={{ marginBottom: 8 }}>
              <label style={{ display: "block", fontFamily: FONT, fontWeight: 700, fontSize: 12, letterSpacing: "0.06em", color: "#374151", marginBottom: 8 }}>
                CONTRASEÑA
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  autoComplete="current-password"
                  disabled={submitting}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setPasswordError("");
                    setLoginErrorMsg("");
                  }}
                  onBlur={() => setPasswordError(validatePassword(password))}
                  style={{ ...inputBase, paddingRight: 46, borderColor: passwordError ? "#dc2626" : "#d1d5db" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center" }}
                >
                  {showPassword ? (
                    <svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" stroke="#6b7280" strokeWidth={1.6} />
                      <circle cx={12} cy={12} r={3} stroke="#6b7280" strokeWidth={1.6} />
                    </svg>
                  ) : (
                    <svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                      <path d="M3 3l18 18" stroke="#6b7280" strokeWidth={1.6} strokeLinecap="round" />
                      <path d="M10.6 5.2C11 5.1 11.5 5 12 5c6.5 0 10 7 10 7a13.4 13.4 0 0 1-3.1 3.9M6.5 6.5C4 8.2 2 12 2 12s3.5 7 10 7c1.4 0 2.6-.3 3.7-.8" stroke="#6b7280" strokeWidth={1.6} strokeLinecap="round" />
                      <path d="M9.5 10a3 3 0 0 0 4.2 4.2" stroke="#6b7280" strokeWidth={1.6} />
                    </svg>
                  )}
                </button>
              </div>
              {passwordError && <div style={{ fontFamily: FONT, fontSize: 13, color: "#dc2626", marginTop: 6 }}>{passwordError}</div>}
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 9, margin: "18px 0 26px" }}>
              <input
                type="checkbox"
                id="novbi-remember"
                checked={remember}
                onChange={() => setRemember((r) => !r)}
                style={{ width: 16, height: 16, accentColor: "#1c3f66", cursor: "pointer" }}
              />
              <label htmlFor="novbi-remember" style={{ fontFamily: FONT, fontSize: 14, color: "#374151", cursor: "pointer", userSelect: "none", flex: 1 }}>
                Recordarme en este dispositivo
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                padding: 14,
                fontFamily: FONT,
                fontWeight: 700,
                fontSize: 15,
                color: "#ffffff",
                background: submitting ? "#1c3f66" : "#000000",
                border: "none",
                borderRadius: 8,
                cursor: submitting ? "default" : "pointer",
                boxSizing: "border-box",
              }}
            >
              {submitting && (
                <span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.35)", borderTopColor: "#ffffff", borderRadius: "50%", display: "inline-block", animation: "novbi-spin 0.7s linear infinite" }} />
              )}
              <span>{submitting ? "Verificando…" : "Iniciar sesión"}</span>
            </button>
          </form>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 32, animation: "novbi-fade-up 0.6s ease-out 0.2s both" }}>
            <svg width={14} height={14} viewBox="0 0 20 20" fill="none">
              <rect x={4} y={9} width={12} height={9} rx={1.5} stroke="#9ca3af" strokeWidth={1.4} />
              <path d="M6.5 9V6.5a3.5 3.5 0 0 1 7 0V9" stroke="#9ca3af" strokeWidth={1.4} />
            </svg>
            <div style={{ fontFamily: FONT, fontSize: 13, color: "#9ca3af" }}>Conexión segura y cifrada</div>
          </div>

          <div style={{ textAlign: "center", marginTop: 14, animation: "novbi-fade-up 0.6s ease-out 0.25s both" }}>
            <a href="#" style={{ fontFamily: FONT, fontSize: 13, color: "#1c3f66", textDecoration: "none" }}>
              ¿Problemas para ingresar? Contacta a soporte
            </a>
          </div>

          <div style={{ textAlign: "center", fontFamily: FONT, fontSize: 13, color: "#9ca3af", marginTop: 20, animation: "novbi-fade-up 0.6s ease-out 0.3s both" }}>
            Novisolutions Cia. Ltda. Business Intelligence © 2026
          </div>
        </div>
      </div>
    </div>
  );
}
