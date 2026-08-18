"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import styles from "./DatePicker.module.css";

interface DatePickerProps {
  value: string; // "yyyy-MM-dd"
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  // "boxed" (por defecto): campo con borde/fondo propio, como un input
  // normal. "plain": sin caja - solo texto + icono chico, para vivir dentro
  // de una toolbar que ya tiene su propio contenedor/tarjeta.
  variant?: "boxed" | "plain";
}

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const DIAS_SEMANA = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"];

function toIso(y: number, m: number, d: number): string {
  const mm = String(m + 1).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

function parseIso(iso: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]) - 1, d: Number(match[3]) };
}

function formatDisplay(iso: string): string {
  const parsed = parseIso(iso);
  if (!parsed) return "";
  return `${String(parsed.d).padStart(2, "0")}/${String(parsed.m + 1).padStart(2, "0")}/${parsed.y}`;
}

// Lunes como primer dia de la semana (convencion local), a diferencia del
// getDay() nativo de JS que arranca en domingo.
function primerDiaSemanaLunes(y: number, m: number): number {
  const dow = new Date(y, m, 1).getDay();
  return (dow + 6) % 7;
}

function diasEnMes(y: number, m: number): number {
  return new Date(y, m + 1, 0).getDate();
}

/** Selector de fecha "a la mano" (selects de anio/mes + grilla de dias) que
 *  reemplaza el input date nativo del navegador - mismo formato yyyy-MM-dd
 *  de entrada/salida para no tocar el resto del flujo (fetch, Excel, PDF).
 *  Sin dependencias externas, solo CSS Modules + framer-motion, igual que
 *  el resto de la app. */
export function DatePicker({ value, onChange, disabled, placeholder, variant = "boxed" }: DatePickerProps) {
  const [abierto, setAbierto] = useState(false);
  const hoy = useMemo(() => new Date(), []);
  const seleccion = parseIso(value);
  const [vistaAnio, setVistaAnio] = useState(seleccion?.y ?? hoy.getFullYear());
  const [vistaMes, setVistaMes] = useState(seleccion?.m ?? hoy.getMonth());
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const s = parseIso(value);
    setVistaAnio(s?.y ?? hoy.getFullYear());
    setVistaMes(s?.m ?? hoy.getMonth());
  }, [abierto, value, hoy]);

  useEffect(() => {
    if (!abierto) return;
    const onClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setAbierto(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setAbierto(false); };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEsc);
    };
  }, [abierto]);

  const anios = useMemo(() => {
    const base = hoy.getFullYear();
    return Array.from({ length: 12 }, (_, i) => base - 8 + i);
  }, [hoy]);

  const celdas = useMemo(() => {
    const offset = primerDiaSemanaLunes(vistaAnio, vistaMes);
    const totalDias = diasEnMes(vistaAnio, vistaMes);
    const mesAnterior = vistaMes === 0 ? 11 : vistaMes - 1;
    const anioAnterior = vistaMes === 0 ? vistaAnio - 1 : vistaAnio;
    const diasMesAnterior = diasEnMes(anioAnterior, mesAnterior);

    const out: { y: number; m: number; d: number; fuera: boolean }[] = [];
    for (let i = offset - 1; i >= 0; i--) {
      out.push({ y: anioAnterior, m: mesAnterior, d: diasMesAnterior - i, fuera: true });
    }
    for (let d = 1; d <= totalDias; d++) {
      out.push({ y: vistaAnio, m: vistaMes, d, fuera: false });
    }
    const mesSiguiente = vistaMes === 11 ? 0 : vistaMes + 1;
    const anioSiguiente = vistaMes === 11 ? vistaAnio + 1 : vistaAnio;
    let dSig = 1;
    while (out.length % 7 !== 0) {
      out.push({ y: anioSiguiente, m: mesSiguiente, d: dSig++, fuera: true });
    }
    return out;
  }, [vistaAnio, vistaMes]);

  const irMesAnterior = () => {
    if (vistaMes === 0) { setVistaMes(11); setVistaAnio((a) => a - 1); } else { setVistaMes((m) => m - 1); }
  };
  const irMesSiguiente = () => {
    if (vistaMes === 11) { setVistaMes(0); setVistaAnio((a) => a + 1); } else { setVistaMes((m) => m + 1); }
  };

  const seleccionar = (y: number, m: number, d: number) => {
    onChange(toIso(y, m, d));
    setAbierto(false);
  };

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button
        type="button"
        className={[
          styles.trigger,
          variant === "plain" ? styles.triggerPlain : "",
          abierto ? styles.triggerOpen : "",
        ].filter(Boolean).join(" ")}
        onClick={() => !disabled && setAbierto((v) => !v)}
        disabled={disabled}
      >
        <span className={value ? undefined : styles.triggerPlaceholder}>
          {value ? formatDisplay(value) : placeholder ?? "Seleccionar fecha"}
        </span>
        <svg className={styles.triggerIcon} width="15" height="15" viewBox="0 0 20 20" fill="none">
          <rect x="3" y="4.5" width="14" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
          <path d="M3 8h14" stroke="currentColor" strokeWidth="1.4" />
          <path d="M6.5 3v3M13.5 3v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>

      <AnimatePresence>
        {abierto && (
          <motion.div
            className={styles.popover}
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            <div className={styles.header}>
              <button type="button" className={styles.navBtn} onClick={irMesAnterior} aria-label="Mes anterior">‹</button>
              <select
                className={`${styles.headerSelect} ${styles.monthSelect}`}
                value={vistaMes}
                onChange={(e) => setVistaMes(Number(e.target.value))}
              >
                {MESES.map((nombre, i) => (
                  <option key={nombre} value={i}>{nombre}</option>
                ))}
              </select>
              <select
                className={`${styles.headerSelect} ${styles.yearSelect}`}
                value={vistaAnio}
                onChange={(e) => setVistaAnio(Number(e.target.value))}
              >
                {anios.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <button type="button" className={styles.navBtn} onClick={irMesSiguiente} aria-label="Mes siguiente">›</button>
            </div>

            <div className={styles.weekRow}>
              {DIAS_SEMANA.map((d) => (
                <span key={d} className={styles.weekday}>{d}</span>
              ))}
            </div>

            <div className={styles.daysGrid}>
              {celdas.map((c, i) => {
                const esSeleccionado = !!seleccion && seleccion.y === c.y && seleccion.m === c.m && seleccion.d === c.d;
                const esHoy = hoy.getFullYear() === c.y && hoy.getMonth() === c.m && hoy.getDate() === c.d;
                return (
                  <button
                    key={`${c.y}-${c.m}-${c.d}-${i}`}
                    type="button"
                    className={[
                      styles.dayCell,
                      c.fuera ? styles.dayOutside : "",
                      esHoy ? styles.dayToday : "",
                      esSeleccionado ? styles.daySelected : "",
                    ].filter(Boolean).join(" ")}
                    onClick={() => seleccionar(c.y, c.m, c.d)}
                  >
                    {c.d}
                  </button>
                );
              })}
            </div>

            <div className={styles.footer}>
              <button
                type="button"
                className={styles.todayBtn}
                onClick={() => seleccionar(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())}
              >
                Hoy
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default DatePicker;
