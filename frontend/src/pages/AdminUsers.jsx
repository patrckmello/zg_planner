import React, { useState, useEffect } from "react";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import UserRoleManager from "../components/UserRoleManager";
import styles from "./AdminUsers.module.css";
import api from "../services/axiosInstance";
import UserModal from "../components/UserCreateModal";

import { useNavigate } from "react-router-dom";
import {
  FiFilter,
  FiArrowDownCircle,
  FiPlus,
  FiEdit,
  FiUser,
  FiMail,
  FiShield,
  FiUserX,
  FiUserCheck,
  FiMoreHorizontal,
  FiTrash2,
  FiSettings,
  FiSearch,
  FiRefreshCw,
} from "react-icons/fi";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

function AdminUsers() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState("username");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [showDropdown, setShowDropdown] = useState(null);
  const [showRoleManager, setShowRoleManager] = useState(false);
  const [userToManageRoles, setUserToManageRoles] = useState(null);
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [savingUser, setSavingUser] = useState(false);

  // Estados para paginação e busca
  const [searchTerm, setSearchTerm] = useState("");
  const [pagination, setPagination] = useState({
    total_items: 0,
    total_pages: 0,
    current_page: 1,
    per_page: 20,
    has_next: false,
    has_prev: false,
    next_num: null,
    prev_num: null,
  });
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Estado para novo usuário
  const [newUser, setNewUser] = useState({
    username: "",
    email: "",
    is_admin: false,
    password: "",
  });

  // Manteremos a sidebar aberta por padrão em telas maiores
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);

  // Função para buscar usuários com paginação e busca
  const fetchUsers = async (page = 1, perPage = 20, search = "") => {
    setLoadingUsers(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        per_page: perPage.toString(),
      });

      if (search.trim()) {
        params.append("search", search.trim());
      }

      const response = await api.get(`/users?${params}`);

      // Verificar se a resposta tem a estrutura esperada com paginação
      if (response.data.items && response.data.pagination) {
        setUsers(response.data.items);
        setPagination(response.data.pagination);
      } else {
        // Fallback para compatibilidade com resposta antiga
        setUsers(Array.isArray(response.data) ? response.data : []);
        setPagination({
          total_items: Array.isArray(response.data) ? response.data.length : 0,
          total_pages: 1,
          current_page: 1,
          per_page: perPage,
          has_next: false,
          has_prev: false,
          next_num: null,
          prev_num: null,
        });
      }
    } catch (error) {
      console.error("Erro ao buscar usuários:", error);
      setError("Erro ao buscar usuários. Verifique suas permissões.");
      setUsers([]);
    } finally {
      setLoadingUsers(false);
      setLoading(false);
    }
  };

  // Função para lidar com mudança de página
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.total_pages) {
      fetchUsers(newPage, pagination.per_page, searchTerm);
    }
  };

  // Função para lidar com mudança de itens por página
  const handlePerPageChange = (newPerPage) => {
    fetchUsers(1, newPerPage, searchTerm);
  };

  // Função para lidar com busca
  const handleSearch = (search) => {
    setSearchTerm(search);
    fetchUsers(1, pagination.per_page, search);
  };

  // Debounce para busca
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm !== undefined) {
        handleSearch(searchTerm);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const filteredUsers = users.filter((user) => {
    let roleMatch = true;
    let statusMatch = true;

    if (filterRole === "admin") roleMatch = user.is_admin;
    if (filterRole === "user") roleMatch = !user.is_admin;

    if (filterStatus === "active") statusMatch = user.is_active !== false;
    if (filterStatus === "inactive") statusMatch = user.is_active === false;

    return roleMatch && statusMatch;
  });

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    if (sortBy === "username") return a.username.localeCompare(b.username);
    if (sortBy === "email") return a.email.localeCompare(b.email);
    if (sortBy === "role") return (b.is_admin ? 1 : 0) - (a.is_admin ? 1 : 0);
    if (sortBy === "status")
      return (b.is_active ? 1 : 0) - (a.is_active ? 1 : 0);
    return 0;
  });

  useEffect(() => {
    fetchUsers();

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
    const savedFilter = localStorage.getItem("userFilterRole");
    const savedStatus = localStorage.getItem("userFilterStatus");
    const savedSort = localStorage.getItem("userSortBy");

    if (savedFilter) setFilterRole(savedFilter);
    if (savedStatus) setFilterStatus(savedStatus);
    if (savedSort) setSortBy(savedSort);
  }, []);

  useEffect(() => {
    localStorage.setItem("userFilterRole", filterRole);
    localStorage.setItem("userFilterStatus", filterStatus);
    localStorage.setItem("userSortBy", sortBy);
  }, [filterRole, filterStatus, sortBy]);

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

  const handleCreateUser = async (payload) => {
    setSavingUser(true);
    try {
      await api.post("/users/", payload);
      await fetchUsers(pagination.current_page, pagination.per_page, searchTerm);
      toast.success("Usuário criado com sucesso!", { autoClose: 3000 });
    } catch (error) {
      toast.error(error.response?.data?.error || "Erro ao criar usuário.", { autoClose: 5000 });
      throw error;
    } finally {
      setSavingUser(false);
    }
  };

  const handleUpdateUser = async (id, payload) => {
    setSavingUser(true);
    try {
      await api.put(`/users/${id}`, payload);
      await fetchUsers(pagination.current_page, pagination.per_page, searchTerm);
      toast.success("Usuário atualizado!", { autoClose: 3000 });
    } catch (error) {
      toast.error(error.response?.data?.error || "Erro ao atualizar usuário.", { autoClose: 5000 });
      throw error;
    } finally {
      setSavingUser(false);
    }
  };

  const toggleAdmin = async (userId, currentValue) => {
    try {
      await api.put(`/users/${userId}`, { is_admin: !currentValue });
      // Recarregar a lista de usuários após alterar permissão
      fetchUsers(pagination.current_page, pagination.per_page, searchTerm);
      toast.success("Permissão alterada com sucesso!", { autoClose: 3000 });
    } catch (error) {
      console.error("Erro ao alterar permissão:", error);
      toast.error(error.response?.data?.error || "Erro ao alterar permissão", {
        autoClose: 5000,
      });
    }
  };

  const toggleUserStatus = async (userId, currentStatus) => {
    try {
      const newStatus = !currentStatus;
      await api.put(`/users/${userId}`, { is_active: newStatus });
      // Recarregar a lista de usuários após alterar status
      fetchUsers(pagination.current_page, pagination.per_page, searchTerm);
      setShowDropdown(null);
      toast.success("Status do usuário alterado com sucesso!", {
        autoClose: 3000,
      });
    } catch (error) {
      console.error("Erro ao alterar status do usuário:", error);
      toast.error(
        error.response?.data?.error || "Erro ao alterar status do usuário",
        { autoClose: 5000 }
      );
    }
  };

  const cancelDelete = () => {
    setUserToDelete(null);
    setShowDeleteModal(false);
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;

    try {
      await api.delete(`/users/${userToDelete.id}`);
      // Recarregar a lista de usuários após excluir
      fetchUsers(pagination.current_page, pagination.per_page, searchTerm);
      toast.success(`Usuário ${userToDelete.username} excluído com sucesso!`, {
        position: "top-right",
        autoClose: 4000,
      });
    } catch (error) {
      console.error("Erro ao excluir usuário:", error);

      // Pega a mensagem do backend, se existir
      const errorMessage =
        error.response?.data?.error ||
        "Erro ao excluir usuário. Tente novamente.";

      toast.error(errorMessage, {
        position: "top-right",
        autoClose: 5000,
      });
    } finally {
      setUserToDelete(null);
      setShowDeleteModal(false);
      setShowDropdown(null);
    }
  };

  const handleManageRoles = (user) => {
    setUserToManageRoles(user);
    setShowRoleManager(true);
    setShowDropdown(null);
  };

  const handleUserUpdate = (updatedUser) => {
    // Recarregar a lista de usuários após atualizar roles
    fetchUsers(pagination.current_page, pagination.per_page, searchTerm);
    setUserToManageRoles(updatedUser);
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
    <div className={styles.adminUsersPage}>
      <Header onMenuToggle={toggleSidebar} />

      <div className={styles.pageBody}>
        <Sidebar isOpen={sidebarOpen} onLogout={handleLogout} />

        <main className={styles.contentArea}>
          <div className={styles.usersWrapper}>
            <div className={styles.usersHeader}>
              <h2>
                Administração de Usuários
                {pagination.total_items > 0 && (
                  <span className={styles.totalCount}>
                    ({pagination.total_items} usuários)
                  </span>
                )}
              </h2>
              <div className={styles.headerActions}>
                <button
                  className={styles.refreshBtn}
                  onClick={() =>
                    fetchUsers(
                      pagination.current_page,
                      pagination.per_page,
                      searchTerm
                    )
                  }
                  disabled={loadingUsers}
                  title="Atualizar lista"
                >
                  <FiRefreshCw
                    className={loadingUsers ? styles.spinning : ""}
                  />
                </button>
                <button
                  className={styles.addUserBtn}
                  onClick={() => setShowUserForm(true)}
                >
                  <FiPlus className={styles.btnIcon} />
                  Novo Usuário
                </button>
              </div>
            </div>

            {/* Barra de busca */}
            <div className={styles.searchContainer}>
              <div className={styles.searchBox}>
                <FiSearch className={styles.searchIcon} />
                <input
                  type="text"
                  placeholder="Buscar por nome de usuário ou email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={styles.searchInput}
                />
              </div>
            </div>

            <div className={styles.controls}>
              <div className={styles.controlGroup}>
                <label className={styles.controlLabel}>
                  <FiFilter className={styles.icon} />
                  Função:
                  <select
                    className={styles.select}
                    value={filterRole}
                    onChange={(e) => setFilterRole(e.target.value)}
                  >
                    <option value="all">Todos</option>
                    <option value="admin">Administradores</option>
                    <option value="user">Usuários</option>
                  </select>
                </label>
              </div>

              <div className={styles.controlGroup}>
                <label className={styles.controlLabel}>
                  <FiFilter className={styles.icon} />
                  Status:
                  <select
                    className={styles.select}
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                  >
                    <option value="all">Todos</option>
                    <option value="active">Ativos</option>
                    <option value="inactive">Inativos</option>
                  </select>
                </label>
              </div>

              <div className={styles.controlGroup}>
                <label className={styles.controlLabel}>
                  <FiArrowDownCircle className={styles.icon} />
                  Ordenar por:
                  <select
                    className={styles.select}
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                  >
                    <option value="username">Nome de usuário</option>
                    <option value="email">Email</option>
                    <option value="role">Função</option>
                    <option value="status">Status</option>
                  </select>
                </label>
              </div>

              <div className={styles.controlGroup}>
                <label className={styles.controlLabel}>
                  Itens por página:
                  <select
                    className={styles.select}
                    value={pagination.per_page}
                    onChange={(e) =>
                      handlePerPageChange(parseInt(e.target.value))
                    }
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </label>
              </div>
            </div>

            {loadingUsers ? (
              <div className={styles.loadingState}>
                <div className={styles.smallSpinner}></div>
                <span>Carregando usuários...</span>
              </div>
            ) : (
              <>
                <div className={styles.usersList}>
                  {sortedUsers.length === 0 ? (
                    <div className={styles.emptyUsers}>
                      {searchTerm ? (
                        <>
                          <FiUser size={48} />
                          <h3>Nenhum usuário encontrado</h3>
                          <p>
                            Nenhum usuário corresponde à busca "{searchTerm}"
                          </p>
                        </>
                      ) : (
                        <>
                          {filterRole === "admin" &&
                            filterStatus === "all" &&
                            "Nenhum administrador encontrado."}
                          {filterRole === "user" &&
                            filterStatus === "all" &&
                            "Nenhum usuário encontrado."}
                          {filterRole === "all" &&
                            filterStatus === "active" &&
                            "Nenhum usuário ativo encontrado."}
                          {filterRole === "all" &&
                            filterStatus === "inactive" &&
                            "Nenhum usuário inativo encontrado."}
                          {filterRole === "all" &&
                            filterStatus === "all" &&
                            "Nenhum usuário cadastrado."}
                        </>
                      )}
                    </div>
                  ) : (
                    sortedUsers.map((user) => (
                      <div
                        key={user.id}
                        className={`${styles.userItem} ${
                          user.is_active === false ? styles.inactiveUser : ""
                        }`}
                      >
                        <div className={styles.userInfo}>
                          <div className={styles.userAvatar}>
                            <FiUser className={styles.avatarIcon} />
                          </div>
                          <div className={styles.userDetails}>
                            <div className={styles.userName}>
                              {user.username}
                              {user.is_admin && (
                                <span className={styles.adminBadge}>
                                  <FiShield className={styles.badgeIcon} />
                                  Admin
                                </span>
                              )}
                              {user.is_active === false && (
                                <span className={styles.inactiveBadge}>
                                  <FiUserX className={styles.badgeIcon} />
                                  Inativo
                                </span>
                              )}
                            </div>
                            <div className={styles.userEmail}>
                              <FiMail className={styles.emailIcon} />
                              {user.email}
                            </div>
                            {user.roles && user.roles.length > 0 && (
                              <div className={styles.userRoles}>
                                {user.roles.map((role) => (
                                  <span
                                    key={role.id}
                                    className={styles.roleBadge}
                                  >
                                    {role.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className={styles.userActions}>
                          <label className={styles.adminToggle}>
                            <input
                              type="checkbox"
                              checked={user.is_admin}
                              onChange={() =>
                                toggleAdmin(user.id, user.is_admin)
                              }
                            />
                            <span className={styles.toggleSlider}></span>
                            <span className={styles.toggleLabel}>Admin</span>
                          </label>
                          <button
                            className={styles.editBtn}
                            onClick={() => setEditingUser(user)}
                            title="Editar usuário"
                          >
                            <FiEdit />
                          </button>
                          <div className={styles.dropdown}>
                            <button
                              className={styles.moreBtn}
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowDropdown(
                                  showDropdown === user.id ? null : user.id
                                );
                              }}
                              title="Mais opções"
                            >
                              <FiMoreHorizontal />
                            </button>
                            {showDropdown === user.id && (
                              <div className={styles.dropdownMenu}>
                                <button
                                  className={styles.dropdownItem}
                                  onClick={() => handleManageRoles(user)}
                                >
                                  <FiSettings className={styles.dropdownIcon} />
                                  Gerenciar Cargos
                                </button>
                                <button
                                  className={styles.dropdownItem}
                                  onClick={() =>
                                    toggleUserStatus(
                                      user.id,
                                      user.is_active !== false
                                    )
                                  }
                                >
                                  {user.is_active !== false ? (
                                    <>
                                      <FiUserX
                                        className={styles.dropdownIcon}
                                      />
                                      Desativar
                                    </>
                                  ) : (
                                    <>
                                      <FiUserCheck
                                        className={styles.dropdownIcon}
                                      />
                                      Ativar
                                    </>
                                  )}
                                </button>
                                <button
                                  className={`${styles.dropdownItem} ${styles.deleteItem}`}
                                  onClick={() => {
                                    setUserToDelete(user);
                                    setShowDeleteModal(true);
                                  }}
                                >
                                  <FiTrash2 className={styles.dropdownIcon} />
                                  Excluir
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Paginação */}
                {pagination.total_pages > 1 && (
                  <div className={styles.pagination}>
                    <div className={styles.paginationInfo}>
                      Página {pagination.current_page} de{" "}
                      {pagination.total_pages} ({pagination.total_items}{" "}
                      usuários)
                    </div>

                    <div className={styles.paginationControls}>
                      <button
                        className={styles.paginationBtn}
                        onClick={() => handlePageChange(1)}
                        disabled={!pagination.has_prev}
                        title="Primeira página"
                      >
                        <ChevronsLeft size={16} />
                      </button>

                      <button
                        className={styles.paginationBtn}
                        onClick={() => handlePageChange(pagination.prev_num)}
                        disabled={!pagination.has_prev}
                        title="Página anterior"
                      >
                        <ChevronLeft size={16} />
                      </button>

                      <span className={styles.pageNumbers}>
                        {Array.from(
                          {
                            length: Math.min(5, pagination.total_pages),
                          },
                          (_, i) => {
                            let pageNum;
                            if (pagination.total_pages <= 5) {
                              pageNum = i + 1;
                            } else if (pagination.current_page <= 3) {
                              pageNum = i + 1;
                            } else if (
                              pagination.current_page >=
                              pagination.total_pages - 2
                            ) {
                              pageNum = pagination.total_pages - 4 + i;
                            } else {
                              pageNum = pagination.current_page - 2 + i;
                            }

                            return (
                              <button
                                key={pageNum}
                                className={`${styles.pageNumberBtn} ${
                                  pageNum === pagination.current_page
                                    ? styles.active
                                    : ""
                                }`}
                                onClick={() => handlePageChange(pageNum)}
                              >
                                {pageNum}
                              </button>
                            );
                          }
                        )}
                      </span>

                      <button
                        className={styles.paginationBtn}
                        onClick={() => handlePageChange(pagination.next_num)}
                        disabled={!pagination.has_next}
                        title="Próxima página"
                      >
                        <ChevronRight size={16} />
                      </button>

                      <button
                        className={styles.paginationBtn}
                        onClick={() => handlePageChange(pagination.total_pages)}
                        disabled={!pagination.has_next}
                        title="Última página"
                      >
                        <ChevronsRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Modal: Criar Usuário */}
          <UserModal
            isOpen={!!showUserForm}
            mode="create"
            onClose={() => setShowUserForm(false)}
            onCreate={handleCreateUser}
            busy={savingUser}
          />

          <UserModal
            isOpen={!!editingUser}
            mode="edit"
            initial={editingUser}
            onClose={() => setEditingUser(null)}
            onUpdate={handleUpdateUser}
            busy={savingUser}
          />

          {/* Modal de confirmação de exclusão */}
          {showDeleteModal && (
            <DeleteConfirmModal
              isOpen={showDeleteModal}
              onConfirm={confirmDelete}
              onCancel={cancelDelete}
              itemName={userToDelete?.username}
              itemType="usuário"
            />
          )}

          {/* Modal de gerenciamento de roles */}
          {showRoleManager && userToManageRoles && (
            <UserRoleManager
              user={userToManageRoles}
              isOpen={showRoleManager}
              onClose={() => {
                setShowRoleManager(false);
                setUserToManageRoles(null);
              }}
              onUserUpdate={handleUserUpdate}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default AdminUsers;
