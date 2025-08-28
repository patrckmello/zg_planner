import React from "react";
import styles from "./TaskTabs.module.css";

const TaskTabs = ({ activeTab, onTabChange, taskCounts }) => {
  const tabs = [
    {
      id: "minhas",
      label: "Minhas",
      description: "Tarefas criadas por você",
      count: taskCounts.my_tasks,
    },
    {
      id: "equipe",
      label: "Equipe",
      description: "Tarefas da sua equipe",
      count: taskCounts.team_tasks,
    },
    {
      id: "colaborativas",
      label: "Colaborativas",
      description: "Tarefas em que você colabora",
      count: taskCounts.collaborative_tasks,
    },
  ];

  return (
    <div className={styles.tabsContainer}>
      <div className={styles.tabsWrapper}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`${styles.tab} ${
              activeTab === tab.id ? styles.active : ""
            }`}
            onClick={() => onTabChange(tab.id)}
            title={tab.description}
          >
            {tab.label}{" "}
            {tab.count > 0 && (
              <span className={styles.taskCount}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default TaskTabs;
