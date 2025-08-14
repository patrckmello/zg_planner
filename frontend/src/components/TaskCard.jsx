import React, { useState } from 'react';
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

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Função para obter a cor da prioridade
  const getPriorityColor = (priority) => {
    const colors = {
      'urgente': '#e74c3c',
      'alta': '#f39c12',
      'media': '#f1c40f',
      'baixa': '#27ae60'
    };
    return colors[priority] || '#95a5a6';
  };

  // Função para obter o ícone do status
  const getStatusIcon = (status) => {
    const icons = {
      'pending': <FiClock />,
      'in_progress': <FiRotateCw />,
      'done': <FiCheck />,
      'cancelled': <FiX />
    };
    return icons[status] || <FiClipboard />;
  };

  // Função para formatar data
  const formatDate = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit' 
    });
  };

  // Função para formatar tempo estimado
  const formatEstimatedTime = (time, unit) => {
    if (!time) return null;
    return `${time}${unit === 'horas' ? 'h' : 'm'}`;
  };

  const handleCardClick = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
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
        onClick={handleCardClick}
      >
        {/* Header do card */}
        <div className={styles.cardHeader}>
          <div className={styles.headerLeft}>
            <div 
              className={styles.priorityIndicator}
              style={{ backgroundColor: getPriorityColor(task.prioridade) }}
            />
            {/* Handle de arrasto */}
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
        </div>

        {/* Título */}
        <h4 className={styles.taskTitle}>{task.title}</h4>

        {/* Descrição resumida */}
        {task.description && (
          <p className={styles.taskDescription}>
            {task.description.length > 100 
              ? `${task.description.substring(0, 100)}...` 
              : task.description
            }
          </p>
        )}

        {/* Informações básicas */}
        <div className={styles.taskMeta}>
          {/* Responsáveis da tarefa */}
          {task.assigned_users_info && task.assigned_users_info.length > 0 ? (
            <div className={styles.metaItem} title="Responsáveis pela tarefa">
              <FiUser className={styles.metaIcon} />
              <span>
                {task.assigned_users_info.length === 1 
                  ? task.assigned_users_info[0].name
                  : `${task.assigned_users_info.length} responsáveis`
                }
              </span>
            </div>
          ) : task.user && (
            <div className={styles.metaItem} title="Responsável pela tarefa">
              <FiUser className={styles.metaIcon} />
              <span>{task.user.name || 'Usuário'}</span>
            </div>
          )}
          
          {/* Criador/Atribuidor (se diferente do responsável) */}
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

        {/* Indicadores adicionais */}
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

      {/* Modal */}
      <TaskModal
        task={task}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onTaskUpdate={onTaskUpdate}
      />
    </>
  );
};

export default TaskCard;

