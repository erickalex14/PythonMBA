"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import styles from "./GooeySearchBar.module.css";

interface GooeySearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  collapsedLabel?: string;
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 15 15" fill="currentColor">
      <path
        d="M10 6.5C10 8.433 8.433 10 6.5 10C4.567 10 3 8.433 3 6.5C3 4.567 4.567 3 6.5 3C8.433 3 10 4.567 10 6.5ZM9.30884 10.0159C8.53901 10.6318 7.56251 11 6.5 11C4.01472 11 2 8.98528 2 6.5C2 4.01472 4.01472 2 6.5 2C8.98528 2 11 4.01472 11 6.5C11 7.56251 10.6318 8.53901 10.0159 9.30884L12.8536 12.1464C13.0488 12.3417 13.0488 12.6583 12.8536 12.8536C12.6583 13.0488 12.3417 13.0488 12.1464 12.8536L9.30884 10.0159Z"
        fillRule="evenodd"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 15 15" fill="none">
      <path d="M11.5 3.5l-8 8M3.5 3.5l8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** Barra de búsqueda animada (pastilla que se expande a input con spring) +
 *  botón circular de lupa afuera - la búsqueda solo se aplica (onChange) al
 *  click en la lupa o Enter, no en cada tecla: el texto se guarda en un
 *  borrador local mientras se escribe y recién se "commitea" al buscar. */
export function GooeySearchBar({ value, onChange, placeholder, collapsedLabel = "Buscar" }: GooeySearchBarProps) {
  const [expandido, setExpandido] = useState(!!value);
  const [borrador, setBorrador] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Si el valor aplicado cambia desde afuera (ej. se limpia el filtro en
  // otro lado), el borrador se resincroniza - mientras se escribe, "value"
  // no cambia (ya no se dispara en cada tecla), asi que esto no interrumpe.
  useEffect(() => { setBorrador(value); }, [value]);

  useEffect(() => {
    if (expandido) inputRef.current?.focus();
  }, [expandido]);

  useEffect(() => {
    if (!expandido) return;
    const onClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node) && !borrador) {
        setExpandido(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [expandido, borrador]);

  const buscar = () => onChange(borrador);

  const limpiar = () => {
    setBorrador("");
    onChange("");
    inputRef.current?.focus();
  };

  return (
    <div ref={wrapperRef} className={styles.wrapper}>
      <div className={styles.buttonContentInner}>
        <motion.div
          className={`${styles.searchBtn} ${expandido ? styles.searchBtnExpanded : ""}`}
          initial={false}
          animate={{ width: expandido ? 260 : 104 }}
          transition={{ duration: 0.4, type: "spring", bounce: 0.2 }}
          whileHover={expandido ? undefined : { scale: 1.04 }}
          whileTap={expandido ? undefined : { scale: 0.96 }}
          onClick={() => !expandido && setExpandido(true)}
          role={expandido ? undefined : "button"}
        >
          {!expandido ? (
            <span className={styles.searchText}>{collapsedLabel}</span>
          ) : (
            <>
              <input
                ref={inputRef}
                type="text"
                className={styles.searchInput}
                placeholder={placeholder ?? "Buscar..."}
                aria-label={placeholder ?? collapsedLabel}
                value={borrador}
                onChange={(e) => setBorrador(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") buscar();
                  else if (e.key === "Escape") { if (borrador) limpiar(); else setExpandido(false); }
                }}
              />
              {borrador && (
                <button type="button" className={styles.inlineClearBtn} onClick={limpiar} aria-label="Limpiar búsqueda">
                  <ClearIcon />
                </button>
              )}
            </>
          )}
        </motion.div>

        {expandido && (
          <motion.button
            type="button"
            className={styles.separateElement}
            onClick={buscar}
            aria-label="Buscar"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ delay: 0.1, duration: 0.3, type: "spring", bounce: 0.25 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
          >
            <SearchIcon />
          </motion.button>
        )}
      </div>
    </div>
  );
}

export default GooeySearchBar;
