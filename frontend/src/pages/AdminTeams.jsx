import React, { useState, useEffect } from "react";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import styles from "./AdminTeams.module.css";
import api from "../services/axiosInstance";
import TeamCreateModal from "../components/TeamCreateModal";
import { useNavigate } from "react-router-dom";
import {
  FiFilter,
  FiArrowDownCircle,
  FiPlus,
  FiEdit,
  FiUsers,
  FiMoreHorizontal,
  FiTrash2,
  FiUserPlus,
  FiUserMinus,
  FiShield,
  FiUser,
} from "react-icons/fi";
import { toast } from "react-toastify";

function AdminTeams() {
  const navigate = useNavigate();
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [sortBy, setSortBy] = useState("name");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [teamToDelete, setTeamToDelete] = useState(null);
  const [showDropdown, setShowDropdown] = useState(null);

  // Estado para nova equipe
  const [newTeam, setNewTeam] = useState({
    name: "",
    description: "",
  });

  // Manteremos a sidebar aberta por padrão em telas maiores
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);

  const sortedTeams = [...teams].sort((a, b) => {
    if (sortBy === "name") return a.name.localeCompare(b.name);
    if (sortBy === "description")
      return (a.description || "").localeCompare(b.description || "");
    if (sortBy === "members_count")
      return (b.members?.length || 0) - (a.members?.length || 0);
    return 0;
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [teamsResponse, usersResponse] = await Promise.all([
          api.get("/teams"),
          api.get("/users"),
        ]);
        console.log("Teams data:", teamsResponse.data); // veja se members aparece aqui
        setTeams(teamsResponse.data);
        setUsers(
          Array.isArray(usersResponse.data)
            ? usersResponse.data
            : usersResponse.data.items || []
        );
        console.log("Users data raw:", usersResponse.data);
      } catch (error) {
        console.error(error);
        setError("Erro ao buscar dados.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();

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
    const savedSort = localStorage.getItem("teamSortBy");
    if (savedSort) setSortBy(savedSort);
  }, []);

  useEffect(() => {
    localStorage.setItem("teamSortBy", sortBy);
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
    setNewTeam({ name: "", description: "" });
  };

  const handleCreateTeam = async () => {
    if (!newTeam.name) {
      toast.error("O nome da equipe é obrigatório!");
      return;
    }

    try {
      const response = await api.post("/teams", newTeam);
      setTeams([...teams, response.data]);
      resetForm();
      setShowTeamForm(false);
      console.log("Equipe criada com sucesso:", response.data);
    } catch (error) {
      console.error("Erro ao criar equipe:", error);

      // Se o backend retornou erro e mensagem, mostra ela
      if (error.response && error.response.data && error.response.data.error) {
        toast.error(error.response.data.error);
      } else {
        toast.error("Erro ao criar equipe. Tente novamente.");
      }
    }
  };

  const handleUpdateTeam = async (teamId, teamData) => {
    try {
      const response = await api.put(`/teams/${teamId}`, teamData);
      setTeams((prev) =>
        prev.map((t) => (t.id === teamId ? response.data : t))
      );
      setEditingTeam(null);
      console.log("Equipe atualizada com sucesso:", response.data);
    } catch (error) {
      console.error("Mensagem de erro:", error);

      if (error.response?.data?.error) {
        toast.error(error.response.data.error);
      } else {
        toast.error("Erro inesperado. Tente novamente.");
      }
    }
  };

  const handleAddMember = async (teamId, userId) => {
    try {
      const response = await api.post(`/teams/${teamId}/users`, {
        user_id: userId,
      });
      setTeams((prev) =>
        prev.map((t) => (t.id === teamId ? response.data : t))
      );
      setSelectedTeam(response.data); // <---- ATUALIZA O TIME ABERTO NO MODAL
      console.log("Membro adicionado com sucesso");
    } catch (error) {
      console.error("Mensagem de erro:", error);

      if (error.response?.data?.error) {
        toast.error(error.response.data.error);
      } else {
        toast.error("Erro inesperado. Tente novamente.");
      }
    }
  };

  const handleRemoveMember = async (teamId, userId) => {
    try {
      const response = await api.delete(`/teams/${teamId}/users/${userId}`);
      setTeams((prev) =>
        prev.map((t) => (t.id === teamId ? response.data : t))
      );
      setSelectedTeam(response.data); // atualiza também o modal aberto
      console.log("Membro removido com sucesso");
    } catch (error) {
      console.error("Mensagem de erro:", error);

      if (error.response?.data?.error) {
        toast.error(error.response.data.error);
      } else {
        toast.error("Erro inesperado. Tente novamente.");
      }
    }
  };

  const handleToggleManager = async (teamId, userId, isManager) => {
    try {
      const response = await api.put(`/teams/${teamId}/users/${userId}`, {
        is_manager: !isManager,
      });
      setTeams((prev) =>
        prev.map((t) => (t.id === teamId ? response.data : t))
      );
      setSelectedTeam(response.data); // atualiza também o modal aberto
      console.log("Status de gestor alterado com sucesso");
    } catch (error) {
      console.error("Mensagem de erro:", error);

      if (error.response?.data?.error) {
        toast.error(error.response.data.error);
      } else {
        toast.error("Erro inesperado. Tente novamente.");
      }
    }
  };

  const cancelDelete = () => {
    setTeamToDelete(null);
    setShowDeleteModal(false);
  };

  const confirmDelete = async () => {
    if (!teamToDelete) return;

    try {
      await api.delete(`/teams/${teamToDelete.id}`);
      setTeams((prev) => prev.filter((t) => t.id !== teamToDelete.id));
    } catch (error) {
      console.error("Erro ao excluir equipe:", error);
      toast.error("Erro ao excluir equipe.");
    } finally {
      setTeamToDelete(null);
      setShowDeleteModal(false);
      setShowDropdown(null);
    }
  };

  const openMembersModal = (team) => {
    setSelectedTeam(team);
    setShowMembersModal(true);
  };

  const getAvailableUsers = () => {
    if (!selectedTeam || !Array.isArray(users)) return [];
    const teamMemberIds = selectedTeam.members?.map((m) => m.user_id) || [];
    return users.filter((user) => !teamMemberIds.includes(user.id));
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
    <div className={styles.adminTeamsPage}>
      <Header onMenuToggle={toggleSidebar} />

      <div className={styles.pageBody}>
        <Sidebar onLogout={handleLogout} isOpen={sidebarOpen} />

        <main className={styles.contentArea}>
          <div className={styles.teamsWrapper}>
            <div className={styles.teamsHeader}>
              <h2>Administração de Equipes</h2>
              <button
                className={styles.addTeamBtn}
                onClick={() => setShowTeamForm(true)}
              >
                <FiPlus className={styles.btnIcon} />
                Nova Equipe
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
                    <option value="members_count">Número de membros</option>
                  </select>
                </label>
              </div>
            </div>

            <div className={styles.teamsList}>
              {sortedTeams.length === 0 ? (
                <div className={styles.emptyTeams}>
                  Nenhuma equipe cadastrada.
                </div>
              ) : (
                sortedTeams.map((team) => (
                  <div key={team.id} className={styles.teamItem}>
                    <div className={styles.teamInfo}>
                      <div className={styles.teamIcon}>
                        <FiUsers className={styles.iconUsers} />
                      </div>
                      <div className={styles.teamDetails}>
                        <div className={styles.teamName}>{team.name}</div>
                        <div className={styles.teamDescription}>
                          {team.description || "Sem descrição"}
                        </div>
                        <div className={styles.teamStats}>
                          <FiUser className={styles.statsIcon} />
                          {team.members?.length || 0} membro(s)
                          {team.members?.some((m) => m.is_manager) && (
                            <span className={styles.managerIndicator}>
                              <FiShield className={styles.managerIcon} />
                              Com gestor
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className={styles.teamActions}>
                      <button
                        className={styles.membersBtn}
                        onClick={() => openMembersModal(team)}
                        title="Gerenciar membros"
                      >
                        <FiUserPlus />
                      </button>
                      <button
                        className={styles.editBtn}
                        onClick={() => setEditingTeam(team)}
                        title="Editar equipe"
                      >
                        <FiEdit />
                      </button>
                      <div className={styles.dropdown}>
                        <button
                          className={styles.moreBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowDropdown(
                              showDropdown === team.id ? null : team.id
                            );
                          }}
                          title="Mais opções"
                        >
                          <FiMoreHorizontal />
                        </button>
                        {showDropdown === team.id && (
                          <div className={styles.dropdownMenu}>
                            <button
                              className={`${styles.dropdownItem} ${styles.dangerItem}`}
                              onClick={() => {
                                setTeamToDelete(team);
                                setShowDeleteModal(true);
                              }}
                            >
                              <FiTrash2 className={styles.dropdownIcon} />
                              Excluir Equipe
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

        {/* Modal para criar nova equipe */}
        <TeamCreateModal
          isOpen={!!showTeamForm}
          mode="create"
          onClose={() => { setShowTeamForm(false); resetForm(); }}
          onCreate={handleCreateTeam}
        />

        <TeamCreateModal
          isOpen={!!editingTeam}
          mode="edit"
          initial={editingTeam}
          onClose={() => setEditingTeam(null)}
          onUpdate={handleUpdateTeam}
        />

        {/* Modal para gerenciar membros */}
        {showMembersModal && selectedTeam && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>
                  Gerenciar Membros - {selectedTeam.name}
                </h3>
                <button
                  className={styles.closeButton}
                  onClick={() => {
                    setShowMembersModal(false);
                    setSelectedTeam(null);
                  }}
                >
                  ×
                </button>
              </div>
              <div className={styles.modalBody}>
                {/* Membros atuais */}
                <div className={styles.section}>
                  <h4 className={styles.sectionTitle}>Membros Atuais</h4>
                  {selectedTeam.members && selectedTeam.members.length > 0 ? (
                    <div className={styles.membersList}>
                      {selectedTeam.members.map((member) => (
                        <div key={member.id} className={styles.memberItem}>
                          <div className={styles.memberInfo}>
                            <span className={styles.memberName}>
                              {member.username}
                            </span>
                            <span className={styles.memberEmail}>
                              {member.email}
                            </span>
                            {member.is_manager && (
                              <span className={styles.managerBadge}>
                                <FiShield className={styles.badgeIcon} />
                                Gestor
                              </span>
                            )}
                          </div>
                          <div className={styles.memberActions}>
                            <button
                              className={`${styles.toggleBtn} ${
                                member.is_manager ? styles.active : ""
                              }`}
                              onClick={() =>
                                handleToggleManager(
                                  selectedTeam.id,
                                  member.user_id,
                                  member.is_manager
                                )
                              }
                              title={
                                member.is_manager
                                  ? "Remover como gestor"
                                  : "Tornar gestor"
                              }
                            >
                              <FiShield />
                            </button>
                            <button
                              className={styles.removeBtn}
                              onClick={() =>
                                handleRemoveMember(
                                  selectedTeam.id,
                                  member.user_id
                                )
                              }
                              title="Remover da equipe"
                            >
                              <FiUserMinus />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className={styles.emptyMessage}>
                      Nenhum membro na equipe.
                    </p>
                  )}
                </div>

                {/* Adicionar novos membros */}
                <div className={styles.section}>
                  <h4 className={styles.sectionTitle}>Adicionar Membros</h4>
                  {getAvailableUsers().length > 0 ? (
                    <div className={styles.availableUsersList}>
                      {getAvailableUsers().map((user) => (
                        <div key={user.id} className={styles.availableUserItem}>
                          <div className={styles.userInfo}>
                            <span className={styles.userName}>
                              {user.username}
                            </span>
                            <span className={styles.userEmail}>
                              {user.email}
                            </span>
                          </div>
                          <button
                            className={styles.addBtn}
                            onClick={() =>
                              handleAddMember(selectedTeam.id, user.id)
                            }
                            title="Adicionar à equipe"
                          >
                            <FiUserPlus />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className={styles.emptyMessage}>
                      Todos os usuários já estão na equipe.
                    </p>
                  )}
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button
                  className={styles.cancelBtn}
                  onClick={() => {
                    setShowMembersModal(false);
                    setSelectedTeam(null);
                  }}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

        <DeleteConfirmModal
          isOpen={showDeleteModal}
          onCancel={cancelDelete}
          onConfirm={confirmDelete}
          taskTitle={teamToDelete?.name || ""}
        />
      </div>
    </div>
  );
}

export default AdminTeams;
