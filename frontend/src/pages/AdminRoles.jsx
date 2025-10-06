import React, { useState, useEffect } from "react";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import RoleUserManager from "../components/RoleUserManager";
import styles from "./AdminRoles.module.css";
import RoleCreateModal from "../components/RoleCreateModal";
import api from "../services/axiosInstance";
import { useNavigate } from "react-router-dom";
import {
  FiFilter,
  FiArrowDownCircle,
  FiPlus,
  FiEdit,
  FiBriefcase,
  FiMoreHorizontal,
  FiTrash2,
  FiUsers,
  FiSettings,
} from "react-icons/fi";
import { toast } from "react-toastify";

function AdminRoles() {
  const navigate = useNavigate();
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [sortBy, setSortBy] = useState("name");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState(null);
  const [showDropdown, setShowDropdown] = useState(null);
  const [showUserManager, setShowUserManager] = useState(false);
  const [roleToManageUsers, setRoleToManageUsers] = useState(null);

  // Estado para novo cargo
  const [newRole, setNewRole] = useState({
    name: "",
    description: "",
  });

  // Manteremos a sidebar aberta por padrão em telas maiores
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);

  const sortedRoles = [...roles].sort((a, b) => {
    if (sortBy === "name") return a.name.localeCompare(b.name);
    if (sortBy === "description")
      return (a.description || "").localeCompare(b.description || "");
    if (sortBy === "users_count")
      return (b.users_count || 0) - (a.users_count || 0);
    return 0;
  });

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const response = await api.get("/roles");
        console.log("Cargos recebidos no frontend:", response.data);
        setRoles(response.data);
      } catch (error) {
        console.error("Erro ao buscar cargos:", error);
        setError("Erro ao buscar cargos. Verifique suas permissões.");
      } finally {
        setLoading(false);
      }
    };

    fetchRoles();

    const handleResize = () => {
      if (window.innerWidth <= 768) {
        setSidebarOpen(false);
      }
    };

    const handleClickOutside = () => {
      setShowDropdown(null);
    };

    window.addEventListener("resize", handleResize);
    document.addEventListener("click", handleClickOutside);

    return () => {
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("click", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const savedSort = localStorage.getItem("roleSortBy");
    if (savedSort) setSortBy(savedSort);
  }, []);

  useEffect(() => {
    localStorage.setItem("roleSortBy", sortBy);
  }, [sortBy]);

  const handleLogout = async () => {
    try {
      await api.post("/logout");
    } catch (err) {
      console.error("Erro ao fazer logout:", err);
    } finally {
      localStorage.removeItem("auth");
      navigate("/login");
    }
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const resetForm = () => {
    setNewRole({ name: "", description: "" });
  };

  const handleCreateRole = async () => {
    if (!newRole.name) {
      toast.error("O nome do cargo é obrigatório!");
      return;
    }

    try {
      const response = await api.post("/roles", newRole);
      setRoles([...roles, response.data]);
      resetForm();
      setShowRoleForm(false);
      console.log("Cargo criado com sucesso:", response.data);
    } catch (error) {
      console.error("Erro ao criar cargo:", error);

      if (error.response?.status === 400 && error.response.data?.error) {
        toast.error(`Erro: ${error.response.data.error}`);
      } else {
        toast.error("Erro ao criar cargo. Tente novamente.");
      }
    }
  };

  const handleUpdateRole = async (roleId, roleData) => {
    try {
      const response = await api.put(`/roles/${roleId}`, roleData);
      setRoles((prev) =>
        prev.map((r) => (r.id === roleId ? response.data : r))
      );
      setEditingRole(null);
      console.log("Cargo atualizado com sucesso:", response.data);
    } catch (error) {
      console.error("Erro ao atualizar cargo:", error);

      if (error.response?.status === 400 && error.response.data?.error) {
        toast.error(`Erro: ${error.response.data.error}`);
      } else {
        toast.error("Erro ao atualizar cargo. Tente novamente.");
      }
    }
  };

  const cancelDelete = () => {
    setRoleToDelete(null);
    setShowDeleteModal(false);
  };

  const confirmDelete = async () => {
    if (!roleToDelete) return;

    try {
      await api.delete(`/roles/${roleToDelete.id}`);
      setRoles((prev) => prev.filter((r) => r.id !== roleToDelete.id));
    } catch (error) {
      console.error("Erro ao excluir cargo:", error);
      toast.error(
        "Erro ao excluir cargo. Verifique se não há usuários vinculados a este cargo."
      );
    } finally {
      setRoleToDelete(null);
      setShowDeleteModal(false);
      setShowDropdown(null);
    }
  };

  const handleManageUsers = (role) => {
    setRoleToManageUsers(role);
    setShowUserManager(true);
    setShowDropdown(null);
  };

  const handleRoleUpdate = (updatedRole) => {
    setRoles((prev) =>
      prev.map((r) => (r.id === updatedRole.id ? updatedRole : r))
    );
    setRoleToManageUsers(updatedRole);
  };

  if (loading) {
    return (
      <div className={styles.spinnerContainer}>
        <div className={styles.spinner}></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorMessage}>
          <h2>Erro</h2>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.adminRolesPage}>
      <Header onMenuToggle={toggleSidebar} />

      <div className={styles.pageBody}>
        <Sidebar onLogout={handleLogout} isOpen={sidebarOpen} />

        <main className={styles.contentArea}>
          <div className={styles.rolesWrapper}>
            <div className={styles.rolesHeader}>
              <h2>Administração de Cargos</h2>
              <button
                className={styles.addRoleBtn}
                onClick={() => setShowRoleForm(true)}
              >
                <FiPlus className={styles.btnIcon} />
                Novo Cargo
              </button>
            </div>

            <div className={styles.controls}>
              <div className={styles.controlGroup}>
                <label className={styles.controlLabel}>
                  <FiArrowDownCircle className={styles.icon} />
                  Ordenar por:
                  <select
                    className={styles.select}
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                  >
                    <option value="name">Nome</option>
                    <option value="description">Descrição</option>
                    <option value="users_count">Número de usuários</option>
                  </select>
                </label>
              </div>
            </div>

            <div className={styles.rolesList}>
              {sortedRoles.length === 0 ? (
                <div className={styles.emptyRoles}>
                  Nenhum cargo cadastrado.
                </div>
              ) : (
                sortedRoles.map((role) => (
                  <div key={role.id} className={styles.roleItem}>
                    <div className={styles.roleInfo}>
                      <div className={styles.roleIcon}>
                        <FiBriefcase className={styles.iconBriefcase} />
                      </div>
                      <div className={styles.roleDetails}>
                        <div className={styles.roleName}>{role.name}</div>
                        <div className={styles.roleDescription}>
                          {role.description || "Sem descrição"}
                        </div>
                        <div className={styles.roleStats}>
                          <FiUsers className={styles.statsIcon} />
                          {role.users_count || 0} usuário(s)
                        </div>
                      </div>
                    </div>
                    <div className={styles.roleActions}>
                      <button
                        className={styles.editBtn}
                        onClick={() => setEditingRole(role)}
                        title="Editar cargo"
                      >
                        <FiEdit />
                      </button>
                      <div className={styles.dropdown}>
                        <button
                          className={styles.moreBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowDropdown(
                              showDropdown === role.id ? null : role.id
                            );
                          }}
                          title="Mais opções"
                        >
                          <FiMoreHorizontal />
                        </button>
                        {showDropdown === role.id && (
                          <div className={styles.dropdownMenu}>
                            <button
                              className={styles.dropdownItem}
                              onClick={() => handleManageUsers(role)}
                            >
                              <FiSettings className={styles.dropdownIcon} />
                              Gerenciar Usuários
                            </button>
                            <button
                              className={`${styles.dropdownItem} ${styles.dangerItem}`}
                              onClick={() => {
                                setRoleToDelete(role);
                                setShowDeleteModal(true);
                              }}
                            >
                              <FiTrash2 className={styles.dropdownIcon} />
                              Excluir Cargo
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </main>

        {/* Modal para criar novo cargo */}
        <RoleCreateModal
          isOpen={!!showRoleForm}
          mode="create"
          onClose={() => setShowRoleForm(false)}
          onCreate={handleCreateRole}
        />

        <RoleCreateModal
          isOpen={!!editingRole}
          mode="edit"
          initial={editingRole}
          onClose={() => setEditingRole(null)}
          onUpdate={handleUpdateRole}
        />

        <DeleteConfirmModal
          isOpen={showDeleteModal}
          onCancel={cancelDelete}
          onConfirm={confirmDelete}
          taskTitle={roleToDelete?.name || ""}
        />

        {showUserManager && roleToManageUsers && (
          <RoleUserManager
            role={roleToManageUsers}
            onRoleUpdate={handleRoleUpdate}
            onClose={() => {
              setShowUserManager(false);
              setRoleToManageUsers(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

export default AdminRoles;
