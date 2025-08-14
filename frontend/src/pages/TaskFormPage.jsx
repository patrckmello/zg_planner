import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import styles from "./TaskFormPage.module.css";
import api from "../services/axiosInstance";
import {
  FiSave,
  FiX,
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
  FiEye,
} from "react-icons/fi";

function TaskFormPage() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [errors, setErrors] = useState({});

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
    assigned_to_user_id: "",
    collaborator_ids: [],
    team_id: "",
  });

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

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [teamsResponse, userResponse] = await Promise.all([
          api.get("/teams"),
          api.get("/users/me"),
        ]);
        setTeams(teamsResponse.data);
        setCurrentUser(userResponse.data);
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
      }
    };

    fetchData();

    const handleResize = () => {
      if (window.innerWidth <= 768) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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

  const validateForm = () => {
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = "Título é obrigatório";
    }

    if (formData.tempo_estimado && formData.tempo_estimado < 1) {
      newErrors.tempo_estimado = "Tempo deve ser maior que 0";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);

    try {
      const formDataToSend = new FormData();

      // Campos básicos
      formDataToSend.append("title", formData.title);
      formDataToSend.append("description", formData.description);
      formDataToSend.append("status", formData.status);
      formDataToSend.append("prioridade", formData.prioridade);
      formDataToSend.append("categoria", formData.categoria);
      formDataToSend.append("relacionado_a", formData.relacionado_a);

      // Data de vencimento
      if (formData.due_date) {
        formDataToSend.append("due_date", formData.due_date);
      }

      // Tempo estimado
      if (formData.tempo_estimado) {
        formDataToSend.append("tempo_estimado", formData.tempo_estimado);
        formDataToSend.append("tempo_unidade", formData.tempo_unidade);
      }

      // Arrays JSON
      formDataToSend.append("lembretes", JSON.stringify(formData.lembretes));
      formDataToSend.append("tags", JSON.stringify(formData.tags));
      formDataToSend.append(
        "collaborator_ids",
        JSON.stringify(formData.collaborator_ids)
      );

      // IDs opcionais
      if (formData.assigned_to_user_id) {
        formDataToSend.append(
          "assigned_to_user_id",
          formData.assigned_to_user_id
        );
      }
      if (formData.team_id) {
        formDataToSend.append("team_id", formData.team_id);
      }

      // Anexos
      formData.anexos.forEach((anexoObj) => {
        if (anexoObj.file) {
          formDataToSend.append("anexos", anexoObj.file);
        }
      });

      const response = await api.post("/tasks", formDataToSend, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      console.log("Tarefa criada com sucesso:", response.data);
      navigate("/tasks");
    } catch (err) {
      console.error("Erro ao criar tarefa:", err);
      if (err.response?.data?.error) {
        alert(err.response.data.error);
      } else {
        alert("Erro ao criar tarefa. Tente novamente.");
      }
    } finally {
      setLoading(false);
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

  return (
    <div className={styles.taskFormPage}>
      <Header onMenuToggle={toggleSidebar} />

      <div className={styles.pageBody}>
        <Sidebar onLogout={handleLogout} isOpen={sidebarOpen} />

        <main className={styles.contentArea}>
          <div className={styles.formWrapper}>
            {/* Header da página */}
            <div className={styles.pageHeader}>
              <div className={styles.headerContent}>
                <h1 className={styles.pageTitle}>Nova Tarefa</h1>
                <div className={styles.breadcrumb}>
                  <span>Dashboard</span>
                  <span className={styles.separator}>›</span>
                  <span>Tarefas</span>
                  <span className={styles.separator}>›</span>
                  <span className={styles.current}>Nova</span>
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
                      <div className={styles.fullWidth}>
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
                              selectedMembers={
                                formData.assigned_to_user_id
                                  ? [parseInt(formData.assigned_to_user_id)]
                                  : []
                              }
                              onSelectionChange={(members) => {
                                updateField(
                                  "assigned_to_user_id",
                                  members.length > 0 ? members[0] : ""
                                );
                              }}
                              label="Atribuir para"
                              placeholder="Selecione um membro da equipe"
                              allowMultiple={false}
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
                        formData.assigned_to_user_id
                          ? parseInt(formData.assigned_to_user_id)
                          : null,
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
                      onChange={(files) => updateField("anexos", files)}
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

              {/* Actions */}
              <div className={styles.formActions}>
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
                  Criar Tarefa
                </Button>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}

export default TaskFormPage;
