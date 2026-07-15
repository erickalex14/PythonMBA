"use client";

import React from "react";
import styles from "../dashboard.module.css";
import { SyncSection } from "../../../components/SyncSection";

export default function SyncPage() {
  return (
    <>
      <header className={styles.contentHeader}>
        <h1>Sincronización Transaccional</h1>
        <p className={styles.subtext}>Sincronización manual de datos históricos y diarios del ERP MBA3 a Staging local</p>
      </header>
      <SyncSection styles={styles} />
    </>
  );
}
