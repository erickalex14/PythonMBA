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
        {permissions.includes("VIEW_MOVIMIENTOS") && (
          <button
            className={`${styles.navItem} ${activeTab === "movimientos" ? styles.active : ""}`}
            onClick={() => selectTab("movimientos")}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
            <span className="flex-1">Movimientos</span>
          </button>
        )}
        
        {permissions.includes("VIEW_LIQUIDACIONES") && (
          <button
            className={`${styles.navItem} ${activeTab === "liquidaciones" ? styles.active : ""}`}
            onClick={() => selectTab("liquidaciones")}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="2" y1="10" x2="22" y2="10"/><path d="M12 21H3a2 2 0 0 1-2-2v-3"/><path d="M12 21h9a2 2 0 0 0 2-2v-3"/></svg>
            <span className="flex-1">Liquidaciones</span>
          </button>
        )}

        {permissions.includes("VIEW_ATS") && (
          <button
            className={`${styles.navItem} ${activeTab === "ats" ? styles.active : ""}`}
            onClick={() => selectTab("ats")}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            <span className="flex-1">Reporte ATS</span>
          </button>
        )}

        {(permissions.includes("VIEW_VENTAS") || isUserAdmin) && (
          <button
            className={`${styles.navItem} ${activeTab === "ventas-diarias" ? styles.active : ""}`}
            onClick={() => selectTab("ventas-diarias")}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
            <span className="flex-1">Ventas Diarias</span>
          </button>
        )}

        {(permissions.includes("VIEW_VENTAS") || isUserAdmin) && (
          <button
            className={`${styles.navItem} ${activeTab === "ventas" ? styles.active : ""}`}
            onClick={() => selectTab("ventas")}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
            <span className="flex-1">Ventas</span>
          </button>
        )}

        {permissions.includes("VIEW_LOGS") && (
          <button
            className={`${styles.navItem} ${activeTab === "logs" ? styles.active : ""}`}
            onClick={() => selectTab("logs")}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span className="flex-1">Bitácora Auditoría</span>
          </button>
        )}

        {canViewSync && (
          <button
            className={`${styles.navItem} ${activeTab === "sync" ? styles.active : ""}`}
            onClick={() => selectTab("sync")}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
            <span className="flex-1">Sincronizar ERP</span>
          </button>
        )}

        {isUserAdmin && (
          <button
            className={`${styles.navItem} ${activeTab === "admin" ? styles.active : ""}`}
            onClick={() => selectTab("admin")}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            <span className="flex-1">Administración</span>
          </button>
        )}
      </nav>

      <div className={styles.sidebarFooter}>
        <div className={styles.userInfo}>
          <p className={styles.userName}>{session?.user?.name}</p>
          <p className={styles.userRole}>{session?.user?.role}</p>
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
