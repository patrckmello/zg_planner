import React, { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import api from "../services/axiosInstance";
import styles from "./ReportsPage.module.css";
import { exportToCSV, exportToPDF } from "../utils/exportUtils";
import {
  BarChart2,
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
  Tag,
  Search,
} from "lucide-react";

// Normalização de prioridade
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

// Debounce genérico
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
};

function ReportsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const [reportData, setReportData] = useState(null);
  const [allTasks, setAllTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [currentView, setCurrentView] = useState("status");
  const [filters, setFilters] = useState({
    start_date: "",
    end_date: "",
    status: "",
    priority: "",
    category: "",
  });
  const [showArchived, setShowArchived] = useState(false); // ⬅️ toggle

  const debouncedCategory = useDebounce(filters.category, 500);

  const getBrasiliaDate = (isoDate) => {
    if (!isoDate) return null;
    const date = new Date(isoDate);
    return new Date(date.getTime() - 3 * 60 * 60 * 1000);
  };

  const getTaskStatus = (task) => {
    const now = new Date();
    const dueDate = getBrasiliaDate(task.due_date);
    if (task.status === "done") return { text: "Concluída", color: "#10b981" };
    if (dueDate && dueDate < now) return { text: "Atrasada", color: "#ef4444" };
    return { text: "Pendente", color: "#f59e0b" };
  };

  const calculateMetrics = (tasks) => {
    if (!tasks || tasks.length === 0) {
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
      total_tasks: tasks.length,
      tasks_by_status: {},
      tasks_by_priority: {},
      tasks_by_category: {},
      tasks_completed_on_time: 0,
      tasks_completed_late: 0,
      overdue_tasks: 0,
      upcoming_tasks: 0,
    };

    let totalCompletionTime = 0;
    let completedTasksWithTime = 0;
    const now = new Date();

    tasks.forEach((task) => {
      metrics.tasks_by_status[task.status] = (metrics.tasks_by_status[task.status] || 0) + 1;

      if (task.prioridade) {
        const normalizedPriority = normalizePriority(task.prioridade);
        metrics.tasks_by_priority[normalizedPriority] =
          (metrics.tasks_by_priority[normalizedPriority] || 0) + 1;
      }

      if (task.categoria) {
        metrics.tasks_by_category[task.categoria] =
          (metrics.tasks_by_category[task.categoria] || 0) + 1;
      }

      const dueDate = task.due_date ? getBrasiliaDate(task.due_date) : null;
      const createdAt = task.created_at ? getBrasiliaDate(task.created_at) : null;
      const completionAt = task.completed_at
        ? getBrasiliaDate(task.completed_at)
        : task.status === "done"
        ? getBrasiliaDate(task.updated_at)
        : null;
      const now = new Date();

      if (!completionAt && task.status !== "archived" && dueDate) {
        if (dueDate < now) metrics.overdue_tasks += 1;
        else metrics.upcoming_tasks += 1;
      }

      if (completionAt && dueDate) {
        if (completionAt <= dueDate) metrics.tasks_completed_on_time += 1;
        else metrics.tasks_completed_late += 1;
      }

      if (completionAt && createdAt) {
        const completionTime = Math.ceil((completionAt - createdAt) / (1000 * 60 * 60 * 24));
        totalCompletionTime += completionTime;
        completedTasksWithTime += 1;
      }
    });

    metrics.average_completion_time =
      completedTasksWithTime > 0
        ? `${Math.round(totalCompletionTime / completedTasksWithTime)} dias`
        : "N/A";

    return metrics;
  };

  const fetchAllTasks = useCallback(async (includeArchived) => {
    try {
      setLoading(true);
      const userResponse = await api.get("/users/me");
      const userId = userResponse.data.id;
      if (!userId) throw new Error("Usuário não encontrado");

      const tasksResponse = await api.get("/tasks", {
        params: includeArchived ? { include_archived: true } : {}
      });
      const allTasksData = tasksResponse.data;

      const myTasks = allTasksData.filter(
        (task) =>
          task.assigned_users?.includes(userId) ||
          task.collaborators?.includes(userId) ||
          task.user_id === userId
      );

      setAllTasks(myTasks);
    } catch (error) {
      console.error("Erro ao buscar tarefas:", error);
      toast.error("Erro ao carregar tarefas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllTasks(showArchived);
  }, [fetchAllTasks, showArchived]);

  // ⬅️ Corrigido: filtra com showArchived e sem variável inexistente
  useEffect(() => {
    let filteredTasks = allTasks;

    if (filters.start_date) {
      filteredTasks = filteredTasks.filter(
        (task) => new Date(task.created_at) >= new Date(filters.start_date)
      );
    }

    if (filters.end_date) {
      filteredTasks = filteredTasks.filter(
        (task) => new Date(task.created_at) <= new Date(filters.end_date)
      );
    }

    if (filters.status) {
      filteredTasks = filteredTasks.filter((task) => task.status === filters.status);
    }

    if (filters.priority) {
      filteredTasks = filteredTasks.filter(
        (task) => normalizePriority(task.prioridade) === filters.priority
      );
    }

    if (debouncedCategory) {
      filteredTasks = filteredTasks.filter(
        (task) =>
          task.categoria &&
          task.categoria.toLowerCase().includes(debouncedCategory.toLowerCase())
      );
    }

    // ⬅️ Se NÃO mostrar arquivadas, remove status=archived
    if (!showArchived) {
      filteredTasks = filteredTasks.filter((task) => task.status !== "archived");
    }

    const calculated = calculateMetrics(filteredTasks);
    setReportData(calculated);
  }, [allTasks, filters, debouncedCategory, showArchived]); // ⬅️ showArchived adicionado

  const handleFilterChange = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  const clearFilters = () => {
    setFilters({ start_date: "", end_date: "", status: "", priority: "", category: "" });
  };

  const handleLogout = async () => {
    try {
      await api.post("/logout");
    } catch (err) {
      console.error("Erro ao fazer logout:", err);
    } finally {
      localStorage.removeItem("auth");
      window.location.href = "/login";
    }
  };

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  const handleExportPDF = async () => {
    if (!reportData) return;
    try {
      await exportToPDF(reportData, filters);
      toast.success("Relatório PDF exportado com sucesso!");
    } catch (error) {
      console.error("Erro ao exportar PDF:", error);
      toast.error("Erro ao exportar relatório PDF");
    }
  };

  const handleExportCSV = () => {
    if (!reportData) return;
    try {
      exportToCSV(reportData, filters);
      toast.success("Dados CSV exportados com sucesso!");
    } catch (error) {
      console.error("Erro ao exportar CSV:", error);
      toast.error("Erro ao exportar dados CSV");
    }
  };

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
                      width: `${(value / maxValue) * 100}%`,
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

  if (loading) {
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

  return (
    <div className={styles.reportsPage}>
      <Header onMenuToggle={toggleSidebar} />
      <div className={styles.pageBody}>
        <Sidebar isOpen={sidebarOpen} onLogout={handleLogout} />
        <main className={styles.contentArea}>
          <div className={styles.reportsWrapper}>
            <div className={styles.pageHeader}>
              <div className={styles.headerContent}>
                <h1 className={styles.pageTitle}>Relatórios Pessoais</h1>
              </div>
              <div className={styles.breadcrumb}>
                <span>Minhas Atividades</span>
                <span className={styles.separator}>›</span>
                <span className={styles.current}>Relatórios Pessoais</span>
              </div>
            </div>

            {/* Export + Toggle arquivadas */}
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
              <button
                onClick={() => setShowArchived(!showArchived)}
                className={`${styles.exportBtn} ${styles.toggleArchived}`}
              >
                {showArchived ? "Mostrar Apenas Ativas" : "Mostrar Todas"}
              </button>
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
                      <label>
                        <Calendar />
                        Data Inicial
                      </label>
                      <input
                        type="date"
                        value={filters.start_date}
                        onChange={(e) => handleFilterChange("start_date", e.target.value)}
                        className={styles.dateInput}
                      />
                    </div>
                    <div className={styles.filterGroup}>
                      <label>
                        <Calendar />
                        Data Final
                      </label>
                      <input
                        type="date"
                        value={filters.end_date}
                        onChange={(e) => handleFilterChange("end_date", e.target.value)}
                        className={styles.dateInput}
                      />
                    </div>
                    <div className={styles.filterGroup}>
                      <label>
                        <Tag />
                        Status
                      </label>
                      <select
                        value={filters.status}
                        onChange={(e) => handleFilterChange("status", e.target.value)}
                      >
                        <option value="">Todos os Status</option>
                        <option value="pending">Pendente</option>
                        <option value="in_progress">Em Andamento</option>
                        <option value="done">Concluída</option>
                        <option value="cancelled">Cancelada</option>
                        <option value="archived">Arquivada</option>
                      </select>
                    </div>
                    <div className={styles.filterGroup}>
                      <label>
                        <AlertTriangle />
                        Prioridade
                      </label>
                      <select
                        value={filters.priority}
                        onChange={(e) => handleFilterChange("priority", e.target.value)}
                      >
                        <option value="">Todas as Prioridades</option>
                        <option value="Alta">Alta</option>
                        <option value="Média">Média</option>
                        <option value="Baixa">Baixa</option>
                      </select>
                    </div>
                    <div className={styles.filterGroup}>
                      <label>
                        <Search />
                        Categoria
                      </label>
                      <input
                        type="text"
                        placeholder="Digite a categoria..."
                        value={filters.category}
                        onChange={(e) => handleFilterChange("category", e.target.value)}
                        className={styles.searchInput}
                      />
                      {filters.category && (
                        <small className={styles.debounceHint}>
                          Pesquisando por "{debouncedCategory}"...
                        </small>
                      )}
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
                      <h3>{reportData.tasks_completed_on_time || 0}</h3>
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
                      <h3>{reportData.overdue_tasks || 0}</h3>
                      <p>Tarefas Atrasadas</p>
                    </div>
                    <div className={styles.metricAlert}>
                      {(reportData.overdue_tasks || 0) > 0 && <Activity size={16} />}
                    </div>
                  </div>

                  <div className={styles.metricCard}>
                    <div className={styles.metricIcon} style={{ backgroundColor: "#f59e0b" }}>
                      <Clock size={24} />
                    </div>
                    <div className={styles.metricContent}>
                      <h3>{reportData.average_completion_time || "N/A"}</h3>
                      <p>Tempo Médio</p>
                    </div>
                    <div className={styles.metricInfo}>
                      <Calendar size={16} />
                    </div>
                  </div>
                </div>

                {renderChart()}

                <div className={styles.performanceCard}>
                  <div className={styles.cardHeader}>
                    <h3 className={styles.cardTitle}>
                      <BarChart2 size={20} />
                      Resumo de Performance
                    </h3>
                  </div>
                  <div className={styles.performanceGrid}>
                    <div className={styles.performanceItem}>
                      <div className={styles.performanceLabel}>Taxa de Conclusão</div>
                      <div className={styles.performanceValue}>
                        {reportData.total_tasks > 0
                          ? Math.round(
                              ((reportData.tasks_by_status?.done || 0) / reportData.total_tasks) * 100
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
                      <div className={styles.performanceLabel}>Produtividade</div>
                      <div className={styles.performanceValue}>
                        {reportData.total_tasks > 0 && reportData.average_completion_time !== "N/A"
                          ? "Alta"
                          : "Baixa"}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className={styles.emptyState}>
                <BarChart2 size={64} />
                <h3>Nenhum Dado Disponível</h3>
                <p>Não há dados suficientes para gerar o relatório no período selecionado.</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default ReportsPage;
