import React, { useState, useEffect } from "react";
import { FiPlus, FiX, FiUser, FiMail, FiShield } from "react-icons/fi";
import api from "../services/axiosInstance";
import styles from "./RoleUserManager.module.css";

function RoleUserManager({ role, onRoleUpdate, onClose }) {
  const [allUsers, setAllUsers] = useState([]);
  const [roleUsers, setRoleUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState("");

  useEffect(() => {
    fetchData();
  }, [role.id]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Buscar todos os usuários
      const usersResponse = await api.get("/users");
      setAllUsers(usersResponse.data);

      // Buscar usuários do cargo específico
      const roleUsersResponse = await api.get(`/roles/${role.id}/users`);
      setRoleUsers(roleUsersResponse.data.users);
    } catch (error) {
      console.error("Erro ao buscar dados:", error);
      setError("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async () => {
    if (!selectedUserId) {
      alert("Selecione um usuário para adicionar");
      return;
    }

    try {
      const response = await api.post(
        `/roles/${role.id}/users/${selectedUserId}`
      );
      setRoleUsers(response.data.users);
      setSelectedUserId("");

      // Atualizar o role no componente pai
      if (onRoleUpdate) {
        onRoleUpdate({
          ...role,
          users_count: response.data.users.length,
        });
      }
    } catch (error) {
      console.error("Erro ao adicionar usuário:", error);
      if (error.response?.data?.error) {
        alert(error.response.data.error);
      } else {
        alert("Erro ao adicionar usuário");
      }
    }
  };

  const handleRemoveUser = async (userId) => {
    try {
      const response = await api.delete(`/roles/${role.id}/users/${userId}`);
      setRoleUsers(response.data.users);

      // Atualizar o role no componente pai
      if (onRoleUpdate) {
        onRoleUpdate({
          ...role,
          users_count: response.data.users.length,
        });
      }
    } catch (error) {
      console.error("Erro ao remover usuário:", error);
      if (error.response?.data?.error) {
        alert(error.response.data.error);
      } else {
        alert("Erro ao remover usuário");
      }
    }
  };

  const availableUsers = allUsers.filter(
    (user) => !roleUsers.some((roleUser) => roleUser.id === user.id)
  );

  if (loading) {
    return (
      <div className={styles.modalOverlay}>
        <div className={styles.modalContent}>
          <div className={styles.loading}>Carregando...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>
            <FiShield className={styles.titleIcon} />
            Gerenciar Usuários - {role.name}
          </h3>
          <button className={styles.closeButton} onClick={onClose}>
            <FiX />
          </button>
        </div>

        <div className={styles.modalBody}>
          {error && <div className={styles.errorMessage}>{error}</div>}

          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>
              Usuários com este cargo ({roleUsers.length})
            </h4>
            {roleUsers.length > 0 ? (
              <div className={styles.usersList}>
                {roleUsers.map((user) => (
                  <div key={user.id} className={styles.userItem}>
                    <div className={styles.userInfo}>
                      <div className={styles.userAvatar}>
                        <FiUser className={styles.userIcon} />
                      </div>
                      <div className={styles.userDetails}>
                        <div className={styles.userName}>
                          {user.username}
                          {user.is_admin && (
                            <span className={styles.adminBadge}>Admin</span>
                          )}
                        </div>
                        <div className={styles.userEmail}>
                          <FiMail className={styles.emailIcon} />
                          {user.email}
                        </div>
                      </div>
                    </div>
                    <button
                      className={styles.removeButton}
                      onClick={() => handleRemoveUser(user.id)}
                      title="Remover usuário do cargo"
                    >
                      <FiX />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.emptyMessage}>
                Nenhum usuário possui este cargo
              </div>
            )}
          </div>

          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>Adicionar Usuário</h4>
            {availableUsers.length > 0 ? (
              <div className={styles.addUserForm}>
                <select
                  className={styles.userSelect}
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                >
                  <option value="">Selecione um usuário</option>
                  {availableUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.username} ({user.email})
                    </option>
                  ))}
                </select>
                <button
                  className={styles.addButton}
                  onClick={handleAddUser}
                  disabled={!selectedUserId}
                >
                  <FiPlus />
                  Adicionar
                </button>
              </div>
            ) : (
              <div className={styles.emptyMessage}>
                Todos os usuários já possuem este cargo
              </div>
            )}
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.closeBtn} onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

export default RoleUserManager;
