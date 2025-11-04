import React, { useState, useEffect, useMemo } from "react";
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
  FiClipboard,
} from "react-icons/fi";

const TaskModal = ({ task, isOpen, onClose, onTaskUpdate }) => {
  const navigate = useNavigate();
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    if (isOpen && task) {
      fetchTaskDetails();
      fetchCurrentUser();
    } else if (!isOpen) {
      setShowDeleteModal(false);
      setComment("");
      setComments([]);
    }
  }, [isOpen, task?.id]);

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
      const response = await api.get(`/tasks/${task.id}/comments`);
      setComments(response.data || []);
    } catch (error) {
      console.error("Erro ao buscar detalhes da tarefa:", error);
      setComments([]);
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
    onClose?.();
  };

  const handleDeleteClick = () => setShowDeleteModal(true);

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await api.delete(`/tasks/${task.id}`);
      onTaskUpdate?.(task.id, { deleted: true });
      toast.success("Tarefa excluída com sucesso!", {
        position: "top-right",
        autoClose: 3000,
      });
      setShowDeleteModal(false);
      onClose?.();
    } catch (error) {
      console.error("Erro ao excluir tarefa:", error);
      toast.error("Erro ao excluir tarefa. Tente novamente.", {
        position: "top-right",
        autoClose: 5000,
      });
      setShowDeleteModal(false);
    } finally {
      setDeleting(false);
    }
  };

  const downloadAttachment = (anexo) => {
    const url =
      anexo?.url ||
      (typeof anexo === "string" ? anexo : "") ||
      (anexo?.name ? `/uploads/${anexo.name}` : "");
    if (url) window.open(url, "_blank");
  };

  // === Utils ===
  const formatDate = (dateString) => {
    if (!dateString) return "Não definida";
    return new Date(dateString).toLocaleString("pt-BR", {
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

  // --- APROVAÇÃO ---
  const canManageApproval = () => {
    if (!currentUser || !task) return false;
    return currentUser.is_admin || task.assigned_by_user?.id === currentUser.id;
  };

  const canSubmitForApproval = () => {
    if (!task?.requires_approval) return false;
    return !task.approval_status || task.approval_status === "rejected";
  };

  const canApproveReject = () => {
    if (!task?.requires_approval) return false;
    if (task.approval_status !== "pending") return false;
    return canManageApproval();
  };

  const submitForApproval = async () => {
    try {
      await api.post(`/tasks/${task.id}/submit_for_approval`);
      toast.success("Tarefa enviada para aprovação.");
      onTaskUpdate?.(task.id, { approval_status: "pending" });
      onClose?.();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Falha ao enviar para aprovação.");
    }
  };

  const approveTask = async () => {
    try {
      await api.post(`/tasks/${task.id}/approve`);
      toast.success("Tarefa aprovada e concluída.");
      onTaskUpdate?.(task.id, { approval_status: "approved", status: "done" });
      onClose?.();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Falha ao aprovar tarefa.");
    }
  };

  const rejectTask = async () => {
    try {
      await api.post(`/tasks/${task.id}/reject`);
      toast.info("Tarefa rejeitada.");
      onTaskUpdate?.(task.id, { approval_status: "rejected" });
      onClose?.();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Falha ao rejeitar tarefa.");
    }
  };

  // Render user card helper
  const renderUserCard = (user, role, icon) => (
    <div key={user.id || user.name} className={styles.userCard}>
      <div className={styles.userAvatar}>{icon}</div>
      <div className={styles.userInfo}>
        <div className={styles.userName}>{user.name}</div>
        <div className={styles.userRole}>{role}</div>
      </div>
    </div>
  );

  // === Andamento (subtasks) ===
  const progress = useMemo(() => {
    const list = Array.isArray(task?.subtasks) ? task.subtasks : [];
    const total = list.length;
    const finished = list.filter((s) => s?.done).length;
    const percent = total === 0 ? 0 : Math.round((finished / total) * 100);
    return { total, finished, percent };
  }, [task?.subtasks]);

  if (!isOpen || !task) return null;

  return (
    <div
      className={styles.modalOverlay}
      onClick={() => {
        if (!showDeleteModal) onClose?.();
      }}
    >
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.headerLeft}>
            <div
              className={styles.priorityIndicator}
              style={{ backgroundColor: getPriorityColor(task.prioridade) }}
            />
            <h2 className={styles.taskTitle}>{task.title}</h2>
          </div>
          <button className={styles.closeButton} onClick={onClose} title="Fechar">
            <FiX />
          </button>
        </div>

        {/* Body */}
        <div className={styles.modalBody}>
          {/* === ANDAMENTO === */}
          {progress.total > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <FiClipboard className={styles.sectionIcon} />
                <h3>Andamento</h3>
                <span className={styles.progressLabel}>
                  {progress.finished}/{progress.total} • {progress.percent}%
                </span>
              </div>
              <div className={styles.sectionContent}>
                <div className={styles.progressTrack} aria-label="Andamento">
                  <div
                    className={styles.progressBar}
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Básicas */}
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
                    style={{ backgroundColor: getPriorityColor(task.prioridade) }}
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

                {task.requires_approval && (
                  <div className={styles.infoItem}>
                    <FiUsers className={styles.infoIcon} />
                    <span className={styles.infoLabel}>Aprovação:</span>
                    <span className={styles.infoValue}>
                      {task.approval_status
                        ? (task.approval_status === "pending" && "Pendente") ||
                          (task.approval_status === "approved" && "Aprovada") ||
                          (task.approval_status === "rejected" && "Rejeitada")
                        : "Necessária"}
                      {task.approved_by_user && (
                        <>
                          {" "}
                          • por {task.approved_by_user.name} em{" "}
                          {formatDate(task.approved_at)}
                        </>
                      )}
                    </span>
                  </div>
                )}

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
                    {formatEstimatedTime(task.tempo_estimado, task.tempo_unidade)}
                  </span>
                </div>

                {task.relacionado_a && (
                  <div className={styles.infoItem}>
                    <FiFileText className={styles.infoIcon} />
                    <span className={styles.infoLabel}>Relacionado a:</span>
                    <span className={styles.infoValue}>{task.relacionado_a}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Pessoas */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <FiUsers className={styles.sectionIcon} />
              <h3>Pessoas Envolvidas</h3>
            </div>
            <div className={styles.sectionContent}>
              <div className={styles.usersContainer}>
                {task.assigned_users_info && task.assigned_users_info.length > 0 ? (
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
                ) : task.assigned_to_user?.name || task.user?.name ? (
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

                {task.assigned_by_user && (
                  <div className={styles.userGroup}>
                    <div className={styles.userGroupHeader}>
                      <FiUsers className={styles.groupIcon} />
                      <span className={styles.groupTitle}>Atribuído por</span>
                    </div>
                    <div className={styles.userCards}>
                      {renderUserCard(task.assigned_by_user, "Gestor", <FiUsers />)}
                    </div>
                  </div>
                )}

                {task.collaborators_info && task.collaborators_info.length > 0 && (
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
          {Array.isArray(task.tags) && task.tags.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <FiTag className={styles.sectionIcon} />
                <h3>Tags</h3>
              </div>
              <div className={styles.sectionContent}>
                <div className={styles.tags}>
                  {task.tags.map((tag, index) => {
                    const isObj = typeof tag === "object" && tag !== null;
                    const name = isObj ? tag.name : tag;
                    const color = isObj ? tag.color : undefined;
                    return (
                      <span
                        key={`${name}-${index}`}
                        className={styles.tag}
                        style={
                          color
                            ? {
                                backgroundColor: color,
                                color: "#fff",
                                borderColor: "rgba(0,0,0,.08)",
                              }
                            : undefined
                        }
                      >
                        {name}
                      </span>
                    );
                  })}
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
                          {anexo?.name || anexo?.filename || `anexo_${index + 1}`}
                        </span>
                        {anexo?.size && (
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
              <div className={styles.commentsList}>
                {comments.length === 0 ? (
                  <p className={styles.noComments}>Nenhum comentário ainda.</p>
                ) : (
                  comments.map((c) => (
                    <div key={c.id} className={styles.comment}>
                      <div className={styles.commentHeader}>
                        <span className={styles.commentAuthor}>
                          {c.user?.name || "Usuário"}
                        </span>
                        <span className={styles.commentDate}>
                          {formatDate(c.created_at)}
                        </span>
                      </div>
                      <p className={styles.commentContent}>{c.content}</p>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleCommentSubmit} className={styles.commentForm}>
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

        {/* Footer */}
        <div className={styles.modalFooter}>
          {/* Colaborador: enviar para aprovação */}
          {canSubmitForApproval() && (
            <button
              className={`${styles.actionButton} ${styles.warningButton}`}
              onClick={submitForApproval}
              title="Enviar para aprovação do gestor"
            >
              <FiSend />
              Enviar para aprovação
            </button>
          )}

          {/* Gestor/Admin: aprovar / rejeitar quando pendente */}
          {canApproveReject() && (
            <>
              <button
                className={`${styles.actionButton} ${styles.successButton}`}
                onClick={approveTask}
                title="Aprovar e concluir tarefa"
              >
                <FiUser />
                Aprovar
              </button>
              <button
                className={`${styles.actionButton} ${styles.dangerButton}`}
                onClick={rejectTask}
                title="Rejeitar solicitação"
              >
                <FiX />
                Rejeitar
              </button>
            </>
          )}

          <div className={styles.footerRight}>
            <button
              className={`${styles.actionButton} ${styles.editButton}`}
              onClick={handleEdit}
              title="Editar tarefa"
            >
              <FiEdit />
              Editar
            </button>
            <button
              className={`${styles.actionButton} ${styles.deleteButton}`}
              onClick={handleDeleteClick}
              title="Excluir tarefa"
            >
              <FiTrash2 />
              Excluir
            </button>
          </div>
        </div>
      </div>

      {/* Modal de confirmação de exclusão */}
      {showDeleteModal && (
        <DeleteConfirmModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDelete}
          isDeleting={deleting}
          title="Confirmar Exclusão"
          message={`Tem certeza que deseja excluir a tarefa "${task?.title}"? Esta ação não pode ser desfeita.`}
        />
      )}
    </div>
  );
};

export default TaskModal;
