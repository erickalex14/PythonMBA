"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import styles from "../dashboard.module.css";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Modal } from "../../../components/ui/Modal";

export default function AdminPage() {
  const { data: session } = useSession();

  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [adminRoles, setAdminRoles] = useState<any[]>([]);
  const [adminPermissions, setAdminPermissions] = useState<any[]>([]);
  const [loadingAdminData, setLoadingAdminData] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  const [erpConfig, setErpConfig] = useState({
    env: "PRUEBAS",
    base_url_test: "",
    codigo_servicio_test: "",
    password_servicio_test: "",
    base_url_prod: "",
    codigo_servicio_prod: "",
    password_servicio_prod: ""
  });

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

  useEffect(() => {
    fetchAdminData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  return (
    <>
      <header className={styles.contentHeader}>
        <h1>Panel de Administración</h1>
        <p className={styles.subtext}>Gestión de seguridad, control de acceso de usuarios y configuración del entorno</p>
      </header>

      <section className={styles.adminGrid}>
        {session?.user && (session.user as any).permissions?.includes("MANAGE_CONFIG") && (
          <Card variant="adminCard" styles={styles}>
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

            <div style={{ marginTop: "1.25rem", borderTop: "1px solid var(--color-surface-subtle)", paddingTop: "1.25rem" }}>
              <h4 style={{ margin: "0 0 0.85rem 0", color: "var(--color-brand-primary)", fontSize: "0.85rem", fontWeight: "700", textTransform: "uppercase" }}>Variables de PRUEBAS (.env)</h4>
              <div className={styles.adminFormGroup}>
                <label>URL Base del Servicio Pruebas</label>
                <input
                  type="text"
                  value={erpConfig.base_url_test}
                  onChange={(e) => setErpConfig({ ...erpConfig, base_url_test: e.target.value })}
                  placeholder="http://192.168.80.201:8020"
                  className={styles.selectFilter}
                  style={{ width: "100%", background: "var(--color-surface)", border: "1px solid var(--color-border-strong)", color: "var(--color-text-primary)", padding: "0.55rem 0.75rem", borderRadius: "8px" }}
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
                    style={{ width: "100%", background: "var(--color-surface)", border: "1px solid var(--color-border-strong)" }}
                  />
                </div>
                <div className={styles.adminFormGroup} style={{ flex: 1 }}>
                  <label>Contraseña Pruebas</label>
                  <input
                    type="password"
                    value={erpConfig.password_servicio_test}
                    onChange={(e) => setErpConfig({ ...erpConfig, password_servicio_test: e.target.value })}
                    className={styles.selectFilter}
                    style={{ width: "100%", background: "var(--color-surface)", border: "1px solid var(--color-border-strong)" }}
                  />
                </div>
              </div>
            </div>

            <div style={{ marginTop: "1.5rem", borderTop: "1px solid var(--color-surface-subtle)", paddingTop: "1.25rem" }}>
              <h4 style={{ margin: "0 0 0.85rem 0", color: "var(--color-brand-accent)", fontSize: "0.85rem", fontWeight: "700", textTransform: "uppercase" }}>Variables de PRODUCCIÓN (.env)</h4>
              <div className={styles.adminFormGroup}>
                <label>URL Base del Servicio Producción</label>
                <input
                  type="text"
                  value={erpConfig.base_url_prod}
                  onChange={(e) => setErpConfig({ ...erpConfig, base_url_prod: e.target.value })}
                  placeholder="http://192.168.80.201:8081"
                  className={styles.selectFilter}
                  style={{ width: "100%", background: "var(--color-surface)", border: "1px solid var(--color-border-strong)", color: "var(--color-text-primary)", padding: "0.55rem 0.75rem", borderRadius: "8px" }}
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
                    style={{ width: "100%", background: "var(--color-surface)", border: "1px solid var(--color-border-strong)" }}
                  />
                </div>
                <div className={styles.adminFormGroup} style={{ flex: 1 }}>
                  <label>Contraseña Prod</label>
                  <input
                    type="password"
                    value={erpConfig.password_servicio_prod}
                    onChange={(e) => setErpConfig({ ...erpConfig, password_servicio_prod: e.target.value })}
                    className={styles.selectFilter}
                    style={{ width: "100%", background: "var(--color-surface)", border: "1px solid var(--color-border-strong)" }}
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
              style={{ width: "100%", marginTop: "1.5rem", padding: "0.75rem", background: "var(--color-brand-accent)", color: "var(--color-surface)", border: "none", borderRadius: "8px", fontWeight: "700", cursor: "pointer" }}
            >
              Guardar Configuración Persistente (.env)
            </Button>
          </Card>
        )}

        {session?.user && (session.user as any).permissions?.includes("MANAGE_CONFIG") && (
          <Card variant="adminCard" styles={styles}>
            <div className={styles.adminCardHeader}>
              <h3>Gestión de Cuentas de Usuarios</h3>
              <Button onClick={() => handleOpenUserModal(null)} className={styles.createUserBtn}>
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
                          <Button onClick={() => handleOpenUserModal(u)} className={`${styles.actionBtn} ${styles.btnEdit}`}>
                            Editar
                          </Button>
                          <Button onClick={() => handleDeleteUser(u)} className={`${styles.actionBtn} ${styles.btnDelete}`}>
                            Eliminar
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div style={{ marginTop: "2rem", borderTop: "1px solid var(--color-surface-subtle)", paddingTop: "1.5rem" }}>
              <div className={styles.adminCardHeader}>
                <h3>Gestión de Roles del Sistema</h3>
                <Button onClick={() => handleOpenRoleModal(null)} className={styles.createUserBtn}>
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
          </Card>
        )}
      </section>

      <Modal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        title={editingUser ? "Editar Usuario" : "Crear Nuevo Usuario"}
        styles={styles}
      >
        {userError && <div className={styles.modalErrorAlert}>{userError}</div>}

        <div className={styles.adminFormGroup}>
          <label>Número de Cédula</label>
          <input
            type="text"
            value={userForm.cedula}
            onChange={(e) => setUserForm({ ...userForm, cedula: e.target.value })}
            placeholder="Ej: 1712345678"
            className={styles.selectFilter}
            style={{ width: "100%", background: "var(--color-surface)", border: "1px solid var(--color-border-strong)", color: "var(--color-text-primary)", padding: "0.55rem 0.75rem", borderRadius: "8px" }}
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
            style={{ width: "100%", background: "var(--color-surface)", border: "1px solid var(--color-border-strong)", color: "var(--color-text-primary)", padding: "0.55rem 0.75rem", borderRadius: "8px" }}
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
            style={{ width: "100%", background: "var(--color-surface)", border: "1px solid var(--color-border-strong)", color: "var(--color-text-primary)", padding: "0.55rem 0.75rem", borderRadius: "8px" }}
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
          <Button type="button" onClick={() => setIsUserModalOpen(false)} className={styles.btnCancel} disabled={submittingUser}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSubmitUser} className={styles.btnConfirm} loading={submittingUser} loadingText="Guardando...">
            Guardar Usuario
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
        title={editingRole ? "Editar Rol" : "Crear Nuevo Rol"}
        styles={styles}
        contentStyle={{ width: "520px" }}
      >
        {roleError && <div className={styles.modalErrorAlert}>{roleError}</div>}

        <div className={styles.adminFormGroup}>
          <label>Nombre del Rol</label>
          <input
            type="text"
            value={roleForm.name}
            onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
            placeholder="Ej: Auditor Externo"
            className={styles.selectFilter}
            style={{ width: "100%", background: "var(--color-surface)", border: "1px solid var(--color-border-strong)", color: "var(--color-text-primary)", padding: "0.55rem 0.75rem", borderRadius: "8px" }}
            disabled={editingRole?.name === "Admin" || editingRole?.name === "Visitante"}
          />
        </div>

        <div className={styles.adminFormGroup} style={{ marginTop: "1.25rem" }}>
          <label>Permisos y Acciones Autorizadas</label>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem", marginTop: "0.5rem", maxHeight: "220px", overflowY: "auto", paddingRight: "0.5rem" }}>
            {adminPermissions.map((perm) => {
              const isChecked = roleForm.permissionIds.includes(perm.id);
              return (
                <label key={perm.id} style={{ display: "flex", alignItems: "flex-start", gap: "0.65rem", cursor: "pointer", fontSize: "0.85rem", color: "var(--color-text-primary)" }}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handlePermissionToggle(perm.id)}
                    style={{ marginTop: "0.15rem", cursor: "pointer" }}
                  />
                  <div>
                    <span style={{ fontWeight: "700" }}>{perm.action}</span>
                    <p style={{ margin: "0.05rem 0 0 0", fontSize: "0.75rem", color: "var(--color-text-muted)" }}>{perm.description}</p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <div className={styles.modalActions}>
          <Button type="button" onClick={() => setIsRoleModalOpen(false)} className={styles.btnCancel} disabled={submittingRole}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSubmitRole} className={styles.btnConfirm} loading={submittingRole} loadingText="Guardando...">
            Guardar Rol
          </Button>
        </div>
      </Modal>
    </>
  );
}
