import React, { useState } from 'react';
import styles from './TaskForm.module.css';

function TaskForm({ onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    due_date: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
    // Limpar campos
    setFormData({
      title: '',
      description: '',
      due_date: '',
    });
    onClose();
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <h2 className={styles.title}>Nova Tarefa</h2>
        <form className={styles.form} onSubmit={handleSubmit}>
          <label htmlFor="title">Título</label>
          <input
            id="title"
            name="title"
            type="text"
            value={formData.title}
            onChange={handleChange}
            required
          />

          <label htmlFor="description">Descrição</label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows="3"
          />

          <label htmlFor="due_date">Data de Vencimento</label>
          <input
            id="due_date"
            name="due_date"
            type="date"
            value={formData.due_date}
            onChange={handleChange}
          />

          <div className={styles.buttons}>
            <button type="submit" className={styles.saveBtn}>Salvar</button>
            <button type="button" onClick={onClose} className={styles.cancelBtn}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default TaskForm;
