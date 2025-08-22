import React, { useState, useEffect } from "react";
import { FiPlus, FiX, FiUser, FiShield } from "react-icons/fi";
import api from "../services/axiosInstance";
import styles from "./UserRoleManager.module.css";

function UserRoleManager({ user, onUserUpdate, onClose }) {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRoleId, setSelectedRoleId] = useState("");

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      const response = await api.get("/roles");
      setRoles(response.data);
    } catch (error) {
      console.error("Erro ao buscar roles:", error);
      setError("Erro ao carregar cargos");
    } finally {
      setLoading(false);
    }
  };

  const handleAddRole = async () => {
    if (!selectedRoleId) {
      alert("Selecione um cargo para adicionar");
      return;
    }

    try {
      const response = await api.post(`/users/${user.id}/roles`, {
        role_id: parseInt(selectedRoleId),
      });
      onUserUpdate(response.data);
      setSelectedRoleId("");
    } catch (error) {
      console.error("Erro ao adicionar role:", error);
      if (error.response?.data?.error) {
        alert(error.response.data.error);
      } else {
        alert("Erro ao adicionar cargo");
      }
    }
  };

  const handleRemoveRole = async (roleId) => {
    try {
      const response = await api.delete(`/users/${user.id}/roles/${roleId}`);
      onUserUpdate(response.data);
    } catch (error) {
      console.error("Erro ao remover role:", error);
      if (error.response?.data?.error) {
        alert(error.response.data.error);
      } else {
        alert("Erro ao remover cargo");
      }
    }
  };

  const availableRoles = roles.filter(
    (role) => !user.roles?.some((userRole) => userRole.id === role.id)
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
            <FiUser className={styles.titleIcon} />
            Gerenciar Cargos - {user.username}
          </h3>
          <button className={styles.closeButton} onClick={onClose}>
            <FiX />
          </button>
        </div>

        <div className={styles.modalBody}>
          {error && <div className={styles.errorMessage}>{error}</div>}

          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>Cargos Atuais</h4>
            {user.roles && user.roles.length > 0 ? (
              <div className={styles.rolesList}>
                {user.roles.map((role) => (
                  <div key={role.id} className={styles.roleItem}>
                    <div className={styles.roleInfo}>
                      <FiShield className={styles.roleIcon} />
                      <div>
                        <div className={styles.roleName}>{role.name}</div>
                        {role.description && (
                          <div className={styles.roleDescription}>
                            {role.description}
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      className={styles.removeButton}
                      onClick={() => handleRemoveRole(role.id)}
                      title="Remover cargo"
                    >
                      <FiX />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.emptyMessage}>Nenhum cargo atribuído</div>
            )}
          </div>

          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>Adicionar Cargo</h4>
            {availableRoles.length > 0 ? (
              <div className={styles.addRoleForm}>
                <select
                  className={styles.roleSelect}
                  value={selectedRoleId}
                  onChange={(e) => setSelectedRoleId(e.target.value)}
                >
                  <option value="">Selecione um cargo</option>
                  {availableRoles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
                <button
                  className={styles.addButton}
                  onClick={handleAddRole}
                  disabled={!selectedRoleId}
                >
                  <FiPlus />
                  Adicionar
                </button>
              </div>
            ) : (
              <div className={styles.emptyMessage}>
                Todos os cargos disponíveis já foram atribuídos
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

export default UserRoleManager;
