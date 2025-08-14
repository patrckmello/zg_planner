import React, { useState, useEffect } from "react";
import { FiUsers, FiUser, FiCheck, FiX } from "react-icons/fi";
import Button from "../ui/Button";
import styles from "./TeamMemberSelector.module.css";
import api from "../../services/axiosInstance";

function TeamMemberSelector({
  teamId,
  selectedMembers = [],
  onSelectionChange,
  label = "Atribuir para",
  placeholder = "Selecione os membros...",
  allowMultiple = true,
  disabled = false,
}) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (teamId) {
      fetchTeamMembers();
    } else {
      setMembers([]);
    }
  }, [teamId]);

  const fetchTeamMembers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/teams/${teamId}/members`);
      setMembers(response.data);
    } catch (err) {
      console.error("Erro ao carregar membros da equipe:", err);
      setError("Erro ao carregar membros da equipe");
    } finally {
      setLoading(false);
    }
  };

  const handleMemberToggle = (memberId) => {
    if (disabled) return;

    let newSelection;
    if (allowMultiple) {
      if (selectedMembers.includes(memberId)) {
        newSelection = selectedMembers.filter((id) => id !== memberId);
      } else {
        newSelection = [...selectedMembers, memberId];
      }
    } else {
      newSelection = selectedMembers.includes(memberId) ? [] : [memberId];
    }

    onSelectionChange(newSelection);
  };

  const handleSelectAll = () => {
    if (disabled) return;

    const allMemberIds = members.map((member) => member.id);
    const allSelected = allMemberIds.every((id) =>
      selectedMembers.includes(id)
    );

    if (allSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange(allMemberIds);
    }
  };

  const getSelectedMembersText = () => {
    if (selectedMembers.length === 0) {
      return placeholder;
    }

    if (selectedMembers.length === members.length && members.length > 0) {
      return `Todos os membros (${members.length})`;
    }

    if (selectedMembers.length === 1) {
      const member = members.find((m) => m.id === selectedMembers[0]);
      return member ? member.username : "1 membro selecionado";
    }

    return `${selectedMembers.length} membros selecionados`;
  };

  if (!teamId) {
    return (
      <div className={styles.selectorContainer}>
        <label className={styles.label}>{label}</label>
        <div className={styles.noTeamMessage}>
          <FiUsers className={styles.icon} />
          <span>Selecione uma equipe primeiro</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.selectorContainer}>
      <label className={styles.label}>{label}</label>

      <div className={`${styles.selector} ${disabled ? styles.disabled : ""}`}>
        <div
          className={`${styles.selectorHeader} ${isOpen ? styles.open : ""}`}
          onClick={() => !disabled && setIsOpen(!isOpen)}
        >
          <div className={styles.selectedText}>
            <FiUsers className={styles.headerIcon} />
            <span>{getSelectedMembersText()}</span>
          </div>
          <div className={styles.headerActions}>
            {selectedMembers.length > 0 && (
              <span className={styles.selectedCount}>
                {selectedMembers.length}
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
            {loading ? (
              <div className={styles.loadingState}>
                <div className={styles.spinner}></div>
                <span>Carregando membros...</span>
              </div>
            ) : error ? (
              <div className={styles.errorState}>
                <FiX className={styles.errorIcon} />
                <span>{error}</span>
                <Button
                  size="small"
                  variant="secondary"
                  onClick={fetchTeamMembers}
                >
                  Tentar novamente
                </Button>
              </div>
            ) : members.length === 0 ? (
              <div className={styles.emptyState}>
                <FiUsers className={styles.emptyIcon} />
                <span>Nenhum membro encontrado</span>
              </div>
            ) : (
              <>
                {allowMultiple && members.length > 1 && (
                  <div className={styles.selectAllContainer}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="small"
                      onClick={handleSelectAll}
                      className={styles.selectAllButton}
                    >
                      <FiUsers className={styles.buttonIcon} />
                      {selectedMembers.length === members.length
                        ? "Desmarcar todos"
                        : "Selecionar todos"}
                    </Button>
                  </div>
                )}

                <div className={styles.membersList}>
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className={`${styles.memberItem} ${
                        selectedMembers.includes(member.id)
                          ? styles.selected
                          : ""
                      }`}
                      onClick={() => handleMemberToggle(member.id)}
                    >
                      <div className={styles.memberInfo}>
                        <div className={styles.memberAvatar}>
                          <FiUser />
                        </div>
                        <div className={styles.memberDetails}>
                          <div className={styles.memberName}>
                            {member.username}
                            {member.is_manager && (
                              <span className={styles.managerBadge}>
                                Gestor
                              </span>
                            )}
                          </div>
                          <div className={styles.memberEmail}>
                            {member.email}
                          </div>
                        </div>
                      </div>
                      <div className={styles.memberActions}>
                        {selectedMembers.includes(member.id) && (
                          <FiCheck className={styles.checkIcon} />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default TeamMemberSelector;
