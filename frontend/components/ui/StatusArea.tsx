import React from "react";

// Icono por defecto de EmptyState (circulo con "!") - antes cada pantalla
// repetia este SVG a mano y algunas se lo saltaban, asi que un mismo estado
// se veia distinto segun la pagina (Movimientos con icono, KPI sin icono).
function DefaultEmptyIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

/** Estado de carga: mismo spinner + mensaje en todas las pantallas.
 *  role="status"/aria-busy avisan a lectores de pantalla sin que el usuario
 *  tenga que estar mirando el spinner. */
export function LoadingState({
  styles,
  label = "Cargando...",
  children,
}: {
  styles: Record<string, string>;
  label?: string;
  // Contenido extra debajo del mensaje (ej. boton "Cancelar" en consultas largas).
  children?: React.ReactNode;
}) {
  return (
    <div className={styles.loaderArea} role="status" aria-live="polite" aria-busy="true">
      <div className={styles.spinner}></div>
      <p>{label}</p>
      {children}
    </div>
  );
}

/** Estado sin datos: icono + mensaje consistentes. El icono es opcional
 *  (algunas pantallas como KPI usan solo texto para un aviso, no un "sin
 *  resultados") - pasar icon={null} lo omite. */
export function EmptyState({
  styles,
  message,
  icon,
}: {
  styles: Record<string, string>;
  message: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className={styles.noDataArea}>
      {icon !== null && <div style={{ marginBottom: "0.6rem" }}>{icon ?? <DefaultEmptyIcon />}</div>}
      <p>{message}</p>
    </div>
  );
}
