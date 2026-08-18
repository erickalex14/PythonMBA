"use client";

import React from "react";
import { Poppins } from "next/font/google";
import styles from "../dashboard.module.css";
import { SyncSection } from "../../../components/SyncSection";

const poppins = Poppins({ weight: ["600", "700"], subsets: ["latin"] });

export default function SyncPage() {
  return (
    <>
      <header className={styles.contentHeader}>
        <h1 className={`${poppins.className} ${styles.moduleTitle}`}>Sincronización Transaccional</h1>
        <p className={styles.moduleSubtext}>Sincronización manual de datos históricos y diarios del ERP MBA3 a Staging local</p>
      </header>
      <SyncSection styles={styles} />
    </>
  );
}
