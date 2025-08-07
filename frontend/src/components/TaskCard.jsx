import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import styles from './TaskCard.module.css';
import { 
  FiChevronDown, 
  FiChevronUp, 
  FiUser, 
  FiCalendar, 
  FiClock,
  FiTag,
  FiPaperclip,
  FiMessageCircle,
  FiEdit,
  FiTrash2,
  FiMove,
  FiDownload
} from 'react-icons/fi';

const TaskCard = ({ task, isDragging = false, viewMode }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [comment, setComment] = useState('');

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: task.id });

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
      'pending': '⏳',
      'in_progress': '🔄',
      'done': '✅',
      'cancelled': '❌'
    };
    return icons[status] || '📋';
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

  const toggleExpanded = (e) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const handleCommentSubmit = (e) => {
    e.preventDefault();
    if (comment.trim()) {

      console.log('Novo comentário:', comment);
      setComment('');
    }
  };

  const handleEdit = (e) => {
    e.stopPropagation();
    // Implementar navegação para edição
    console.log('Editar tarefa:', task.id);
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    // Implementar confirmação e exclusão
    console.log('Excluir tarefa:', task.id);
  };

  const handleMove = (e) => {
    e.stopPropagation();
    // Implementar modal de movimentação
    console.log('Mover tarefa:', task.id);
  };

  const cardClasses = `
    ${styles.taskCard} 
    ${isExpanded ? styles.expanded : ''} 
    ${isDragging || isSortableDragging ? styles.dragging : ''}
  `.trim();

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cardClasses}
      {...attributes}
      {...listeners}
    >
      {/* Header do card */}
      <div className={styles.cardHeader}>
        <div className={styles.headerLeft}>
          <div 
            className={styles.priorityIndicator}
            style={{ backgroundColor: getPriorityColor(task.prioridade) }}
          />
          <span className={styles.statusIcon}>
            {getStatusIcon(task.status)}
          </span>
          <span className={styles.priorityBadge}>
            {task.prioridade?.toUpperCase()}
          </span>
        </div>
        
        <button 
          className={styles.expandButton}
          onClick={toggleExpanded}
          aria-label={isExpanded ? 'Colapsar card' : 'Expandir card'}
        >
          {isExpanded ? <FiChevronUp /> : <FiChevronDown />}
        </button>
      </div>

      {/* Título */}
      <h4 className={styles.taskTitle}>{task.title}</h4>

      {/* Informações básicas */}
      <div className={styles.taskMeta}>
        {task.assigned_to_user && (
          <div className={styles.metaItem}>
            <FiUser className={styles.metaIcon} />
            <span>{task.assigned_to_user.name || 'Usuário'}</span>
          </div>
        )}
        
        {task.due_date && (
          <div className={styles.metaItem}>
            <FiCalendar className={styles.metaIcon} />
            <span>{formatDate(task.due_date)}</span>
          </div>
        )}
        
        {task.tempo_estimado && (
          <div className={styles.metaItem}>
            <FiClock className={styles.metaIcon} />
            <span>{formatEstimatedTime(task.tempo_estimado, task.tempo_unidade)}</span>
          </div>
        )}
      </div>

      {/* Conteúdo expandido */}
      {isExpanded && (
        <div className={styles.expandedContent}>
          {/* Descrição */}
          {task.description && (
            <div className={styles.description}>
              <p>{task.description}</p>
            </div>
          )}

          {/* Tags */}
          {task.tags && task.tags.length > 0 && (
            <div className={styles.tagsSection}>
              <div className={styles.sectionHeader}>
                <FiTag className={styles.sectionIcon} />
                <span>Tags</span>
              </div>
              <div className={styles.tags}>
                {task.tags.map((tag, index) => (
                  <span key={index} className={styles.tag}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Anexos */}
          {task.anexos && task.anexos.length > 0 && (
            <div className={styles.attachmentsSection}>
              <div className={styles.sectionHeader}>
                <FiPaperclip className={styles.sectionIcon} />
                <span>Anexos</span>
              </div>
              <div className={styles.attachments}>
                {task.anexos.map((anexo, index) => (
                  <div key={index} className={styles.attachment}>
                    <span className={styles.attachmentName}>
                      {anexo.filename || `anexo_${index + 1}`}
                    </span>
                    <button className={styles.downloadButton}>
                      <FiDownload />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comentários */}
          <div className={styles.commentsSection}>
            <div className={styles.sectionHeader}>
              <FiMessageCircle className={styles.sectionIcon} />
              <span>Comentários</span>
            </div>
            
            <form onSubmit={handleCommentSubmit} className={styles.commentForm}>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Adicionar comentário..."
                className={styles.commentInput}
                rows={2}
              />
              {comment.trim() && (
                <button type="submit" className={styles.commentSubmit}>
                  Enviar
                </button>
              )}
            </form>
          </div>

          {/* Ações */}
          <div className={styles.actions}>
            <button 
              className={`${styles.actionButton} ${styles.editButton}`}
              onClick={handleEdit}
            >
              <FiEdit />
              Editar
            </button>
            <button 
              className={`${styles.actionButton} ${styles.deleteButton}`}
              onClick={handleDelete}
            >
              <FiTrash2 />
              Excluir
            </button>
            <button 
              className={`${styles.actionButton} ${styles.moveButton}`}
              onClick={handleMove}
            >
              <FiMove />
              Mover
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskCard;

