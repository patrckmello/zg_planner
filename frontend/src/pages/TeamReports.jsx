import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import api from "../services/axiosInstance";
import styles from "./TeamReports.module.css";
import {
  BarChart3,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertTriangle,
  Calendar,
  Filter,
  Download,
  FileText,
  Target,
  ChevronDown,
  ChevronUp,
  Activity,
  PieChart,
  Users,
  Zap,
} from "lucide-react";

/* ===================== Helpers ===================== */
const displayNameFromMember = (m) =>
  m?.name ??
  m?.username ??        // /teams retorna "username"
  m?.user_name ??       // /teams/:id/productivity retorna "user_name"
  m?.user?.username ??  // se vier aninhado
  m?.user?.name ??
  m?.user?.full_name ??
  null;

const normalizePriority = (priority) => {
  if (!priority) return priority;
  const map = { alta: "Alta", media: "Média", baixa: "Baixa", high: "Alta", medium: "Média", low: "Baixa" };
  return map[String(priority).toLowerCase()] || priority;
};

const normalizeCategory = (category) => {
  if (!category) return category;
  const s = String(category);
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
};

// IDs e atribuídos/collabs podem vir como número/string/objeto
const normalizeId = (v) => (v == null ? null : String(v?.id ?? v?.user_id ?? v));
const listHasId = (list, id) => Array.isArray(list) && list.some((u) => normalizeId(u) === String(id));
const collectAssignees = (task) => {
  const a = Array.isArray(task?.assigned_users) ? task.assigned_users.map(normalizeId) : [];
  const c = Array.isArray(task?.collaborators) ? task.collaborators.map(normalizeId) : [];
  const owner = normalizeId(task?.user_id);
  return Array.from(new Set([owner, ...a, ...c].filter(Boolean)));
};

