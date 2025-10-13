import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import TagInput from "../components/forms/TagInput";
import FileUploadArea from "../components/forms/FileUploadArea";
import TeamMemberSelector from "../components/forms/TeamMemberSelector";
import CollaboratorSelector from "../components/forms/CollaboratorSelector";
import CustomDateTimePicker from "../components/forms/CustomDateTimePicker";
import Checkbox from "../components/Checkbox/Checkbox";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import styles from "./EditTaskFormPage.module.css";
import api from "../services/axiosInstance";
import { getMsStatus } from "../services/msIntegration";
import { FiZap } from "react-icons/fi";
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
  FiEdit3,
  FiEye,
} from "react-icons/fi";

function EditTaskFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [teams, setTeams] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [errors, setErrors] = useState({});
  const [removedFiles, setRemovedFiles] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [requiresApproval, setRequiresApproval] = useState(false);

  const [msStatus, setMsStatus] = useState({ connected: false });
  const [addToOutlook, setAddToOutlook] = useState(false);

  // Refs para campos obrigatórios
  const titleRef = useRef(null);
  const dueDateRef = useRef(null);
  const tempoEstimadoRef = useRef(null);

  // Estados do formulário
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    status: "pending",
    due_date: "",
    prioridade: "media",
    categoria: "processo",
    tempo_estimado: "",
    tempo_unidade: "horas",
    relacionado_a: "",
    lembretes: [],
    tags: [],
    anexos: [],
    assigned_to_user_ids: [], // Alterado para array
    collaborator_ids: [],
    team_id: "",
    
  });

  const [originalTask, setOriginalTask] = useState(null);

  // Opções para os selects
  const prioridadeOptions = [
    { value: "baixa", label: "🟢 Baixa" },
    { value: "media", label: "🟡 Média" },
    { value: "alta", label: "🟠 Alta" },
    { value: "urgente", label: "🔴 Urgente" },
  ];

  const statusOptions = [
    { value: "pending", label: "⏳ Pendente" },
    { value: "in_progress", label: "🔄 Em andamento" },
    { value: "done", label: "✅ Concluído" },
    { value: "cancelled", label: "❌ Cancelado" },
  ];

  const categoriaOptions = [
    { value: "processo", label: "⚙️ Processo" },
    { value: "projeto", label: "🚀 Projeto" },
    { value: "manutencao", label: "🔧 Manutenção" },
    { value: "reuniao", label: "👥 Reunião" },
  ];

  const tempoUnidadeOptions = [
    { value: "horas", label: "Horas" },
    { value: "minutos", label: "Minutos" },
  ];

  const lembretesOptions = [
    { value: "5min", label: "5 minutos antes" },
    { value: "15min", label: "15 minutos antes" },
    { value: "30min", label: "30 minutos antes" },
    { value: "1h", label: "1 hora antes" },
    { value: "1d", label: "1 dia antes" },
    { value: "1w", label: "1 semana antes" },
  ];

  const tagSuggestions = [
    "urgente",
    "importante",
    "revisão",
    "aprovação",
    "cliente",
    "interno",
    "externo",
    "documentação",
    "análise",
    "desenvolvimento",
  ];

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { label: "Pendente", color: "#f59e0b", bg: "#fef3c7" },
      in_progress: { label: "Em Andamento", color: "#3b82f6", bg: "#dbeafe" },
      done: { label: "Concluído", color: "#10b981", bg: "#d1fae5" },
      cancelled: { label: "Cancelado", color: "#ef4444", bg: "#fee2e2" },
    };

    const config = statusConfig[status] || statusConfig.pending;

    return (
      <span
        className={styles.statusBadge}
        style={{
          color: config.color,
          backgroundColor: config.bg,
        }}
      >
        {config.label}
      </span>
    );
  };

  const handleOutlookToggle = (checked) => {
    if (!msStatus.connected) {
      toast.warn(
        "Conecte sua conta Microsoft para adicionar eventos ao Outlook.",
        {
          position: "top-right",
          autoClose: 4000,
          closeOnClick: true,
        }
      );
      return; // não altera o estado
    }
    setAddToOutlook(!!checked);
  };

  useEffect(() => {
    if (!msStatus.connected && addToOutlook) {
      setAddToOutlook(false);
    }
  }, [msStatus.connected, addToOutlook]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [taskResponse, teamsResponse, userResponse, ms] = await Promise.all([
          api.get(`/tasks/${id}`),
          api.get("/teams"),
          api.get("/users/me"),
          getMsStatus(),
        ]);
        setMsStatus(ms || { connected: false });

        const task = taskResponse.data;
        setOriginalTask(task);
        setTeams(teamsResponse.data);
        setCurrentUser(userResponse.data);

        // Processar anexos vindos do backend
        const adaptAnexos = (task.anexos || []).map((anexo) => {
          if (typeof anexo === "string") {
            return {
              id: anexo,
              name: anexo,
              size: 0,
              type: "application/octet-stream",
              url: `${api.defaults.baseURL}/uploads/${anexo}`,
              isExisting: true,
            };
          } else {
            return {
              id: anexo.id || anexo.name || Date.now() + Math.random(),
              name: anexo.name,
              size: anexo.size || 0,
              type: anexo.type || "application/octet-stream",
              url: anexo.url || `${api.defaults.baseURL}/uploads/${anexo.name}`,
              isExisting: true,
            };
          }
        });

        // Preencher formulário com dados da tarefa
        setFormData({
          title: task.title || "",
          description: task.description || "",
          status: task.status || "pending",
          due_date: task.due_date || "",
          prioridade: task.prioridade || "media",
          categoria: task.categoria || "processo",
          tempo_estimado: task.tempo_estimado || "",
          tempo_unidade: task.tempo_unidade || "horas",
          relacionado_a: task.relacionado_a || "",
          lembretes: task.lembretes || [],
          tags: task.tags || [],
          anexos: adaptAnexos,
          assigned_to_user_ids: Array.isArray(task.assigned_to_user_ids)
            ? task.assigned_to_user_ids.map((id) => parseInt(id))
            : task.user_id
            ? [parseInt(task.user_id)]
            : [], // Garante que seja um array de números
          collaborator_ids: task.collaborator_ids || [],
          team_id: task.team_id || "",
          
        });
        setRequiresApproval(!!task.requires_approval);
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
        toast.error("Erro ao carregar tarefa. Redirecionando...");
        navigate("/tasks");
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

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [id, navigate]);



  const handleLogout = async () => {
    try {
      await api.post("/logout");
    } catch (err) {
      console.error("Erro ao fazer logout:", err);
    } finally {
      localStorage.removeItem("auth");
      navigate("/login");
    }
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  // Função para rolar até o primeiro campo com erro
  const scrollToFirstError = (newErrors) => {
    const errorFields = Object.keys(newErrors);
    if (errorFields.length === 0) return;

    const fieldRefMap = {
      title: titleRef,
      due_date: dueDateRef,
      tempo_estimado: tempoEstimadoRef,
    };

    // Encontrar o primeiro campo com erro que tem ref
    for (const field of errorFields) {
      const ref = fieldRefMap[field];
      if (ref && ref.current) {
        ref.current.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "nearest",
        });

        // Focar no campo após um pequeno delay
        setTimeout(() => {
          if (
            ref.current.querySelector("input") ||
            ref.current.querySelector("textarea")
          ) {
            const input =
              ref.current.querySelector("input") ||
              ref.current.querySelector("textarea");
            input.focus();
          }
        }, 300);
        break;
      }
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = "Título é obrigatório";
    }

    if (formData.tempo_estimado && formData.tempo_estimado < 1) {
      newErrors.tempo_estimado = "Tempo deve ser maior que 0";
    }

    if (addToOutlook && !formData.due_date) {
      newErrors.due_date = "Obrigatória para adicionar ao Outlook";
    }

    if (addToOutlook && !msStatus.connected) {
      newErrors.addToOutlook = "Conecte sua conta Microsoft antes de adicionar ao Outlook.";
    }
    setErrors(newErrors);

    // Rolar até o primeiro campo com erro
    if (Object.keys(newErrors).length > 0) {
      scrollToFirstError(newErrors);
    }

    return Object.keys(newErrors).length === 0;
  };

  const handleFileChange = (files) => {
    // Rastrear arquivos removidos
    const currentFileNames = files.map((f) => f.name);
    const originalFileNames = formData.anexos
      .filter((f) => f.isExisting)
      .map((f) => f.name);

    const newRemovedFiles = originalFileNames.filter(
      (name) => !currentFileNames.includes(name) && !removedFiles.includes(name)
    );

    if (newRemovedFiles.length > 0) {
      setRemovedFiles((prev) => [...prev, ...newRemovedFiles]);
    }

    updateField("anexos", files);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);

    try {
      const formDataToSend = new FormData();

      // —— Campos básicos
      formDataToSend.append("title", formData.title);
      formDataToSend.append("description", formData.description);
      formDataToSend.append("status", formData.status);
      formDataToSend.append("prioridade", formData.prioridade);
      formDataToSend.append("categoria", formData.categoria);
      formDataToSend.append("relacionado_a", formData.relacionado_a);

      // —— Data de vencimento
      if (formData.due_date) {
        formDataToSend.append("due_date", formData.due_date);
      }

      // —— Tempo estimado
      if (formData.tempo_estimado) {
        formDataToSend.append("tempo_estimado", formData.tempo_estimado);
        formDataToSend.append("tempo_unidade", formData.tempo_unidade);
      }

      // —— Arrays JSON
      formDataToSend.append(
        "lembretes",
        JSON.stringify(formData.lembretes || [])
      );
      formDataToSend.append("tags", JSON.stringify(formData.tags || []));
      formDataToSend.append(
        "collaborator_ids",
        JSON.stringify(formData.collaborator_ids || [])
      );

      // —— Só envia assigned_to_user_ids se:
      // (a) usuário pode reatribuir (gestor/admin da equipe selecionada)
      // (b) houve mudança real nos responsáveis
      const canReassign = isManagerOfAnyTeam() && isManagerOfSelectedTeam();

      const originalAssignees = Array.isArray(
        originalTask?.assigned_to_user_ids
      )
        ? originalTask.assigned_to_user_ids.map(Number)
        : originalTask?.user_id
        ? [Number(originalTask.user_id)]
        : [];

      const currentAssignees = Array.isArray(formData.assigned_to_user_ids)
        ? formData.assigned_to_user_ids.map(Number)
        : [];

      const sameArray = (a, b) => {
        const sa = [...a].sort((x, y) => x - y);
        const sb = [...b].sort((x, y) => x - y);
        return JSON.stringify(sa) === JSON.stringify(sb);
      };

      const assigneesChanged = !sameArray(originalAssignees, currentAssignees);

      if (canReassign && assigneesChanged) {
        formDataToSend.append(
          "assigned_to_user_ids",
          JSON.stringify(currentAssignees)
        );
      }
      // ⚠️ Caso NÃO possa reatribuir ou NÃO houve mudança,
      // NÃO enviamos assigned_to_user_ids — evitando sobrescrever 'assigned_by_user_id' no backend.

      // —— IDs opcionais
      if (formData.team_id) {
        formDataToSend.append("team_id", formData.team_id);
      }

      // —— Arquivos removidos
      formDataToSend.append(
        "files_to_remove",
        JSON.stringify(removedFiles || [])
      );

      // —— Anexos existentes
      const existingFiles = (formData.anexos || [])
        .filter((f) => f.isExisting)
        .map((f) => ({
          id: f.id,
          name: f.name,
          size: f.size,
          type: f.type,
          url: f.url,
        }));
      formDataToSend.append("existing_files", JSON.stringify(existingFiles));
      // Aprovação
      formDataToSend.append("requires_approval", requiresApproval ? "true" : "false");
      formDataToSend.append(
        "create_calendar_event",
        addToOutlook && msStatus.connected ? "true" : "false"
      );

      // —— Anexos novos
      (formData.anexos || []).forEach((anexoObj) => {
        if (anexoObj.file && !anexoObj.isExisting) {
          formDataToSend.append("new_files", anexoObj.file);
        }
      });

      const response = await api.put(`/tasks/${id}`, formDataToSend, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      console.log("Tarefa atualizada com sucesso:", response.data);
      navigate("/tasks");
    } catch (err) {
      console.error("Erro ao atualizar tarefa:", err);
      if (err.response?.data?.error) {
        toast.error(err.response.data.error);
      } else {
        toast.error("Erro ao atualizar tarefa. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await api.delete(`/tasks/${id}`);
      toast.success("Tarefa excluída com sucesso!");
      navigate("/tasks");
    } catch (error) {
      console.error("Erro ao excluir tarefa:", error);
      toast.error("Ocorreu um erro ao excluir a tarefa. Tente novamente.");
      // Fecha o modal mesmo se der erro, para o usuário poder tentar de novo.
      setShowDeleteModal(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancel = () => {
    navigate(-1);
  };

  // Verificar se o usuário atual é gestor de alguma equipe
  const isManagerOfAnyTeam = () => {
    if (!currentUser) return false;
    return currentUser.is_admin || currentUser.is_manager;
  };

  // Verificar se o usuário atual é gestor da equipe selecionada
  const isManagerOfSelectedTeam = () => {
    if (!formData.team_id || !currentUser) return false;
    const selectedTeam = teams.find((t) => t.id === parseInt(formData.team_id));
    if (!selectedTeam) return false;
    return (
      currentUser.is_admin ||
      selectedTeam.members?.some(
        (member) => member.user_id === currentUser.id && member.is_manager
      )
    );
  };

  // Verificar se o usuário pode editar a tarefa
  const canEditTask = () => {
    if (!currentUser || !originalTask) return false;
    return (
      currentUser.is_admin ||
      originalTask.user_id === currentUser.id ||
      originalTask.assigned_by_user_id === currentUser.id ||
      (originalTask.collaborators &&
        originalTask.collaborators.includes(currentUser.id))
    );
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
      <Header onMenuToggle={toggleSidebar} />

      <div className={styles.pageBody}>
        <Sidebar onLogout={handleLogout} isOpen={sidebarOpen} />

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
                      <div className={styles.fullWidth} ref={titleRef}>
                        <Input
                          label="Título"
                          required
                          value={formData.title}
                          onChange={(e) => updateField("title", e.target.value)}
                          placeholder="Digite o título da tarefa"
                          error={errors.title}
                        />
                      </div>
                      <div className={styles.fullWidth}>
                        <Input
                          type="textarea"
                          label="Descrição"
                          value={formData.description}
                          onChange={(e) =>
                            updateField("description", e.target.value)
                          }
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
                        onChange={(e) =>
                          updateField("prioridade", e.target.value)
                        }
                        options={prioridadeOptions}
                      />
                      <Select
                        label="Status"
                        value={formData.status}
                        onChange={(e) => updateField("status", e.target.value)}
                        options={statusOptions}
                      />
                      <Select
                        label="Categoria"
                        icon={<FiFolder />}
                        value={formData.categoria}
                        onChange={(e) =>
                          updateField("categoria", e.target.value)
                        }
                        options={categoriaOptions}
                      />
                      <Input
                        label="Relacionado a"
                        value={formData.relacionado_a}
                        onChange={(e) =>
                          updateField("relacionado_a", e.target.value)
                        }
                        placeholder="Nº do processo, cliente..."
                      />

                      <div className={styles.fullWidth} ref={dueDateRef}>
                        <CustomDateTimePicker
                          label="Data de Vencimento"
                          value={formData.due_date}
                          onChange={(value) => updateField("due_date", value)}
                          placeholder="Selecione data e hora"
                          required={false}
                          error={errors.due_date}
                        />
                      </div>
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
                      <div ref={tempoEstimadoRef}>
                        <Input
                          type="number"
                          label="Quantidade"
                          value={formData.tempo_estimado}
                          onChange={(e) =>
                            updateField("tempo_estimado", e.target.value)
                          }
                          placeholder="Ex: 2"
                          min="1"
                          error={errors.tempo_estimado}
                        />
                      </div>
                      <Select
                        label="Unidade"
                        value={formData.tempo_unidade}
                        onChange={(e) =>
                          updateField("tempo_unidade", e.target.value)
                        }
                        options={tempoUnidadeOptions}
                      />
                    </div>
                  </div>
                </div>

                {/* Seção Atribuição - Apenas para gestores */}
                {isManagerOfAnyTeam() && (
                  <div className={styles.formSection}>
                    <div className={styles.sectionHeader}>
                      <FiUsers className={styles.sectionIcon} />
                      <h2 className={styles.sectionTitle}>Atribuição</h2>
                    </div>
                    <div className={styles.sectionContent}>
                      <div className={styles.formGrid}>
                        <div className={styles.fullWidth}>
                          <Select
                            label="Equipe"
                            icon={<FiUsers />}
                            value={formData.team_id}
                            onChange={(e) =>
                              updateField("team_id", e.target.value)
                            }
                            options={teams.map((team) => ({
                              value: team.id,
                              label: team.name,
                            }))}
                            placeholder="Selecione uma equipe"
                          />
                        </div>

                        {formData.team_id && (
                          <div className={styles.fullWidth}>
                            <TeamMemberSelector
                              teamId={parseInt(formData.team_id)}
                              selectedMembers={formData.assigned_to_user_ids}
                              onSelectionChange={(members) => {
                                updateField("assigned_to_user_ids", members);
                              }}
                              label="Atribuir para"
                              placeholder="Selecione membros da equipe"
                              allowMultiple={true}
                              disabled={!isManagerOfSelectedTeam()}
                            />
                            {!isManagerOfSelectedTeam() && (
                              <div className={styles.permissionNote}>
                                <FiEye className={styles.noteIcon} />
                                <span>
                                  Apenas gestores podem atribuir tarefas para
                                  outros membros da equipe
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Seção Colaboradores */}
                <div className={styles.formSection}>
                  <div className={styles.sectionHeader}>
                    <FiEye className={styles.sectionIcon} />
                    <h2 className={styles.sectionTitle}>
                      Colaboradores/Observadores
                    </h2>
                  </div>
                  <div className={styles.sectionContent}>
                    <CollaboratorSelector
                      selectedCollaborators={formData.collaborator_ids}
                      onSelectionChange={(collaborators) =>
                        updateField("collaborator_ids", collaborators)
                      }
                      label="Adicionar colaboradores"
                      placeholder="Selecione usuários para colaborar ou observar esta tarefa"
                      excludeUserIds={[
                        currentUser?.id,
                        ...(formData.assigned_to_user_ids || []).map((id) =>
                          parseInt(id)
                        ),
                      ].filter(Boolean)}
                    />
                    <div className={styles.collaboratorNote}>
                      <span>
                        Colaboradores podem visualizar e comentar na tarefa, mas
                        não editá-la.
                      </span>
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
                      {lembretesOptions.map((option) => (
                        <div key={option.value} className={styles.checkboxItem}>
                          <Checkbox
                            id={`lembrete-${option.value}`}
                            checked={formData.lembretes.includes(option.value)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                updateField("lembretes", [
                                  ...formData.lembretes,
                                  option.value,
                                ]);
                              } else {
                                updateField(
                                  "lembretes",
                                  formData.lembretes.filter(
                                    (l) => l !== option.value
                                  )
                                );
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
                      onChange={(tags) => updateField("tags", tags)}
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
                        "image/*",
                        "application/pdf",
                        "application/msword",
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                        "application/vnd.ms-excel",
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                      ]}
                    />
                  </div>
                </div>
              </div>

              {/* 🚀 Automação e Integrações */}
              <div className={styles.formSection}>
                <div className={styles.sectionHeader}>
                  <FiZap className={styles.sectionIcon} />
                  <h2 className={styles.sectionTitle}>Automação e Integrações</h2>
                </div>
                <div className={styles.sectionContent}>
                  <div className={styles.formGrid}>
                    <div className={styles.fullWidth}>
                      <Checkbox
                        label="Requer aprovação do gestor"
                        checked={requiresApproval}
                        onCheckedChange={(checked) => setRequiresApproval(!!checked)}
                      />
                    </div>

                    <div className={styles.fullWidth}>
                      <Checkbox
                        label={
                          msStatus.connected
                            ? `Adicionar à agenda do Outlook (${msStatus.email || "conectado"})`
                            : "Adicionar à agenda do Outlook (conecte sua conta primeiro)"
                        }
                        checked={addToOutlook}
                        onCheckedChange={handleOutlookToggle}  // ← usa o handler
                        // não usar 'disabled' aqui, para permitir o clique e mostrar o toast
                      />

                      {!msStatus.connected && (
                        <div className={styles.permissionNote}>
                          <FiCalendar className={styles.noteIcon} />
                          <span>
                            Vá em <strong>Meu Perfil ▸ Integrações</strong> e conecte sua conta.{" "}
                            <a
                              href="/meu-perfil"
                              className={styles.linkInline}
                              onClick={() =>
                                toast.info("Abrindo página de integrações…", {
                                  position: "top-right",
                                  autoClose: 2500,
                                  closeOnClick: true,
                                })
                              }
                            >
                              Conectar agora
                            </a>
                          </span>
                        </div>
                      )}

                      <div className={styles.helperText}>
                        <small>
                          Evento usa Título/Descrição/Data; duração = Tempo Estimado (ou 30 min).
                          Convidados: atribuídos e colaboradores.
                        </small>
                      </div>
                    </div>
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
                  disabled={!canEditTask()}
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
                    disabled={!canEditTask()}
                  >
                    Salvar Alterações
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </main>
      </div>
      {showDeleteModal && (
        <DeleteConfirmModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDelete}
          isDeleting={isDeleting}
          title="Confirmar Exclusão"
          message={`Tem certeza que deseja excluir a tarefa "${formData.title}"? Esta ação não pode ser desfeita.`}
        />
      )}
      <ToastContainer
        position="bottom-right"
        autoClose={5000}
        hideProgressBar={false}
      />
    </div>
  );
}

export default EditTaskFormPage;
