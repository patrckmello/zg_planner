import React, { useState, useEffect } from 'react';
import { DndContext, DragOverlay, rectIntersection } from '@dnd-kit/core';
import KanbanColumn from './KanbanColumn';
import TaskCard from './TaskCard';
import styles from './KanbanBoard.module.css';
import api from '../services/axiosInstance';
import {
  FiClock,
  FiRotateCw,
  FiCheck,
  FiX,
  FiAlertTriangle,
  FiAlertCircle,
  FiMinus,
  FiChevronDown,
  FiCalendar,
  FiClipboard
} from 'react-icons/fi';

const KanbanBoard = ({ tasks, onTaskUpdate, viewMode = 'status' }) => {
  const [activeId, setActiveId] = useState(null);
  const [draggedTask, setDraggedTask] = useState(null);
  const [localTasks, setLocalTasks] = useState([]);

  // sempre que a prop mudar, sincroniza com estado local
  useEffect(() => {
    setLocalTasks(tasks);
  }, [tasks]);

  const organizeTasksByMode = (tasks, mode) => {
    switch (mode) {
      case 'status':
        return {
          pending: tasks.filter(task => task.status === 'pending'),
          in_progress: tasks.filter(task => task.status === 'in_progress'),
          done: tasks.filter(task => task.status === 'done'),
          cancelled: tasks.filter(task => task.status === 'cancelled')
        };
      case 'priority':
        return {
          urgente: tasks.filter(task => task.prioridade === 'urgente'),
          alta: tasks.filter(task => task.prioridade === 'alta'),
          media: tasks.filter(task => task.prioridade === 'media'),
          baixa: tasks.filter(task => task.prioridade === 'baixa')
        };
      case 'due_date': {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const nextWeek = new Date(today);
        nextWeek.setDate(nextWeek.getDate() + 7);

        return {
          overdue: tasks.filter(task => task.due_date && new Date(task.due_date) < today && task.status !== 'done'),
          today: tasks.filter(task => task.due_date && new Date(task.due_date).toDateString() === today.toDateString()),
          this_week: tasks.filter(task => task.due_date && new Date(task.due_date) > today && new Date(task.due_date) <= nextWeek),
          no_date: tasks.filter(task => !task.due_date)
        };
      }
      case 'alphabetical': {
        // Ordenar tarefas alfabeticamente por título
        const sortedTasks = [...tasks].sort((a, b) => 
          a.title.toLowerCase().localeCompare(b.title.toLowerCase(), 'pt-BR')
        );
        return {
          all: sortedTasks
        };
      }
      default:
        return { all: tasks };
    }
  };

  const getColumnConfig = (mode) => {
    switch (mode) {
      case 'status':
        return {
          pending: { title: 'Pendentes', icon: <FiClock />, color: '#95a5a6' },
          in_progress: { title: 'Em Andamento', icon: <FiRotateCw />, color: '#3498db' },
          done: { title: 'Concluídas', icon: <FiCheck />, color: '#27ae60' },
          cancelled: { title: 'Canceladas', icon: <FiX />, color: '#e74c3c' }
        };
      case 'priority':
        return {
          urgente: { title: 'Urgente', icon: <FiAlertTriangle />, color: '#e74c3c' },
          alta: { title: 'Alta', icon: <FiAlertCircle />, color: '#f39c12' },
          media: { title: 'Média', icon: <FiMinus />, color: '#f1c40f' },
          baixa: { title: 'Baixa', icon: <FiChevronDown />, color: '#27ae60' }
        };
      case 'due_date':
        return {
          overdue: { title: 'Atrasadas', icon: <FiAlertTriangle />, color: '#e74c3c' },
          today: { title: 'Hoje', icon: <FiCalendar />, color: '#f39c12' },
          this_week: { title: 'Esta Semana', icon: <FiCalendar />, color: '#3498db' },
          no_date: { title: 'Sem Data', icon: <FiClipboard />, color: '#95a5a6' }
        };
      case 'alphabetical':
        return {
          all: { title: 'Todas as Tarefas (A-Z)', icon: <FiClipboard />, color: '#6366f1' }
        };
      default:
        return { all: { title: 'Todas', icon: <FiClipboard />, color: '#95a5a6' } };
    }
  };

  const organizedTasks = organizeTasksByMode(localTasks, viewMode);
  const columnConfig = getColumnConfig(viewMode);

  const handleDragStart = (event) => {
    const { active } = event;
    setActiveId(active.id);
    const task = localTasks.find(t => t.id === parseInt(active.id));
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

    const getDestinationColumnId = (over) => {
      const sortableData = over?.data?.current?.sortable;
      if (sortableData && sortableData.containerId) {
        return sortableData.containerId;
      }
      return over?.id;
    };

    const newColumnId = getDestinationColumnId(over);

    const task = localTasks.find((t) => t.id === taskId);
    if (!task) {
      setActiveId(null);
      setDraggedTask(null);
      return;
    }

    let currentValue = null;
    if (viewMode === 'status') {
      currentValue = task.status;
    } else if (viewMode === 'priority') {
      currentValue = task.prioridade;
    }

    if (currentValue === newColumnId) {
      setActiveId(null);
      setDraggedTask(null);
      return;
    }

    const updateData = {};
    if (viewMode === 'status') {
      updateData.status = newColumnId;
    } else if (viewMode === 'priority') {
      updateData.prioridade = newColumnId;
    }

    if (Object.keys(updateData).length === 0) {
      setActiveId(null);
      setDraggedTask(null);
      return;
    }

    // Atualiza localmente de forma otimista
    setLocalTasks(prev =>
      prev.map(t => t.id === taskId ? { ...t, ...updateData } : t)
    );

    try {
      await api.put(`/tasks/${taskId}`, updateData, {
        headers: { 'Content-Type': 'application/json' },
      });
      onTaskUpdate(taskId, updateData); // ainda avisa o pai
    } catch (error) {
      console.error('Erro ao atualizar tarefa:', error);
      alert('Erro ao atualizar tarefa. Tente novamente.');

      // rollback se falhar
      setLocalTasks(prev =>
        prev.map(t => t.id === taskId ? { ...t, ...task } : t)
      );
    }

    setActiveId(null);
    setDraggedTask(null);
  };

  return (
    <DndContext
      collisionDetection={rectIntersection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className={styles.kanbanBoard}>
        {Object.entries(organizedTasks).map(([columnId, columnTasks]) => (
          <KanbanColumn
            key={columnId}
            id={columnId}
            title={columnConfig[columnId]?.title || columnId}
            icon={columnConfig[columnId]?.icon || <FiClipboard />}
            color={columnConfig[columnId]?.color || '#95a5a6'}
            tasks={columnTasks}
            viewMode={viewMode}
            onTaskUpdate={onTaskUpdate}
          />
        ))}
      </div>
      
      <DragOverlay>
        {activeId && draggedTask ? (
          <TaskCard
            task={draggedTask}
            isDragging={true}
            viewMode={viewMode}
            onTaskUpdate={onTaskUpdate}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

export default KanbanBoard;
