import React from 'react';
import styles from './TaskTabs.module.css';

const TaskTabs = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'minhas', label: 'Minhas', description: 'Tarefas criadas por você' },
    { id: 'equipe', label: 'Equipe', description: 'Tarefas da sua equipe' },
    { id: 'colaborativas', label: 'Colaborativas', description: 'Tarefas em que você colabora' }
  ];

  return (
    <div className={styles.tabsContainer}>
      <div className={styles.tabsWrapper}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`${styles.tab} ${activeTab === tab.id ? styles.active : ''}`}
            onClick={() => onTabChange(tab.id)}
            title={tab.description}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default TaskTabs;

