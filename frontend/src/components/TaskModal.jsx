import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import styles from "./TaskModal.module.css";
import api from "../services/axiosInstance";
import DeleteConfirmModal from "./DeleteConfirmModal";
import {
  FiX,
  FiEdit,
  FiTrash2,
  FiUser,
  FiCalendar,
  FiClock,
  FiTag,
  FiPaperclip,
  FiMessageCircle,
  FiDownload,
  FiSend,
  FiFlag,
  FiFolder,
  FiUsers,
  FiEye,
  FiFileText,
  FiUserCheck,
} from "react-icons/fi";

const TaskModal = ({ task, isOpen, onClose, onTaskUpdate }) => {
  const navigate = useNavigate();
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    if (isOpen && task) {
      fetchTaskDetails();
      fetchCurrentUser();
    } else if (!isOpen) {
      setShowDeleteModal(false); // Resetar o estado do modal de exclusão ao fechar o modal da task
    }
  }, [isOpen, task]);

  const fetchCurrentUser = async () => {
    try {
      const response = await api.get("/users/me");
      setCurrentUser(response.data);
    } catch (error) {
      console.error("Erro ao buscar usuário atual:", error);
    }
  };

  const fetchTaskDetails = async () => {
    try {
      // Buscar comentários da tarefa
      const response = await api.get(`/tasks/${task.id}/comments`);
      setComments(response.data);
    } catch (error) {
      console.error("Erro ao buscar detalhes da tarefa:", error);
      setComments([]); // Em caso de erro, lista vazia
    }
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;

    setLoading(true);
    try {
      const response = await api.post(`/tasks/${task.id}/comments`, {
        content: comment,
      });

      setComments((prev) => [...prev, response.data]);
      setComment("");
      console.log("Comentário adicionado:", response.data);
    } catch (error) {
      console.error("Erro ao adicionar comentário:", error);
      toast.error("Erro ao adicionar comentário. Tente novamente.", {
        position: "top-right",
        autoClose: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    navigate(`/tasks/${task.id}/edit`);
    onClose();
  };

  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/tasks/${task.id}`);
      onTaskUpdate(task.id, { deleted: true });
      setShowDeleteModal(false);
      onClose();
      toast.success("Tarefa excluída com sucesso!", {
        position: "top-right",
        autoClose: 3000,
      });
    } catch (error) {
      console.error("Erro ao excluir tarefa:", error);
      toast.error("Erro ao excluir tarefa. Tente novamente.", {
        position: "top-right",
        autoClose: 5000,
      });
      setShowDeleteModal(false);
    }
  };

  const downloadAttachment = (anexo) => {
    if (anexo.url) {
      window.open(anexo.url, "_blank");
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Não definida";
    const date = new Date(dateString);
    // Corrigir para fuso horário local
    const localDate = new Date(
      date.getTime() - date.getTimezoneOffset() * 60000
    );
    return localDate.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    });
  };

  const formatEstimatedTime = (time, unit) => {
    if (!time) return "Não definido";
    return `${time} ${unit === "horas" ? "horas" : "minutos"}`;
  };

  const getPriorityColor = (priority) => {
    const colors = {
      urgente: "#e74c3c",
      alta: "#f39c12",
      media: "#f1c40f",
      baixa: "#27ae60",
    };
    return colors[priority] || "#95a5a6";
  };

  const getStatusLabel = (status) => {
    const labels = {
      pending: "Pendente",
      in_progress: "Em andamento",
      done: "Concluído",
      cancelled: "Cancelado",
    };
    return labels[status] || status;
  };

  const getCategoryLabel = (category) => {
    const labels = {
      processo: "Processo",
      projeto: "Projeto",
      manutencao: "Manutenção",
      reuniao: "Reunião",
    };
    return labels[category] || category;
  };

  // Função para renderizar usuário individual
  const renderUserCard = (user, role, icon) => (
    <div key={user.id || user.name} className={styles.userCard}>
      <div className={styles.userAvatar}>{icon}</div>
      <div className={styles.userInfo}>
        <div className={styles.userName}>{user.name}</div>
        <div className={styles.userRole}>{role}</div>
      </div>
    </div>
  );

  if (!isOpen || !task) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        {/* Header do Modal */}
        <div className={styles.modalHeader}>
          <div className={styles.headerLeft}>
            <div
              className={styles.priorityIndicator}
              style={{ backgroundColor: getPriorityColor(task.prioridade) }}
            />
            <h2 className={styles.taskTitle}>{task.title}</h2>
          </div>
          <button className={styles.closeButton} onClick={onClose}>
            <FiX />
          </button>
        </div>

        {/* Conteúdo do Modal */}
        <div className={styles.modalBody}>
          {/* Informações Básicas */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <FiFileText className={styles.sectionIcon} />
              <h3>Informações Básicas</h3>
            </div>
            <div className={styles.sectionContent}>
              {task.description && (
                <div className={styles.description}>
                  <p>{task.description}</p>
                </div>
              )}

              <div className={styles.infoGrid}>
                <div className={styles.infoItem}>
                  <FiFlag className={styles.infoIcon} />
                  <span className={styles.infoLabel}>Prioridade:</span>
                  <span
                    className={styles.priorityBadge}
                    style={{
                      backgroundColor: getPriorityColor(task.prioridade),
                    }}
                  >
                    {task.prioridade?.toUpperCase()}
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <FiFolder className={styles.infoIcon} />
                  <span className={styles.infoLabel}>Status:</span>
                  <span className={styles.infoValue}>
                    {getStatusLabel(task.status)}
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <FiFolder className={styles.infoIcon} />
                  <span className={styles.infoLabel}>Categoria:</span>
                  <span className={styles.infoValue}>
                    {getCategoryLabel(task.categoria)}
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <FiCalendar className={styles.infoIcon} />
                  <span className={styles.infoLabel}>Vencimento:</span>
                  <span className={styles.infoValue}>
                    {formatDate(task.due_date)}
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <FiClock className={styles.infoIcon} />
                  <span className={styles.infoLabel}>Tempo estimado:</span>
                  <span className={styles.infoValue}>
                    {formatEstimatedTime(
                      task.tempo_estimado,
                      task.tempo_unidade
                    )}
                  </span>
                </div>

                {task.relacionado_a && (
                  <div className={styles.infoItem}>
                    <FiFileText className={styles.infoIcon} />
                    <span className={styles.infoLabel}>Relacionado a:</span>
                    <span className={styles.infoValue}>
                      {task.relacionado_a}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Responsável e Colaboradores */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <FiUsers className={styles.sectionIcon} />
              <h3>Pessoas Envolvidas</h3>
            </div>
            <div className={styles.sectionContent}>
              <div className={styles.usersContainer}>
                {/* Responsáveis da tarefa */}
                {task.assigned_users_info &&
                task.assigned_users_info.length > 0 ? (
                  <div className={styles.userGroup}>
                    <div className={styles.userGroupHeader}>
                      <FiUserCheck className={styles.groupIcon} />
                      <span className={styles.groupTitle}>
                        Responsáveis ({task.assigned_users_info.length})
                      </span>
                    </div>
                    <div className={styles.userCards}>
                      {task.assigned_users_info.map((user) =>
                        renderUserCard(user, "Responsável", <FiUserCheck />)
                      )}
                    </div>
                  </div>
                ) : // Fallback para responsável único
                task.assigned_to_user?.name || task.user?.name ? (
                  <div className={styles.userGroup}>
                    <div className={styles.userGroupHeader}>
                      <FiUser className={styles.groupIcon} />
                      <span className={styles.groupTitle}>Responsável</span>
                    </div>
                    <div className={styles.userCards}>
                      {renderUserCard(
                        {
                          id: task.assigned_to_user?.id || task.user?.id,
                          name: task.assigned_to_user?.name || task.user?.name,
                        },
                        "Responsável",
                        <FiUser />
                      )}
                    </div>
                  </div>
                ) : (
                  <div className={styles.userGroup}>
                    <div className={styles.userGroupHeader}>
                      <FiUser className={styles.groupIcon} />
                      <span className={styles.groupTitle}>Responsável</span>
                    </div>
                    <div className={styles.noAssignedMessage}>
                      <span>Nenhum responsável atribuído</span>
                    </div>
                  </div>
                )}

                {/* Atribuído por */}
                {task.assigned_by_user && (
                  <div className={styles.userGroup}>
                    <div className={styles.userGroupHeader}>
                      <FiUsers className={styles.groupIcon} />
                      <span className={styles.groupTitle}>Atribuído por</span>
                    </div>
                    <div className={styles.userCards}>
                      {renderUserCard(
                        task.assigned_by_user,
                        "Gestor",
                        <FiUsers />
                      )}
                    </div>
                  </div>
                )}

                {/* Colaboradores */}
                {task.collaborators_info &&
                  task.collaborators_info.length > 0 && (
                    <div className={styles.userGroup}>
                      <div className={styles.userGroupHeader}>
                        <FiEye className={styles.groupIcon} />
                        <span className={styles.groupTitle}>
                          Colaboradores ({task.collaborators_info.length})
                        </span>
                      </div>
                      <div className={styles.userCards}>
                        {task.collaborators_info.map((collaborator) =>
                          renderUserCard(collaborator, "Colaborador", <FiEye />)
                        )}
                      </div>
                    </div>
                  )}
              </div>
            </div>
          </div>

          {/* Tags */}
          {task.tags && task.tags.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <FiTag className={styles.sectionIcon} />
                <h3>Tags</h3>
              </div>
              <div className={styles.sectionContent}>
                <div className={styles.tags}>
                  {task.tags.map((tag, index) => (
                    <span key={index} className={styles.tag}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Anexos */}
          {task.anexos && task.anexos.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <FiPaperclip className={styles.sectionIcon} />
                <h3>Anexos</h3>
              </div>
              <div className={styles.sectionContent}>
                <div className={styles.attachments}>
                  {task.anexos.map((anexo, index) => (
                    <div key={index} className={styles.attachment}>
                      <div className={styles.attachmentInfo}>
                        <span className={styles.attachmentName}>
                          {anexo.name || anexo.filename || `anexo_${index + 1}`}
                        </span>
                        {anexo.size && (
                          <span className={styles.attachmentSize}>
                            {(anexo.size / 1024).toFixed(1)} KB
                          </span>
                        )}
                      </div>
                      <button
                        className={styles.downloadButton}
                        onClick={() => downloadAttachment(anexo)}
                        title="Baixar anexo"
                      >
                        <FiDownload />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Comentários */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <FiMessageCircle className={styles.sectionIcon} />
              <h3>Comentários</h3>
            </div>
            <div className={styles.sectionContent}>
              {/* Lista de comentários */}
              <div className={styles.commentsList}>
                {comments.length === 0 ? (
                  <p className={styles.noComments}>Nenhum comentário ainda.</p>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className={styles.comment}>
                      <div className={styles.commentHeader}>
                        <span className={styles.commentAuthor}>
                          {comment.user?.name || "Usuário"}
                        </span>
                        <span className={styles.commentDate}>
                          {formatDate(comment.created_at)}
                        </span>
                      </div>
                      <p className={styles.commentContent}>{comment.content}</p>
                    </div>
                  ))
                )}
              </div>

              {/* Formulário de novo comentário */}
              <form
                onSubmit={handleCommentSubmit}
                className={styles.commentForm}
              >
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Adicionar comentário..."
                  className={styles.commentInput}
                  rows={3}
                />
                <button
                  type="submit"
                  className={styles.commentSubmit}
                  disabled={!comment.trim() || loading}
                >
                  <FiSend />
                  {loading ? "Enviando..." : "Enviar"}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Footer do Modal */}
        <div className={styles.modalFooter}>
          <button
            className={`${styles.actionButton} ${styles.editButton}`}
            onClick={handleEdit}
          >
            <FiEdit />
            Editar
          </button>
          <button
            className={`${styles.actionButton} ${styles.deleteButton}`}
            onClick={handleDeleteClick}
          >
            <FiTrash2 />
            Excluir
          </button>
        </div>
      </div>

      {/* Modal de confirmação de exclusão */}
      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onCancel={handleCancelDelete}
        onConfirm={handleDelete}
        taskTitle={task.title}
        message={`Tem certeza que deseja excluir a tarefa "${task?.title}"?`}
      />
    </div>
  );
};

export default TaskModal;
