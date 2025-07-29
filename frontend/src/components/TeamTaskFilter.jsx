import React, { useState } from 'react';
import { FiUsers, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import Checkbox from './Checkbox/Checkbox';
import styles from './TeamTaskFilter.module.css';

function TeamTaskFilter({ 
  members = [], 
  selectedMembers = [], 
  onMemberToggle, 
  onSelectAll, 
  onDeselectAll 
}) {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleMemberChange = (memberId) => {
    if (onMemberToggle) {
      onMemberToggle(memberId);
    }
  };

  const handleSelectAll = () => {
    if (onSelectAll) {
      onSelectAll();
    }
  };

  const handleDeselectAll = () => {
    if (onDeselectAll) {
      onDeselectAll();
    }
  };

  return (
    <div className={styles.filterContainer}>
      <button 
        className={styles.filterButton}
        onClick={handleToggle}
        type="button"
      >
        <FiUsers className={styles.icon} />
        <span>Filtrar Membros ({selectedMembers.length}/{members.length})</span>
        {isOpen ? <FiChevronUp /> : <FiChevronDown />}
      </button>
      
      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.dropdownHeader}>
            <button 
              className={styles.actionButton}
              onClick={handleSelectAll}
              type="button"
            >
              Selecionar Todos
            </button>
            <button 
              className={styles.actionButton}
              onClick={handleDeselectAll}
              type="button"
            >
              Desmarcar Todos
            </button>
          </div>
          
          <div className={styles.membersList}>
            {members.map(member => (
              <label key={member.id} className={styles.memberItem}>
                <Checkbox
                  checked={selectedMembers.includes(member.id)}
                  onCheckedChange={() => handleMemberChange(member.id)}
                />
                <div className={styles.memberInfo}>
                  <span className={styles.memberName}>{member.username}</span>
                  {member.teamName && (
                    <span className={styles.memberTeam}>({member.teamName})</span>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default TeamTaskFilter;

