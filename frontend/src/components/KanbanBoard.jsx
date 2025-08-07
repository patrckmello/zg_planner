import React, { useState, useEffect } from 'react';
import { DndContext, DragOverlay, closestCorners } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import KanbanColumn from './KanbanColumn';
import TaskCard from './TaskCard';
import styles from './KanbanBoard.module.css';
import api from '../services/axiosInstance';

const KanbanBoard = ({ tasks, onTaskUpdate, viewMode = 'status', activeTab = 'minhas' }) => {
  const [activeId, setActiveId] = useState(null);
  const [draggedTask, setDraggedTask] = useState(null);

  // Organizar tarefas por colunas baseado no modo de visualização
  const organizeTasksByMode = (tasks, mode) => {
    switch (mode) {
      case 'status':
        return {
          'pending': tasks.filter(task => task.status === 'pending'),
          'in_progress': tasks.filter(task => task.status === 'in_progress'),
          'done': tasks.filter(task => task.status === 'done'),
          'cancelled': tasks.filter(task => task.status === 'cancelled')
        };
      case 'priority':
        return {
          'urgente': tasks.filter(task => task.prioridade === 'urgente'),
          'alta': tasks.filter(task => task.prioridade === 'alta'),
          'media': tasks.filter(task => task.prioridade === 'media'),
          'baixa': tasks.filter(task => task.prioridade === 'baixa')
        };
      case 'due_date':
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const nextWeek = new Date(today);
        nextWeek.setDate(nextWeek.getDate() + 7);

        return {
          'overdue': tasks.filter(task => task.due_date && new Date(task.due_date) < today && task.status !== 'done'),
          'today': tasks.filter(task => task.due_date && new Date(task.due_date).toDateString() === today.toDateString()),
          'this_week': tasks.filter(task => task.due_date && new Date(task.due_date) > today && new Date(task.due_date) <= nextWeek),
          'no_date': tasks.filter(task => !task.due_date)
        };
      default:
        return { 'all': tasks };
    }
  };

  // Configurações das colunas por modo
  const getColumnConfig = (mode) => {
    switch (mode) {
      case 'status':
        return {
          'pending': { title: 'Pendentes', icon: '⏳', color: '#95a5a6' },
          'in_progress': { title: 'Em Andamento', icon: '🔄', color: '#3498db' },
          'done': { title: 'Concluídas', icon: '✅', color: '#27ae60' },
          'cancelled': { title: 'Canceladas', icon: '❌', color: '#e74c3c' }
        };
      case 'priority':
        return {
          'urgente': { title: 'Urgente', icon: '🔴', color: '#e74c3c' },
          'alta': { title: 'Alta', icon: '🟠', color: '#f39c12' },
          'media': { title: 'Média', icon: '🟡', color: '#f1c40f' },
          'baixa': { title: 'Baixa', icon: '🟢', color: '#27ae60' }
        };
      case 'due_date':
        return {
          'overdue': { title: 'Atrasadas', icon: '🚨', color: '#e74c3c' },
          'today': { title: 'Hoje', icon: '📅', color: '#f39c12' },
          'this_week': { title: 'Esta Semana', icon: '📆', color: '#3498db' },
          'no_date': { title: 'Sem Data', icon: '📋', color: '#95a5a6' }
        };
      default:
        return { 'all': { title: 'Todas', icon: '📋', color: '#95a5a6' } };
    }
  };

  const organizedTasks = organizeTasksByMode(tasks, viewMode);
  const columnConfig = getColumnConfig(viewMode);

  const handleDragStart = (event) => {
    const { active } = event;
    setActiveId(active.id);
    
    // Encontrar a tarefa sendo arrastada
    const task = tasks.find(t => t.id === parseInt(active.id));
    setDraggedTask(task);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    
    if (!over) {
      setActiveId(null);
      setDraggedTask(null);
      return;
    }

    const taskId = parseInt(active.id);
    const newColumnId = over.id;
    
    // Encontrar a tarefa
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    // Determinar o novo valor baseado no modo de visualização e coluna
    let updateData = {};
    
    if (viewMode === 'status') {
      updateData.status = newColumnId;
    } else if (viewMode === 'priority') {
      updateData.prioridade = newColumnId;
    }

    // Atualizar no backend
    try {
      await api.put(`/tasks/${taskId}`, updateData);
      onTaskUpdate(taskId, updateData);
    } catch (error) {
      console.error('Erro ao atualizar tarefa:', error);
    }

    setActiveId(null);
    setDraggedTask(null);
  };

  return (
    <DndContext
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className={styles.kanbanBoard}>
        {Object.entries(organizedTasks).map(([columnId, columnTasks]) => (
          <KanbanColumn
            key={columnId}
            id={columnId}
            title={columnConfig[columnId]?.title || columnId}
            icon={columnConfig[columnId]?.icon || '📋'}
            color={columnConfig[columnId]?.color || '#95a5a6'}
            tasks={columnTasks}
            viewMode={viewMode}
          />
        ))}
      </div>
      
      <DragOverlay>
        {activeId && draggedTask ? (
          <TaskCard
            task={draggedTask}
            isDragging={true}
            viewMode={viewMode}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

export default KanbanBoard;

