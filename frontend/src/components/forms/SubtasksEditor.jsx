import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "./SubtasksEditor.module.css";
import { FiPlus, FiTrash2 } from "react-icons/fi";
import Checkbox from "../Checkbox/Checkbox";

const SubtasksEditor = ({ value = [], onChange }) => {
  const [items, setItems] = useState(Array.isArray(value) ? value : []);
  const lastInputRef = useRef(null);

  useEffect(() => {
    if (Array.isArray(value)) setItems(value);
  }, [value]);

  const commit = (next) => {
    setItems(next);
    onChange?.(next);
  };

  const addItem = (focus = true) => {
    const id = `st-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const next = [...items, { id, title: "", done: false, order: items.length }];
    commit(next);
    // Foca no último input adicionado
    if (focus) requestAnimationFrame(() => lastInputRef.current?.focus());
  };

  const updateItem = (id, patch) =>
    commit(items.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const removeItem = (id) =>
    commit(
      items.filter((s) => s.id !== id).map((s, i) => ({ ...s, order: i }))
    );

  const sorted = useMemo(
    () => [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [items]
  );

  const { total, finished, percent } = useMemo(() => {
    const t = sorted.length;
    const f = sorted.filter((s) => s.done).length;
    const p = t === 0 ? 0 : Math.round((f / t) * 100);
    return { total: t, finished: f, percent: p };
  }, [sorted]);

  const handleKeyDown = (e, idx) => {
    if (e.key === "Enter" && idx === sorted.length - 1) {
      e.preventDefault();
      addItem();
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div className={styles.title}>
          <span className={styles.titleLabel}>Subtarefas</span>
          <span className={styles.hint}>
            Divida a tarefa em etapas (pressione Enter para criar outra)
          </span>
        </div>
        <button type="button" className={styles.addBtn} onClick={() => addItem()}>
          <FiPlus size={18} /> Adicionar subtarefa
        </button>
      </div>

      {total > 0 && (
        <div className={styles.progressWrap}>
          <div className={styles.progressTrack}>
            <div className={styles.progressBar} style={{ width: `${percent}%` }} />
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className={styles.empty}>
          Nenhuma subtarefa ainda. Clique em <strong>Adicionar subtarefa</strong>.
        </div>
      ) : (
        // ATENÇÃO: Para animações de entrada/saída, envolva este 'div' com 'TransitionGroup'
        // e cada 'row' com 'CSSTransition' (veja o comentário no topo do arquivo).
        <div className={styles.list}>
          {sorted.map((s, idx) => {
            const isLast = idx === sorted.length - 1;
            return (
              <div key={s.id} className={`${styles.row} ${s.done ? styles.done : ''}`}>
                <div className={styles.doneCell}>
                  <Checkbox
                    checked={!!s.done}
                    onCheckedChange={(checked) =>
                      updateItem(s.id, { done: !!checked })
                    }
                    ariaLabel={
                      s.done ? "Marcar como não concluída" : "Marcar como concluída"
                    }
                  />
                </div>

                <input
                  ref={isLast ? lastInputRef : null}
                  className={styles.titleInput}
                  value={s.title || ""}
                  onChange={(e) => updateItem(s.id, { title: e.target.value })}
                  onKeyDown={(e) => handleKeyDown(e, idx)}
                  placeholder={`Subtarefa #${idx + 1}`}
                />

                <button
                  type="button"
                  className={styles.removeBtn}
                  onClick={() => removeItem(s.id)}
                  title="Excluir subtarefa"
                  aria-label="Excluir subtarefa"
                >
                  <FiTrash2 size={18} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SubtasksEditor;
