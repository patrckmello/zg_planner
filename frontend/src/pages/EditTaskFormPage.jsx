import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import TagInput from '../components/forms/TagInput';
import FileUploadArea from '../components/forms/FileUploadArea';
import Checkbox from '../components/Checkbox/Checkbox';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import styles from './EditTaskFormPage.module.css';
import api from '../services/axiosInstance';
import { 
  FiSave, 
  FiX, 
  FiTrash2,
  FiClock, 
  FiUser, 
  FiUsers, 
  FiTag,
  FiPaperclip,
  FiBell,
  FiCalendar,
  FiFlag,
  FiFolder,
  FiFileText,
  FiEdit3
} from 'react-icons/fi';

function EditTaskFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [errors, setErrors] = useState({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [removedFiles, setRemovedFiles] = useState([]);

  // Estados do formulário
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'pending',
    due_date: '',
    prioridade: 'media',
    categoria: 'processo',
    status_inicial: 'a_fazer',
    tempo_estimado: '',
    tempo_unidade: 'horas',
    relacionado_a: '',
    lembretes: [],
    tags: [],
    anexos: [],
    assigned_by_user_id: '',
    collaborators: [],
    team_id: ''
  });

  const [originalTask, setOriginalTask] = useState(null);

  // Opções para os selects (mesmas da TaskFormPage)
  const prioridadeOptions = [
    { value: 'baixa', label: '🟢 Baixa' },
    { value: 'media', label: '🟡 Média' },
    { value: 'alta', label: '🟠 Alta' },
    { value: 'urgente', label: '🔴 Urgente' }
  ];

  const statusOptions = [
    { value: 'pending', label: '⏳ Pendente' },
    { value: 'in_progress', label: '🔄 Em andamento' },
    { value: 'done', label: '✅ Concluído' },
    { value: 'cancelled', label: '❌ Cancelado' }
  ];

  const statusInicialOptions = [
    { value: 'a_fazer', label: '📝 A fazer' },
    { value: 'em_andamento', label: '🔄 Em andamento' },
    { value: 'concluido', label: '✅ Concluído' },
    { value: 'cancelado', label: '❌ Cancelado' }
  ];

  const categoriaOptions = [
    { value: 'processo', label: '⚙️ Processo' },
    { value: 'projeto', label: '🚀 Projeto' },
    { value: 'manutencao', label: '🔧 Manutenção' },
    { value: 'reuniao', label: '👥 Reunião' }
  ];

  const tempoUnidadeOptions = [
    { value: 'horas', label: 'Horas' },
    { value: 'minutos', label: 'Minutos' }
  ];

  const lembretesOptions = [
    { value: '5min', label: '5 minutos antes' },
    { value: '15min', label: '15 minutos antes' },
    { value: '30min', label: '30 minutos antes' },
    { value: '1h', label: '1 hora antes' },
    { value: '1d', label: '1 dia antes' },
    { value: '1w', label: '1 semana antes' }
  ];

  const tagSuggestions = [
    'urgente', 'importante', 'revisão', 'aprovação', 'cliente',
    'interno', 'externo', 'documentação', 'análise', 'desenvolvimento'
  ];

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { label: 'Pendente', color: '#f59e0b', bg: '#fef3c7' },
      in_progress: { label: 'Em Andamento', color: '#3b82f6', bg: '#dbeafe' },
      done: { label: 'Concluído', color: '#10b981', bg: '#d1fae5' },
      cancelled: { label: 'Cancelado', color: '#ef4444', bg: '#fee2e2' }
    };

    const config = statusConfig[status] || statusConfig.pending;
    
    return (
      <span 
        className={styles.statusBadge}
        style={{ 
          color: config.color, 
          backgroundColor: config.bg 
        }}
      >
        {config.label}
      </span>
    );
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [taskResponse, usersResponse, teamsResponse] = await Promise.all([
          api.get(`/tasks/${id}`),
          api.get('/users'),
          api.get('/teams')
        ]);

        const task = taskResponse.data;
        setOriginalTask(task);
        setUsers(usersResponse.data);
        setTeams(teamsResponse.data);

        // Processar anexos vindos do backend
        const adaptAnexos = (task.anexos || []).map(anexo => {
          if (typeof anexo === 'string') {
            return {
              id: anexo,
              name: anexo,
              size: 0,
              type: 'application/octet-stream',
              url: `${api.defaults.baseURL}/uploads/${anexo}`,
              isExisting: true
            };
          } else {
            return {
              id: anexo.id || anexo.name || Date.now() + Math.random(),
              name: anexo.name,
              size: anexo.size || 0,
              type: anexo.type || 'application/octet-stream',
              url: anexo.url || `${api.defaults.baseURL}/uploads/${anexo.name}`,
              isExisting: true
            };
          }
        });

        // Preencher formulário com dados da tarefa
        setFormData({
          title: task.title || '',
          description: task.description || '',
          status: task.status || 'pending',
          due_date: task.due_date ? task.due_date.slice(0, 10) : '',
          prioridade: task.prioridade || 'media',
          categoria: task.categoria || 'processo',
          status_inicial: task.status_inicial || 'a_fazer',
          tempo_estimado: task.tempo_estimado || '',
          tempo_unidade: task.tempo_unidade || 'horas',
          relacionado_a: task.relacionado_a || '',
          lembretes: task.lembretes || [],
          tags: task.tags || [],
          anexos: adaptAnexos,
          assigned_by_user_id: task.assigned_by_user_id || '',
          collaborators: task.collaborators || [],
          team_id: task.team_id || ''
        });

      } catch (error) {
        console.error('Erro ao carregar dados:', error);
        alert('Erro ao carregar tarefa. Redirecionando...');
        navigate('/dashboard');
      } finally {
        setInitialLoading(false);
      }
    };

    if (id) {
      fetchData();
    }

    const handleResize = () => {
      if (window.innerWidth <= 768) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [id, navigate]);

  const handleLogout = async () => {
    try {
      await api.post('/logout');
    } catch (err) {
      console.error('Erro ao fazer logout:', err);
    } finally {
      localStorage.removeItem('auth');
      navigate('/login');
    }
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.title.trim()) {
      newErrors.title = 'Título é obrigatório';
    }

    if (formData.tempo_estimado && formData.tempo_estimado < 1) {
      newErrors.tempo_estimado = 'Tempo deve ser maior que 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFileChange = (files) => {
    // Rastrear arquivos removidos
    const currentFileNames = files.map(f => f.name);
    const originalFileNames = formData.anexos.filter(f => f.isExisting).map(f => f.name);
    
    const newRemovedFiles = originalFileNames.filter(name => 
      !currentFileNames.includes(name) && !removedFiles.includes(name)
    );
    
    if (newRemovedFiles.length > 0) {
      setRemovedFiles(prev => [...prev, ...newRemovedFiles]);
    }

    updateField('anexos', files);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);

    try {
      const formDataToSend = new FormData();

      // Campos básicos
      formDataToSend.append('title', formData.title);
      formDataToSend.append('description', formData.description);
      formDataToSend.append('status', formData.status);
      formDataToSend.append('prioridade', formData.prioridade);
      formDataToSend.append('categoria', formData.categoria);
      formDataToSend.append('status_inicial', formData.status_inicial);
      formDataToSend.append('relacionado_a', formData.relacionado_a);

      // Data de vencimento
      if (formData.due_date) {
        const dueDateISO = new Date(formData.due_date).toISOString();
        formDataToSend.append('due_date', dueDateISO);
      }

      // Tempo estimado
      if (formData.tempo_estimado) {
        formDataToSend.append('tempo_estimado', formData.tempo_estimado);
        formDataToSend.append('tempo_unidade', formData.tempo_unidade);
      }

      // Arrays JSON
      formDataToSend.append('lembretes', JSON.stringify(formData.lembretes));
      formDataToSend.append('tags', JSON.stringify(formData.tags));
      formDataToSend.append('collaborators', JSON.stringify(formData.collaborators));
      formDataToSend.append('removedFiles', JSON.stringify(removedFiles));

      // IDs opcionais
      if (formData.assigned_by_user_id) {
        formDataToSend.append('assigned_by_user_id', formData.assigned_by_user_id);
      }
      if (formData.team_id) {
        formDataToSend.append('team_id', formData.team_id);
      }

      // Anexos novos
      formData.anexos.forEach((anexoObj) => {
        if (anexoObj.file && anexoObj.isNew) {
          formDataToSend.append('anexos', anexoObj.file);
        }
      });

      const response = await api.put(`/tasks/${id}`, formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      console.log('Tarefa atualizada com sucesso:', response.data);
      navigate('/dashboard');

    } catch (err) {
      console.error('Erro ao atualizar tarefa:', err);
      alert('Erro ao atualizar tarefa. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/tasks/${id}`);
      console.log('Tarefa excluída com sucesso');
      navigate('/dashboard');
    } catch (error) {
      console.error('Erro ao excluir tarefa:', error);
      alert('Erro ao excluir tarefa. Tente novamente.');
    }
  };

  const handleCancel = () => {
    navigate(-1);
  };

  if (initialLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Carregando tarefa...</p>
      </div>
    );
  }

  return (
    <div className={styles.editTaskFormPage}>
      <Header onLogout={handleLogout} onMenuToggle={toggleSidebar} />

      <div className={styles.pageBody}>
        <Sidebar isOpen={sidebarOpen} />
        
        <main className={styles.contentArea}>
          <div className={styles.formWrapper}>
            {/* Header da página */}
            <div className={styles.pageHeader}>
              <div className={styles.headerContent}>
                <div className={styles.titleRow}>
                  <h1 className={styles.pageTitle}>
                    <FiEdit3 className={styles.titleIcon} />
                    Editar Tarefa
                  </h1>
                  {originalTask && getStatusBadge(originalTask.status)}
                </div>
                <div className={styles.breadcrumb}>
                  <span>Dashboard</span>
                  <span className={styles.separator}>›</span>
                  <span>Tarefas</span>
                  <span className={styles.separator}>›</span>
                  <span className={styles.taskName}>{originalTask?.title}</span>
                  <span className={styles.separator}>›</span>
                  <span className={styles.current}>Editar</span>
                </div>
              </div>
            </div>

            {/* Formulário */}
            <form className={styles.taskForm} onSubmit={handleSubmit}>
              <div className={styles.formContent}>
                {/* Seção Básica */}
                <div className={styles.formSection}>
                  <div className={styles.sectionHeader}>
                    <FiFileText className={styles.sectionIcon} />
                    <h2 className={styles.sectionTitle}>Informações Básicas</h2>
                  </div>
                  <div className={styles.sectionContent}>
                    <div className={styles.formGrid}>
                      <div className={styles.fullWidth}>
                        <Input
                          label="Título"
                          required
                          value={formData.title}
                          onChange={(e) => updateField('title', e.target.value)}
                          placeholder="Digite o título da tarefa"
                          error={errors.title}
                        />
                      </div>
                      <div className={styles.fullWidth}>
                        <Input
                          type="textarea"
                          label="Descrição"
                          value={formData.description}
                          onChange={(e) => updateField('description', e.target.value)}
                          placeholder="Descreva os detalhes da tarefa"
                          rows={4}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Seção Configurações */}
                <div className={styles.formSection}>
                  <div className={styles.sectionHeader}>
                    <FiFlag className={styles.sectionIcon} />
                    <h2 className={styles.sectionTitle}>Configurações</h2>
                  </div>
                  <div className={styles.sectionContent}>
                    <div className={styles.formGrid}>
                      <Select
                        label="Prioridade"
                        icon={<FiFlag />}
                        value={formData.prioridade}
                        onChange={(e) => updateField('prioridade', e.target.value)}
                        options={prioridadeOptions}
                      />
                      <Select
                        label="Status"
                        value={formData.status}
                        onChange={(e) => updateField('status', e.target.value)}
                        options={statusOptions}
                      />
                      <Select
                        label="Categoria"
                        icon={<FiFolder />}
                        value={formData.categoria}
                        onChange={(e) => updateField('categoria', e.target.value)}
                        options={categoriaOptions}
                      />
                      <Input
                        type="date"
                        label="Data de Vencimento"
                        icon={<FiCalendar />}
                        value={formData.due_date}
                        onChange={(e) => updateField('due_date', e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Seção Tempo */}
                <div className={styles.formSection}>
                  <div className={styles.sectionHeader}>
                    <FiClock className={styles.sectionIcon} />
                    <h2 className={styles.sectionTitle}>Tempo Estimado</h2>
                  </div>
                  <div className={styles.sectionContent}>
                    <div className={styles.formGrid}>
                      <Input
                        type="number"
                        label="Quantidade"
                        value={formData.tempo_estimado}
                        onChange={(e) => updateField('tempo_estimado', e.target.value)}
                        placeholder="Ex: 2"
                        min="1"
                        error={errors.tempo_estimado}
                      />
                      <Select
                        label="Unidade"
                        value={formData.tempo_unidade}
                        onChange={(e) => updateField('tempo_unidade', e.target.value)}
                        options={tempoUnidadeOptions}
                      />
                    </div>
                  </div>
                </div>

                {/* Seção Relacionamentos */}
                <div className={styles.formSection}>
                  <div className={styles.sectionHeader}>
                    <FiUsers className={styles.sectionIcon} />
                    <h2 className={styles.sectionTitle}>Relacionamentos</h2>
                  </div>
                  <div className={styles.sectionContent}>
                    <div className={styles.formGrid}>
                      <Input
                        label="Relacionado a"
                        value={formData.relacionado_a}
                        onChange={(e) => updateField('relacionado_a', e.target.value)}
                        placeholder="Nº do processo, cliente..."
                      />
                      <Select
                        label="Atribuído por"
                        icon={<FiUser />}
                        value={formData.assigned_by_user_id}
                        onChange={(e) => updateField('assigned_by_user_id', e.target.value)}
                        options={users.map(user => ({ value: user.id, label: user.username }))}
                        placeholder="Selecione um usuário"
                      />
                      <Select
                        label="Equipe"
                        icon={<FiUsers />}
                        value={formData.team_id}
                        onChange={(e) => updateField('team_id', e.target.value)}
                        options={teams.map(team => ({ value: team.id, label: team.name }))}
                        placeholder="Selecione uma equipe"
                      />
                    </div>
                  </div>
                </div>

                {/* Seção Lembretes */}
                <div className={styles.formSection}>
                  <div className={styles.sectionHeader}>
                    <FiBell className={styles.sectionIcon} />
                    <h2 className={styles.sectionTitle}>Lembretes</h2>
                  </div>
                  <div className={styles.sectionContent}>
                    <div className={styles.checkboxGrid}>
                      {lembretesOptions.map(option => (
                        <div key={option.value} className={styles.checkboxItem}>
                          <Checkbox
                            id={`lembrete-${option.value}`}
                            checked={formData.lembretes.includes(option.value)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                updateField('lembretes', [...formData.lembretes, option.value]);
                              } else {
                                updateField('lembretes', formData.lembretes.filter(l => l !== option.value));
                              }
                            }}
                            label={option.label}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Seção Tags */}
                <div className={styles.formSection}>
                  <div className={styles.sectionHeader}>
                    <FiTag className={styles.sectionIcon} />
                    <h2 className={styles.sectionTitle}>Tags</h2>
                  </div>
                  <div className={styles.sectionContent}>
                    <TagInput
                      value={formData.tags}
                      onChange={(tags) => updateField('tags', tags)}
                      suggestions={tagSuggestions}
                      placeholder="Adicionar tag..."
                      maxTags={10}
                    />
                  </div>
                </div>

                {/* Seção Anexos */}
                <div className={styles.formSection}>
                  <div className={styles.sectionHeader}>
                    <FiPaperclip className={styles.sectionIcon} />
                    <h2 className={styles.sectionTitle}>Anexos</h2>
                  </div>
                  <div className={styles.sectionContent}>
                    <FileUploadArea
                      value={formData.anexos}
                      onChange={handleFileChange}
                      maxFiles={10}
                      maxFileSize={10 * 1024 * 1024} // 10MB
                      acceptedTypes={[
                        'image/*',
                        'application/pdf',
                        'application/msword',
                        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                        'application/vnd.ms-excel',
                        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                      ]}
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className={styles.formActions}>
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => setShowDeleteModal(true)}
                  icon={<FiTrash2 />}
                >
                  Excluir
                </Button>
                <div className={styles.rightActions}>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleCancel}
                    icon={<FiX />}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    loading={loading}
                    icon={<FiSave />}
                  >
                    Salvar Alterações
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </main>
      </div>

      {/* Modal de confirmação de exclusão */}
      {showDeleteModal && (
        <DeleteConfirmModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDelete}
          title="Excluir Tarefa"
          message={`Tem certeza que deseja excluir a tarefa "${originalTask?.title}"? Esta ação não pode ser desfeita.`}
        />
      )}
    </div>
  );
}

export default EditTaskFormPage;

