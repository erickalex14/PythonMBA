"use client";

import React from "react";
import { useSession } from "next-auth/react";
import { Sidebar } from "../../components/Sidebar";
import NovbiSplash from "../../components/NovbiSplash";
import styles from "./dashboard.module.css";

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();

  // Splash a pantalla completa mientras se resuelve la sesión - el middleware
  // ya se encarga de redirigir si no hay sesión, esto solo cubre el instante
  // de carga para no pintar el sidebar antes de tiempo.
  if (status !== "authenticated") {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#ffffff" }}>
        <NovbiSplash loop />
      </div>
    );
  }

  const isUserAdmin = session?.user?.role === "Admin";

  return (
    <div className={styles.container}>
      <Sidebar session={session} isUserAdmin={isUserAdmin} styles={styles} />
      <main className={styles.mainContent}>{children}</main>
    </div>
  );
}
