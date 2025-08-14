import React, { useState, useEffect } from "react";
import { FiUsers, FiUser, FiCheck, FiX, FiSearch } from "react-icons/fi";
import Button from "../ui/Button";
import Input from "../ui/Input";
import styles from "./CollaboratorSelector.module.css";
import api from "../../services/axiosInstance";

function CollaboratorSelector({
  selectedCollaborators = [],
  onSelectionChange,
  label = "Colaboradores/Observadores",
  placeholder = "Adicionar colaboradores...",
  disabled = false,
  excludeUserIds = [], // IDs de usuários para excluir da lista
}) {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchAvailableCollaborators();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, searchTerm, excludeUserIds]);

  const fetchAvailableCollaborators = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get("/users/available-collaborators");
      setUsers(response.data);
    } catch (err) {
      console.error("Erro ao carregar colaboradores:", err);
      setError("Erro ao carregar usuários disponíveis");
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    let filtered = users.filter((user) => !excludeUserIds.includes(user.id));

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (user) =>
          user.username.toLowerCase().includes(term) ||
          user.email.toLowerCase().includes(term)
      );
    }

    setFilteredUsers(filtered);
  };

  const handleCollaboratorToggle = (userId) => {
    if (disabled) return;

    let newSelection;
    if (selectedCollaborators.includes(userId)) {
      newSelection = selectedCollaborators.filter((id) => id !== userId);
    } else {
      newSelection = [...selectedCollaborators, userId];
    }

    onSelectionChange(newSelection);
  };

  const handleRemoveCollaborator = (userId, event) => {
    event.stopPropagation();
    const newSelection = selectedCollaborators.filter((id) => id !== userId);
    onSelectionChange(newSelection);
  };

  const getSelectedCollaboratorsText = () => {
    if (selectedCollaborators.length === 0) {
      return placeholder;
    }

    if (selectedCollaborators.length === 1) {
      const user = users.find((u) => u.id === selectedCollaborators[0]);
      return user ? user.username : "1 colaborador selecionado";
    }

    return `${selectedCollaborators.length} colaboradores selecionados`;
  };

  const getSelectedUsers = () => {
    return users.filter((user) => selectedCollaborators.includes(user.id));
  };

  return (
    <div className={styles.selectorContainer}>
      <label className={styles.label}>{label}</label>

      <div className={`${styles.selector} ${disabled ? styles.disabled : ""}`}>
        {/* Colaboradores selecionados */}
        {selectedCollaborators.length > 0 && (
          <div className={styles.selectedCollaborators}>
            {getSelectedUsers().map((user) => (
              <div key={user.id} className={styles.collaboratorChip}>
                <div className={styles.chipAvatar}>
                  <FiUser />
                </div>
                <span className={styles.chipName}>{user.username}</span>
                <button
                  type="button"
                  className={styles.chipRemove}
                  onClick={(e) => handleRemoveCollaborator(user.id, e)}
                  disabled={disabled}
                >
                  <FiX />
                </button>
              </div>
            ))}
          </div>
        )}

        <div
          className={`${styles.selectorHeader} ${isOpen ? styles.open : ""}`}
          onClick={() => !disabled && setIsOpen(!isOpen)}
        >
          <div className={styles.selectedText}>
            <FiUsers className={styles.headerIcon} />
            <span>{getSelectedCollaboratorsText()}</span>
          </div>
          <div className={styles.headerActions}>
            {selectedCollaborators.length > 0 && (
              <span className={styles.selectedCount}>
                {selectedCollaborators.length}
              </span>
            )}
            <div
              className={`${styles.chevron} ${isOpen ? styles.rotated : ""}`}
            >
              ▼
            </div>
          </div>
        </div>

        {isOpen && (
          <div className={styles.dropdown}>
            {/* Campo de busca */}
            <div className={styles.searchContainer}>
              <Input
                type="text"
                placeholder="Buscar usuários..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                icon={<FiSearch />}
                className={styles.searchInput}
              />
            </div>

            {loading ? (
              <div className={styles.loadingState}>
                <div className={styles.spinner}></div>
                <span>Carregando usuários...</span>
              </div>
            ) : error ? (
              <div className={styles.errorState}>
                <FiX className={styles.errorIcon} />
                <span>{error}</span>
                <Button
                  size="small"
                  variant="secondary"
                  onClick={fetchAvailableCollaborators}
                >
                  Tentar novamente
                </Button>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className={styles.emptyState}>
                <FiUsers className={styles.emptyIcon} />
                <span>
                  {searchTerm
                    ? "Nenhum usuário encontrado"
                    : "Nenhum usuário disponível"}
                </span>
              </div>
            ) : (
              <div className={styles.usersList}>
                {filteredUsers.map((user) => (
                  <div
                    key={user.id}
                    className={`${styles.userItem} ${
                      selectedCollaborators.includes(user.id)
                        ? styles.selected
                        : ""
                    }`}
                    onClick={() => handleCollaboratorToggle(user.id)}
                  >
                    <div className={styles.userInfo}>
                      <div className={styles.userAvatar}>
                        <FiUser />
                      </div>
                      <div className={styles.userDetails}>
                        <div className={styles.userName}>{user.username}</div>
                        <div className={styles.userEmail}>{user.email}</div>
                        {user.teams && user.teams.length > 0 && (
                          <div className={styles.userTeams}>
                            {user.teams.slice(0, 2).map((team) => (
                              <span key={team.id} className={styles.teamBadge}>
                                {team.name}
                              </span>
                            ))}
                            {user.teams.length > 2 && (
                              <span className={styles.teamBadge}>
                                +{user.teams.length - 2}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className={styles.userActions}>
                      {selectedCollaborators.includes(user.id) && (
                        <FiCheck className={styles.checkIcon} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default CollaboratorSelector;
