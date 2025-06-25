import React, { useState, useEffect } from 'react';
import styles from './TaskForm.module.css';

function EditTaskForm({ initialData, onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    due_date: '',
    status: 'pending',
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        title: initialData.title || '',
        description: initialData.description || '',
        due_date: initialData.due_date ? initialData.due_date.slice(0, 10) : '',
        status: initialData.status || 'pending',
      });
    }
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <h2>Editar Tarefa</h2>
        <form onSubmit={handleSubmit}>
          <label>Título</label>
          <input name="title" value={formData.title} onChange={handleChange} required />

          <label>Descrição</label>
          <textarea name="description" value={formData.description} onChange={handleChange} />

          <label>Status</label>
          <select name="status" value={formData.status} onChange={handleChange}>
            <option value="pending">Pendente</option>
            <option value="done">Concluída</option>
          </select>

          <label>Data de Vencimento</label>
          <input type="date" name="due_date" value={formData.due_date} onChange={handleChange} />

          <div className={styles.actions}>
            <button type="submit">Salvar</button>
            <button type="button" onClick={onClose}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditTaskForm;
