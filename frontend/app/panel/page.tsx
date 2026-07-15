"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import NovbiSplash from "../../components/NovbiSplash";

export default function PanelIndexPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status !== "authenticated") return;
    const perms: string[] = (session?.user as any)?.permissions || [];
    const isAdmin = session?.user?.role === "Admin";
    if (perms.includes("VIEW_VENTAS") || isAdmin) {
      router.replace("/panel/dashboard");
    } else {
      router.replace("/panel/movimientos");
    }
  }, [status, session, router]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#ffffff" }}>
      <NovbiSplash loop />
    </div>
  );
}
