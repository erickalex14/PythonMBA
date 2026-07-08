"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import styles from "./dashboard.module.css";

// Componentes Modularizados (SOLID)
import { Sidebar } from "../../components/Sidebar";
import { KPICards } from "../../components/KPICards";
import { ChartsSection } from "../../components/ChartsSection";
import { ReportTable } from "../../components/ReportTable";
import { SyncSection } from "../../components/SyncSection";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { REPORTS_CONFIG } from "../../lib/reports-config";
import { useReportQuery } from "../../hooks/useReportQuery";

type TabType = "movimientos" | "liquidaciones" | "ats" | "ventas" | "logs" | "admin" | "sync";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Filtros generales de rango y búsqueda global
  const [startDate, setStartDate] = useState("2026-06-01");
  const [endDate, setEndDate] = useState("2026-06-30");
  const [searchQuery, setSearchQuery] = useState("");

  // Pestaña activa y almacén de datos (Bitácora)
  const [activeTab, setActiveTab] = useState<TabType>("movimientos");
  const [logs, setLogs] = useState<any[]>([]);
  const [downloading, setDownloading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Hook Personalizado de Consultas Progresivas (Single Responsibility)
  const {
    loading,
    queryProgress,
    estTimeRemaining,
    currentQueryingDate,
    data,
    error,
    fetchReportData,
    setData,
    setError,
    setQueryProgress,
    setEstTimeRemaining,
    setLoading
  } = useReportQuery();

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Filtros específicos en la tabla para Movimientos
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedSalesman, setSelectedSalesman] = useState("");

  // Filtros específicos en la tabla para Liquidaciones
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedPartida, setSelectedPartida] = useState("");
  const [selectedRecepcion, setSelectedRecepcion] = useState("");

  // Filtros específicos en la tabla para ATS
  const [selectedVendor, setSelectedVendor] = useState("");
  const [selectedClassif, setSelectedClassif] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedCorp, setSelectedCorp] = useState("");

  // Estados de administración
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [adminRoles, setAdminRoles] = useState<any[]>([]);
  const [adminPermissions, setAdminPermissions] = useState<any[]>([]);
  const [loadingAdminData, setLoadingAdminData] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  // ERP Config conmutación dual
  const [erpConfig, setErpConfig] = useState({
    env: "PRUEBAS",
    base_url_test: "",
    codigo_servicio_test: "",
    password_servicio_test: "",
    base_url_prod: "",
    codigo_servicio_prod: "",
    password_servicio_prod: ""
  });

  // Modales
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [userForm, setUserForm] = useState({ name: "", cedula: "", password: "", roleId: "" });
  const [submittingUser, setSubmittingUser] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);

  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<any | null>(null);
  const [roleForm, setRoleForm] = useState({ name: "", permissionIds: [] as string[] });
  const [submittingRole, setSubmittingRole] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);

  // Redireccionar si no está autenticado
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/acceso");
    }
  }, [status, router]);

  // Cargar datos administrativos
  const fetchAdminData = async () => {
    setLoadingAdminData(true);
    try {
      const usersRes = await fetch("/api/admin/users");
      if (usersRes.ok) {
        const json = await usersRes.json();
        setAdminUsers(json.users);
      }

      const rolesRes = await fetch("/api/admin/roles");
      if (rolesRes.ok) {
        const json = await rolesRes.json();
        setAdminRoles(json.roles);
      }

      const permsRes = await fetch("/api/admin/permissions");
      if (permsRes.ok) {
        const json = await permsRes.json();
        setAdminPermissions(json.permissions);
      }

      const configRes = await fetch("/api/admin/config");
      if (configRes.ok) {
        const json = await configRes.json();
        if (json && json.env) setErpConfig(json);
      }
    } catch (err) {
      console.error("Error al cargar datos del panel administrativo", err);
    } finally {
      setLoadingAdminData(false);
    }
  };

  // Guardar configuración del ERP
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

  // Cargar datos de reportes o bitácora al cambiar de pestaña
  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    setLogs([]);
    try {
      const res = await fetch("/api/data/logs");
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setLogs(json);
    } catch (err: any) {
      setError(err.message || "Error al obtener la bitácora de auditoría.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuery = () => {
    if (activeTab === "logs") {
      fetchLogs();
    } else if (activeTab === "admin") {
      fetchAdminData();
    } else {
      fetchReportData(activeTab, startDate, endDate);
    }
  };

  useEffect(() => {
    if (status === "authenticated") {
      if (activeTab === "logs") {
        fetchLogs();
      } else if (activeTab === "admin") {
        fetchAdminData();
      } else if (activeTab === "sync") {
        // Nada que consultar al entrar a sync
        setData([]);
      } else {
        setData([]);
        setError(null);
        setQueryProgress(0);
        setEstTimeRemaining(null);
      }
    }
  }, [activeTab, status]);

  // Resetear filtros locales al cambiar de pestaña
  useEffect(() => {
    setSelectedBrand("");
    setSelectedBranch("");
    setSelectedSalesman("");
    setSelectedProduct("");
    setSelectedPartida("");
    setSelectedRecepcion("");
    setSelectedVendor("");
    setSelectedClassif("");
    setSelectedStatus("");
    setSelectedCorp("");
    setCurrentPage(1);
  }, [activeTab]);

  // Resetear página actual si los datos filtrados cambian
  useEffect(() => {
    setCurrentPage(1);
  }, [
    selectedBrand, selectedBranch, selectedSalesman,
    selectedProduct, selectedPartida, selectedRecepcion,
    selectedVendor, selectedClassif, selectedStatus, selectedCorp,
    searchQuery
  ]);

  // Descarga de Excel
  const handleDownloadExcel = async () => {
    if (data.length === 0) return;
    setDownloading(true);
    try {
      const reportConfig = REPORTS_CONFIG[activeTab];
      if (!reportConfig) return;

      const res = await fetch("/api/data/excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: reportConfig.excelType,
          data: filteredData,
          start_date: startDate,
          end_date: endDate
        })
      });

      if (!res.ok) {
        throw new Error("No se pudo generar el archivo de Excel en el servidor.");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Reporte_${activeTab}_${startDate}_a_${endDate}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Error al generar Excel: ${err.message}`);
    } finally {
      setDownloading(false);
    }
  };

  // Descarga de PDF (Impresión nativa con CSS Print)
  const handlePrintPdf = () => {
    window.print();
  };

  // Gestión de Usuarios (CRUD)
  const handleOpenUserModal = (user: any | null) => {
    setEditingUser(user);
    setUserError(null);
    if (user) {
      setUserForm({
        name: user.name || "",
        cedula: user.cedula || "",
        password: "",
        roleId: user.roleId || ""
      });
    } else {
      setUserForm({ name: "", cedula: "", password: "", roleId: "" });
    }
    setIsUserModalOpen(true);
  };

  const handleSubmitUser = async () => {
    if (!userForm.cedula || !userForm.name || (!editingUser && !userForm.password) || !userForm.roleId) {
      setUserError("Por favor complete todos los campos mandatorios.");
      return;
    }
    setSubmittingUser(true);
    setUserError(null);
    try {
      const url = editingUser ? `/api/admin/users?id=${editingUser.id}` : "/api/admin/users";
      const method = editingUser ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userForm)
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Error procesando solicitud.");
      }

      setIsUserModalOpen(false);
      fetchAdminData();
    } catch (err: any) {
      setUserError(err.message || "Error del servidor.");
    } finally {
      setSubmittingUser(false);
    }
  };

  const handleDeleteUser = async (user: any) => {
    if (!confirm(`¿Está seguro que desea eliminar la cuenta de ${user.name}?`)) return;
    try {
      const res = await fetch(`/api/admin/users?id=${user.id}`, { method: "DELETE" });
      if (!res.ok) {
        const text = await res.text();
        alert(`Error al eliminar usuario: ${text}`);
      } else {
        fetchAdminData();
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  // Gestión de Roles (CRUD)
  const handleOpenRoleModal = (role: any | null) => {
    setEditingRole(role);
    setRoleError(null);
    if (role) {
      setRoleForm({
        name: role.name || "",
        permissionIds: role.permissions?.map((p: any) => p.id) || []
      });
    } else {
      setRoleForm({ name: "", permissionIds: [] });
    }
    setIsRoleModalOpen(true);
  };

  const handlePermissionToggle = (permId: string) => {
    const list = [...roleForm.permissionIds];
    const idx = list.indexOf(permId);
    if (idx > -1) {
      list.splice(idx, 1);
    } else {
      list.push(permId);
    }
    setRoleForm({ ...roleForm, permissionIds: list });
  };

  const handleSubmitRole = async () => {
    if (!roleForm.name) {
      setRoleError("Por favor ingrese el nombre del rol.");
      return;
    }
    setSubmittingRole(true);
    setRoleError(null);
    try {
      const url = editingRole ? `/api/admin/roles?id=${editingRole.id}` : "/api/admin/roles";
      const method = editingRole ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(roleForm)
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Error procesando solicitud.");
      }

      setIsRoleModalOpen(false);
      fetchAdminData();
    } catch (err: any) {
      setRoleError(err.message || "Error del servidor.");
    } finally {
      setSubmittingRole(false);
    }
  };

  // Filtro de búsqueda global e internamente por campos específicos
  const filteredData = useMemo(() => {
    if (activeTab === "logs" || activeTab === "admin" || activeTab === "sync") return [];
    
    return data.filter((row) => {
      // 1. Filtro de Búsqueda Global
      if (searchQuery.trim() !== "") {
        const match = Object.values(row).some((val) =>
          String(val).toLowerCase().includes(searchQuery.toLowerCase())
        );
        if (!match) return false;
      }

      // 2. Filtros Específicos por Tab
      if (activeTab === "movimientos") {
        if (selectedBrand && String(row.Codigo_Marca).trim() !== selectedBrand) return false;
        if (selectedBranch && String(row.Codigo_Sucursal).trim() !== selectedBranch) return false;
        if (selectedSalesman && String(row.COD_SALESMAN).trim() !== selectedSalesman) return false;
      } else if (activeTab === "liquidaciones") {
        if (selectedProduct && String(row.PRODUCTO_ID_CORP).trim() !== selectedProduct) return false;
        if (selectedPartida && String(row.PARTIDA_ID_CORP).trim() !== selectedPartida) return false;
        if (selectedRecepcion && String(row.IdRecepcionRelacionada).trim() !== selectedRecepcion) return false;
      } else if (activeTab === "ats") {
        if (selectedVendor && String(row.VENDOR_NAME).trim() !== selectedVendor) return false;
        if (selectedClassif && String(row.MF_Lista2).trim() !== selectedClassif) return false;
        if (selectedStatus) {
          const isAnulado = row.ES_ANULADO === 1;
          if (selectedStatus === "ANULADO" && !isAnulado) return false;
          if (selectedStatus === "ACTIVO" && isAnulado) return false;
        }
      } else if (activeTab === "ventas") {
        if (selectedProduct && String(row.producto).trim() !== selectedProduct) return false;
        if (selectedBranch && String(row.grupo).trim() !== selectedBranch) return false;
      }

      return true;
    });
  }, [
    data, activeTab, searchQuery,
    selectedBrand, selectedBranch, selectedSalesman,
    selectedProduct, selectedPartida, selectedRecepcion,
    selectedVendor, selectedClassif, selectedStatus, selectedCorp
  ]);

  // Filtros de bitácora
  const filteredLogs = useMemo(() => {
    if (activeTab !== "logs") return [];
    if (!searchQuery.trim()) return logs;
    return logs.filter((log) => {
      const q = searchQuery.toLowerCase();
      return (
        String(log.user_name).toLowerCase().includes(q) ||
        String(log.user_cedula).toLowerCase().includes(q) ||
        String(log.user_role).toLowerCase().includes(q) ||
        String(log.download_type).toLowerCase().includes(q) ||
        String(log.timestamp).toLowerCase().includes(q)
      );
    });
  }, [logs, searchQuery, activeTab]);

  // Paginación de reportes
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, currentPage, itemsPerPage]);

  // Paginación de logs
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredLogs.slice(start, start + itemsPerPage);
  }, [filteredLogs, currentPage, itemsPerPage]);

  // Listas de filtros dinámicos (Dropdowns)
  const filterOptions = useMemo(() => {
    const brands = new Set<string>();
    const branches = new Set<string>();
    const salesmen = new Set<string>();
    const products = new Set<string>();
    const partidas = new Set<string>();
    const recepciones = new Set<string>();
    const vendors = new Set<string>();
    const classifs = new Set<string>();

    data.forEach((row) => {
      if (activeTab === "movimientos") {
        if (row.Codigo_Marca) brands.add(String(row.Codigo_Marca).trim());
        if (row.Codigo_Sucursal) branches.add(String(row.Codigo_Sucursal).trim());
        if (row.COD_SALESMAN) salesmen.add(String(row.COD_SALESMAN).trim());
      } else if (activeTab === "liquidaciones") {
        if (row.PRODUCTO_ID_CORP) products.add(String(row.PRODUCTO_ID_CORP).trim());
        if (row.PARTIDA_ID_CORP) partidas.add(String(row.PARTIDA_ID_CORP).trim());
        if (row.IdRecepcionRelacionada) recepciones.add(String(row.IdRecepcionRelacionada).trim());
      } else if (activeTab === "ats") {
        if (row.VENDOR_NAME) vendors.add(String(row.VENDOR_NAME).trim());
        if (row.MF_Lista2) classifs.add(String(row.MF_Lista2).trim());
      } else if (activeTab === "ventas") {
        if (row.producto) products.add(String(row.producto).trim());
        if (row.grupo) branches.add(String(row.grupo).trim());
      }
    });

    return {
      brands: Array.from(brands).sort(),
      branches: Array.from(branches).sort(),
      salesmen: Array.from(salesmen).sort(),
      products: Array.from(products).sort(),
      partidas: Array.from(partidas).sort(),
      recepciones: Array.from(recepciones).sort(),
      vendors: Array.from(vendors).sort(),
      classifs: Array.from(classifs).sort()
    };
  }, [data, activeTab]);

  const isUserAdmin = session?.user?.role === "Admin";
  const reportConfig = REPORTS_CONFIG[activeTab];

  // Estructura de cabeceras de reportes para impresión certificada
  const totalQty = useMemo(() => {
    if (activeTab === "movimientos") {
      return data.reduce((acc, row) => acc + (Number(row.ORIGINAL_QTY) || 0), 0);
    } else if (activeTab === "liquidaciones") {
      return data.reduce((acc, row) => acc + (Number(row.CANTIDAD) || 0), 0);
    } else if (activeTab === "ventas") {
      return data.reduce((acc, row) => acc + (Number(row.cantidad) || Number(row.CANTIDAD) || 0), 0);
    }
    return 0;
  }, [data, activeTab]);

  const totalAmount = useMemo(() => {
    if (activeTab === "movimientos") {
      return data.reduce((acc, row) => acc + (Number(row.BASE_COMISION) || 0), 0);
    } else if (activeTab === "liquidaciones") {
      return data.reduce((acc, row) => acc + (Number(row.VALOR_TOTAL_CIF) || 0), 0);
    } else if (activeTab === "ats") {
      return data.reduce((acc, row) => acc + (Number(row.INVOICE_TOTAL) || 0), 0);
    } else if (activeTab === "ventas") {
      return data.reduce((acc, row) => acc + (Number(row.total_linea) || Number(row.TOTAL_LINEA) || 0), 0);
    }
    return 0;
  }, [data, activeTab]);

  return (
    <div className={styles.container}>
      {/* Sidebar Modularizado */}
      <Sidebar
        session={session}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isUserAdmin={isUserAdmin}
        styles={styles}
      />

      {/* Contenido Principal */}
      <main className={styles.mainContent}>
        
        {/* Encabezado Presidencial exclusivo para impresión PDF */}
        <div className={styles.printOnlyHeader}>
          <div className={styles.printHeaderTop}>
            <div className={styles.printBrand}>NOVICOMPU CORPORATE BUSINESS INTELLIGENCE</div>
            <div className={styles.printConfidentiality}>SECRETARÍA GENERAL - CONFIDENCIAL</div>
          </div>
          <hr className={styles.printDivider} />
          <h1 className={styles.printTitle}>
            {activeTab === "movimientos" && "INFORME CERTIFICADO DE MOVIMIENTOS DE INVENTARIOS Y SERIALES"}
            {activeTab === "liquidaciones" && "INFORME CERTIFICADO DE COSTOS Y LIQUIDACIONES DE IMPORTACIÓN"}
            {activeTab === "ats" && "INFORME FISCAL CONSOLIDADO DE COMPRAS (ATS)"}
            {activeTab === "ventas" && "INFORME CERTIFICADO DE VENTAS"}
            {activeTab === "logs" && "BITÁCORA DE AUDITORÍA Y CONTROL DE ACCESOS AL PORTAL BI"}
          </h1>
          <div className={styles.printMetaGrid}>
            <div>
              <p><span>Periodo de Análisis:</span> Desde el {startDate} hasta el {endDate}</p>
              <p><span>Fecha y Hora de Emisión:</span> {new Date().toLocaleString("es-EC")}</p>
              <p><span>Sistema de Origen:</span> Base Transaccional ERP MBA3</p>
            </div>
            <div>
              <p><span>Auditor Responsable:</span> {session?.user?.name}</p>
              <p><span>Cédula de Identidad:</span> {(session?.user as any)?.cedula}</p>
              <p><span>Nivel de Acceso:</span> Rol {session?.user?.role}</p>
            </div>
          </div>
          <div className={styles.printExecutiveSummary}>
            <h3>Síntesis Ejecutiva del Reporte</h3>
            <p>
              El presente informe ha sido generado de forma certificada de acuerdo con las normativas corporativas de control interno. 
              Tras el cruce y consolidación de datos, se reporta una muestra depurada de <strong>{filteredData.length} transacciones válidas</strong> en el periodo seleccionado. 
              {activeTab === "movimientos" && `El volumen neto de mercancía movilizada asciende a ${totalQty.toLocaleString()} unidades, registrando una base de comisión real acumulada de $${totalAmount.toFixed(2)} distribuida entre la fuerza de ventas registrada.`}
              {activeTab === "liquidaciones" && `El costo CIF acumulado de las importaciones analizadas totaliza $${totalAmount.toFixed(2)}, consolidando un total de ${totalQty.toLocaleString()} unidades físicas que han completado el proceso de recepción y liquidación.`}
              {activeTab === "ats" && `El consolidado fiscal del periodo reporta compras brutas por un valor total facturado de $${totalAmount.toFixed(2)}.`}
              {activeTab === "ventas" && `El volumen de ventas consolidado reporta transacciones brutas por un valor total de $${totalAmount.toFixed(2)}, distribuidas en un volumen acumulado de ${totalQty.toLocaleString()} unidades físicas vendidas.`}
            </p>
          </div>
        </div>

        {/* Cabecera Web */}
        <header className={styles.contentHeader}>
          <h1>
            {activeTab === "movimientos" && "Movimientos de Productos (Seriales)"}
            {activeTab === "liquidaciones" && "Liquidaciones de Importaciones"}
            {activeTab === "ats" && "ATS - Facturas de Compras"}
            {activeTab === "ventas" && "Ventas (Detalle)"}
            {activeTab === "logs" && "Bitácora de Auditoría"}
            {activeTab === "admin" && "Panel de Administración"}
            {activeTab === "sync" && "Sincronización Transaccional"}
          </h1>
          <p className={styles.subtext}>
            {activeTab === "movimientos" && "Reporte de transacciones de inventario, seriales y comisiones"}
            {activeTab === "liquidaciones" && "Consolidado de costos CIF y detalle de productos liquidados"}
            {activeTab === "ats" && "Resumen fiscal de compras autorizadas y anulaciones"}
            {activeTab === "ventas" && "Reporte consolidado de facturación de clientes y ventas transadas"}
            {activeTab === "logs" && "Historial de descargas de reportes para auditoría de seguridad"}
            {activeTab === "admin" && "Gestión de seguridad, control de acceso de usuarios y configuración del entorno"}
            {activeTab === "sync" && "Sincronización manual de datos históricos y diarios del ERP MBA3 a Staging local"}
          </p>
        </header>

        {/* 1. SECCIÓN DE SINCRONIZACIÓN MANUAL */}
        {activeTab === "sync" && (
          <SyncSection styles={styles} />
        )}

        {/* 2. SECCIÓN DE ADMINISTRACIÓN DE USUARIOS/CONFIG */}
        {activeTab === "admin" && (
          <section className={styles.adminGrid}>
            
            {/* Card 1: Configuración de Entorno ERP con Conmutación Dual */}
            {session?.user && (session.user as any).permissions?.includes("MANAGE_CONFIG") && (
              <div className={styles.adminCard}>
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

                <div style={{ marginTop: "1.25rem", borderTop: "1px solid #f1f5f9", paddingTop: "1.25rem" }}>
                  <h4 style={{ margin: "0 0 0.85rem 0", color: "#005daa", fontSize: "0.85rem", fontWeight: "700", textTransform: "uppercase" }}>Variables de PRUEBAS (.env)</h4>
                  <div className={styles.adminFormGroup}>
                    <label>URL Base del Servicio Pruebas</label>
                    <input
                      type="text"
                      value={erpConfig.base_url_test}
                      onChange={(e) => setErpConfig({ ...erpConfig, base_url_test: e.target.value })}
                      placeholder="http://192.168.80.201:8020"
                      className={styles.selectFilter}
                      style={{ width: "100%", background: "#ffffff", border: "1px solid #cbd5e1", color: "#0f172a", padding: "0.55rem 0.75rem", borderRadius: "8px" }}
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
                        style={{ width: "100%", background: "#ffffff", border: "1px solid #cbd5e1" }}
                      />
                    </div>
                    <div className={styles.adminFormGroup} style={{ flex: 1 }}>
                      <label>Contraseña Pruebas</label>
                      <input
                        type="password"
                        value={erpConfig.password_servicio_test}
                        onChange={(e) => setErpConfig({ ...erpConfig, password_servicio_test: e.target.value })}
                        className={styles.selectFilter}
                        style={{ width: "100%", background: "#ffffff", border: "1px solid #cbd5e1" }}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: "1.5rem", borderTop: "1px solid #f1f5f9", paddingTop: "1.25rem" }}>
                  <h4 style={{ margin: "0 0 0.85rem 0", color: "#70b92b", fontSize: "0.85rem", fontWeight: "700", textTransform: "uppercase" }}>Variables de PRODUCCIÓN (.env)</h4>
                  <div className={styles.adminFormGroup}>
                    <label>URL Base del Servicio Producción</label>
                    <input
                      type="text"
                      value={erpConfig.base_url_prod}
                      onChange={(e) => setErpConfig({ ...erpConfig, base_url_prod: e.target.value })}
                      placeholder="http://192.168.80.201:8081"
                      className={styles.selectFilter}
                      style={{ width: "100%", background: "#ffffff", border: "1px solid #cbd5e1", color: "#0f172a", padding: "0.55rem 0.75rem", borderRadius: "8px" }}
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
                        style={{ width: "100%", background: "#ffffff", border: "1px solid #cbd5e1" }}
                      />
                    </div>
                    <div className={styles.adminFormGroup} style={{ flex: 1 }}>
                      <label>Contraseña Prod</label>
                      <input
                        type="password"
                        value={erpConfig.password_servicio_prod}
                        onChange={(e) => setErpConfig({ ...erpConfig, password_servicio_prod: e.target.value })}
                        className={styles.selectFilter}
                        style={{ width: "100%", background: "#ffffff", border: "1px solid #cbd5e1" }}
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
                  style={{ width: "100%", marginTop: "1.5rem", padding: "0.75rem", background: "#70b92b", color: "#ffffff", border: "none", borderRadius: "8px", fontWeight: "700", cursor: "pointer" }}
                >
                  Guardar Configuración Persistente (.env)
                </Button>
              </div>
            )}

            {/* Card 2: CRUD de Usuarios y Roles */}
            {session?.user && (session.user as any).permissions?.includes("MANAGE_CONFIG") && (
              <div className={styles.adminCard}>
                <div className={styles.adminCardHeader}>
                  <h3>Gestión de Cuentas de Usuarios</h3>
                  <Button
                    onClick={() => handleOpenUserModal(null)}
                    className={styles.createUserBtn}
                  >
                    + Crear Usuario
                  </Button>
                </div>

                <div className={styles.tableWrapper}>
                  {loadingAdminData ? (
                    <div className={styles.tableLoader}>
                      <div className={styles.spinner}></div>
                      <p>Cargando lista de usuarios...</p>
                    </div>
                  ) : (
                    <table className={styles.table} style={{ fontSize: "0.85rem" }}>
                      <thead>
                        <tr>
                          <th>Cédula</th>
                          <th>Nombre</th>
                          <th>Rol</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminUsers.map((u) => (
                          <tr key={u.id}>
                            <td><strong>{u.cedula}</strong></td>
                            <td>{u.name}</td>
                            <td>
                              <Badge status={u.role?.name === "Admin" ? "badgeAdmin" : "badgeUser"} styles={styles}>
                                {u.role?.name}
                              </Badge>
                            </td>
                            <td>
                              <Button
                                onClick={() => handleOpenUserModal(u)}
                                className={`${styles.actionBtn} ${styles.btnEdit}`}
                              >
                                Editar
                              </Button>
                              <Button
                                onClick={() => handleDeleteUser(u)}
                                className={`${styles.actionBtn} ${styles.btnDelete}`}
                              >
                                Eliminar
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Sub-Card: CRUD de Roles y Permisos */}
                <div style={{ marginTop: "2rem", borderTop: "1px solid #f1f5f9", paddingTop: "1.5rem" }}>
                  <div className={styles.adminCardHeader}>
                    <h3>Gestión de Roles del Sistema</h3>
                    <Button
                      onClick={() => handleOpenRoleModal(null)}
                      className={styles.createUserBtn}
                    >
                      + Crear Rol
                    </Button>
                  </div>
                  
                  <div className={styles.tableWrapper}>
                    <table className={styles.table} style={{ fontSize: "0.85rem" }}>
                      <thead>
                        <tr>
                          <th>Nombre del Rol</th>
                          <th>Permisos Asociados</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminRoles.map((role) => (
                          <tr key={role.id}>
                            <td><strong>{role.name}</strong></td>
                            <td>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                                {role.permissions?.map((p: any) => (
                                  <span key={p.id} className={styles.permBadge} title={p.description}>
                                    {p.action}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td>
                              <Button
                                onClick={() => handleOpenRoleModal(role)}
                                className={`${styles.actionBtn} ${styles.btnEdit}`}
                                disabled={role.name === "Admin" || role.name === "Visitante"}
                              >
                                Editar
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* 3. FILTROS GENERALES DE REPORTES */}
        {activeTab !== "admin" && activeTab !== "sync" && (
          <section className={styles.filtersSection}>
            <div className={styles.filtersRow}>
              <div className={styles.filterGroup}>
                <label>Fecha de Inicio</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className={styles.filterGroup}>
                <label>Fecha de Fin</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={loading}
                />
              </div>
              <Button onClick={handleQuery} className={styles.queryBtn} loading={loading} loadingText="Consultando...">
                Consultar Datos
              </Button>
            </div>

            <div className={styles.searchFilter}>
              <div className={styles.filterGroup}>
                <label>Búsqueda Global</label>
                <input
                  type="text"
                  placeholder="Buscar en todos los campos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </section>
        )}

        {/* 4. FILTROS ESPECÍFICOS POR TABLA */}
        {data.length > 0 && !loading && activeTab !== "admin" && activeTab !== "sync" && activeTab !== "logs" && (
          <section className={styles.subFiltersSection}>
            <h4 style={{ margin: "0 0 0.85rem 0", color: "#005daa", fontSize: "0.80rem", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Filtros de Segmentación Local (Sin recargar base de datos)
            </h4>
            <div className={styles.subFiltersRow}>
              
              {activeTab === "movimientos" && (
                <>
                  <div className={styles.filterGroup}>
                    <label>Filtrar por Marca</label>
                    <select value={selectedBrand} onChange={(e) => setSelectedBrand(e.target.value)} className={styles.selectFilter}>
                      <option value="">Todas las Marcas...</option>
                      {filterOptions.brands.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.filterGroup}>
                    <label>Filtrar por Sucursal</label>
                    <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)} className={styles.selectFilter}>
                      <option value="">Todas las Sucursales...</option>
                      {filterOptions.branches.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.filterGroup}>
                    <label>Filtrar por Vendedor</label>
                    <select value={selectedSalesman} onChange={(e) => setSelectedSalesman(e.target.value)} className={styles.selectFilter}>
                      <option value="">Todos los Vendedores...</option>
                      {filterOptions.salesmen.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {activeTab === "liquidaciones" && (
                <>
                  <div className={styles.filterGroup}>
                    <label>Filtrar por ID Producto</label>
                    <select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)} className={styles.selectFilter}>
                      <option value="">Todos los Productos...</option>
                      {filterOptions.products.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.filterGroup}>
                    <label>Filtrar por Partida Arancelaria</label>
                    <select value={selectedPartida} onChange={(e) => setSelectedPartida(e.target.value)} className={styles.selectFilter}>
                      <option value="">Todas las Partidas...</option>
                      {filterOptions.partidas.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.filterGroup}>
                    <label>Filtrar por Recepción Relacionada</label>
                    <select value={selectedRecepcion} onChange={(e) => setSelectedRecepcion(e.target.value)} className={styles.selectFilter}>
                      <option value="">Todas las Recepciones...</option>
                      {filterOptions.recepciones.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {activeTab === "ats" && (
                <>
                  <div className={styles.filterGroup}>
                    <label>Filtrar por Proveedor</label>
                    <select value={selectedVendor} onChange={(e) => setSelectedVendor(e.target.value)} className={styles.selectFilter}>
                      <option value="">Todos los Proveedores...</option>
                      {filterOptions.vendors.map((v) => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.filterGroup}>
                    <label>Filtrar por SRI Clasificación</label>
                    <select value={selectedClassif} onChange={(e) => setSelectedClassif(e.target.value)} className={styles.selectFilter}>
                      <option value="">Todas las Clasificaciones...</option>
                      {filterOptions.classifs.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.filterGroup}>
                    <label>Estado del Documento</label>
                    <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} className={styles.selectFilter}>
                      <option value="">Todos los Estados...</option>
                      <option value="ACTIVO">ACTIVO</option>
                      <option value="ANULADO">ANULADO</option>
                    </select>
                  </div>
                </>
              )}

              {activeTab === "ventas" && (
                <>
                  <div className={styles.filterGroup}>
                    <label>Filtrar por Producto</label>
                    <select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)} className={styles.selectFilter}>
                      <option value="">Todos los Productos...</option>
                      {filterOptions.products.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.filterGroup}>
                    <label>Filtrar por Grupo</label>
                    <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)} className={styles.selectFilter}>
                      <option value="">Todos los Grupos...</option>
                      {filterOptions.branches.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

            </div>
          </section>
        )}

        {/* 5. CARGADOR PROGRESIVO DE CONSULTA DIARIA */}
        {loading && (activeTab === "movimientos" || activeTab === "liquidaciones" || activeTab === "ats" || activeTab === "ventas") && (
          <section className={styles.progressCard}>
            <div className={styles.progressHeader}>
              <span>Consultando ERP MBA3 por lotes diarios...</span>
              <span className={styles.progressPercentage}>{queryProgress}%</span>
            </div>
            <div className={styles.progressBarBg}>
              <div className={styles.progressBarFill} style={{ width: `${queryProgress}%` }}></div>
            </div>
            <div className={styles.progressMeta}>
              <p>Procesando fecha: <strong>{currentQueryingDate}</strong></p>
              {estTimeRemaining !== null && (
                <p>Tiempo restante estimado: <strong>{estTimeRemaining}s</strong></p>
              )}
            </div>
          </section>
        )}

        {/* 6. KPIS MODULARIZADOS */}
        {!loading && (
          <KPICards filteredData={filteredData} activeTab={activeTab} styles={styles} />
        )}

        {/* 7. SECCIÓN DE GRÁFICOS MODULARIZADOS */}
        {!loading && (
          <ChartsSection filteredData={filteredData} activeTab={activeTab} styles={styles} />
        )}

        {/* 8. CONTENEDOR DE TABLAS E INFORMES */}
        {activeTab !== "admin" && activeTab !== "sync" && (
          <section className={styles.reportSection}>
            <div className={styles.reportHeaderActions}>
              <h3>Detalle Consolidado de Datos</h3>
              
              {!loading && activeTab !== "logs" && filteredData.length > 0 && (
                <div style={{ display: "flex", gap: "0.50rem" }}>
                  <Button onClick={handleDownloadExcel} className={styles.downloadExcelBtn} loading={downloading} loadingText="Generando...">
                    Descargar Excel
                  </Button>
                  <Button onClick={handlePrintPdf} className={styles.downloadPdfBtn} disabled={downloadingPdf}>
                    Imprimir Certificado (PDF)
                  </Button>
                </div>
              )}
            </div>

            {error && <div className={styles.errorAlert}>{error}</div>}

            {loading && !queryProgress && (
              <div className={styles.loaderArea}>
                <div className={styles.spinner}></div>
                <p>Consultando base transaccional...</p>
              </div>
            )}

            {!loading && filteredData.length === 0 && activeTab !== "logs" && !error && (
              <div className={styles.noDataArea}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <p>No se encontraron registros para el rango de fechas seleccionado.</p>
              </div>
            )}

            {/* TABLA DE REPORTES MODULARIZADA (OCP / SOLID) */}
            {reportConfig && filteredData.length > 0 && !loading && (
              <div className={styles.tableWrapper}>
                <ReportTable config={reportConfig} paginatedData={paginatedData} styles={styles} />
              </div>
            )}

            {/* TABLA DE AUDITORÍA (LOGS DE ACCESO) */}
            {activeTab === "logs" && filteredLogs.length > 0 && !loading && (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Usuario</th>
                      <th>Cédula</th>
                      <th>Rol</th>
                      <th>Tipo Descarga</th>
                      <th>Periodo Reportado</th>
                      <th>Registros</th>
                      <th>Fecha de Descarga</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedLogs.map((log) => (
                      <tr key={log.id}>
                        <td><strong>{log.user_name}</strong></td>
                        <td>{log.user_cedula}</td>
                        <td>
                          <Badge status={log.user_role === "Admin" ? "badgeAdmin" : "badgeUser"} styles={styles}>
                            {log.user_role}
                          </Badge>
                        </td>
                        <td><strong>{log.download_type}</strong></td>
                        <td>{log.query_period}</td>
                        <td>{log.records_count}</td>
                        <td>{new Date(log.timestamp).toLocaleString("es-EC")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* CONTROLES DE PAGINACIÓN DE REPORTES */}
            {!loading && activeTab !== "logs" && filteredData.length > 0 && (
              <div className={styles.paginationRow}>
                <div className={styles.paginationInfo}>
                  Mostrando {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(filteredData.length, currentPage * itemsPerPage)} de {filteredData.length} registros
                </div>
                <div className={styles.paginationButtons}>
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className={styles.pageBtn}
                  >
                    &lt;&lt;
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className={styles.pageBtn}
                  >
                    Anterior
                  </button>
                  <span className={styles.pageNumber}>
                    Pág. {currentPage} de {Math.ceil(filteredData.length / itemsPerPage) || 1}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(Math.ceil(filteredData.length / itemsPerPage), p + 1))}
                    disabled={currentPage >= Math.ceil(filteredData.length / itemsPerPage)}
                    className={styles.pageBtn}
                    style={currentPage >= Math.ceil(filteredData.length / itemsPerPage) ? {} : { background: "#ffffff", color: "#005daa" }}
                  >
                    Siguiente
                  </button>
                  <button
                    onClick={() => setCurrentPage(Math.ceil(filteredData.length / itemsPerPage))}
                    disabled={currentPage >= Math.ceil(filteredData.length / itemsPerPage)}
                    className={styles.pageBtn}
                  >
                    &gt;&gt;
                  </button>
                </div>
                <div className={styles.itemsPerPageSelect}>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                  >
                    <option value={10}>10 filas</option>
                    <option value={25}>25 filas</option>
                    <option value={50}>50 filas</option>
                    <option value={100}>100 filas</option>
                  </select>
                </div>
              </div>
            )}

            {/* CONTROLES DE PAGINACIÓN DE BITÁCORA */}
            {!loading && activeTab === "logs" && filteredLogs.length > 0 && (
              <div className={styles.paginationRow}>
                <div className={styles.paginationInfo}>
                  Mostrando {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(filteredLogs.length, currentPage * itemsPerPage)} de {filteredLogs.length} logs
                </div>
                <div className={styles.paginationButtons}>
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className={styles.pageBtn}
                  >
                    &lt;&lt;
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className={styles.pageBtn}
                  >
                    Anterior
                  </button>
                  <span className={styles.pageNumber}>
                    Pág. {currentPage} de {Math.ceil(filteredLogs.length / itemsPerPage) || 1}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(Math.ceil(filteredLogs.length / itemsPerPage), p + 1))}
                    disabled={currentPage >= Math.ceil(filteredLogs.length / itemsPerPage)}
                    className={styles.pageBtn}
                  >
                    Siguiente
                  </button>
                  <button
                    onClick={() => setCurrentPage(Math.ceil(filteredLogs.length / itemsPerPage))}
                    disabled={currentPage >= Math.ceil(filteredLogs.length / itemsPerPage)}
                    className={styles.pageBtn}
                  >
                    &gt;&gt;
                  </button>
                </div>
                <div className={styles.itemsPerPageSelect}>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                  >
                    <option value={10}>10 logs</option>
                    <option value={25}>25 logs</option>
                    <option value={50}>50 logs</option>
                  </select>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Firma Presidencial exclusiva para impresión PDF */}
        <div className={styles.printOnlyFooter}>
          <div className={styles.printSignatureArea}>
            <div className={styles.printSignatureLine}>
              <p>_________________________________________</p>
              <p className={styles.signatureTitle}>Firma del Auditor Responsable</p>
              <p>Nombre: {session?.user?.name}</p>
              <p>Cédula: {(session?.user as any)?.cedula}</p>
            </div>
            <div className={styles.printSignatureLine}>
              <p>_________________________________________</p>
              <p className={styles.signatureTitle}>Control Interno / Presidencia</p>
              <p>NOVICOMPU Corporate Systems</p>
            </div>
          </div>
          <div className={styles.printDisclaimer}>
            Este reporte es confidencial y para uso exclusivo de la presidencia y juntas directivas autorizadas. Toda reproducción no autorizada queda estrictamente prohibida bajo regulaciones de auditoría de datos corporativos.
          </div>
        </div>

      </main>

      {/* Modal de CRUD de Usuarios */}
      {isUserModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2>{editingUser ? "Editar Usuario" : "Crear Nuevo Usuario"}</h2>
              <button onClick={() => setIsUserModalOpen(false)} className={styles.modalClose}>
                &times;
              </button>
            </div>
            <div className={styles.modalBody}>
              {userError && <div className={styles.modalErrorAlert}>{userError}</div>}
              
              <div className={styles.adminFormGroup}>
                <label>Número de Cédula</label>
                <input
                  type="text"
                  value={userForm.cedula}
                  onChange={(e) => setUserForm({ ...userForm, cedula: e.target.value })}
                  placeholder="Ej: 1712345678"
                  className={styles.selectFilter}
                  style={{ width: "100%", background: "#ffffff", border: "1px solid #cbd5e1", color: "#0f172a", padding: "0.55rem 0.75rem", borderRadius: "8px" }}
                  disabled={editingUser !== null}
                />
              </div>

              <div className={styles.adminFormGroup}>
                <label>Nombre Completo</label>
                <input
                  type="text"
                  value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                  placeholder="Ej: Juan Pérez"
                  className={styles.selectFilter}
                  style={{ width: "100%", background: "#ffffff", border: "1px solid #cbd5e1", color: "#0f172a", padding: "0.55rem 0.75rem", borderRadius: "8px" }}
                />
              </div>

              <div className={styles.adminFormGroup}>
                <label>Contraseña {editingUser ? "(Dejar en blanco para no modificar)" : ""}</label>
                <input
                  type="password"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  placeholder={editingUser ? "Dejar vacío" : "Contraseña"}
                  className={styles.selectFilter}
                  style={{ width: "100%", background: "#ffffff", border: "1px solid #cbd5e1", color: "#0f172a", padding: "0.55rem 0.75rem", borderRadius: "8px" }}
                />
              </div>

              <div className={styles.adminFormGroup}>
                <label>Rol Asociado (Permisos)</label>
                <select
                  value={userForm.roleId}
                  onChange={(e) => setUserForm({ ...userForm, roleId: e.target.value })}
                  className={styles.adminSelectEnv}
                  style={{ width: "100%", padding: "0.55rem 0.75rem" }}
                >
                  <option value="">Seleccionar Rol...</option>
                  {adminRoles.map((role) => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
              </div>

              <div className={styles.modalActions}>
                <Button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className={styles.btnCancel}
                  disabled={submittingUser}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handleSubmitUser}
                  className={styles.btnConfirm}
                  loading={submittingUser}
                  loadingText="Guardando..."
                >
                  Guardar Usuario
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de CRUD de Roles */}
      {isRoleModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent} style={{ width: "520px" }}>
            <div className={styles.modalHeader}>
              <h2>{editingRole ? "Editar Rol" : "Crear Nuevo Rol"}</h2>
              <button onClick={() => setIsRoleModalOpen(false)} className={styles.modalClose}>
                &times;
              </button>
            </div>
            <div className={styles.modalBody}>
              {roleError && <div className={styles.modalErrorAlert}>{roleError}</div>}
              
              <div className={styles.adminFormGroup}>
                <label>Nombre del Rol</label>
                <input
                  type="text"
                  value={roleForm.name}
                  onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                  placeholder="Ej: Auditor Externo"
                  className={styles.selectFilter}
                  style={{ width: "100%", background: "#ffffff", border: "1px solid #cbd5e1", color: "#0f172a", padding: "0.55rem 0.75rem", borderRadius: "8px" }}
                  disabled={editingRole?.name === "Admin" || editingRole?.name === "Visitante"}
                />
              </div>

              <div className={styles.adminFormGroup} style={{ marginTop: "1.25rem" }}>
                <label>Permisos y Acciones Autorizadas</label>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem", marginTop: "0.5rem", maxHeight: "220px", overflowY: "auto", paddingRight: "0.5rem" }}>
                  {adminPermissions.map((perm) => {
                    const isChecked = roleForm.permissionIds.includes(perm.id);
                    return (
                      <label key={perm.id} style={{ display: "flex", alignItems: "flex-start", gap: "0.65rem", cursor: "pointer", fontSize: "0.85rem", color: "#0f172a" }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handlePermissionToggle(perm.id)}
                          style={{ marginTop: "0.15rem", cursor: "pointer" }}
                        />
                        <div>
                          <span style={{ fontWeight: "700" }}>{perm.action}</span>
                          <p style={{ margin: "0.05rem 0 0 0", fontSize: "0.75rem", color: "#64748b" }}>{perm.description}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className={styles.modalActions}>
                <Button
                  type="button"
                  onClick={() => setIsRoleModalOpen(false)}
                  className={styles.btnCancel}
                  disabled={submittingRole}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handleSubmitRole}
                  className={styles.btnConfirm}
                  loading={submittingRole}
                  loadingText="Guardando..."
                >
                  Guardar Rol
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