/* ===================== Export simples ===================== */
const exportToCSV = (data, teamName) => {
  try {
    const csvContent = [
      ["Métrica", "Valor"],
      ["Equipe", teamName || "N/A"],
      ["Total de Tarefas", data.total_tasks || 0],
      ["Concluídas no Prazo", data.tasks_completed_on_time || 0],
      ["Tarefas Atrasadas", data.overdue_tasks || 0],
      ["Tempo Médio", data.average_completion_time || "N/A"],
      [
        "Taxa de Conclusão",
        data.total_tasks > 0
          ? Math.round(((data.tasks_by_status?.done || 0) / data.total_tasks) * 100) + "%"
          : "0%",
      ],
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `relatorio_equipe_${teamName || "equipe"}_${new Date().toISOString().split("T")[0]}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error("Erro ao exportar CSV:", error);
    throw error;
  }
};

const exportToPDF = (data, teamName) => {
  try {
    const printContent = `
      <html>
        <head>
          <title>Relatório da Equipe - ${teamName || "Equipe"}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #3498db; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            th { background-color: #f2f2f2; }
            .metric { margin: 10px 0; }
          </style>
        </head>
        <body>
          <h1>Relatório da Equipe: ${teamName || "Equipe"}</h1>
          <p>Data: ${new Date().toLocaleDateString("pt-BR")}</p>

          <h2>Métricas Principais</h2>
          <div class="metric"><strong>Total de Tarefas:</strong> ${data.total_tasks || 0}</div>
          <div class="metric"><strong>Concluídas no Prazo:</strong> ${data.tasks_completed_on_time || 0}</div>
          <div class="metric"><strong>Tarefas Atrasadas:</strong> ${data.overdue_tasks || 0}</div>
          <div class="metric"><strong>Tempo Médio:</strong> ${data.average_completion_time || "N/A"}</div>
          <div class="metric"><strong>Taxa de Conclusão:</strong> ${
            data.total_tasks > 0
              ? Math.round(((data.tasks_by_status?.done || 0) / data.total_tasks) * 100) + "%"
              : "0%"
          }</div>

          <h2>Distribuição por Status</h2>
          <table>
            <tr><th>Status</th><th>Quantidade</th></tr>
            ${Object.entries(data.tasks_by_status || {})
              .map(
                ([status, count]) =>
                  `<tr><td>${
                    status === "done" ? "Concluída" :
                    status === "pending" ? "Pendente" :
                    status === "in_progress" ? "Em Andamento" :
                    status === "cancelled" ? "Cancelada" :
                    status === "archived" ? "Arquivada" : status
                  }</td><td>${count}</td></tr>`
              )
              .join("")}
          </table>

          <h2>Distribuição por Prioridade</h2>
          <table>
            <tr><th>Prioridade</th><th>Quantidade</th></tr>
            ${Object.entries(data.tasks_by_priority || {})
              .map(([priority, count]) => `<tr><td>${priority}</td><td>${count}</td></tr>`)
              .join("")}
          </table>
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  } catch (error) {
    console.error("Erro ao exportar PDF:", error);
    throw error;
  }
};

/* ===================== Componente ===================== */
function TeamReports() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [currentView, setCurrentView] = useState("status");
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState("");
  const [teamProductivity, setTeamProductivity] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [allTasks, setAllTasks] = useState([]);
  const [filters, setFilters] = useState({
    start_date: "",
    end_date: "",
    status: "",
    priority: "",
    category: "",
    user_id: "",
  });

  // Toggle Ativas/Todas
  const [showOnlyActive, setShowOnlyActive] = useState(true);

  // conjunto visível para produtividade
  const [visibleTeamTasks, setVisibleTeamTasks] = useState([]);

  const hasAccess = () => currentUser?.is_admin || currentUser?.is_manager;

  const getBrasiliaDate = (isoDate) => {
    if (!isoDate) return null;
    const date = new Date(isoDate);
    return new Date(date.getTime() - 3 * 60 * 60 * 1000);
  };

  // Busca tarefas com/sem arquivadas conforme toggle
  const fetchTasks = useCallback(
    async (includeArchived) => {
      try {
        const params = includeArchived ? { include_archived: true } : {};
        if (selectedTeam) params.team_id = selectedTeam;

        const res = await api.get("/tasks", { params });
        setAllTasks(res.data);
      } catch (e) {
        console.error("Erro ao buscar tarefas:", e);
        toast.error("Erro ao carregar tarefas");
      }
    },
    [selectedTeam]
  );

  useEffect(() => {
    const fetchTeamIfNeeded = async () => {
      if (!selectedTeam) return;
      const t = teams.find((x) => String(x.id) === String(selectedTeam));
      const hasMembers = Array.isArray(t?.members) && t.members.length > 0;
      if (!hasMembers) {
        try {
          const { data } = await api.get(`/teams/${selectedTeam}`);
          // substitui o item da lista por um "completo"
          setTeams((prev) =>
            prev.map((x) => (String(x.id) === String(selectedTeam) ? data : x))
          );
        } catch (e) {
          console.warn("Falha ao detalhar equipe, seguindo com dados atuais.", e);
        }
      }
    };
    fetchTeamIfNeeded();
  }, [selectedTeam, teams]);

  useEffect(() => {
    const fetchInitialData = async (includeArchived) => {
      try {
        setLoading(true);

        const userResponse = await api.get("/users/me");
        setCurrentUser(userResponse.data);

        if (!userResponse.data.is_admin && !userResponse.data.is_manager) {
          toast.error("Acesso negado. Apenas gestores e administradores podem acessar esta página.");
          navigate("/dashboard");
          return;
        }

        const teamsResponse = await api.get("/teams");

        if (!userResponse.data.is_admin && userResponse.data.is_manager) {
          const userTeams = teamsResponse.data.filter((team) =>
            team.members?.some(
              (member) => member.user_id === userResponse.data.id && member.is_manager
            )
          );
          setTeams(userTeams);
        } else {
          setTeams(teamsResponse.data);
        }

        await fetchTasks(includeArchived);
      } catch (error) {
        console.error("Erro ao buscar dados iniciais:", error);
        toast.error("Erro ao carregar dados. Faça login novamente.");
        navigate("/login");
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData(!showOnlyActive);

    const handleResize = () => {
      if (window.innerWidth <= 768) setSidebarOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [navigate, fetchTasks, showOnlyActive]);

  useEffect(() => {
    fetchTasks(!showOnlyActive);
  }, [fetchTasks, showOnlyActive, selectedTeam]);

  /* ===================== Métricas ===================== */
  const calculateTeamMetrics = (teamTasks) => {
    if (!teamTasks || teamTasks.length === 0) {
      return {
        total_tasks: 0,
        tasks_by_status: {},
        tasks_by_priority: {},
        tasks_by_category: {},
        tasks_completed_on_time: 0,
        tasks_completed_late: 0,
        overdue_tasks: 0,
        upcoming_tasks: 0,
        average_completion_time: "N/A",
      };
    }

    const metrics = {
      total_tasks: teamTasks.length,
      tasks_by_status: {},
      tasks_by_priority: {},
      tasks_by_category: {},
      tasks_completed_on_time: 0,
      tasks_completed_late: 0,
      overdue_tasks: 0,
      upcoming_tasks: 0,
    };

    const now = new Date();
    let totalCompletionTime = 0;
    let completedTasksWithTime = 0;

    teamTasks.forEach((task) => {
      metrics.tasks_by_status[task.status] = (metrics.tasks_by_status[task.status] || 0) + 1;

      if (task.prioridade) {
        const p = normalizePriority(task.prioridade);
        metrics.tasks_by_priority[p] = (metrics.tasks_by_priority[p] || 0) + 1;
      }

      if (task.categoria) {
        const c = normalizeCategory(task.categoria);
        metrics.tasks_by_category[c] = (metrics.tasks_by_category[c] || 0) + 1;
      }

      const dueDate = task.due_date ? getBrasiliaDate(task.due_date) : null;
      const createdAt = task.created_at ? getBrasiliaDate(task.created_at) : null;
      const completionAt = task.completed_at
        ? getBrasiliaDate(task.completed_at)
        : task.status === "done"
        ? getBrasiliaDate(task.updated_at)
        : null;

      if (completionAt && dueDate) {
        if (completionAt <= dueDate) metrics.tasks_completed_on_time += 1;
        else metrics.tasks_completed_late += 1;

        if (createdAt) {
          const completionTime = Math.ceil((completionAt - createdAt) / (1000 * 60 * 60 * 24));
          totalCompletionTime += completionTime;
          completedTasksWithTime += 1;
        }
      }

      if (task.status !== "done" && task.status !== "archived" && dueDate) {
        if (dueDate < now) metrics.overdue_tasks += 1;
        else metrics.upcoming_tasks += 1;
      }
    });

    metrics.average_completion_time =
      completedTasksWithTime > 0
        ? `${Math.round(totalCompletionTime / completedTasksWithTime)} dias`
        : "N/A";

    return metrics;
  };

  /* ===================== Base de membros da equipe ===================== */
  // Pega membros da equipe selecionada diretamente do /teams (sempre contempla Ana)
  const selectedTeamObj = useMemo(
    () => teams.find((t) => String(t.id) === String(selectedTeam)),
    [teams, selectedTeam]
  );

  const teamMembers = useMemo(() => {
    const members = Array.isArray(selectedTeamObj?.members) ? selectedTeamObj.members : [];
    return members.map((m) => {
      const id = String(m?.user_id ?? m?.id ?? m?.user?.id ?? "");
      const name = displayNameFromMember(m) || `Usuário #${id || "?"}`;
      return { user_id: id, user_name: name };
    });
  }, [selectedTeamObj]);

  const teamMemberIdsSet = useMemo(
    () => new Set(teamMembers.map((m) => String(m.user_id))),
    [teamMembers]
  );

  /* ===================== Busca de dados para o relatório ===================== */
  const fetchReportData = async () => {
    if (!selectedTeam) {
      setReportData(null);
      setTeamProductivity(null);
      setVisibleTeamTasks([]);
      return;
    }

    try {
      setLoading(true);

      // ainda buscamos produtividade (para a caixa “Produtividade”), mas a base de membros vem de /teams
      let prod = null;
      try {
        const productivityResponse = await api.get(`/teams/${selectedTeam}/productivity`);
        prod = productivityResponse.data;
      } catch (e) {
        // se a API de produtividade falhar, seguimos só com teamMembers
        prod = null;
      }
      setTeamProductivity(prod);

      // Critério de pertencimento à equipe:
      // - Dono é membro, OU
      // - Algum assigned_user/collaborator é membro
      let teamTasks = allTasks.filter((task) => {
        const ownerId = normalizeId(task?.user_id);
        if (teamMemberIdsSet.has(String(ownerId))) return true;

        const assignees = collectAssignees(task);
        return assignees.some((uid) => teamMemberIdsSet.has(String(uid)));
      });

      // Filtros adicionais
      if (filters.user_id) {
        const uid = String(filters.user_id);
        teamTasks = teamTasks.filter((task) => {
          const assignees = collectAssignees(task);
          return assignees.includes(uid);
        });
      }
      if (filters.status) {
        teamTasks = teamTasks.filter((task) => task.status === filters.status);
      }
      if (filters.priority) {
        teamTasks = teamTasks.filter(
          (task) => normalizePriority(task.prioridade) === filters.priority
        );
      }
      if (filters.category) {
        const needle = String(filters.category).toLowerCase();
        teamTasks = teamTasks.filter(
          (task) => task.categoria && String(task.categoria).toLowerCase().includes(needle)
        );
      }
      if (filters.start_date) {
        const d = new Date(filters.start_date);
        teamTasks = teamTasks.filter((task) => new Date(task.created_at) >= d);
      }
      if (filters.end_date) {
        const d = new Date(filters.end_date);
        teamTasks = teamTasks.filter((task) => new Date(task.created_at) <= d);
      }

      // Toggle Ativas/Todas
      if (showOnlyActive) {
        teamTasks = teamTasks.filter((task) => task.status !== "archived");
      }

      setVisibleTeamTasks(teamTasks);

      const calculated = calculateTeamMetrics(teamTasks);
      calculated.detailed_tasks = teamTasks;
      setReportData(calculated);
    } catch (error) {
      console.error("Erro ao buscar dados do relatório:", error);
      toast.error("Erro ao carregar relatório");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTeam, filters, allTasks, showOnlyActive]);

  /* ===================== Filtros / UI ===================== */
  const handleFilterChange = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  const clearFilters = () => {
    setFilters({
      start_date: "",
      end_date: "",
      status: "",
      priority: "",
      category: "",
      user_id: "",
    });
    setSelectedTeam("");
  };

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

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  const handleExportPDF = async () => {
    if (!reportData) {
      toast.error("Nenhum dado disponível para exportar");
      return;
    }
    try {
      exportToPDF(reportData, selectedTeamObj?.name || teamProductivity?.team_name);
      toast.success("Relatório PDF exportado com sucesso!");
    } catch (error) {
      console.error("Erro ao exportar PDF:", error);
      toast.error("Erro ao exportar relatório PDF");
    }
  };

  const handleExportCSV = () => {
    if (!reportData) {
      toast.error("Nenhum dado disponível para exportar");
      return;
    }
    try {
      exportToCSV(reportData, selectedTeamObj?.name || teamProductivity?.team_name);
      toast.success("Dados CSV exportados com sucesso!");
    } catch (error) {
      console.error("Erro ao exportar CSV:", error);
      toast.error("Erro ao exportar dados CSV");
    }
  };

  const getStatusColor = (status) =>
    ({ pending: "#f59e0b", in_progress: "#3b82f6", done: "#10b981", cancelled: "#ef4444", archived: "#6b7280" }[
      status
    ] || "#6b7280");

  const getPriorityColor = (priority) => ({ Alta: "#ef4444", Média: "#f59e0b", Baixa: "#10b981" }[priority] || "#6b7280");

  const getStatusLabel = (status) =>
    ({ pending: "Pendente", in_progress: "Em Andamento", done: "Concluída", cancelled: "Cancelada", archived: "Arquivada" }[
      status
    ] || status);

  /* ===================== Nomes dos membros ===================== */
  // Preferimos os membros da equipe; se faltar alguém, caímos no retorno de produtividade
  const memberNameById = useMemo(() => {
    const map = new Map();

    // nomes vindos de /teams
    teamMembers.forEach((m) => {
      if (m.user_id) map.set(String(m.user_id), m.user_name);
    });

    // nomes vindos de /teams/:id/productivity (campo "user_name")
    (teamProductivity?.productivity || []).forEach((row) => {
      const id = String(row.user_id);
      const name = row.user_name || row.username || row.name;
      if (id && name && !map.has(id)) map.set(id, name);
    });

    // garante nome do usuário atual também
    if (currentUser?.id) {
      map.set(
        String(currentUser.id),
        currentUser.username || currentUser.name || currentUser.full_name
      );
    }

    return map;
  }, [teamMembers, teamProductivity, currentUser]);


  /* ===================== Produtividade (local) ===================== */
  const computedProductivity = useMemo(() => {
    const byUser = new Map();
    visibleTeamTasks.forEach((t) => {
      const responsibles = collectAssignees(t);
      responsibles.forEach((uid) => {
        if (!byUser.has(uid)) byUser.set(uid, { user_id: uid, total_tasks: 0, completed_tasks: 0 });
        const agg = byUser.get(uid);
        agg.total_tasks += 1;
        if (t.status === "done") agg.completed_tasks += 1;
      });
    });

    const arr = Array.from(byUser.values()).map((row) => ({
      ...row,
      user_name: memberNameById.get(row.user_id) || `Usuário #${row.user_id}`,
      completion_rate: row.total_tasks > 0 ? (row.completed_tasks / row.total_tasks) * 100 : 0,
    }));

    arr.sort((a, b) => b.completed_tasks - a.completed_tasks);
    return arr;
  }, [visibleTeamTasks, memberNameById]);

  /* ===================== Gráfico ===================== */
  const renderChart = () => {
    if (!reportData) return null;

    let data = {};
    let title = "";
    let getColor = () => "#3498db";

    switch (currentView) {
      case "status":
        data = reportData.tasks_by_status || {};
        title = "Distribuição por Status";
        getColor = getStatusColor;
        break;
      case "priority":
        data = reportData.tasks_by_priority || {};
        title = "Distribuição por Prioridade";
        getColor = getPriorityColor;
        break;
      case "category":
        data = reportData.tasks_by_category || {};
        title = "Distribuição por Categoria";
        break;
      default:
        return null;
    }

    return (
      <div className={styles.chartCard}>
        <div className={styles.chartHeader}>
          <div className={styles.chartTitle}>
            <PieChart size={20} />
            {title}
          </div>
          <div className={styles.chartToggle}>
            <button
              className={`${styles.toggleBtn} ${currentView === "status" ? styles.active : ""}`}
              onClick={() => setCurrentView("status")}
            >
              Status
            </button>
            <button
              className={`${styles.toggleBtn} ${currentView === "priority" ? styles.active : ""}`}
              onClick={() => setCurrentView("priority")}
            >
              Prioridade
            </button>
            <button
              className={`${styles.toggleBtn} ${currentView === "category" ? styles.active : ""}`}
              onClick={() => setCurrentView("category")}
            >
              Categoria
            </button>
          </div>
        </div>

        <div className={styles.chartContent}>
          {Object.keys(data).length === 0 ? (
            <div className={styles.emptyChart}>
              <p>Nenhum dado disponível para exibir</p>
            </div>
          ) : (
            Object.entries(data).map(([key, value]) => (
              <div key={key} className={styles.chartItem}>
                <div className={styles.chartItemLabel}>
                  <div className={styles.chartItemColor} style={{ backgroundColor: getColor(key) }}></div>
                  <span>{currentView === "status" ? getStatusLabel(key) : key}</span>
                </div>
                <div className={styles.chartItemBar}>
                  <div
                    className={styles.chartItemFill}
                    style={{
                      width: `${(value / Math.max(...Object.values(data), 1)) * 100}%`,
                      backgroundColor: getColor(key),
                    }}
                  />
                </div>
                <div className={styles.chartItemValue}>{value}</div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  /* ===================== Render ===================== */
  if (loading && !currentUser) {
    return (
      <div className={styles.reportsPage}>
        <Header onMenuToggle={toggleSidebar} />
        <div className={styles.pageBody}>
          <Sidebar isOpen={sidebarOpen} onLogout={handleLogout} />
          <main className={styles.contentArea}>
            <div className={styles.reportsWrapper}>
              <div className={styles.spinnerContainer}>
                <div className={styles.spinner}></div>
                <p>Carregando relatório...</p>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!hasAccess()) {
    return (
      <div className={styles.reportsPage}>
        <Header onMenuToggle={toggleSidebar} />
        <div className={styles.pageBody}>
          <Sidebar isOpen={sidebarOpen} onLogout={handleLogout} />
          <main className={styles.contentArea}>
            <div className={styles.reportsWrapper}>
              <div className={styles.accessDenied}>
                <Users size={64} />
                <h2>Acesso Restrito</h2>
                <p>Esta página é acessível apenas para gestores de equipe e administradores.</p>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.reportsPage}>
      <Header onMenuToggle={toggleSidebar} />
      <div className={styles.pageBody}>
        <Sidebar isOpen={sidebarOpen} onLogout={handleLogout} />
        <main className={styles.contentArea}>
          <div className={styles.reportsWrapper}>
            <div className={styles.pageHeader}>
              <div className={styles.headerContent}>
                <h1 className={styles.pageTitle}>Relatórios da Equipe</h1>
              </div>
              <div className={styles.breadcrumb}>
                <span>Equipes</span>
                <span className={styles.separator}>›</span>
                <span className={styles.current}>Relatórios da Equipe</span>
              </div>
            </div>

            {/* Export + Toggle Ativas/Todas */}
            <div className={styles.exportSection}>
              <button
                onClick={handleExportPDF}
                className={`${styles.exportBtn} ${styles.exportPdf}`}
                disabled={!reportData}
              >
                <FileText size={18} />
                Exportar PDF
              </button>
              <button
                onClick={handleExportCSV}
                className={`${styles.exportBtn} ${styles.exportCsv}`}
                disabled={!reportData}
              >
                <Download size={18} />
                Exportar CSV
              </button>

              <div className={styles.toggleGroup}>
                <button
                  className={`${styles.toggleBtn} ${showOnlyActive ? styles.active : ""}`}
                  onClick={() => setShowOnlyActive(true)}
                >
                  Ativas
                </button>
                <button
                  className={`${styles.toggleBtn} ${!showOnlyActive ? styles.active : ""}`}
                  onClick={() => setShowOnlyActive(false)}
                >
                  Todas
                </button>
              </div>
            </div>

            {/* Filtros */}
            <div className={styles.filtersCard}>
              <div className={styles.filtersHeader} onClick={() => setFiltersVisible(!filtersVisible)}>
                <div className={styles.filtersTitle}>
                  <Filter size={20} />
                  <span>Filtros</span>
                </div>
                {filtersVisible ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </div>

              {filtersVisible && (
                <div className={styles.filtersContent}>
                  <div className={styles.filtersGrid}>
                    <div className={styles.filterGroup}>
                      <label>Equipe *</label>
                      <select value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)} required>
                        <option value="">Selecione uma equipe</option>
                        {teams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className={styles.filterGroup}>
                      <label>Membro da Equipe</label>
                      <select
                        value={filters.user_id}
                        onChange={(e) => handleFilterChange("user_id", e.target.value)}
                        disabled={!selectedTeam}
                      >
                        <option value="">Todos os Membros</option>
                        {selectedTeam &&
                          teamMembers.map((member) => (
                            <option key={member.user_id} value={String(member.user_id)}>
                              {member.user_name}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div className={styles.filterGroup}>
                      <label>Data Inicial</label>
                      <input
                        type="date"
                        value={filters.start_date}
                        onChange={(e) => handleFilterChange("start_date", e.target.value)}
                        className={styles.dateInput}
                      />
                    </div>

                    <div className={styles.filterGroup}>
                      <label>Data Final</label>
                      <input
                        type="date"
                        value={filters.end_date}
                        onChange={(e) => handleFilterChange("end_date", e.target.value)}
                        className={styles.dateInput}
                      />
                    </div>

                    <div className={styles.filterGroup}>
                      <label>Status</label>
                      <select value={filters.status} onChange={(e) => handleFilterChange("status", e.target.value)}>
                        <option value="">Todos</option>
                        <option value="pending">Pendente</option>
                        <option value="in_progress">Em Andamento</option>
                        <option value="done">Concluída</option>
                        <option value="cancelled">Cancelada</option>
                        <option value="archived">Arquivada</option>
                      </select>
                    </div>

                    <div className={styles.filterGroup}>
                      <label>Prioridade</label>
                      <select
                        value={filters.priority}
                        onChange={(e) => handleFilterChange("priority", e.target.value)}
                      >
                        <option value="">Todas</option>
                        <option value="Alta">Alta</option>
                        <option value="Média">Média</option>
                        <option value="Baixa">Baixa</option>
                      </select>
                    </div>

                    <div className={styles.filterGroup}>
                      <label>Categoria</label>
                      <input
                        type="text"
                        placeholder="Digite a categoria"
                        value={filters.category}
                        onChange={(e) => handleFilterChange("category", e.target.value)}
                        className={styles.searchInput}
                      />
                    </div>
                  </div>

                  <div className={styles.filtersActions}>
                    <button onClick={clearFilters} className={styles.clearBtn}>
                      Limpar Filtros
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Conteúdo */}
            {reportData ? (
              <>
                <div className={styles.metricsGrid}>
                  <div className={styles.metricCard}>
                    <div className={styles.metricIcon} style={{ backgroundColor: "#3b82f6" }}>
                      <Target size={24} />
                    </div>
                    <div className={styles.metricContent}>
                      <h3>{reportData.total_tasks}</h3>
                      <p>Total de Tarefas</p>
                    </div>
                    <div className={styles.metricTrend}>
                      <Activity size={16} />
                    </div>
                  </div>

                  <div className={styles.metricCard}>
                    <div className={styles.metricIcon} style={{ backgroundColor: "#10b981" }}>
                      <CheckCircle size={24} />
                    </div>
                    <div className={styles.metricContent}>
                      <h3>{reportData.tasks_completed_on_time}</h3>
                      <p>Concluídas no Prazo</p>
                    </div>
                    <div className={styles.metricProgress}>
                      <TrendingUp size={16} />
                    </div>
                  </div>

                  <div className={styles.metricCard}>
                    <div className={styles.metricIcon} style={{ backgroundColor: "#ef4444" }}>
                      <AlertTriangle size={24} />
                    </div>
                    <div className={styles.metricContent}>
                      <h3>{reportData.overdue_tasks}</h3>
                      <p>Tarefas Atrasadas</p>
                    </div>
                    <div className={styles.metricAlert}>
                      {reportData.overdue_tasks > 0 && <Zap size={16} />}
                    </div>
                  </div>

                  <div className={styles.metricCard}>
                    <div className={styles.metricIcon} style={{ backgroundColor: "#f59e0b" }}>
                      <Clock size={24} />
                    </div>
                    <div className={styles.metricContent}>
                      <h3>{reportData.average_completion_time}</h3>
                      <p>Tempo Médio</p>
                    </div>
                    <div className={styles.metricInfo}>
                      <Calendar size={16} />
                    </div>
                  </div>
                </div>

                {renderChart()}

                {/* Produtividade (recalculada localmente) */}
                {computedProductivity.length > 0 && (
                  <div className={styles.productivityCard}>
                    <div className={styles.cardHeader}>
                      <h3 className={styles.cardTitle}>
                        <Users size={20} />
                        Produtividade da Equipe: {selectedTeamObj?.name || teamProductivity?.team_name || ""}
                      </h3>
                    </div>
                    <div className={styles.productivityGrid}>
                      {computedProductivity.map((member) => {
                        const maxCompleted = Math.max(
                          ...computedProductivity.map((p) => p.completed_tasks),
                          1
                        );
                        return (
                          <div key={member.user_id} className={styles.productivityItem}>
                            <div className={styles.productivityLabel}>
                              <span className={styles.userName}>{member.user_name}</span>
                              <span className={styles.userRate}>
                                {member.completion_rate.toFixed(1)}%
                              </span>
                            </div>
                            <div className={styles.productivityBar}>
                              <div
                                className={styles.productivityFill}
                                style={{
                                  width: `${(member.completed_tasks / maxCompleted) * 100}%`,
                                  backgroundColor: "#3498db",
                                }}
                              ></div>
                            </div>
                            <div className={styles.productivityValue}>
                              {member.completed_tasks} / {member.total_tasks}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className={styles.performanceCard}>
                  <div className={styles.cardHeader}>
                    <h3 className={styles.cardTitle}>
                      <BarChart3 size={20} />
                      Resumo de Performance da Equipe
                    </h3>
                  </div>
                  <div className={styles.performanceGrid}>
                    <div className={styles.performanceItem}>
                      <div className={styles.performanceLabel}>Taxa de Conclusão da Equipe</div>
                      <div className={styles.performanceValue}>
                        {reportData.total_tasks > 0
                          ? Math.round(
                              ((reportData.tasks_by_status.done || 0) / reportData.total_tasks) * 100
                            )
                          : 0}
                        %
                      </div>
                    </div>
                    <div className={styles.performanceItem}>
                      <div className={styles.performanceLabel}>Tarefas Concluídas Atrasadas</div>
                      <div className={styles.performanceValue}>
                        {reportData.tasks_completed_late || 0}
                      </div>
                    </div>
                    <div className={styles.performanceItem}>
                      <div className={styles.performanceLabel}>Próximas Tarefas</div>
                      <div className={styles.performanceValue}>
                        {reportData.upcoming_tasks || 0}
                      </div>
                    </div>
                    <div className={styles.performanceItem}>
                      <div className={styles.performanceLabel}>Produtividade Média</div>
                      <div className={styles.performanceValue}>
                        {reportData.total_tasks > 0 &&
                        reportData.average_completion_time !== "N/A"
                          ? "Alta"
                          : "Baixa"}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className={styles.emptyState}>
                <BarChart3 size={64} />
                <h3>Selecione uma Equipe</h3>
                <p>Escolha uma equipe nos filtros para gerar o relatório.</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default TeamReports;
