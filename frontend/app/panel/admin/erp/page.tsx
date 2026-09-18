"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import styles from "../../dashboard.module.css";
import { Button } from "../../../../components/ui/Button";
import { Card } from "../../../../components/ui/Card";

export default function AdminErpPage() {
  const [savingConfig, setSavingConfig] = useState(false);

  const [erpConfig, setErpConfig] = useState({
    env: "PRUEBAS",
    base_url_test: "",
    codigo_servicio_test: "",
    password_servicio_test: "",
    base_url_prod: "",
    codigo_servicio_prod: "",
    password_servicio_prod: ""
  });

  useEffect(() => {
    fetch("/api/admin/config")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json && json.env) setErpConfig(json);
      })
      .catch((err) => console.error("Error al cargar configuración ERP", err));
  }, []);

  const handleSaveErpConfig = async () => {
    setSavingConfig(true);
    try {
      const res = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(erpConfig)
      });
      if (!res.ok) {
        const txt = await res.text();
        alert(`Error al guardar configuración: ${txt}`);
      } else {
        alert("Configuración guardada de manera persistente en .env con éxito.");
      }
    } catch (err: any) {
      alert(`Error al guardar configuración: ${err.message}`);
    } finally {
      setSavingConfig(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: "easeOut" }}>
      <Card variant="adminCard" styles={styles}>
        <h3>Configuración de Conexión ERP MBA3</h3>

        <div className={styles.adminFormGroup}>
          <label>Seleccionar Entorno Activo (Consulta Transaccional)</label>
          <select
            value={erpConfig.env}
            onChange={(e) => {
              setErpConfig({ ...erpConfig, env: e.target.value });
            }}
            className={styles.adminSelectEnv}
          >
            <option value="PRUEBAS">PRUEBAS (Desarrollo - Puerto 8020)</option>
            <option value="PROD">PRODUCCIÓN (Operativo - Puerto 8081)</option>
          </select>
        </div>

        <div style={{ marginTop: "1.25rem", borderTop: "1px solid var(--color-surface-subtle)", paddingTop: "1.25rem" }}>
          <h4 style={{ margin: "0 0 0.85rem 0", color: "var(--color-brand-primary)", fontSize: "0.85rem", fontWeight: "700", textTransform: "uppercase" }}>Variables de PRUEBAS (.env)</h4>
          <div className={styles.adminFormGroup}>
            <label>URL Base del Servicio Pruebas</label>
            <input
              type="text"
              value={erpConfig.base_url_test}
              onChange={(e) => setErpConfig({ ...erpConfig, base_url_test: e.target.value })}
              placeholder="http://servidor-erp-pruebas:8020"
              className={styles.selectFilter}
              style={{ width: "100%", background: "var(--color-surface)", border: "1px solid var(--color-border-strong)", color: "var(--color-text-primary)", padding: "0.55rem 0.75rem", borderRadius: "8px" }}
            />
          </div>
          <div className={styles.adminFormRow} style={{ display: "flex", gap: "1rem", marginTop: "0.85rem" }}>
            <div className={styles.adminFormGroup} style={{ flex: 1 }}>
              <label>Código de Acceso Pruebas</label>
              <input
                type="text"
                value={erpConfig.codigo_servicio_test}
                onChange={(e) => setErpConfig({ ...erpConfig, codigo_servicio_test: e.target.value })}
                className={styles.selectFilter}
                style={{ width: "100%", background: "var(--color-surface)", border: "1px solid var(--color-border-strong)" }}
              />
            </div>
            <div className={styles.adminFormGroup} style={{ flex: 1 }}>
              <label>Contraseña Pruebas</label>
              <input
                type="password"
                value={erpConfig.password_servicio_test}
                onChange={(e) => setErpConfig({ ...erpConfig, password_servicio_test: e.target.value })}
                className={styles.selectFilter}
                style={{ width: "100%", background: "var(--color-surface)", border: "1px solid var(--color-border-strong)" }}
              />
            </div>
          </div>
        </div>

        <div style={{ marginTop: "1.5rem", borderTop: "1px solid var(--color-surface-subtle)", paddingTop: "1.25rem" }}>
          <h4 style={{ margin: "0 0 0.85rem 0", color: "var(--color-brand-accent)", fontSize: "0.85rem", fontWeight: "700", textTransform: "uppercase" }}>Variables de PRODUCCIÓN (.env)</h4>
          <div className={styles.adminFormGroup}>
            <label>URL Base del Servicio Producción</label>
            <input
              type="text"
              value={erpConfig.base_url_prod}
              onChange={(e) => setErpConfig({ ...erpConfig, base_url_prod: e.target.value })}
              placeholder="http://servidor-erp-produccion:8081"
              className={styles.selectFilter}
              style={{ width: "100%", background: "var(--color-surface)", border: "1px solid var(--color-border-strong)", color: "var(--color-text-primary)", padding: "0.55rem 0.75rem", borderRadius: "8px" }}
            />
          </div>
          <div className={styles.adminFormRow} style={{ display: "flex", gap: "1rem", marginTop: "0.85rem" }}>
            <div className={styles.adminFormGroup} style={{ flex: 1 }}>
              <label>Código de Acceso Prod</label>
              <input
                type="text"
                value={erpConfig.codigo_servicio_prod}
                onChange={(e) => setErpConfig({ ...erpConfig, codigo_servicio_prod: e.target.value })}
                className={styles.selectFilter}
                style={{ width: "100%", background: "var(--color-surface)", border: "1px solid var(--color-border-strong)" }}
              />
            </div>
            <div className={styles.adminFormGroup} style={{ flex: 1 }}>
              <label>Contraseña Prod</label>
              <input
                type="password"
                value={erpConfig.password_servicio_prod}
                onChange={(e) => setErpConfig({ ...erpConfig, password_servicio_prod: e.target.value })}
                className={styles.selectFilter}
                style={{ width: "100%", background: "var(--color-surface)", border: "1px solid var(--color-border-strong)" }}
              />
            </div>
          </div>
        </div>

        <Button
          onClick={handleSaveErpConfig}
          className={styles.saveConfigBtn}
          disabled={savingConfig}
          loading={savingConfig}
          loadingText="Guardando..."
          style={{ width: "100%", marginTop: "1.5rem", padding: "0.75rem", background: "var(--color-brand-accent)", color: "var(--color-surface)", border: "none", borderRadius: "8px", fontWeight: "700", cursor: "pointer" }}
        >
          Guardar Configuración Persistente (.env)
        </Button>
      </Card>
    </motion.div>
  );
}
