import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import TaskCard from './TaskCard';
import styles from './KanbanColumn.module.css';
import { FiChevronDown, FiChevronUp, FiMail } from 'react-icons/fi';

const KanbanColumn = ({ id, title, icon, color, tasks, viewMode }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { setNodeRef, isOver } = useDroppable({ id });

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div className={styles.kanbanColumn}>
      {/* Header da coluna */}
      <div 
        className={styles.columnHeader}
        style={{ borderLeftColor: color }}
      >
        <div className={styles.headerLeft}>
          <span className={styles.columnIcon}>{icon}</span>
          <h3 className={styles.columnTitle}>{title}</h3>
          <span className={styles.taskCount}>{tasks.length}</span>
        </div>
        
        <button 
          className={styles.collapseButton}
          onClick={toggleCollapse}
          aria-label={isCollapsed ? 'Expandir coluna' : 'Colapsar coluna'}
        >
          {isCollapsed ? <FiChevronDown /> : <FiChevronUp />}
        </button>
      </div>

      {/* Conteúdo da coluna */}
      {!isCollapsed && (
        <div 
          ref={setNodeRef}
          className={`${styles.columnContent} ${isOver ? styles.dragOver : ''}`}
        >
          {tasks.length === 0 ? (
            <div className={styles.emptyColumn}>
              <span className={styles.emptyIcon}><FiMail /></span>
              <p className={styles.emptyText}>Nenhuma tarefa</p>
            </div>
          ) : (
            <SortableContext 
              items={tasks.map(task => task.id)} 
              strategy={verticalListSortingStrategy}
            >
              <div className={styles.tasksContainer}>
                {tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    viewMode={viewMode}
                  />
                ))}
              </div>
            </SortableContext>
          )}
        </div>
      )}
    </div>
  );
};

export default KanbanColumn;

