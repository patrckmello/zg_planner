import React from 'react';
import styles from './ViewModeSelector.module.css';
import { FiFilter, FiCalendar, FiFlag, FiUser, FiAlignLeft } from 'react-icons/fi';

const ViewModeSelector = ({ viewMode, onViewModeChange }) => {
  const viewModes = [
    { 
      id: 'status', 
      label: 'Status', 
      icon: <FiFilter />,
      description: 'Organizar por status da tarefa'
    },
    { 
      id: 'priority', 
      label: 'Prioridade', 
      icon: <FiFlag />,
      description: 'Organizar por nível de prioridade'
    },
    { 
      id: 'due_date', 
      label: 'Data', 
      icon: <FiCalendar />,
      description: 'Organizar por data de vencimento'
    },
    { 
      id: 'assignee', 
      label: 'Responsável', 
      icon: <FiUser />,
      description: 'Organizar por pessoa responsável'
    },
    { 
      id: 'alphabetical', 
      label: 'A-Z', 
      icon: <FiAlignLeft />,
      description: 'Organizar alfabeticamente'
    }
  ];

  return (
    <div className={styles.viewModeSelector}>
      <div className={styles.selectorLabel}>
        <span>Visualizar por:</span>
      </div>
      
      <div className={styles.modesContainer}>
        {viewModes.map((mode) => (
          <button
            key={mode.id}
            className={`${styles.modeButton} ${viewMode === mode.id ? styles.active : ''}`}
            onClick={() => onViewModeChange(mode.id)}
            title={mode.description}
          >
            <span className={styles.modeIcon}>{mode.icon}</span>
            <span className={styles.modeLabel}>{mode.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ViewModeSelector;

