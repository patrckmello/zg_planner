import React, { useState, useRef, useEffect } from 'react';
import styles from './EditTaskForm.module.css';
import Checkbox from './Checkbox/Checkbox';
import AnexoItemPreview from './AnexoItemPreview';

const EditTaskForm = ({ initialData, onSubmit, onClose }) => {
  // Estados do formulário
  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    prioridade: 'media',
    status: 'pending',
    categoria: 'processo',
    dataVencimento: '',
    relacionadoA: '',
    lembretes: [],
    tags: [],
    anexos: []
  });

  // Estados de controle
  const [errors, setErrors] = useState({});
  const [newTag, setNewTag] = useState('');
  const [lembretesOpen, setLembretesOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // NOVO: Estado para rastrear arquivos removidos
  const [removedFiles, setRemovedFiles] = useState([]);

  // Refs
  const fileInputRef = useRef(null);
  const lembretesRef = useRef(null);

  // Opções para os selects
  const prioridadeOptions = [
    { value: 'baixa', label: 'Baixa' },
    { value: 'media', label: 'Média' },
    { value: 'alta', label: 'Alta' },
    { value: 'urgente', label: 'Urgente' }
  ];

  const statusOptions = [
    { value: 'pending', label: 'Pendente' },
    { value: 'in_progress', label: 'Em andamento' },
    { value: 'done', label: 'Concluído' },
    { value: 'cancelled', label: 'Cancelado' }
  ];

  const categoriaOptions = [
    { value: 'processo', label: 'Processo' },
    { value: 'projeto', label: 'Projeto' },
    { value: 'manutencao', label: 'Manutenção' },
    { value: 'reuniao', label: 'Reunião' }
  ];

  const lembretesOptions = [
    { value: '5min', label: '5 minutos antes' },
    { value: '15min', label: '15 minutos antes' },
    { value: '30min', label: '30 minutos antes' },
    { value: '1h', label: '1 hora antes' },
    { value: '1d', label: '1 dia antes' },
    { value: '1w', label: '1 semana antes' }
  ];

  // Carregar dados iniciais
  useEffect(() => {
    if (initialData) {
      console.log('Dados iniciais recebidos:', initialData);
      
      // Processar anexos vindos do backend
      const adaptAnexos = (initialData.anexos || []).map(anexo => {
        if (typeof anexo === 'string') {
          // Formato antigo: apenas nome do arquivo
          return {
            id: anexo,
            name: anexo,
            size: 0,
            type: 'application/octet-stream',
            url: `http://localhost:5555/uploads/${anexo}`,
            isExisting: true // Marca como arquivo existente
          };
        } else {
          // Formato novo: objeto completo
          return {
            id: anexo.id || anexo.name || Date.now() + Math.random(),
            name: anexo.name,
            size: anexo.size || 0,
            type: anexo.type || 'application/octet-stream',
            url: anexo.url || `http://localhost:5555/uploads/${anexo.name}`,
            isExisting: true // Marca como arquivo existente
          };
        }
      });

      setFormData({
        titulo: initialData.title || initialData.titulo || '',
        descricao: initialData.description || initialData.descricao || '',
        prioridade: initialData.prioridade || 'media',
        status: initialData.status || 'pending',
        categoria: initialData.categoria || 'processo',
        dataVencimento: initialData.due_date ? initialData.due_date.slice(0, 10) : (initialData.dataVencimento || ''),
        relacionadoA: initialData.relacionado_a || initialData.relacionadoA || '',
        lembretes: initialData.lembretes || [],
        tags: initialData.tags || [],
        anexos: adaptAnexos
      });

      console.log('Anexos processados:', adaptAnexos);
    }
  }, [initialData]);

  // Função para atualizar campos do formulário
  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  // Validação do formulário
  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.titulo.trim()) {
      newErrors.titulo = 'Título é obrigatório';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submissão do formulário
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      // Preparar dados para envio
      const taskData = {
        title: formData.titulo,
        description: formData.descricao,
        status: formData.status,
        due_date: formData.dataVencimento,
        prioridade: formData.prioridade,
        categoria: formData.categoria,
        relacionadoA: formData.relacionadoA,
        lembretes: formData.lembretes,
        tags: formData.tags,
        anexos: formData.anexos,
        removedFiles: removedFiles // NOVO: Incluir lista de arquivos removidos
      };

      console.log('Dados sendo enviados para onSubmit:', taskData);
      console.log('Arquivos removidos:', removedFiles);

      await onSubmit(initialData.id, taskData);
      onClose();
    } catch (error) {
      console.error('Erro ao editar tarefa:', error);
      alert('Erro ao editar tarefa. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Gerenciamento de tags
  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      updateField('tags', [...formData.tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove) => {
    updateField('tags', formData.tags.filter(tag => tag !== tagToRemove));
  };

  const handleTagKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  // Gerenciamento de lembretes
  const toggleLembrete = (value) => {
    const newLembretes = formData.lembretes.includes(value)
      ? formData.lembretes.filter(l => l !== value)
      : [...formData.lembretes, value];
    updateField('lembretes', newLembretes);
  };

  const getLembretesText = () => {
    if (formData.lembretes.length === 0) return 'Selecionar lembretes...';
    if (formData.lembretes.length === 1) {
      const option = lembretesOptions.find(opt => opt.value === formData.lembretes[0]);
      return option ? option.label : 'Lembrete selecionado';
    }
    return `${formData.lembretes.length} lembretes selecionados`;
  };

  // Gerenciamento de arquivos
  const handleFileSelect = (files) => {
    const newFiles = Array.from(files).map(file => ({
      id: Date.now() + Math.random(),
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      isExisting: false // Marca como arquivo novo
    }));
    updateField('anexos', [...formData.anexos, ...newFiles]);
  };

  // FUNÇÃO CORRIGIDA: Remover anexos e rastrear arquivos removidos
  const removeAnexo = (id) => {
    console.log('Removendo anexo com ID:', id);
    console.log('Anexos atuais:', formData.anexos);
    
    const anexoToRemove = formData.anexos.find(anexo => anexo.id === id);
    console.log('Anexo a ser removido:', anexoToRemove);
    
    // Se é um arquivo existente (não um novo upload), adicionar à lista de removidos
    if (anexoToRemove && anexoToRemove.isExisting && anexoToRemove.name) {
      console.log('Adicionando arquivo à lista de removidos:', anexoToRemove.name);
      setRemovedFiles(prev => [...prev, anexoToRemove.name]);
    }
    
    // Remover da lista de anexos
    updateField('anexos', formData.anexos.filter(anexo => anexo.id !== id));
  };

  const handleFileInputChange = (e) => {
    if (e.target.files.length > 0) {
      handleFileSelect(e.target.files);
      e.target.value = '';
    }
  };

  // Drag and drop
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  // Fechar dropdown de lembretes ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (lembretesRef.current && !lembretesRef.current.contains(event.target)) {
        setLembretesOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Editar Tarefa</h2>
          <button 
            type="button" 
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Fechar modal"
          >
            ×
          </button>
        </div>

        {/* Formulário */}
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.formContent}>
            <div className={styles.formGrid}>
              {/* Título */}
              <div className={styles.titleSection}>
                <label className={styles.label}>
                  Título <span className={styles.required}>*</span>
                </label>
                <input
                  type="text"
                  className={`${styles.input} ${errors.titulo ? styles.inputError : ''}`}
                  value={formData.titulo}
                  onChange={(e) => updateField('titulo', e.target.value)}
                  placeholder="Digite o título da tarefa"
                />
                {errors.titulo && (
                  <span className={styles.errorMessage}>{errors.titulo}</span>
                )}
              </div>

              {/* Descrição */}
              <div className={styles.descriptionSection}>
                <label className={styles.label}>Descrição</label>
                <textarea
                  className={styles.textarea}
                  value={formData.descricao}
                  onChange={(e) => updateField('descricao', e.target.value)}
                  placeholder="Descreva os detalhes da tarefa" rows="6"
                />
              </div>

              {/* Prioridade */}
              <div className={styles.prioridadeSection}>
                <label className={styles.label}>Prioridade</label>
                <select
                  className={styles.select}
                  value={formData.prioridade}
                  onChange={(e) => updateField('prioridade', e.target.value)}
                >
                  {prioridadeOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status */}
              <div className={styles.statusSection}>
                <label className={styles.label}>Status</label>
                <select
                  className={styles.select}
                  value={formData.status}
                  onChange={(e) => updateField('status', e.target.value)}
                >
                  {statusOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Categoria */}
              <div className={styles.categoriaSection}>
                <label className={styles.label}>Categoria</label>
                <select
                  className={styles.select}
                  value={formData.categoria}
                  onChange={(e) => updateField('categoria', e.target.value)}
                >
                  {categoriaOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Data de Vencimento */}
              <div className={styles.dueDateSection}>
                <label className={styles.label}>Data de Vencimento</label>
                <input
                  type="date"
                  className={styles.input}
                  value={formData.dataVencimento}
                  onChange={(e) => updateField('dataVencimento', e.target.value)}
                />
              </div>

              {/* Relacionado a */}
              <div className={styles.relacionadoSection}>
                <label className={styles.label}>Relacionado a</label>
                <input
                  type="text"
                  className={styles.input}
                  value={formData.relacionadoA}
                  onChange={(e) => updateField('relacionadoA', e.target.value)}
                  placeholder="Nº do processo, cliente..."
                />
              </div>

              {/* Lembretes */}
              <div className={styles.lembretesSection}>
                <label className={styles.label}>Lembretes</label>
                <div className={styles.lembretesDropdown} ref={lembretesRef}>
                  <button
                    type="button"
                    className={styles.lembretesButton}
                    onClick={() => setLembretesOpen(!lembretesOpen)}
                  >
                    <span className={styles.lembretesText}>
                      {getLembretesText()}
                    </span>
                    <span className={`${styles.chevron} ${lembretesOpen ? styles.chevronUp : ''}`}>
                      ▼
                    </span>
                  </button>
                  {lembretesOpen && (
                    <div className={styles.lembretesMenu}>
                      {lembretesOptions.map(option => (
                        <div key={option.value} className={styles.lembreteOption}>
                          <Checkbox
                            checked={formData.lembretes.includes(option.value)}
                            onChange={() => toggleLembrete(option.value)}
                            label={option.label}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Tags */}
              <div className={styles.tagsSection}>
                <label className={styles.label}>Tags</label>
                <div className={styles.tagsInputContainer}>
                  <input
                    type="text"
                    className={styles.input}
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={handleTagKeyPress}
                    placeholder="Adicionar tag"
                  />
                  <button
                    type="button"
                    className={styles.addTagButton}
                    onClick={addTag}
                    disabled={!newTag.trim()}
                  >
                    +
                  </button>
                </div>
                <div className={styles.tagsList}>
                  {formData.tags.map((tag, index) => (
                    <div key={index} className={styles.tagItem}>
                      <span className={styles.tagText}>{tag}</span>
                      <button
                        type="button"
                        className={styles.removeTagButton}
                        onClick={() => removeTag(tag)}
                        aria-label={`Remover tag ${tag}`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Anexos */}
              <div className={styles.anexosSection}>
                <label className={styles.label}>Anexos</label>
                <div className={styles.anexosContainer}>
                  {/* Área de upload */}
                  <div
                    className={`${styles.fileDropArea} ${isDragging ? styles.dragging : ''}`}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <div className={styles.fileDropContent}>
                      <div className={styles.fileDropIcon}>📁</div>
                      <div className={styles.fileDropText}>
                        Clique para selecionar
                      </div>
                      <div className={styles.fileDropSubtext}>
                        ou arraste e solte os arquivos aqui
                      </div>
                    </div>
                  </div>

                  {/* Grid de anexos */}
                  <div className={styles.anexosGrid}>
                    {formData.anexos.map(anexo => (
                      <AnexoItemPreview
                        key={anexo.id}
                        anexo={anexo}
                        onRemove={() => removeAnexo(anexo.id)}
                      />
                    ))}
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className={styles.hiddenFileInput}
                  onChange={handleFileInputChange}
                />
              </div>
            </div>
          </div>

          {/* Ações do formulário */}
          <div className={styles.formActions}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={styles.submitButton}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditTaskForm;

