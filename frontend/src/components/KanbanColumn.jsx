import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import TaskCard from './TaskCard';
import styles from './KanbanColumn.module.css';
import { FiChevronDown, FiChevronUp, FiMail } from 'react-icons/fi';
import api from '../services/axiosInstance';

/**
 * Props:
 * - collapsible: boolean
 * - defaultCollapsed: boolean  -> inicia colapsada sem controlar de fora
 * - totalCount: number         -> (opcional) contador “real” quando lista é paginada
 * - pageSize: number           -> tamanho dos lotes ao paginar arquivadas
 * - activeTab/currentUser      -> para filtrar arquivadas conforme aba
 */
const KanbanColumn = ({
  id,
  title,
  icon,
  color,
  tasks,
  viewMode,
  onTaskUpdate,
  collapsible = false,
  collapsed,                 // se vier, tratamos como controlado (retrocompatível)
  defaultCollapsed = false,  // usado quando 'collapsed' não veio
  onToggleCollapse,
  totalCount,
  pageSize = 50,
  activeTab,
  currentUser,
}) => {
  // estado interno só é usado se 'collapsed' não for controlado externamente
  const [internalCollapsed, setInternalCollapsed] = useState(defaultCollapsed);
  const isCollapsed = typeof collapsed === 'boolean' ? collapsed : internalCollapsed;

  // droppable: mesmo colapsado, mantemos uma pequena área para permitir drop
  const { setNodeRef, isOver } = useDroppable({ id });

  // ---------- Lazy-load para "archived" ----------
  const isArchivedColumn = id === 'archived';
  const [archivedItems, setArchivedItems] = useState([]);
  const [archivedLoaded, setArchivedLoaded] = useState(false);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [archivedPage, setArchivedPage] = useState(1);
  const [archivedTotal, setArchivedTotal] = useState(null);
  const openOnceRef = useRef(false);

  // filtro igual ao TasksPage
  const applyTabFilter = (all, tab, user) => {
    const list = all || [];
    if (!user) return list;

    switch (tab) {
      case 'minhas':
        return list.filter(
          (task) =>
            task.user_id === user.id &&
            (task.assigned_by_user_id === null || task.assigned_by_user_id === user.id)
        );
      case 'equipe':
        return list.filter(
          (task) =>
            (
              task.team_id !== null ||
              (task.assigned_by_user_id === user.id && task.user_id !== user.id)
            ) &&
            !(
              task.collaborators &&
              task.collaborators.includes(user.id) &&
              task.user_id !== user.id &&
              task.assigned_by_user_id !== user.id
            )
        );
      case 'colaborativas':
        return list.filter(
          (task) => task.collaborators && task.collaborators.includes(user.id)
        );
      default:
        return list;
    }
  };

  const fetchArchived = async (page = 1) => {
    if (archivedLoading) return;
    setArchivedLoading(true);
    try {
      const res = await api.get('/tasks/archived', {
        params: {
          page,
          page_size: pageSize,
          // se implementou no backend: filtrar antes de paginar
          // scope: activeTab, // 'minhas' | 'equipe' | 'colaborativas'
        },
      });
      const { items, total } = res.data;

      setArchivedItems((prev) => (page === 1 ? items : [...prev, ...items]));
      setArchivedTotal(typeof total === 'number' ? total : null);
      setArchivedLoaded(true);
      setArchivedPage(page);
    } catch (err) {
      console.error('Erro ao carregar arquivadas:', err);
    } finally {
      setArchivedLoading(false);
    }
  };

  // quando a coluna for aberta, carregue a 1ª página
  useEffect(() => {
    if (isArchivedColumn && !isCollapsed && !archivedLoaded && !openOnceRef.current) {
      openOnceRef.current = true;
      fetchArchived(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCollapsed, isArchivedColumn]);

  const handleToggle = () => {
    if (onToggleCollapse) onToggleCollapse();
    else setInternalCollapsed((prev) => !prev);
  };

  // itens que a coluna vai renderizar
  const items = useMemo(() => {
    if (isArchivedColumn) {
      return applyTabFilter(archivedItems, activeTab, currentUser);
    }
    return Array.isArray(tasks) ? tasks : [];
  }, [isArchivedColumn, archivedItems, tasks, activeTab, currentUser]);

  // ✅ counter agora mostra o que está visível (após filtro da aba)
  const count = useMemo(() => {
    return items.length;
  }, [items.length]);

  // se ainda há mais para carregar (para mostrar o botão no header)
  const canLoadMore =
    isArchivedColumn &&
    typeof archivedTotal === 'number' &&
    archivedItems.length < archivedTotal && // baseado no total de itens carregados (antes do filtro)
    !archivedLoading;

  const handleLoadMore = () => {
    if (!canLoadMore) return;
    fetchArchived(archivedPage + 1);
  };

  return (
    <div className={styles.kanbanColumn}>
      {/* Header da coluna */}
      <div className={styles.columnHeader} style={{ borderLeftColor: color }}>
        <div className={styles.headerLeft}>
          <span className={styles.columnIcon}>{icon}</span>
          <h3 className={styles.columnTitle}>{title}</h3>

          {/* contador principal = quantos estão visíveis */}
          <span className={styles.taskCount}>{count}</span>

          {/* opcional: mostrar " / total" se ainda há mais (indicativo) */}
          {isArchivedColumn &&
            typeof archivedTotal === 'number' &&
            archivedItems.length < archivedTotal && (
              <span className={styles.taskCountSub}>
                &nbsp;/&nbsp;{archivedTotal}
              </span>
            )}
        </div>

        <div className={styles.headerRight}>
          {isArchivedColumn && canLoadMore && (
            <button
              className={styles.loadMoreHeaderBtn}
              onClick={handleLoadMore}
              disabled={archivedLoading}
              title="Carregar mais arquivadas"
            >
              {archivedLoading ? 'Carregando…' : 'Carregar mais'}
            </button>
          )}

          {collapsible && (
            <button
              className={styles.collapseButton}
              onClick={handleToggle}
              aria-label={isCollapsed ? 'Expandir coluna' : 'Colapsar coluna'}
            >
              {isCollapsed ? <FiChevronDown /> : <FiChevronUp />}
            </button>
          )}
        </div>
      </div>

      {/* Conteúdo / zona de drop */}
      <div
        ref={setNodeRef}
        className={`${styles.columnContent} ${isOver ? styles.dragOver : ''}`}
        // quando colapsada, mostra apenas uma “faixa” fininha para permitir drop
        style={isCollapsed ? { minHeight: 12, padding: 4 } : undefined}
      >
        {!isCollapsed && (
          <>
            {items.length === 0 && !archivedLoading ? (
              <div className={styles.emptyColumn}>
                <span className={styles.emptyIcon}><FiMail /></span>
                <p className={styles.emptyText}>Nenhuma tarefa</p>
              </div>
            ) : null}

            {archivedLoading && (
              <div className={styles.loadingArea}>
                <div className={styles.spinnerMini} />
                <span>Carregando…</span>
              </div>
            )}

            {items.length > 0 && (
              <SortableContext
                id={id}
                items={items.map((task) => task.id.toString())}
                strategy={verticalListSortingStrategy}
              >
                <div className={styles.tasksContainer}>
                  {items.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      viewMode={viewMode}
                      onTaskUpdate={onTaskUpdate}
                    />
                  ))}
                </div>
              </SortableContext>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default KanbanColumn;
