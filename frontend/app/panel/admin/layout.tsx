"use client";

import React from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Poppins } from "next/font/google";
import styles from "../dashboard.module.css";

const poppins = Poppins({ weight: ["600", "700"], subsets: ["latin"] });

// Submódulos de /panel/admin (antes una sola página plana con dos bloques).
// Cada uno vive en su propia ruta/archivo y se muestra solo si la sesión
// tiene el permiso correspondiente -- mismo criterio que ya usaba la página
// vieja para mostrar/ocultar cada bloque inline.
const SUBMODULOS = [
  { slug: "usuarios", etiqueta: "Usuarios y Roles", permiso: "MANAGE_USERS" },
  { slug: "erp", etiqueta: "Configuración ERP", permiso: "MANAGE_CONFIG" },
  { slug: "dashboards", etiqueta: "Personalización de Dashboards", permiso: "MANAGE_DASHBOARDS" },
] as const;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const permisos: string[] = (session?.user as any)?.permissions || [];

  const visibles = SUBMODULOS.filter((m) => permisos.includes(m.permiso));

  return (
    <>
      <header className={styles.contentHeader}>
        <h1 className={`${poppins.className} ${styles.moduleTitle}`}>Panel de Administración</h1>
        <p className={styles.moduleSubtext}>Gestión de seguridad, control de acceso de usuarios y configuración del entorno</p>
      </header>

      {visibles.length > 1 && (
        <nav className={styles.adminSubNav}>
          {visibles.map((m) => {
            const href = `/panel/admin/${m.slug}`;
            const activo = pathname === href;
            return (
              <Link key={m.slug} href={href} className={`${styles.adminSubNavTab} ${activo ? styles.adminSubNavTabActive : ""}`}>
                {m.etiqueta}
              </Link>
            );
          })}
        </nav>
      )}

      {children}
    </>
  );
}
