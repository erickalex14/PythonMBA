import React, { useState } from "react";
import { signOut } from "next-auth/react";

interface SidebarProps {
  session: any;
  activeTab: string;
  setActiveTab: (tab: any) => void;
  isUserAdmin: boolean;
  styles: any;
}

export const Sidebar: React.FC<SidebarProps> = ({
  session,
  activeTab,
  setActiveTab,
  isUserAdmin,
  styles
}) => {
  const permissions: string[] = session?.user?.permissions || [];
  const canViewSync = permissions.includes("MANAGE_CONFIG") || isUserAdmin;
  const [mobileOpen, setMobileOpen] = useState(false);

  const selectTab = (tab: string) => {
    setActiveTab(tab);
    setMobileOpen(false);
  };

  return (
    <>
      <div className={styles.mobileNavToggle}>
        <button
          className={styles.mobileNavToggleBtn}
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menú"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <div className={styles.novbiLogoLockup}>
          <span className={styles.novbiLogoNov}>NOV</span>
          <span className={styles.novbiLogoSep} />
          <span className={styles.novbiLogoBox}><span>BI</span></span>
        </div>
      </div>

      {mobileOpen && <div className={styles.sidebarBackdrop} onClick={() => setMobileOpen(false)} />}

      <aside className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ""}`}>
        <div className={styles.logoArea}>
          <div className={styles.novbiLogoLockup}>
            <span className={styles.novbiLogoNov}>NOV</span>
            <span className={styles.novbiLogoSep} />
            <span className={styles.novbiLogoBox}><span>BI</span></span>
          </div>
        </div>

        <nav className={styles.navMenu}>
        {(permissions.includes("VIEW_VENTAS") || isUserAdmin) && (
          <button
            className={`${styles.navItem} ${activeTab === "ventas-diarias" ? styles.active : ""}`}
            onClick={() => selectTab("ventas-diarias")}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}><rect x="2" y="2" width="7" height="7" rx="1.4" stroke="currentColor" strokeWidth="1.5"/><rect x="11" y="2" width="7" height="7" rx="1.4" stroke="currentColor" strokeWidth="1.5"/><rect x="2" y="11" width="7" height="7" rx="1.4" stroke="currentColor" strokeWidth="1.5"/><rect x="11" y="11" width="7" height="7" rx="1.4" stroke="currentColor" strokeWidth="1.5"/></svg>
            <span className="flex-1">Dashboard</span>
          </button>
        )}

        {permissions.includes("VIEW_MOVIMIENTOS") && (
          <button
            className={`${styles.navItem} ${activeTab === "movimientos" ? styles.active : ""}`}
            onClick={() => selectTab("movimientos")}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}><circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5"/><path d="M13 7l-2 5-4 1 2-5 4-1Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>
            <span className="flex-1">Movimientos</span>
          </button>
        )}

        {permissions.includes("VIEW_LIQUIDACIONES") && (
          <button
            className={`${styles.navItem} ${activeTab === "liquidaciones" ? styles.active : ""}`}
            onClick={() => selectTab("liquidaciones")}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}><rect x="3" y="3" width="14" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><line x1="6" y1="7.5" x2="14" y2="7.5" stroke="currentColor" strokeWidth="1.4"/><line x1="6" y1="10.5" x2="14" y2="10.5" stroke="currentColor" strokeWidth="1.4"/><line x1="6" y1="13.5" x2="11" y2="13.5" stroke="currentColor" strokeWidth="1.4"/></svg>
            <span className="flex-1">Liquidaciones</span>
          </button>
        )}

        {permissions.includes("VIEW_ATS") && (
          <button
            className={`${styles.navItem} ${activeTab === "ats" ? styles.active : ""}`}
            onClick={() => selectTab("ats")}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}><path d="M5 2.5h7l3 3v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-14a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><line x1="7" y1="9" x2="13" y2="9" stroke="currentColor" strokeWidth="1.3"/><line x1="7" y1="12" x2="13" y2="12" stroke="currentColor" strokeWidth="1.3"/></svg>
            <span className="flex-1">Reporte ATS</span>
          </button>
        )}

        {(permissions.includes("VIEW_VENTAS") || isUserAdmin) && (
          <button
            className={`${styles.navItem} ${activeTab === "ventas" ? styles.active : ""}`}
            onClick={() => selectTab("ventas")}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}><line x1="4" y1="17" x2="4" y2="9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><line x1="10" y1="17" x2="10" y2="3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><line x1="16" y1="17" x2="16" y2="12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
            <span className="flex-1">Rentabilidad</span>
          </button>
        )}

        {permissions.includes("VIEW_LOGS") && (
          <button
            className={`${styles.navItem} ${activeTab === "logs" ? styles.active : ""}`}
            onClick={() => selectTab("logs")}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}><circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5"/><path d="M10 6v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span className="flex-1">Bitácora Auditoría</span>
          </button>
        )}

        {canViewSync && (
          <button
            className={`${styles.navItem} ${activeTab === "sync" ? styles.active : ""}`}
            onClick={() => selectTab("sync")}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}><path d="M15.5 6A6 6 0 1 0 16 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M15.5 2.5V6H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span className="flex-1">Sincronizar ERP</span>
          </button>
        )}

        {isUserAdmin && (
          <button
            className={`${styles.navItem} ${activeTab === "admin" ? styles.active : ""}`}
            onClick={() => selectTab("admin")}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}><circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.4 4.4l1.4 1.4M14.2 14.2l1.4 1.4M4.4 15.6l1.4-1.4M14.2 5.8l1.4-1.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
            <span className="flex-1">Administración</span>
          </button>
        )}
      </nav>

      <div className={styles.sidebarFooter}>
        <div className={styles.userInfo}>
          <p className={styles.userName}>{session?.user?.name}</p>
          <p className={styles.userRole}>Rol: {session?.user?.role}</p>
          <p className={styles.userCedula}>Cédula: {(session?.user as any)?.cedula}</p>
        </div>
        <button onClick={() => signOut()} className={styles.logoutBtn}>
          Cerrar Sesión
        </button>
      </div>
      </aside>
    </>
  );
};
