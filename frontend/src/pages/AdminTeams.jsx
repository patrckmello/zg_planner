import React, { useState, useEffect } from "react";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import styles from "./AdminTeams.module.css";
import api from "../services/axiosInstance";
import TeamCreateModal from "../components/TeamCreateModal";
import { useNavigate } from "react-router-dom";
import {
  FiArrowDownCircle,
  FiPlus,
  FiEdit,
  FiUsers,
  FiMoreHorizontal,
  FiTrash2,
  FiShield,
  FiUser,
} from "react-icons/fi";
import { toast } from "react-toastify";

function AdminTeams() {
  const navigate = useNavigate();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingTeam, setEditingTeam] = useState(null);
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [sortBy, setSortBy] = useState("name");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [teamToDelete, setTeamToDelete] = useState(null);
  const [showDropdown, setShowDropdown] = useState(null);

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
        const teamsResponse = await api.get("/teams");
        setTeams(teamsResponse.data);
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

   const handleCreateTeam = async (payload) => {
    if (!payload?.name) { toast.error("O nome da equipe é obrigatório!"); return; }
    try {
      const response = await api.post("/teams", payload);
      setTeams((prev) => [...prev, response.data]);
      setShowTeamForm(false);
      toast.success("Equipe criada com sucesso!");
    } catch (error) {
      if (error.response?.data?.error) toast.error(error.response.data.error);
      else toast.error("Erro ao criar equipe. Tente novamente.");
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
      setEditingTeam(response.data);
        return response.data;
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
      setEditingTeam(response.data);
        return response.data;
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
      setEditingTeam(response.data);
        return response.data;
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
          isOpen={showTeamForm}
          mode="create"
          onClose={() => setShowTeamForm(false)}
          onCreate={handleCreateTeam}
          initialTab="detalhes"
        />

       <TeamCreateModal
          isOpen={!!editingTeam}
          mode="edit"
          initial={editingTeam}
          onClose={() => setEditingTeam(null)}
          onUpdate={handleUpdateTeam}
          initialTab="detalhes"
          onAddMember={handleAddMember}
          onRemoveMember={handleRemoveMember}
          onToggleManager={handleToggleManager}
        />
        
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
