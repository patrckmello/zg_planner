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

const normalizePriority = (priority) => {
  if (!priority) return priority;
  const priorityMap = {
    alta: "Alta",
    media: "Média",
    baixa: "Baixa",
    high: "Alta",
    medium: "Média",
    low: "Baixa",
  };
  return priorityMap[priority.toLowerCase()] || priority;
};

const normalizeCategory = (category) => {
  if (!category) return category;
  return category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
};

// Export simples (CSV)
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

    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
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

// Export simples (PDF via print)
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
                    status === "done"
                      ? "Concluída"
                      : status === "pending"
                      ? "Pendente"
                      : status === "in_progress"
                      ? "Em Andamento"
                      : status === "cancelled"
                      ? "Cancelada"
                      : status === "archived"
                      ? "Arquivada"
                      : status
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

  // 🔹 Guardar o conjunto de tarefas visíveis no momento (para usar na produtividade)
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
        const res = await api.get("/tasks", {
          params: includeArchived ? { include_archived: true } : {},
        });
        setAllTasks(res.data);
      } catch (e) {
        console.error("Erro ao buscar tarefas:", e);
        toast.error("Erro ao carregar tarefas");
      }
    },
    []
  );

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
            team.members.some(
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

    // carrega conforme o toggle atual
    fetchInitialData(!showOnlyActive);

    const handleResize = () => {
      if (window.innerWidth <= 768) setSidebarOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [navigate, fetchTasks, showOnlyActive]);

  // Rebusca apenas as tasks quando alternar Ativas/Todas
  useEffect(() => {
    fetchTasks(!showOnlyActive);
  }, [fetchTasks, showOnlyActive]);

  const getTaskStatus = (task) => {
    if (task.status === "archived") return { text: "Arquivada", color: "#6b7280" };
    if (task.status === "done") return { text: "Concluída", color: "#10b981" };

    const now = new Date();
    const dueDate = getBrasiliaDate(task.due_date);
    if (dueDate && dueDate < now) return { text: "Atrasada", color: "#ef4444" };
    return { text: "Pendente", color: "#f59e0b" };
  };

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
        const normalizedPriority = normalizePriority(task.prioridade);
        metrics.tasks_by_priority[normalizedPriority] =
          (metrics.tasks_by_priority[normalizedPriority] || 0) + 1;
      }

      if (task.categoria) {
        const normalizedCategory = normalizeCategory(task.categoria);
        metrics.tasks_by_category[normalizedCategory] =
          (metrics.tasks_by_category[normalizedCategory] || 0) + 1;
      }

      const dueDate = task.due_date ? getBrasiliaDate(task.due_date) : null;
      const createdAt = task.created_at ? getBrasiliaDate(task.created_at) : null;
      const updatedAt = task.updated_at ? getBrasiliaDate(task.updated_at) : null;

      if (task.status === "done" && dueDate && updatedAt) {
        if (updatedAt <= dueDate) metrics.tasks_completed_on_time += 1;
        else metrics.tasks_completed_late += 1;

        if (createdAt) {
          const completionTime = Math.ceil((updatedAt - createdAt) / (1000 * 60 * 60 * 24));
          totalCompletionTime += completionTime;
          completedTasksWithTime += 1;
        }
      }

      // Não considerar arquivadas nos contadores de atraso/próximas
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

  const fetchReportData = async () => {
    if (!selectedTeam) {
      setReportData(null);
      setTeamProductivity(null);
      setVisibleTeamTasks([]); // 🔹 limpa visíveis
      return;
    }

    try {
      setLoading(true);

      const productivityResponse = await api.get(`/teams/${selectedTeam}/productivity`);
      setTeamProductivity(productivityResponse.data);

      const teamMemberIds = productivityResponse.data.productivity.map((m) => m.user_id);

      let teamTasks = allTasks.filter((task) => teamMemberIds.includes(task.user_id));

      // Filtros adicionais
      if (filters.user_id) {
        teamTasks = teamTasks.filter((task) => task.user_id === parseInt(filters.user_id));
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
        teamTasks = teamTasks.filter(
          (task) =>
            task.categoria &&
            task.categoria.toLowerCase().includes(filters.category.toLowerCase())
        );
      }
      if (filters.start_date) {
        teamTasks = teamTasks.filter(
          (task) => new Date(task.created_at) >= new Date(filters.start_date)
        );
      }
      if (filters.end_date) {
        teamTasks = teamTasks.filter(
          (task) => new Date(task.created_at) <= new Date(filters.end_date)
        );
      }

      // Toggle Ativas/Todas
      if (showOnlyActive) {
        teamTasks = teamTasks.filter((task) => task.status !== "archived");
      }

      // 🔹 guarda o conjunto visível para cálculo de produtividade no front
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

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

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
    if (!reportData || !teamProductivity) {
      toast.error("Nenhum dado disponível para exportar");
      return;
    }
    try {
      exportToPDF(reportData, teamProductivity.team_name);
      toast.success("Relatório PDF exportado com sucesso!");
    } catch (error) {
      console.error("Erro ao exportar PDF:", error);
      toast.error("Erro ao exportar relatório PDF");
    }
  };

  const handleExportCSV = () => {
    if (!reportData || !teamProductivity) {
      toast.error("Nenhum dado disponível para exportar");
      return;
    }
    try {
      exportToCSV(reportData, teamProductivity.team_name);
      toast.success("Dados CSV exportados com sucesso!");
    } catch (error) {
      console.error("Erro ao exportar CSV:", error);
      toast.error("Erro ao exportar dados CSV");
    }
  };

  // Cores/labels incluindo 'archived'
  const getStatusColor = (status) => {
    const colors = {
      pending: "#f59e0b",
      in_progress: "#3b82f6",
      done: "#10b981",
      cancelled: "#ef4444",
      archived: "#6b7280",
    };
    return colors[status] || "#6b7280";
  };

  const getPriorityColor = (priority) => {
    const colors = { Alta: "#ef4444", Média: "#f59e0b", Baixa: "#10b981" };
    return colors[priority] || "#6b7280";
  };

  const getStatusLabel = (status) => {
    const labels = {
      pending: "Pendente",
      in_progress: "Em Andamento",
      done: "Concluída",
      cancelled: "Cancelada",
      archived: "Arquivada",
    };
    return labels[status] || status;
  };

  // 🔹 Nomes dos membros vindos do backend (para mostrar label bonitinho)
  const memberNameById = useMemo(() => {
    const map = new Map();
    (teamProductivity?.productivity || []).forEach((m) => {
      map.set(m.user_id, m.user_name);
    });
    return map;
  }, [teamProductivity]);

  // 🔹 Produtividade recalculada localmente (respeita filtros + toggle)
  const computedProductivity = useMemo(() => {
    const byUser = new Map();
    visibleTeamTasks.forEach((t) => {
      const uid = t.user_id;
      if (!byUser.has(uid)) {
        byUser.set(uid, { user_id: uid, total_tasks: 0, completed_tasks: 0 });
      }
      const agg = byUser.get(uid);
      agg.total_tasks += 1;
      if (t.status === "done") agg.completed_tasks += 1; // nunca conta archived como concluída
    });

    const arr = Array.from(byUser.values()).map((row) => ({
      ...row,
      user_name: memberNameById.get(row.user_id) || `Usuário #${row.user_id}`,
      completion_rate: row.total_tasks > 0 ? (row.completed_tasks / row.total_tasks) * 100 : 0,
    }));

    // ordena por completed_tasks desc só pra ficar agradável
    arr.sort((a, b) => b.completed_tasks - a.completed_tasks);
    return arr;
  }, [visibleTeamTasks, memberNameById]);

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

    const maxValue = Math.max(...Object.values(data), 1);

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
                          (teamProductivity?.productivity || []).map((member) => (
                            <option key={member.user_id} value={member.user_id}>
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
                      <select
                        value={filters.status}
                        onChange={(e) => handleFilterChange("status", e.target.value)}
                      >
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
                    <div className={styles.metricAlert}>{reportData.overdue_tasks > 0 && <Zap size={16} />}</div>
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

                {/* 🔹 PRODUTIVIDADE (recalculada localmente) */}
                {computedProductivity.length > 0 && (
                  <div className={styles.productivityCard}>
                    <div className={styles.cardHeader}>
                      <h3 className={styles.cardTitle}>
                        <Users size={20} />
                        Produtividade da Equipe: {teamProductivity?.team_name || ""}
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
                          ? Math.round(((reportData.tasks_by_status.done || 0) / reportData.total_tasks) * 100)
                          : 0}
                        %
                      </div>
                    </div>
                    <div className={styles.performanceItem}>
                      <div className={styles.performanceLabel}>Tarefas Concluídas Atrasadas</div>
                      <div className={styles.performanceValue}>{reportData.tasks_completed_late || 0}</div>
                    </div>
                    <div className={styles.performanceItem}>
                      <div className={styles.performanceLabel}>Próximas Tarefas</div>
                      <div className={styles.performanceValue}>{reportData.upcoming_tasks || 0}</div>
                    </div>
                    <div className={styles.performanceItem}>
                      <div className={styles.performanceLabel}>Produtividade Média</div>
                      <div className={styles.performanceValue}>
                        {reportData.total_tasks > 0 && reportData.average_completion_time !== "N/A" ? "Alta" : "Baixa"}
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
