import React, { useState, useRef, useEffect } from 'react';
import styles from './TaskForm.module.css';
import Checkbox from './Checkbox/Checkbox.jsx';
import AnexoItemPreview from './AnexoItemPreview.jsx';

function TaskForm({ onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    due_date: '',
    prioridade: 'Média',
    categoria: 'Processo',
    status_inicial: 'A fazer',
    relacionado_a: '',
    lembretes: [],
    tags: [],
    anexos: [],
    tagInput: '',
  });

  const [lembretesOpen, setLembretesOpen] = useState(false);
  const lembretesRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (lembretesRef.current && !lembretesRef.current.contains(event.target)) {
        setLembretesOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLembreteChange = (value, checked) => {
    setFormData(prev => {
      let lembretes = [...prev.lembretes];
      if (checked && !lembretes.includes(value)) lembretes.push(value);
      else lembretes = lembretes.filter(l => l !== value);
      return { ...prev, lembretes };
    });
  };

  const handleTagInputChange = (e) => {
    setFormData(prev => ({ ...prev, tagInput: e.target.value }));
  };

  const addTag = () => {
    const tag = formData.tagInput.trim();
    if (tag && !formData.tags.includes(tag)) {
      setFormData(prev => ({ ...prev, tags: [...prev.tags, tag], tagInput: '' }));
    }
  };

  const removeTag = (tagToRemove) => {
    setFormData(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tagToRemove) }));
  };

  const handleAnexosChange = (e) => {
    const files = Array.from(e.target.files);
    setFormData(prev => ({ ...prev, anexos: [...prev.anexos, ...files] }));
    e.target.value = null;
  };

  const removeAnexo = (index) => {
    setFormData(prev => {
      const novosAnexos = [...prev.anexos];
      novosAnexos.splice(index, 1);
      return { ...prev, anexos: novosAnexos };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
    onClose();
  };

  const lembretesOpcoes = ['1 hora antes', '1 dia antes', '1 semana antes', 'Na data de vencimento'];

  const getLembretesDisplayText = () => {
    if (formData.lembretes.length === 0) return 'Selecionar lembretes...';
    if (formData.lembretes.length === 1) return formData.lembretes[0];
    return `${formData.lembretes.length} lembretes selecionados`;
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <h2 className={styles.title}>Nova Tarefa</h2>
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.formContent}>
            
            {/* LINHA 1: TÍTULO (span 4) */}
            <div className={styles.titleField}>
              <label htmlFor="title">Título *</label>
              <input 
                id="title" 
                name="title" 
                type="text" 
                value={formData.title} 
                onChange={handleChange} 
                required 
              />
            </div>

            {/* LINHA 2-3: DESCRIÇÃO (span 2, 2 linhas) + CAMPOS LATERAIS */}
            <div className={styles.descriptionField}>
              <label htmlFor="description">Descrição</label>
              <textarea 
                id="description" 
                name="description" 
                value={formData.description} 
                onChange={handleChange} 
                rows="4" 
              />
            </div>

            {/* LINHA 2: PRIORIDADE + STATUS */}
            <div className={styles.prioridadeField}>
              <label htmlFor="prioridade">Prioridade</label>
              <select 
                id="prioridade" 
                name="prioridade" 
                value={formData.prioridade} 
                onChange={handleChange}
              >
                <option>Alta</option>
                <option>Média</option>
                <option>Baixa</option>
              </select>
            </div>

            <div className={styles.statusField}>
              <label htmlFor="status_inicial">Status Inicial</label>
              <select 
                id="status_inicial" 
                name="status_inicial" 
                value={formData.status_inicial} 
                onChange={handleChange}
              >
                <option>A fazer</option>
                <option>Em andamento</option>
                <option>Aguardando terceiros</option>
              </select>
            </div>

            {/* LINHA 3: CATEGORIA + DATA DE VENCIMENTO */}
            <div className={styles.categoriaField}>
              <label htmlFor="categoria">Categoria</label>
              <select 
                id="categoria" 
                name="categoria" 
                value={formData.categoria} 
                onChange={handleChange}
              >
                <option>Processo</option>
                <option>Reunião</option>
                <option>Pesquisa</option>
                <option>Documento</option>
                <option>Audiência</option>
                <option>Outro</option>
              </select>
            </div>

            <div className={styles.dueDateField}>
              <label htmlFor="due_date">Data de Vencimento</label>
              <input 
                id="due_date" 
                name="due_date" 
                type="date" 
                value={formData.due_date} 
                onChange={handleChange} 
              />
            </div>
            
            {/* LINHA 4: RELACIONADO A (span 2) + LEMBRETES + TAGS */}
            <div className={styles.relacionadoField}>
              <label htmlFor="relacionado_a">Relacionado a</label>
              <input
                id="relacionado_a"
                name="relacionado_a"
                type="text"
                value={formData.relacionado_a}
                onChange={handleChange}
                placeholder="Nº do processo, cliente..."
              />
            </div>

            <div className={styles.lembretesField}>
              <label>Lembretes</label>
              <div className={styles.lembretesDropdown} ref={lembretesRef}>
                <div 
                  className={styles.lembretesDisplay} 
                  onClick={() => setLembretesOpen(!lembretesOpen)}
                >
                  <span>{getLembretesDisplayText()}</span>
                  <span>▼</span>
                </div>
                {lembretesOpen && (
                  <div className={styles.lembretesMenu}>
                    {lembretesOpcoes.map(lembrete => (
                      <div key={lembrete} className={styles.lembreteOption}>
                        <Checkbox
                          label={lembrete}
                          checked={formData.lembretes.includes(lembrete)}
                          onChange={(checked) => handleLembreteChange(lembrete, checked)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className={styles.tagsField}>
              <label htmlFor="tags-input">Tags</label>
              <div className={styles.tagsInputContainer}>
                <input
                  id="tags-input"
                  type="text"
                  placeholder="Adicionar tag"
                  value={formData.tagInput}
                  onChange={handleTagInputChange}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                />
                <button type="button" onClick={addTag}>+</button>
              </div>
              <div className={styles.tagsList}>
                {formData.tags.map(tag => (
                  <div key={tag} className={styles.tagItem}>
                    <span>{tag}</span>
                    <button type="button" onClick={() => removeTag(tag)}>×</button>
                  </div>
                ))}
              </div>
            </div>

            {/* LINHA 5: SEÇÃO DE ANEXOS (span 4) COM GRID ANINHADO */}
            <div className={styles.anexosField}>
              <div className={styles.anexosSection}>
                <label>Anexos</label>
                <input
                  id="anexos-input"
                  className={styles.hiddenFileInput}
                  type="file"
                  multiple
                  onChange={handleAnexosChange}
                />
                <div className={styles.anexosLayout}>
                  {/* Input Button (1 coluna) */}
                  <label htmlFor="anexos-input" className={styles.fileInputArea}>
                    <span>Clique para selecionar</span>
                    <p>ou arraste e solte os arquivos aqui</p>
                  </label>

                  {/* Preview Area (3 colunas) com Grid Aninhado */}
                  <div className={styles.previewArea}>
                    {formData.anexos.map((file, i) => (
                      <AnexoItemPreview
                        key={i}
                        file={file}
                        onRemove={() => removeAnexo(i)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

          </div> {/* Fim do .formContent */}

          <div className={styles.buttons}>
            <button type="button" onClick={onClose} className={styles.cancelBtn}>
              Cancelar
            </button>
            <button type="submit" className={styles.saveBtn}>
              Salvar Tarefa
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default TaskForm;

