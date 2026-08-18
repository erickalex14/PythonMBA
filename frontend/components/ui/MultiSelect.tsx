"use client";

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import styles from "./MultiSelect.module.css";

interface MultiSelectProps {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
}

function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
      <path d="M2 6.2l2.6 2.6L10 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Dropdown de selección múltiple con checkboxes - reemplaza el <select>
 *  nativo (single-select) en filtros donde tiene sentido combinar varias
 *  opciones a la vez (ej. varias marcas/sucursales/vendedores). Mismo look
 *  del resto de los filtros (misma caja/borde que .selectFilter). */
export function MultiSelect({ options, selected, onChange, placeholder = "Todas..." }: MultiSelectProps) {
  const [abierto, setAbierto] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

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

  const toggle = (opt: string) => {
    onChange(selected.includes(opt) ? selected.filter((o) => o !== opt) : [...selected, opt]);
  };

  const triggerLabel = selected.length === 0
    ? placeholder
    : selected.length === 1
      ? selected[0]
      : `${selected.length} seleccionadas`;

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button
        type="button"
        className={`${styles.trigger} ${abierto ? styles.triggerOpen : ""}`}
        onClick={() => setAbierto((v) => !v)}
      >
        <span className={`${styles.triggerLabel} ${selected.length === 0 ? styles.triggerPlaceholder : ""}`}>
          {triggerLabel}
        </span>
        {selected.length > 0 && <span className={styles.triggerCount}>{selected.length}</span>}
        <svg
          className={`${styles.triggerIcon} ${abierto ? styles.triggerIconOpen : ""}`}
          width="12" height="12" viewBox="0 0 20 20" fill="none"
        >
          <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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
            {options.length > 0 && selected.length > 0 && (
              <div className={styles.popoverActions}>
                {/* Sin selección = sin filtro = todas, ya cubierto por el estado
                    vacío - un botón "seleccionar todas" sería redundante con
                    "Limpiar" y sólo agregaría un estado idéntico con más pasos. */}
                <button type="button" className={styles.popoverActionBtn} onClick={() => onChange([])}>
                  Limpiar selección
                </button>
              </div>
            )}
            <div className={styles.popoverList}>
              {options.length === 0 ? (
                <p className={styles.emptyState}>Sin opciones disponibles.</p>
              ) : (
                options.map((opt) => {
                  const checked = selected.includes(opt);
                  return (
                    <div key={opt} className={styles.optionRow} onClick={() => toggle(opt)}>
                      <span className={`${styles.checkbox} ${checked ? styles.checkboxChecked : ""}`}>
                        {checked && <CheckIcon />}
                      </span>
                      <span>{opt}</span>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default MultiSelect;
