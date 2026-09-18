"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

// /panel/admin ya no tiene contenido propio -- redirige al primer submódulo
// al que la sesión tenga permiso (mismo orden que el sub-nav en layout.tsx).
const ORDEN_SUBMODULOS = [
  { slug: "usuarios", permiso: "MANAGE_USERS" },
  { slug: "erp", permiso: "MANAGE_CONFIG" },
  { slug: "dashboards", permiso: "MANAGE_DASHBOARDS" },
] as const;

export default function AdminIndexPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status !== "authenticated") return;
    const permisos: string[] = (session?.user as any)?.permissions || [];
    const primero = ORDEN_SUBMODULOS.find((m) => permisos.includes(m.permiso));
    router.replace(primero ? `/panel/admin/${primero.slug}` : "/panel/dashboard");
  }, [status, session, router]);

  return null;
}
