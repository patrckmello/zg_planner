import React from 'react';
import styles from './DeleteConfirmModal.module.css';

export default function DeleteConfirmModal({ isOpen, onCancel, onConfirm, taskTitle }) {
  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <h3>Confirmar Exclusão</h3>
        <p>Tem certeza que deseja excluir a tarefa?</p>
        <p className={styles.taskTitle}>{taskTitle}</p>
        <div className={styles.buttons}>
          <button className={styles.cancelBtn} onClick={onCancel}>Cancelar</button>
          <button className={styles.confirmBtn} onClick={onConfirm}>Excluir</button>
        </div>
      </div>
    </div>
  );
}
