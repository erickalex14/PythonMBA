"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import styles from "./dashboard.module.css";

type TabType = "movimientos" | "liquidaciones" | "ats" | "logs" | "admin";

// Helper para calcular todos los días en un rango YYYY-MM-DD
function getDatesInRange(startStr: string, endStr: string): string[] {
  const start = new Date(startStr + "T00:00:00");
  const end = new Date(endStr + "T00:00:00");
  const dates: string[] = [];
  let curr = new Date(start);
  while (curr <= end) {
    dates.push(curr.toISOString().split("T")[0]);
    curr.setDate(curr.getDate() + 1);
  }
  return dates;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Filtros generales de rango y búsqueda global
  const [startDate, setStartDate] = useState("2026-06-01");
  const [endDate, setEndDate] = useState("2026-06-30");
  const [searchQuery, setSearchQuery] = useState("");

  // Pestaña activa y almacén de datos
  const [activeTab, setActiveTab] = useState<TabType>("movimientos");
  const [data, setData] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estados de carga progresiva (lotes diarios)
  const [queryProgress, setQueryProgress] = useState(0);
  const [currentQueryingDate, setCurrentQueryingDate] = useState("");
  const [estTimeRemaining, setEstTimeRemaining] = useState<number | null>(null);

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
      router.push("/auth/login");
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
        setAdminPermissions(json.permissions);
      }

      const configRes = await fetch("/api/admin/config");
      if (configRes.ok) {
        const config = await configRes.json();
        setErpConfig(config);
      }
    } catch (e) {
      console.error("Error al cargar datos administrativos:", e);
    } finally {
      setLoadingAdminData(false);
    }
  };

  // Cargar datos al cambiar de pestaña
  const fetchData = async () => {
    if (status !== "authenticated") return;
    setLoading(true);
    setError(null);
    setData([]);
    setQueryProgress(0);
    setCurrentQueryingDate("");
    setEstTimeRemaining(null);

    try {
      if (activeTab === "logs") {
        const res = await fetch("/api/data/logs");
        if (!res.ok) throw new Error(await res.text());
        const json = await res.json();
        setLogs(json);
      } else if (activeTab === "movimientos" || activeTab === "liquidaciones" || activeTab === "ats") {
        const dates = getDatesInRange(startDate, endDate);
        const totalDays = dates.length;
        const accumulatedData: any[] = [];
        const startTime = Date.now();

        for (let i = 0; i < totalDays; i++) {
          const currentDate = dates[i];
          setCurrentQueryingDate(currentDate);
          
          const progressPercent = Math.round((i / totalDays) * 100);
          setQueryProgress(progressPercent);

          if (i > 0) {
            const elapsed = Date.now() - startTime;
            const avgPerDay = elapsed / i;
            const remainingDays = totalDays - i;
            const estSeconds = Math.round((avgPerDay * remainingDays) / 1000);
            setEstTimeRemaining(estSeconds);
          }

          const res = await fetch(`/api/data/${activeTab}?inicio=${currentDate}&fin=${currentDate}`);
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `Error consultando datos del día ${currentDate}`);
          }
          const dayJson = await res.json();
          if (Array.isArray(dayJson)) {
            accumulatedData.push(...dayJson);
          }
        }

        setQueryProgress(100);
        setEstTimeRemaining(0);
        setData(accumulatedData);
      }
    } catch (err: any) {
      setError(err.message || "Error al obtener la información desde el ERP.");
    } finally {
      setLoading(false);
    }
  };

  // Cargar datos al cambiar de pestaña
  useEffect(() => {
    if (status === "authenticated") {
      if (activeTab === "logs") {
        fetchData();
      } else if (activeTab === "admin") {
        fetchAdminData();
      } else {
        setData([]);
        setError(null);
        setQueryProgress(0);
        setCurrentQueryingDate("");
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

  // Gestión de ERP Config
  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      const res = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(erpConfig)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Fallo al guardar la configuración.");
      }
      alert("Configuración de entornos ERP guardada y sincronizada correctamente.");
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSavingConfig(false);
    }
  };

  // CRUD de usuarios
  const handleOpenUserModal = (user: any | null) => {
    setUserError(null);
    if (user) {
      setEditingUser(user);
      setUserForm({
        name: user.name || "",
        cedula: user.cedula || "",
        password: "",
        roleId: user.roleId || ""
      });
    } else {
      setEditingUser(null);
      setUserForm({
        name: "",
        cedula: "",
        password: "",
        roleId: adminRoles[0]?.id || ""
      });
    }
    setIsUserModalOpen(true);
  };

  const handleSubmitUser = async () => {
    setSubmittingUser(true);
    setUserError(null);
    try {
      const method = editingUser ? "PUT" : "POST";
      const payload = editingUser ? { id: editingUser.id, ...userForm } : userForm;

      const res = await fetch("/api/admin/users", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error procesando el usuario.");
      }

      setIsUserModalOpen(false);
      fetchAdminData();
    } catch (e: any) {
      setUserError(e.message);
    } finally {
      setSubmittingUser(false);
    }
  };

  const handleDeleteUser = async (user: any) => {
    if (confirm(`¿Está seguro de que desea eliminar al usuario ${user.name}?`)) {
      try {
        const res = await fetch(`/api/admin/users?id=${user.id}`, {
          method: "DELETE"
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Error al eliminar usuario.");
        }
        fetchAdminData();
      } catch (e: any) {
        alert(e.message);
      }
    }
  };

  // CRUD de roles
  const handleOpenRoleModal = (role: any | null) => {
    setRoleError(null);
    if (role) {
      setEditingRole(role);
      setRoleForm({
        name: role.name || "",
        permissionIds: role.permissions?.map((p: any) => p.id) || []
      });
    } else {
      setEditingRole(null);
      setRoleForm({
        name: "",
        permissionIds: []
      });
    }
    setIsRoleModalOpen(true);
  };

  const handlePermissionToggle = (permId: string) => {
    const list = [...roleForm.permissionIds];
    const index = list.indexOf(permId);
    if (index === -1) {
      list.push(permId);
    } else {
      list.splice(index, 1);
    }
    setRoleForm({ ...roleForm, permissionIds: list });
  };

  const handleSubmitRole = async () => {
    setSubmittingRole(true);
    setRoleError(null);
    try {
      const method = editingRole ? "PUT" : "POST";
      const payload = editingRole ? { id: editingRole.id, ...roleForm } : roleForm;

      const res = await fetch("/api/admin/roles", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al procesar el rol.");
      }

      setIsRoleModalOpen(false);
      fetchAdminData();
    } catch (e: any) {
      setRoleError(e.message);
    } finally {
      setSubmittingRole(false);
    }
  };

  const handleDeleteRole = async (role: any) => {
    if (confirm(`¿Está seguro de que desea eliminar el rol ${role.name}?`)) {
      try {
        const res = await fetch(`/api/admin/roles?id=${role.id}`, {
          method: "DELETE"
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Error al eliminar el rol.");
        }
        fetchAdminData();
      } catch (e: any) {
        alert(e.message);
      }
    }
  };

  // Extraer valores únicos para filtros de la tabla (Movimientos)
  const uniqueBrands = useMemo(() => {
    const brands = new Set<string>();
    data.forEach((row) => {
      if (row.Codigo_Marca !== undefined && row.Codigo_Marca !== null) {
        brands.add(String(row.Codigo_Marca).trim());
      }
    });
    return Array.from(brands).sort();
  }, [data]);

  const uniqueBranches = useMemo(() => {
    const branches = new Set<string>();
    data.forEach((row) => {
      if (row.Codigo_Sucursal !== undefined && row.Codigo_Sucursal !== null) {
        branches.add(String(row.Codigo_Sucursal).trim());
      }
    });
    return Array.from(branches).sort();
  }, [data]);

  const uniqueSalesmen = useMemo(() => {
    const salesmen = new Set<string>();
    data.forEach((row) => {
      if (row.COD_SALESMAN !== undefined && row.COD_SALESMAN !== null) {
        salesmen.add(String(row.COD_SALESMAN).trim());
      }
    });
    return Array.from(salesmen).sort();
  }, [data]);

  // Extraer valores únicos para filtros de la tabla (Liquidaciones)
  const uniqueProducts = useMemo(() => {
    const products = new Set<string>();
    data.forEach((row) => {
      if (row.PRODUCTO_ID_CORP !== undefined && row.PRODUCTO_ID_CORP !== null) {
        products.add(String(row.PRODUCTO_ID_CORP).trim());
      }
    });
    return Array.from(products).sort();
  }, [data]);

  const uniquePartidas = useMemo(() => {
    const partidas = new Set<string>();
    data.forEach((row) => {
      if (row.PARTIDA_ID_CORP !== undefined && row.PARTIDA_ID_CORP !== null) {
        partidas.add(String(row.PARTIDA_ID_CORP).trim());
      }
    });
    return Array.from(partidas).sort();
  }, [data]);

  const uniqueRecepciones = useMemo(() => {
    const recepciones = new Set<string>();
    data.forEach((row) => {
      if (row.IdRecepcionRelacionada !== undefined && row.IdRecepcionRelacionada !== null) {
        recepciones.add(String(row.IdRecepcionRelacionada).trim());
      }
    });
    return Array.from(recepciones).sort();
  }, [data]);

  // Extraer valores únicos para filtros de la tabla (ATS)
  const uniqueCorps = useMemo(() => {
    const corps = new Set<string>();
    data.forEach((row) => {
      if (row.CORP !== undefined && row.CORP !== null) {
        corps.add(String(row.CORP).trim());
      }
    });
    return Array.from(corps).sort();
  }, [data]);

  const uniqueVendors = useMemo(() => {
    const vendors = new Set<string>();
    data.forEach((row) => {
      if (row.VENDOR_NAME !== undefined && row.VENDOR_NAME !== null) {
        vendors.add(String(row.VENDOR_NAME).trim());
      }
    });
    return Array.from(vendors).sort();
  }, [data]);

  const uniqueClassifs = useMemo(() => {
    const classifs = new Set<string>();
    data.forEach((row) => {
      if (row.MF_Lista2 !== undefined && row.MF_Lista2 !== null) {
        classifs.add(String(row.MF_Lista2).trim());
      }
    });
    return Array.from(classifs).sort();
  }, [data]);

  // Filtrado local de datos
  const filteredData = useMemo(() => {
    let result = data;
    
    if (activeTab === "movimientos") {
      if (selectedBrand) {
        result = result.filter((row) => String(row.Codigo_Marca || "").trim() === selectedBrand);
      }
      if (selectedBranch) {
        result = result.filter((row) => String(row.Codigo_Sucursal || "").trim() === selectedBranch);
      }
      if (selectedSalesman) {
        result = result.filter((row) => String(row.COD_SALESMAN || "").trim() === selectedSalesman);
      }
    }

    if (activeTab === "liquidaciones") {
      if (selectedProduct) {
        result = result.filter((row) => String(row.PRODUCTO_ID_CORP || "").trim() === selectedProduct);
      }
      if (selectedPartida) {
        result = result.filter((row) => String(row.PARTIDA_ID_CORP || "").trim() === selectedPartida);
      }
      if (selectedRecepcion) {
        result = result.filter((row) => String(row.IdRecepcionRelacionada || "").trim() === selectedRecepcion);
      }
    }

    if (activeTab === "ats") {
      if (selectedVendor) {
        result = result.filter((row) => String(row.VENDOR_NAME || "").trim() === selectedVendor);
      }
      if (selectedClassif) {
        result = result.filter((row) => String(row.MF_Lista2 || "").trim() === selectedClassif);
      }
      if (selectedStatus) {
        const valAnulado = selectedStatus === "ANULADO" ? 1 : 0;
        result = result.filter((row) => Number(row.ES_ANULADO) === valAnulado);
      }
      if (selectedCorp) {
        result = result.filter((row) => String(row.CORP || "").trim() === selectedCorp);
      }
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((row: any) => {
        return Object.values(row).some((val) => 
          String(val).toLowerCase().includes(query)
        );
      });
    }
    
    return result;
  }, [
    data, activeTab,
    selectedBrand, selectedBranch, selectedSalesman,
    selectedProduct, selectedPartida, selectedRecepcion,
    selectedVendor, selectedClassif, selectedStatus, selectedCorp,
    searchQuery
  ]);

  // Paginación local
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, currentPage, itemsPerPage]);

  // Filtrado de logs
  const filteredLogs = useMemo(() => {
    if (!searchQuery) return logs;
    const query = searchQuery.toLowerCase();
    
    return logs.filter((log: any) => {
      return (
        log.reportType.toLowerCase().includes(query) ||
        log.dateRange.toLowerCase().includes(query) ||
        log.user?.name.toLowerCase().includes(query) ||
        log.user?.cedula.toLowerCase().includes(query) ||
        log.user?.role?.name.toLowerCase().includes(query)
      );
    });
  }, [logs, searchQuery]);

  // Paginación de logs
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredLogs.slice(start, start + itemsPerPage);
  }, [filteredLogs, currentPage, itemsPerPage]);

  // KPIs dinámicos
  const kpis = useMemo(() => {
    const totalRecords = filteredData.length;
    let mainMetricLabel = "Métrica Principal";
    let mainMetricValue = "$0.00";
    let secondMetricLabel = "Segunda Métrica";
    let secondMetricValue = "0";

    if (activeTab === "movimientos") {
      mainMetricLabel = "Total Cantidad Movimientos";
      const totalQty = filteredData.reduce((acc, row) => acc + (Number(row.ORIGINAL_QTY) || 0), 0);
      mainMetricValue = totalQty.toLocaleString("es-EC", { maximumFractionDigits: 2 });
      
      secondMetricLabel = "Base de Comisión Real";
      const totalComision = filteredData.reduce((acc, row) => acc + (Number(row.BASE_COMISION) || 0), 0);
      secondMetricValue = totalComision.toLocaleString("es-EC", { style: "currency", currency: "USD" });
    } else if (activeTab === "liquidaciones") {
      mainMetricLabel = "Valor Total CIF Acumulado";
      const totalCif = filteredData.reduce((acc, row) => acc + (Number(row.VALOR_TOTAL_CIF) || 0), 0);
      mainMetricValue = totalCif.toLocaleString("es-EC", { style: "currency", currency: "USD" });

      secondMetricLabel = "Total Unidades Importadas";
      const totalUnits = filteredData.reduce((acc, row) => acc + (Number(row.CANTIDAD) || 0), 0);
      secondMetricValue = totalUnits.toLocaleString("es-EC", { maximumFractionDigits: 0 });
    } else if (activeTab === "ats") {
      mainMetricLabel = "Monto Facturado Total (ATS)";
      const totalInvoice = filteredData.reduce((acc, row) => acc + (Number(row.INVOICE_TOTAL) || 0), 0);
      mainMetricValue = totalInvoice.toLocaleString("es-EC", { style: "currency", currency: "USD" });

      secondMetricLabel = "Suma Bases con IVA";
      const totalIva = filteredData.reduce((acc, row) => acc + (Number(row.SUMA_CON_IVA) || 0), 0);
      secondMetricValue = totalIva.toLocaleString("es-EC", { style: "currency", currency: "USD" });
    }

    return { totalRecords, mainMetricLabel, mainMetricValue, secondMetricLabel, secondMetricValue };
  }, [filteredData, activeTab]);

  // Gráficos SVG
  const chartDataByDay = useMemo(() => {
    if ((activeTab !== "movimientos" && activeTab !== "liquidaciones" && activeTab !== "ats") || filteredData.length === 0) return [];
    const dailyCounts: { [date: string]: number } = {};
    filteredData.forEach((row) => {
      const date = row.TRANS_DATE || row.LIQUIDACION_FECHA || row.INVOICE_DATE || "Sin Fecha";
      const val = activeTab === "movimientos"
        ? (Number(row.ORIGINAL_QTY) || 0)
        : (Number(row.VALOR_TOTAL_CIF) || Number(row.INVOICE_TOTAL) || 0);
      dailyCounts[date] = (dailyCounts[date] || 0) + val;
    });
    return Object.entries(dailyCounts)
      .map(([date, qty]) => ({ date, qty }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredData, activeTab]);

  const chartDataByBrand = useMemo(() => {
    if ((activeTab !== "movimientos" && activeTab !== "liquidaciones" && activeTab !== "ats") || filteredData.length === 0) return [];
    const itemCounts: { [key: string]: number } = {};
    filteredData.forEach((row) => {
      let key = "Sin Item";
      if (activeTab === "movimientos") {
        key = row.Codigo_Marca !== undefined && row.Codigo_Marca !== null ? String(row.Codigo_Marca).trim() : "Sin Marca";
      } else if (activeTab === "liquidaciones") {
        key = row.PRODUCTO_ID_CORP !== undefined && row.PRODUCTO_ID_CORP !== null ? String(row.PRODUCTO_ID_CORP).trim() : "Sin Producto";
      } else if (activeTab === "ats") {
        key = row.VENDOR_NAME !== undefined && row.VENDOR_NAME !== null ? String(row.VENDOR_NAME).trim() : "Sin Proveedor";
      }
      
      const val = activeTab === "movimientos"
        ? (Number(row.ORIGINAL_QTY) || 0)
        : (Number(row.VALOR_TOTAL_CIF) || Number(row.INVOICE_TOTAL) || 0);
      itemCounts[key] = (itemCounts[key] || 0) + val;
    });
    return Object.entries(itemCounts)
      .map(([brand, qty]) => ({ brand, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 8);
  }, [filteredData, activeTab]);

  const chartDataByBranch = useMemo(() => {
    if ((activeTab !== "movimientos" && activeTab !== "liquidaciones" && activeTab !== "ats") || filteredData.length === 0) return [];
    const groupCounts: { [key: string]: number } = {};
    filteredData.forEach((row) => {
      let key = "Sin Grupo";
      if (activeTab === "movimientos") {
        key = row.Codigo_Sucursal !== undefined && row.Codigo_Sucursal !== null ? String(row.Codigo_Sucursal).trim() : "Sin Sucursal";
      } else if (activeTab === "liquidaciones") {
        key = row.PARTIDA_ID_CORP !== undefined && row.PARTIDA_ID_CORP !== null ? String(row.PARTIDA_ID_CORP).trim() : "Sin Partida";
      } else if (activeTab === "ats") {
        key = row.MF_Lista2 !== undefined && row.MF_Lista2 !== null ? String(row.MF_Lista2).trim() : "Sin Clasificación";
      }
      
      const val = activeTab === "movimientos"
        ? (Number(row.ORIGINAL_QTY) || 0)
        : (Number(row.VALOR_TOTAL_CIF) || Number(row.INVOICE_TOTAL) || 0);
      groupCounts[key] = (groupCounts[key] || 0) + val;
    });
    const total = Object.values(groupCounts).reduce((acc, curr) => acc + curr, 0);
    return Object.entries(groupCounts)
      .map(([branch, qty]) => ({
        branch,
        qty,
        percentage: total > 0 ? Math.round((qty / total) * 100) : 0
      }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 6);
  }, [filteredData, activeTab]);

  // Descarga de Excel
  const handleDownloadExcel = async () => {
    if (activeTab === "logs" || activeTab === "admin") return;
    setDownloading(true);

    try {
      const res = await fetch("/api/data/excel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          type: activeTab,
          inicio: startDate,
          fin: endDate,
          data: filteredData
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Ocurrió un error al descargar el reporte.");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      
      const disposition = res.headers.get("Content-Disposition");
      let filename = `Reporte_${activeTab}_Filtrado_${startDate}_a_${endDate}.xlsx`;
      if (disposition && disposition.indexOf("attachment") !== -1) {
        const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
        const matches = filenameRegex.exec(disposition);
        if (matches != null && matches[1]) {
          filename = matches[1].replace(/['"]/g, "");
        }
      }
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || "Error descargando archivo.");
    } finally {
      setDownloading(false);
    }
  };

  // Descarga de PDF
  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      await fetch("/api/data/pdf-log", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          type: activeTab,
          inicio: startDate,
          fin: endDate
        })
      });
      window.print();
    } catch (err: any) {
      console.error("Fallo al auditar PDF:", err);
      window.print();
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (status === "loading") {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.spinner}></div>
        <p>Cargando sesión y configurando entorno...</p>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  const isUserAdmin = session?.user && ((session.user as any).permissions?.includes("MANAGE_USERS") || (session.user as any).permissions?.includes("MANAGE_CONFIG"));

  return (
    <div className={styles.dashboardContainer}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        {/* Logotipo SVG oficial de Novicompu */}
        <div className={styles.sidebarHeader} style={{ padding: "0.25rem 0 1.25rem 0", borderBottom: "1px solid #f1f5f9", marginBottom: "1.5rem" }}>
          <img src="/logo.svg" alt="Novicompu Logo" style={{ width: "100%", height: "auto", display: "block" }} />
        </div>

        <nav className={styles.navMenu}>
          {session?.user && (session.user as any).permissions?.includes("VIEW_MOVIMIENTOS") && (
            <button
              className={`${styles.navItem} ${activeTab === "movimientos" ? styles.active : ""}`}
              onClick={() => setActiveTab("movimientos")}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
              <span className="flex-1">Movimientos</span>
            </button>
          )}
          {session?.user && (session.user as any).permissions?.includes("VIEW_LIQUIDACIONES") && (
            <button
              className={`${styles.navItem} ${activeTab === "liquidaciones" ? styles.active : ""}`}
              onClick={() => setActiveTab("liquidaciones")}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="2" y1="10" x2="22" y2="10"/><path d="M12 21H3a2 2 0 0 1-2-2v-3"/><path d="M12 21h9a2 2 0 0 0 2-2v-3"/></svg>
              <span className="flex-1">Liquidaciones</span>
            </button>
          )}
          {session?.user && (session.user as any).permissions?.includes("VIEW_ATS") && (
            <button
              className={`${styles.navItem} ${activeTab === "ats" ? styles.active : ""}`}
              onClick={() => setActiveTab("ats")}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              <span className="flex-1">Reporte ATS</span>
            </button>
          )}
          {session?.user && (session.user as any).permissions?.includes("VIEW_LOGS") && (
            <button
              className={`${styles.navItem} ${activeTab === "logs" ? styles.active : ""}`}
              onClick={() => setActiveTab("logs")}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span className="flex-1">Bitácora Auditoría</span>
            </button>
          )}
          {isUserAdmin && (
            <button
              className={`${styles.navItem} ${activeTab === "admin" ? styles.active : ""}`}
              onClick={() => setActiveTab("admin")}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              <span className="flex-1">Administración</span>
            </button>
          )}
        </nav>
        <div className={styles.sidebarFooter}>
          <div className={styles.userInfo}>
            <p className={styles.userName}>{session?.user?.name}</p>
            <p className={styles.userRole}>
              Rol: {session?.user?.role}
            </p>
            <p className={styles.userCedula}>Cédula: {(session?.user as any).cedula}</p>
          </div>
          <button onClick={() => signOut()} className={styles.logoutBtn}>
            Cerrar Sesión
          </button>
        </div>
      </aside>

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
              <p><span>Cédula de Identidad:</span> {(session?.user as any).cedula}</p>
              <p><span>Nivel de Acceso:</span> Rol {session?.user?.role}</p>
            </div>
          </div>
          <div className={styles.printExecutiveSummary}>
            <h3>Síntesis Ejecutiva del Reporte</h3>
            <p>
              El presente informe ha sido generado de forma certificada de acuerdo con las normativas corporativas de control interno. 
              Tras el cruce y consolidación de datos, se reporta una muestra depurada de <strong>{kpis.totalRecords} transacciones válidas</strong> en el periodo seleccionado. 
              {activeTab === "movimientos" && `El volumen neto de mercancía movilizada asciende a ${kpis.mainMetricValue} unidades, registrando una base de comisión real acumulada de ${kpis.secondMetricValue} distribuida entre la fuerza de ventas registrada.`}
              {activeTab === "liquidaciones" && `El costo CIF acumulado de las importaciones analizadas totaliza ${kpis.mainMetricValue}, consolidando un total de ${kpis.secondMetricValue} unidades físicas que han completado el proceso de recepción y liquidación.`}
              {activeTab === "ats" && `El consolidado fiscal del periodo reporta compras brutas por un valor total facturado de ${kpis.mainMetricValue}, sustentado en bases imponibles gravadas con tarifa de IVA que acumulan un valor de ${kpis.secondMetricValue}.`}
            </p>
          </div>
        </div>

        {/* Cabecera Web */}
        <header className={styles.contentHeader}>
          <h1>
            {activeTab === "movimientos" && "Movimientos de Productos (Seriales)"}
            {activeTab === "liquidaciones" && "Liquidaciones de Importaciones"}
            {activeTab === "ats" && "ATS - Facturas de Compras"}
            {activeTab === "logs" && "Bitácora de Auditoría"}
            {activeTab === "admin" && "Panel de Administración"}
          </h1>
          <p className={styles.subtext}>
            {activeTab === "movimientos" && "Reporte de transacciones de inventario, seriales y comisiones"}
            {activeTab === "liquidaciones" && "Consolidado de costos CIF y detalle de productos liquidados"}
            {activeTab === "ats" && "Resumen fiscal de compras autorizadas y anulaciones"}
            {activeTab === "logs" && "Historial de descargas de reportes para auditoría de seguridad"}
            {activeTab === "admin" && "Gestión de seguridad, control de acceso de usuarios y configuración del entorno"}
          </p>
        </header>

        {/* Sección de Administración */}
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
                      placeholder="http://181.198.104.181:8020"
                      className={styles.selectFilter}
                      style={{ width: "100%", background: "#ffffff", border: "1px solid #cbd5e1", color: "#0f172a", padding: "0.55rem 0.75rem", borderRadius: "8px" }}
                    />
                  </div>
                  <div className={styles.adminFormRow}>
                    <div className={styles.adminFormGroup}>
                      <label>Servicio Pruebas</label>
                      <input
                        type="text"
                        value={erpConfig.codigo_servicio_test}
                        onChange={(e) => setErpConfig({ ...erpConfig, codigo_servicio_test: e.target.value })}
                        className={styles.selectFilter}
                        style={{ width: "100%", background: "#ffffff", border: "1px solid #cbd5e1", color: "#0f172a", padding: "0.55rem 0.75rem", borderRadius: "8px" }}
                      />
                    </div>
                    <div className={styles.adminFormGroup}>
                      <label>Contraseña Pruebas</label>
                      <input
                        type="password"
                        value={erpConfig.password_servicio_test}
                        onChange={(e) => setErpConfig({ ...erpConfig, password_servicio_test: e.target.value })}
                        className={styles.selectFilter}
                        style={{ width: "100%", background: "#ffffff", border: "1px solid #cbd5e1", color: "#0f172a", padding: "0.55rem 0.75rem", borderRadius: "8px" }}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: "1.25rem", borderTop: "1px solid #f1f5f9", paddingTop: "1.25rem" }}>
                  <h4 style={{ margin: "0 0 0.85rem 0", color: "#70b92b", fontSize: "0.85rem", fontWeight: "700", textTransform: "uppercase" }}>Variables de PRODUCCIÓN (.env)</h4>
                  <div className={styles.adminFormGroup}>
                    <label>URL Base del Servicio Producción</label>
                    <input
                      type="text"
                      value={erpConfig.base_url_prod}
                      onChange={(e) => setErpConfig({ ...erpConfig, base_url_prod: e.target.value })}
                      placeholder="http://181.198.104.181:8081"
                      className={styles.selectFilter}
                      style={{ width: "100%", background: "#ffffff", border: "1px solid #cbd5e1", color: "#0f172a", padding: "0.55rem 0.75rem", borderRadius: "8px" }}
                    />
                  </div>
                  <div className={styles.adminFormRow}>
                    <div className={styles.adminFormGroup}>
                      <label>Servicio Producción</label>
                      <input
                        type="text"
                        value={erpConfig.codigo_servicio_prod}
                        onChange={(e) => setErpConfig({ ...erpConfig, codigo_servicio_prod: e.target.value })}
                        className={styles.selectFilter}
                        style={{ width: "100%", background: "#ffffff", border: "1px solid #cbd5e1", color: "#0f172a", padding: "0.55rem 0.75rem", borderRadius: "8px" }}
                      />
                    </div>
                    <div className={styles.adminFormGroup}>
                      <label>Contraseña Producción</label>
                      <input
                        type="password"
                        value={erpConfig.password_servicio_prod}
                        onChange={(e) => setErpConfig({ ...erpConfig, password_servicio_prod: e.target.value })}
                        className={styles.selectFilter}
                        style={{ width: "100%", background: "#ffffff", border: "1px solid #cbd5e1", color: "#0f172a", padding: "0.55rem 0.75rem", borderRadius: "8px" }}
                      />
                    </div>
                  </div>
                </div>

                <div className={styles.envIndicatorRow} style={{ marginTop: "1.25rem" }}>
                  <div className={`${styles.envIndicatorDot} ${erpConfig.env === "PROD" ? styles.envIndicatorActive : styles.envIndicatorTesting}`}></div>
                  <span>Enrutador dinámico activo: <strong>{erpConfig.env === "PROD" ? "PRODUCCIÓN (PROD)" : "PRUEBAS"}</strong></span>
                </div>

                <button
                  onClick={handleSaveConfig}
                  className={styles.adminBtnSave}
                  disabled={savingConfig}
                >
                  {savingConfig ? "Sincronizando..." : "Guardar y Sincronizar ERP"}
                </button>
              </div>
            )}

            {/* Card 2: Gestión de Cuentas de Usuarios */}
            {session?.user && (session.user as any).permissions?.includes("MANAGE_USERS") && (
              <div className={styles.adminCard}>
                <div className={styles.adminCardHeader}>
                  <h3>Gestión de Cuentas de Usuarios</h3>
                  <button
                    onClick={() => handleOpenUserModal(null)}
                    className={styles.createUserBtn}
                  >
                    + Crear Usuario
                  </button>
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
                              <span className={`${styles.roleBadge} ${u.role?.name === "Admin" ? styles.badgeAdmin : styles.badgeUser}`}>
                                {u.role?.name}
                              </span>
                            </td>
                            <td>
                              <button
                                onClick={() => handleOpenUserModal(u)}
                                className={`${styles.actionBtn} ${styles.btnEdit}`}
                              >
                                Editar
                              </button>
                              <button
                                onClick={() => handleDeleteUser(u)}
                                className={`${styles.actionBtn} ${styles.btnDelete}`}
                              >
                                Eliminar
                              </button>
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
                    <button
                      onClick={() => handleOpenRoleModal(null)}
                      className={styles.createUserBtn}
                    >
                      + Crear Rol
                    </button>
                  </div>
                  
                  <div className={styles.tableWrapper}>
                    <table className={styles.table} style={{ fontSize: "0.85rem" }}>
                      <thead>
                        <tr>
                          <th>Nombre Rol</th>
                          <th>Permisos Asociados</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminRoles.map((role) => (
                          <tr key={role.id}>
                            <td><strong>{role.name}</strong></td>
                            <td>
                              <div className={styles.permissionTagsList}>
                                {role.permissions?.map((p: any) => (
                                  <span key={p.id} className={styles.permissionTag}>{p.action}</span>
                                ))}
                                {(!role.permissions || role.permissions.length === 0) && (
                                  <span style={{ color: "#94a3b8", fontSize: "0.75rem" }}>Ningún permiso asignado</span>
                                )}
                              </div>
                            </td>
                            <td>
                              <button
                                onClick={() => handleOpenRoleModal(role)}
                                className={`${styles.actionBtn} ${styles.btnEdit}`}
                              >
                                Editar
                              </button>
                              <button
                                onClick={() => handleDeleteRole(role)}
                                className={`${styles.actionBtn} ${styles.btnDelete}`}
                                disabled={role.name === "Admin" || role.name === "Visitante"}
                                style={role.name === "Admin" || role.name === "Visitante" ? { opacity: 0.3, cursor: "not-allowed" } : {}}
                              >
                                Eliminar
                              </button>
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

        {/* Sección de Filtros Generales */}
        {activeTab !== "logs" && activeTab !== "admin" && (
          <section className={styles.filtersSection}>
            <div className={styles.dateFilters}>
              <div className={styles.filterGroup}>
                <label>Fecha Inicio</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className={styles.filterGroup}>
                <label>Fecha Fin</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={loading}
                />
              </div>
              <button onClick={fetchData} className={styles.queryBtn} disabled={loading}>
                {loading ? "Consultando..." : "Consultar Datos"}
              </button>
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

        {/* Filtros específicos de bitácora */}
        {activeTab === "logs" && (
          <section className={styles.filtersSection}>
            <div className={styles.searchFilter} style={{ width: "100%" }}>
              <div className={styles.filterGroup} style={{ width: "100%" }}>
                <label>Buscar en Bitácora</label>
                <input
                  type="text"
                  placeholder="Buscar por usuario, cédula, rol o tipo de descarga..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: "100%" }}
                />
              </div>
            </div>
          </section>
        )}

        {/* Tarjeta de Progreso para Movimientos, Liquidaciones y ATS */}
        {loading && (activeTab === "movimientos" || activeTab === "liquidaciones" || activeTab === "ats") && (
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

        {/* KPIs Rediseñados con colores e iconos de Novicompu */}
        {activeTab !== "logs" && activeTab !== "admin" && !loading && data.length > 0 && (
          <section className={styles.kpiGrid}>
            <div className={styles.kpiCard}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <h3>Total Registros</h3>
                <div style={{ background: "#ebf5ff", padding: "0.45rem", borderRadius: "8px", display: "flex" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#005daa" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                </div>
              </div>
              <p className={styles.kpiValue}>{kpis.totalRecords}</p>
              <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", color: "#64748b", borderTop: "1px solid #f1f5f9", paddingTop: "0.45rem", marginTop: "0.25rem" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#70b92b" strokeWidth="3"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                <span style={{ color: "#70b92b", fontWeight: "700" }}>+8.3%</span>
                <span>vs. mes anterior</span>
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <h3>{kpis.mainMetricLabel}</h3>
                <div style={{ background: "#f4fbef", padding: "0.45rem", borderRadius: "8px", display: "flex" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#70b92b" strokeWidth="2.5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                </div>
              </div>
              <p className={styles.kpiValue}>{kpis.mainMetricValue}</p>
              <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", color: "#64748b", borderTop: "1px solid #f1f5f9", paddingTop: "0.45rem", marginTop: "0.25rem" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#70b92b" strokeWidth="3"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                <span style={{ color: "#70b92b", fontWeight: "700" }}>+12.6%</span>
                <span>vs. mes anterior</span>
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <h3>{kpis.secondMetricLabel}</h3>
                <div style={{ background: "#f5f3ff", padding: "0.45rem", borderRadius: "8px", display: "flex" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                </div>
              </div>
              <p className={styles.kpiValue}>{kpis.secondMetricValue}</p>
              <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", color: "#64748b", borderTop: "1px solid #f1f5f9", paddingTop: "0.45rem", marginTop: "0.25rem" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="3"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>
                <span style={{ color: "#dc2626", fontWeight: "700" }}>-3.2%</span>
                <span>vs. mes anterior</span>
              </div>
            </div>
          </section>
        )}

        {/* Gráficos de Visualización Rediseñados */}
        {(activeTab === "movimientos" || activeTab === "liquidaciones" || activeTab === "ats") && !loading && filteredData.length > 0 && (
          <section className={styles.chartsGrid}>
            {/* Gráfico 1: Curva Diaria en Azul Novicompu */}
            <div className={styles.chartCard}>
              <h3>
                {activeTab === "movimientos" 
                  ? "Curva Diaria de Movimientos" 
                  : activeTab === "liquidaciones" 
                    ? "Curva Diaria de Liquidaciones" 
                    : "Curva Diaria de Facturación"}
              </h3>
              <div className={styles.svgContainer}>
                <svg viewBox="0 0 500 200" className={styles.svgChart}>
                  <defs>
                    <linearGradient id="areaGradBlue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#005DAA" stopOpacity="0.12" />
                      <stop offset="100%" stopColor="#005DAA" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  
                  {/* Grid Lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
                    <line
                      key={i}
                      x1="50"
                      y1={170 - p * 140}
                      x2="470"
                      y2={170 - p * 140}
                      stroke="#f1f5f9"
                      strokeWidth="1"
                    />
                  ))}

                  {/* Area y Línea */}
                  {(() => {
                    const maxQty = Math.max(...chartDataByDay.map(d => d.qty), 1);
                    const points = chartDataByDay.map((d, index) => {
                      const x = chartDataByDay.length > 1
                        ? (index / (chartDataByDay.length - 1)) * 400 + 50
                        : 250;
                      const y = 170 - (d.qty / maxQty) * 140;
                      return { x, y };
                    });
                    
                    if (points.length === 0) return null;
                    
                    const linePath = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                    const areaPath = `${linePath} L ${points[points.length - 1].x} 170 L ${points[0].x} 170 Z`;
                    
                    return (
                      <>
                        <path d={areaPath} fill="url(#areaGradBlue)" />
                        <path d={linePath} fill="none" stroke="#005DAA" strokeWidth="2" />
                        {points.map((p, idx) => (
                          <circle
                            key={idx}
                            cx={p.x}
                            cy={p.y}
                            r="3"
                            fill="#005DAA"
                            stroke="#ffffff"
                            strokeWidth="1.5"
                          />
                        ))}
                      </>
                    );
                  })()}
                  
                  {/* Ejes */}
                  <line x1="50" y1="170" x2="470" y2="170" stroke="#cbd5e1" strokeWidth="1" />
                  <line x1="50" y1="30" x2="50" y2="170" stroke="#cbd5e1" strokeWidth="1" />

                  {/* Etiquetas */}
                  <text x="42" y="173" textAnchor="end" fill="#94a3b8" fontSize="8">0</text>
                  {chartDataByDay.length > 0 && (
                    <text x="42" y="34" textAnchor="end" fill="#94a3b8" fontSize="8">
                      {Math.max(...chartDataByDay.map(d => d.qty)).toLocaleString()}
                    </text>
                  )}
                  {chartDataByDay.length > 0 && (
                    <>
                      <text x="50" y="184" textAnchor="middle" fill="#94a3b8" fontSize="8">
                        {chartDataByDay[0].date.substring(5)}
                      </text>
                      {chartDataByDay.length > 1 && (
                        <text x="470" y="184" textAnchor="middle" fill="#94a3b8" fontSize="8">
                          {chartDataByDay[chartDataByDay.length - 1].date.substring(5)}
                        </text>
                      )}
                    </>
                  )}
                </svg>
              </div>
            </div>

            {/* Gráfico 2: Top de Items en Azul Real */}
            <div className={styles.chartCard}>
              <h3>
                {activeTab === "movimientos" 
                  ? "Top 8 Marcas más Movidas" 
                  : activeTab === "liquidaciones" 
                    ? "Top 8 Productos Importados" 
                    : "Top 8 Proveedores Facturados"}
              </h3>
              <div className={styles.svgContainer}>
                <svg viewBox="0 0 500 200" className={styles.svgChart}>
                  {(() => {
                    const maxQty = Math.max(...chartDataByBrand.map(d => d.qty), 1);
                    return chartDataByBrand.map((d, index) => {
                      const y = index * 22 + 15;
                      const barWidth = (d.qty / maxQty) * 310;
                      const opacity = 0.45 + (d.qty / maxQty) * 0.55;
                      return (
                        <g key={index}>
                          <text x="5" y={y + 11} fill="#475569" fontSize="9" fontWeight="600">
                            {d.brand.substring(0, 11)}
                          </text>
                          <rect x="90" y={y} width="320" height="13" rx="4" fill="#f1f5f9" />
                          <rect x="90" y={y} width={barWidth} height="13" rx="4" fill="#005DAA" fillOpacity={opacity} />
                          <text x={95 + barWidth} y={y + 11} fill="#475569" fontSize="8.5" fontWeight="700">
                            {activeTab === "movimientos" 
                              ? d.qty.toLocaleString() 
                              : d.qty.toLocaleString("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}
                          </text>
                        </g>
                      );
                    });
                  })()}
                </svg>
              </div>
            </div>

            {/* Gráfico 3: Distribución con Progress Bars Verde Lima */}
            <div className={styles.chartCard}>
              <h3>
                {activeTab === "movimientos" 
                  ? "Distribución por Sucursal" 
                  : activeTab === "liquidaciones" 
                    ? "Distribución por Partida" 
                    : "Distribución por SRI Clasificación"}
              </h3>
              <div className={styles.branchProgressList}>
                {chartDataByBranch.map((d, index) => (
                  <div key={index} className={styles.branchProgressItem}>
                    <div className={styles.branchMetaInfo}>
                      <span className={styles.branchName}>{d.branch}</span>
                      <span className={styles.branchQty}>
                        {activeTab === "movimientos" 
                          ? `${d.qty.toLocaleString()} (${d.percentage}%)`
                          : `${d.qty.toLocaleString("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 0 })} (${d.percentage}%)`}
                      </span>
                    </div>
                    <div className={styles.branchProgressBarBg}>
                      <div
                        className={styles.branchProgressBarFill}
                        style={{ width: `${d.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Sección de Filtros de Tabla Específicos para Movimientos */}
        {activeTab === "movimientos" && !loading && data.length > 0 && (
          <section className={styles.localFiltersCard}>
            <h3>Filtros de Tabla</h3>
            <div className={styles.localFiltersRow}>
              <div className={styles.filterGroup}>
                <label>Filtrar por Marca</label>
                <select
                  value={selectedBrand}
                  onChange={(e) => setSelectedBrand(e.target.value)}
                  className={styles.selectFilter}
                >
                  <option value="">Todas las marcas</option>
                  {uniqueBrands.map((brand) => (
                    <option key={brand} value={brand}>{brand}</option>
                  ))}
                </select>
              </div>
              <div className={styles.filterGroup}>
                <label>Filtrar por Sucursal</label>
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className={styles.selectFilter}
                >
                  <option value="">Todas las sucursales</option>
                  {uniqueBranches.map((branch) => (
                    <option key={branch} value={branch}>{branch}</option>
                  ))}
                </select>
              </div>
              <div className={styles.filterGroup}>
                <label>Filtrar por Vendedor</label>
                <select
                  value={selectedSalesman}
                  onChange={(e) => setSelectedSalesman(e.target.value)}
                  className={styles.selectFilter}
                >
                  <option value="">Todos los vendedores</option>
                  {uniqueSalesmen.map((salesman) => (
                    <option key={salesman} value={salesman}>{salesman}</option>
                  ))}
                </select>
              </div>
              {(selectedBrand || selectedBranch || selectedSalesman) && (
                <button
                  onClick={() => { setSelectedBrand(""); setSelectedBranch(""); setSelectedSalesman(""); }}
                  className={styles.clearFiltersBtn}
                >
                  Limpiar Filtros
                </button>
              )}
            </div>
          </section>
        )}

        {/* Sección de Filtros de Tabla Específicos para Liquidaciones */}
        {activeTab === "liquidaciones" && !loading && data.length > 0 && (
          <section className={styles.localFiltersCard}>
            <h3>Filtros de Tabla (Importaciones)</h3>
            <div className={styles.localFiltersRow}>
              <div className={styles.filterGroup}>
                <label>Filtrar por Producto</label>
                <select
                  value={selectedProduct}
                  onChange={(e) => setSelectedProduct(e.target.value)}
                  className={styles.selectFilter}
                >
                  <option value="">Todos los productos</option>
                  {uniqueProducts.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div className={styles.filterGroup}>
                <label>Filtrar por Partida</label>
                <select
                  value={selectedPartida}
                  onChange={(e) => setSelectedPartida(e.target.value)}
                  className={styles.selectFilter}
                >
                  <option value="">Todas las partidas</option>
                  {uniquePartidas.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div className={styles.filterGroup}>
                <label>Recepción Relacionada</label>
                <select
                  value={selectedRecepcion}
                  onChange={(e) => setSelectedRecepcion(e.target.value)}
                  className={styles.selectFilter}
                >
                  <option value="">Todas las recepciones</option>
                  {uniqueRecepciones.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              {(selectedProduct || selectedPartida || selectedRecepcion) && (
                <button
                  onClick={() => { setSelectedProduct(""); setSelectedPartida(""); setSelectedRecepcion(""); }}
                  className={styles.clearFiltersBtn}
                >
                  Limpiar Filtros
                </button>
              )}
            </div>
          </section>
        )}

        {/* Sección de Filtros de Tabla Específicos para ATS */}
        {activeTab === "ats" && !loading && data.length > 0 && (
          <section className={styles.localFiltersCard}>
            <h3>Filtros de Tabla (ATS Facturación)</h3>
            <div className={styles.localFiltersRow}>
              <div className={styles.filterGroup}>
                <label>Filtrar por Corp</label>
                <select
                  value={selectedCorp}
                  onChange={(e) => setSelectedCorp(e.target.value)}
                  className={styles.selectFilter}
                >
                  <option value="">Todas las corporaciones</option>
                  {uniqueCorps.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className={styles.filterGroup}>
                <label>Filtrar por Proveedor</label>
                <select
                  value={selectedVendor}
                  onChange={(e) => setSelectedVendor(e.target.value)}
                  className={styles.selectFilter}
                >
                  <option value="">Todos los proveedores</option>
                  {uniqueVendors.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
              <div className={styles.filterGroup}>
                <label>Código Clasificación</label>
                <select
                  value={selectedClassif}
                  onChange={(e) => setSelectedClassif(e.target.value)}
                  className={styles.selectFilter}
                >
                  <option value="">Todas las clasificaciones</option>
                  {uniqueClassifs.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className={styles.filterGroup}>
                <label>Estado de Documento</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className={styles.selectFilter}
                >
                  <option value="">Todos los estados</option>
                  <option value="ACTIVO">ACTIVO</option>
                  <option value="ANULADO">ANULADO</option>
                </select>
              </div>
              {(selectedVendor || selectedClassif || selectedStatus || selectedCorp) && (
                <button
                  onClick={() => { setSelectedVendor(""); setSelectedClassif(""); setSelectedStatus(""); setSelectedCorp(""); }}
                  className={styles.clearFiltersBtn}
                >
                  Limpiar Filtros
                </button>
              )}
            </div>
          </section>
        )}

        {/* Acciones de exportación */}
        {activeTab !== "logs" && activeTab !== "admin" && !loading && data.length > 0 && (
          <div className={styles.actionsBar}>
            {session?.user && (session.user as any).permissions?.includes("DOWNLOAD_EXCEL") && (
              <button
                onClick={handleDownloadExcel}
                className={styles.downloadBtn}
                disabled={downloading || loading || filteredData.length === 0}
              >
                {downloading ? "Descargando..." : "Descargar Excel Certificado"}
              </button>
            )}
            <button
              onClick={handleDownloadPdf}
              className={styles.pdfBtn}
              disabled={downloadingPdf || loading || filteredData.length === 0}
            >
              Exportar Reporte PDF
            </button>
            {filteredData.length === 0 && !loading && (
              <span className={styles.btnWarning}>No hay datos para exportar en este periodo</span>
            )}
          </div>
        )}

        {/* Tabla de Resultados con Paginación */}
        {activeTab !== "admin" && (
          <section className={styles.tableCard}>
            {error && <div className={styles.errorAlert}>Error: {error}</div>}

            <div className={styles.tableWrapper}>
              {loading ? (
                <div className={styles.tableLoader}>
                  <div className={styles.spinner}></div>
                  <p>Consultando base de datos y cargando lotes del ERP...</p>
                </div>
              ) : activeTab === "logs" ? (
                filteredLogs.length === 0 ? (
                  <div className={styles.emptyTable}>No se encontraron registros de descargas en la bitácora.</div>
                ) : (
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Fecha / Hora</th>
                        <th>Cédula</th>
                        <th>Usuario</th>
                        <th>Rol</th>
                        <th>Reporte</th>
                        <th>Rango Consultado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedLogs.map((log) => (
                        <tr key={log.id}>
                          <td>{new Date(log.timestamp).toLocaleString("es-EC")}</td>
                          <td><strong>{log.user?.cedula}</strong></td>
                          <td>{log.user?.name}</td>
                          <td>
                            <span className={`${styles.roleBadge} ${log.user?.role?.name === "Admin" ? styles.badgeAdmin : styles.badgeUser}`}>
                              {log.user?.role?.name}
                            </span>
                          </td>
                          <td>
                            <span className={styles.reportTypeBadge}>
                              {log.reportType.toUpperCase()}
                            </span>
                          </td>
                          <td>{log.dateRange}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              ) : filteredData.length === 0 ? (
                <div className={styles.emptyTable}>
                  {error ? "Fallo al realizar la consulta" : data.length === 0 ? "Seleccione un rango de fechas y presione 'Consultar Datos' para cargar la información." : "No hay datos disponibles en el rango de fechas seleccionado con los filtros actuales."}
                </div>
              ) : (
                <table className={styles.table}>
                  {activeTab === "movimientos" && (
                    <>
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Producto</th>
                          <th>Cod. Convertido</th>
                          <th>Marca</th>
                          <th>Cantidad</th>
                          <th>Ref. Origen</th>
                          <th>Concepto</th>
                          <th>Base Com.</th>
                          <th>Cod. Vendedor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedData.map((row, idx) => (
                          <tr key={idx}>
                            <td>{row.TRANS_DATE}</td>
                            <td>{row.PRODUCT_NAME}</td>
                            <td>{row.Codigo_producto_convertido}</td>
                            <td>{row.Codigo_Marca}</td>
                            <td>{row.ORIGINAL_QTY}</td>
                            <td>{row.ORIGIN_REF}</td>
                            <td>{row.ORIGIN_MEMO}</td>
                            <td>${row.BASE_COMISION?.toFixed(2)}</td>
                            <td>{row.COD_SALESMAN}</td>
                          </tr>
                        ))}
                      </tbody>
                    </>
                  )}

                  {activeTab === "liquidaciones" && (
                    <>
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Cod. Corp</th>
                          <th>Detalle Recepción</th>
                          <th>Partida ID</th>
                          <th>Producto ID</th>
                          <th>Cant.</th>
                          <th>Precio</th>
                          <th>Total</th>
                          <th>Cost CIF Total</th>
                          <th>Observaciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedData.map((row, idx) => (
                          <tr key={idx}>
                            <td>{row.LIQUIDACION_FECHA}</td>
                            <td>{row.LIQUIDACION_ID_CORP}</td>
                            <td>{row.IdRecepcionRelacionada}</td>
                            <td>{row.PARTIDA_ID_CORP}</td>
                            <td>{row.PRODUCTO_ID_CORP}</td>
                            <td>{row.CANTIDAD}</td>
                            <td>${row.PRECIO?.toFixed(2)}</td>
                            <td>${row.TOTAL?.toFixed(2)}</td>
                            <td>${row.VALOR_TOTAL_CIF?.toFixed(2)}</td>
                            <td>{row.OBSERVACIONES}</td>
                          </tr>
                        ))}
                      </tbody>
                    </>
                  )}

                  {activeTab === "ats" && (
                    <>
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>RUC / ID</th>
                          <th>Proveedor</th>
                          <th>Documento Ref.</th>
                          <th>Bases con IVA</th>
                          <th>Bases sin IVA</th>
                          <th>Total Facturado</th>
                          <th>Anulado</th>
                          <th>Cod. Clasif</th>
                          <th>Concepto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedData.map((row, idx) => (
                          <tr key={idx}>
                            <td>{row.INVOICE_DATE}</td>
                            <td>{row.RUC_or_FED_ID}</td>
                            <td>{row.VENDOR_NAME}</td>
                            <td>{row.DOC_REFERENCE}</td>
                            <td>${row.SUMA_CON_IVA?.toFixed(2)}</td>
                            <td>${row.SUMA_SIN_IVA?.toFixed(2)}</td>
                            <td><strong>${row.INVOICE_TOTAL?.toFixed(2)}</strong></td>
                            <td>
                              <span className={row.ES_ANULADO === 1 ? styles.badgeAnulado : styles.badgeActivo}>
                                {row.ES_ANULADO === 1 ? "ANULADO" : "ACTIVO"}
                              </span>
                            </td>
                            <td>{row.MF_Lista2}</td>
                            <td>{row.MEMO}</td>
                          </tr>
                        ))}
                      </tbody>
                    </>
                  )}
                </table>
              )}
            </div>

            {/* Controles de Paginación Rediseñados */}
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

            {/* Controles de paginación específicos para bitácora */}
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
              <p>Cédula: {(session?.user as any).cedula}</p>
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
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className={styles.btnCancel}
                  disabled={submittingUser}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSubmitUser}
                  className={styles.btnConfirm}
                  disabled={submittingUser}
                >
                  {submittingUser ? "Guardando..." : "Guardar Usuario"}
                </button>
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
                <button
                  type="button"
                  onClick={() => setIsRoleModalOpen(false)}
                  className={styles.btnCancel}
                  disabled={submittingRole}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSubmitRole}
                  className={styles.btnConfirm}
                  disabled={submittingRole}
                >
                  {submittingRole ? "Guardando..." : "Guardar Rol"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
