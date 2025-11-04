import React, { useState, useMemo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import TaskModal from './TaskModal';
import styles from './TaskCard.module.css';
import { 
  FiUser, 
  FiCalendar, 
  FiClock,
  FiTag,
  FiPaperclip,
  FiMessageCircle,
  FiMove,
  FiRotateCw,
  FiCheck,
  FiX,
  FiClipboard,
  FiEye
} from 'react-icons/fi';

const TaskCard = ({ task, isDragging = false, onTaskUpdate }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: task.id.toString() });

  const style = { transform: CSS.Transform.toString(transform), transition };

  // === andamento das subtarefas ===
  const progress = useMemo(() => {
    const list = Array.isArray(task?.subtasks) ? task.subtasks : [];
    const total = list.length;
    const finished = list.filter(s => s?.done).length;
    const percent = total === 0 ? 0 : Math.round((finished / total) * 100);
    return { total, finished, percent };
  }, [task?.subtasks]);

  const getPriorityColor = (priority) => {
    const colors = { urgente:'#e74c3c', alta:'#f39c12', media:'#f1c40f', baixa:'#27ae60' };
    return colors[priority] || '#95a5a6';
  };

  const getStatusIcon = (status) => {
    const icons = { pending:<FiClock/>, in_progress:<FiRotateCw/>, done:<FiCheck/>, cancelled:<FiX/> };
    return icons[status] || <FiClipboard/>;
  };

  const formatDate = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' });
  };

  const formatEstimatedTime = (time, unit) => {
    if (!time) return null;
    return `${time}${unit === 'horas' ? 'h' : 'm'}`;
  };

  const cardClasses = `
    ${styles.taskCard} 
    ${isDragging || isSortableDragging ? styles.dragging : ''}
  `.trim();

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={cardClasses}
        onClick={() => setIsModalOpen(true)}
      >
        {/* Header */}
        <div className={styles.cardHeader}>
          <div className={styles.headerLeft}>
            <div 
              className={styles.priorityIndicator}
              style={{ backgroundColor: getPriorityColor(task.prioridade) }}
            />
            <span 
              className={styles.dragHandle} 
              {...attributes} 
              {...listeners} 
              title="Arrastar"
              onClick={(e) => e.stopPropagation()}
            >
              <FiMove />
            </span>
            <span className={styles.statusIcon}>
              {getStatusIcon(task.status)}
            </span>
            <span className={styles.priorityBadge}>
              {task.prioridade?.toUpperCase()}
            </span>
          </div>

          {/* Badge de andamento no topo (se houver subtarefas) */}
          {progress.total > 0 && (
            <div className={styles.progressBadge} title="Andamento das subtarefas">
              {progress.finished}/{progress.total} • {progress.percent}%
            </div>
          )}
        </div>

        {/* Título */}
        <h4 className={styles.taskTitle}>{task.title}</h4>

        {/* Barrinha de progresso logo abaixo do título */}
        {progress.total > 0 && (
          <div className={styles.progressTrack} aria-label="Andamento">
            <div
              className={styles.progressBar}
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        )}

        {/* Badge de aprovação */}
        {task.requires_approval && (
          <div
            className={styles.approvalBadge}
            data-status={task.approval_status || "none"}
            title={
              task.approval_status
                ? `Aprovação: ${task.approval_status}`
                : "Aprovação necessária"
            }
          >
            {task.approval_status === "pending" && "Pendente de aprovação"}
            {task.approval_status === "approved" && "Aprovada"}
            {task.approval_status === "rejected" && "Rejeitada"}
            {!task.approval_status && "Aprovação necessária"}
          </div>
        )}

        {/* Descrição resumida */}
        {task.description && (
          <p className={styles.taskDescription}>
            {task.description.length > 100 
              ? `${task.description.substring(0, 100)}...` 
              : task.description}
          </p>
        )}

        {/* Meta */}
        <div className={styles.taskMeta}>
          {task.assigned_users_info && task.assigned_users_info.length > 0 ? (
            <div className={styles.metaItem} title="Responsáveis pela tarefa">
              <FiUser className={styles.metaIcon} />
              <span>
                {task.assigned_users_info.length === 1 
                  ? task.assigned_users_info[0].name
                  : `${task.assigned_users_info.length} responsáveis`}
              </span>
            </div>
          ) : task.user && (
            <div className={styles.metaItem} title="Responsável pela tarefa">
              <FiUser className={styles.metaIcon} />
              <span>{task.user.name || 'Usuário'}</span>
            </div>
          )}

          {task.assigned_by_user && task.assigned_by_user.id !== task.user?.id && (
            <div className={styles.metaItem} title="Atribuído por">
              <FiEye className={styles.metaIcon} />
              <span>{task.assigned_by_user.name}</span>
            </div>
          )}

          {task.due_date && (
            <div className={styles.metaItem} title="Data de vencimento">
              <FiCalendar className={styles.metaIcon} />
              <span>{formatDate(task.due_date)}</span>
            </div>
          )}

          {task.tempo_estimado && (
            <div className={styles.metaItem} title="Tempo estimado">
              <FiClock className={styles.metaIcon} />
              <span>{formatEstimatedTime(task.tempo_estimado, task.tempo_unidade)}</span>
            </div>
          )}

          {task.created_at && (
            <div className={styles.metaItem} title="Data de criação">
              <FiMessageCircle className={styles.metaIcon} />
              <span>Criada em {formatDate(task.created_at)}</span>
            </div>
          )}
        </div>

        {/* Tags e indicadores como já estavam */}
        {Array.isArray(task.tags) && task.tags.length > 0 && (
          <div className={styles.tagChipsRow}>
            {task.tags.slice(0, 6).map((t, idx) => {
              const name = typeof t === "string" ? t : (t.name || t.label || "");
              const color = typeof t === "object" && t?.color ? t.color : undefined;
              const getContrast = (hex) => {
                try {
                  const c = hex.replace("#", "");
                  const r = parseInt(c.slice(0,2),16), g = parseInt(c.slice(2,4),16), b = parseInt(c.slice(4,6),16);
                  const y = (r*299 + g*587 + b*114) / 1000;
                  return y > 150 ? "#111" : "#fff";
                } catch { return "#111"; }
              };
              const fg = color ? getContrast(color) : "#111";
              return (
                <span
                  key={idx}
                  className={styles.tagChip}
                  title={name}
                  style={{
                    backgroundColor: color || "#eef2ff",
                    color: fg,
                    border: color ? "none" : "1px solid #c7d2fe",
                  }}
                >
                  <FiTag style={{ marginRight: 6, opacity: 0.9 }} />
                  {name}
                </span>
              );
            })}
            {task.tags.length > 6 && (
              <span className={styles.tagChipMore}>+{task.tags.length - 6}</span>
            )}
          </div>
        )}

        <div className={styles.taskIndicators}>
          {task.tags && task.tags.length > 0 && (
            <div className={styles.indicator} title={`${task.tags.length} tag(s)`}>
              <FiTag />
              <span>{task.tags.length}</span>
            </div>
          )}
          {task.anexos && task.anexos.length > 0 && (
            <div className={styles.indicator} title={`${task.anexos.length} anexo(s)`}>
              <FiPaperclip />
              <span>{task.anexos.length}</span>
            </div>
          )}
          {task.collaborators && task.collaborators.length > 0 && (
            <div className={styles.indicator} title={`${task.collaborators.length} colaborador(es)`}>
              <FiEye />
              <span>{task.collaborators.length}</span>
            </div>
          )}
        </div>
      </div>

      <TaskModal
        task={task}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onTaskUpdate={onTaskUpdate}
      />
    </>
  );
};

export default TaskCard;
