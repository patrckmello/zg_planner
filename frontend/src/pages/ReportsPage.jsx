import React, { useState, useEffect } from "react";
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
} from "lucide-react";

function ReportsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [currentView, setCurrentView] = useState("status"); // status, priority, category
  const [filters, setFilters] = useState({
    start_date: "",
    end_date: "",
    status: "",
    priority: "",
    category: "",
  });

  const fetchReportData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();

      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });

      const response = await api.get(`/tasks/reports?${params.toString()}`);
      setReportData(response.data);
    } catch (error) {
      console.error("Erro ao buscar dados do relatório:", error);
      toast.error("Erro ao carregar relatório");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, []);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const applyFilters = () => {
    fetchReportData();
  };

  const clearFilters = () => {
    setFilters({
      start_date: "",
      end_date: "",
      status: "",
      priority: "",
      category: "",
    });
    setTimeout(() => {
      fetchReportData();
    }, 100);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    window.location.href = "/login";
  };

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
    };
    return colors[status] || "#6b7280";
  };

  const getPriorityColor = (priority) => {
    const colors = {
      Alta: "#ef4444",
      Média: "#f59e0b",
      Baixa: "#10b981",
    };
    return colors[priority] || "#6b7280";
  };

  const getStatusLabel = (status) => {
    const labels = {
      pending: "Pendente",
      in_progress: "Em Andamento",
      done: "Concluída",
      cancelled: "Cancelada",
    };
    return labels[status] || status;
  };

  const renderChart = () => {
    if (!reportData) return null;

    let data = {};
    let title = "";
    let getColor = () => "#1a73e8";

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

    const maxValue = Math.max(...Object.values(data));

    return (
      <div className={styles.chartSection}>
        <div className={styles.chartHeader}>
          <div className={styles.chartTitle}>
            <BarChart2 size={20} />
            {title}
          </div>
          <div className={styles.chartToggle}>
            <button
              className={`${styles.toggleBtn} ${
                currentView === "status" ? styles.active : ""
              }`}
              onClick={() => setCurrentView("status")}
            >
              Status
            </button>
            <button
              className={`${styles.toggleBtn} ${
                currentView === "priority" ? styles.active : ""
              }`}
              onClick={() => setCurrentView("priority")}
            >
              Prioridade
            </button>
            <button
              className={`${styles.toggleBtn} ${
                currentView === "category" ? styles.active : ""
              }`}
              onClick={() => setCurrentView("category")}
            >
              Categoria
            </button>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {Object.entries(data).map(([key, value]) => (
            <div
              key={key}
              style={{ display: "flex", alignItems: "center", gap: "1rem" }}
            >
              <div
                style={{
                  minWidth: "120px",
                  fontSize: "0.9rem",
                  color: "#374151",
                }}
              >
                {currentView === "status" ? getStatusLabel(key) : key}
              </div>
              <div
                style={{
                  flex: 1,
                  height: "8px",
                  background: "#f3f4f6",
                  borderRadius: "4px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${maxValue > 0 ? (value / maxValue) * 100 : 0}%`,
                    height: "100%",
                    background: getColor(key),
                    borderRadius: "4px",
                    transition: "width 0.6s ease",
                  }}
                />
              </div>
              <div
                style={{
                  minWidth: "30px",
                  textAlign: "right",
                  fontSize: "0.9rem",
                  fontWeight: "600",
                  color: "#1a73e8",
                }}
              >
                {value}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <Header onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
        <div className={styles.content}>
          <Sidebar isOpen={sidebarOpen} onLogout={handleLogout} />
          <main className={styles.main}>
            <div className={styles.reportsWrapper}>
              <div className={styles.loadingContainer}>
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
    <div className={styles.container}>
      <Header onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <div className={styles.content}>
        <Sidebar isOpen={sidebarOpen} onLogout={handleLogout} />
        <main className={styles.main}>
          <div className={styles.reportsWrapper}>
            {/* Header da Página */}
            <div className={styles.pageHeader}>
              <div className={styles.titleSection}>
                <BarChart2 size={32} className={styles.pageIcon} />
                <div>
                  <h1>Relatórios</h1>
                  <p>Análise do seu desempenho e produtividade</p>
                </div>
              </div>
              <div className={styles.exportButtons}>
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
              </div>
            </div>

            {/* Filtros Colapsáveis */}
            <div className={styles.filtersCard}>
              <div
                className={styles.filtersHeader}
                onClick={() => setFiltersVisible(!filtersVisible)}
              >
                <Filter size={20} />
                <span>Filtros</span>
                {filtersVisible ? (
                  <ChevronUp size={20} />
                ) : (
                  <ChevronDown size={20} />
                )}
              </div>

              {filtersVisible && (
                <>
                  <div className={styles.filtersGrid}>
                    <div className={styles.filterGroup}>
                      <label>Data Inicial</label>
                      <input
                        type="date"
                        value={filters.start_date}
                        onChange={(e) =>
                          handleFilterChange("start_date", e.target.value)
                        }
                      />
                    </div>
                    <div className={styles.filterGroup}>
                      <label>Data Final</label>
                      <input
                        type="date"
                        value={filters.end_date}
                        onChange={(e) =>
                          handleFilterChange("end_date", e.target.value)
                        }
                      />
                    </div>
                    <div className={styles.filterGroup}>
                      <label>Status</label>
                      <select
                        value={filters.status}
                        onChange={(e) =>
                          handleFilterChange("status", e.target.value)
                        }
                      >
                        <option value="">Todos</option>
                        <option value="pending">Pendente</option>
                        <option value="in_progress">Em Andamento</option>
                        <option value="done">Concluída</option>
                        <option value="cancelled">Cancelada</option>
                      </select>
                    </div>
                    <div className={styles.filterGroup}>
                      <label>Prioridade</label>
                      <select
                        value={filters.priority}
                        onChange={(e) =>
                          handleFilterChange("priority", e.target.value)
                        }
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
                        onChange={(e) =>
                          handleFilterChange("category", e.target.value)
                        }
                      />
                    </div>
                  </div>
                  <div className={styles.filtersActions}>
                    <button onClick={applyFilters} className={styles.applyBtn}>
                      Aplicar Filtros
                    </button>
                    <button onClick={clearFilters} className={styles.clearBtn}>
                      Limpar
                    </button>
                  </div>
                </>
              )}
            </div>

            {reportData ? (
              <>
                {/* Métricas Principais */}
                <div className={styles.metricsGrid}>
                  <div className={styles.metricCard}>
                    <div className={styles.metricIcon}>
                      <Target size={24} />
                    </div>
                    <div className={styles.metricContent}>
                      <h3>{reportData.total_tasks}</h3>
                      <p>Total de Tarefas</p>
                    </div>
                  </div>

                  <div className={styles.metricCard}>
                    <div
                      className={styles.metricIcon}
                      style={{ backgroundColor: "#10b981" }}
                    >
                      <CheckCircle size={24} />
                    </div>
                    <div className={styles.metricContent}>
                      <h3>{reportData.tasks_completed_on_time}</h3>
                      <p>Concluídas no Prazo</p>
                    </div>
                  </div>

                  <div className={styles.metricCard}>
                    <div
                      className={styles.metricIcon}
                      style={{ backgroundColor: "#ef4444" }}
                    >
                      <AlertTriangle size={24} />
                    </div>
                    <div className={styles.metricContent}>
                      <h3>{reportData.overdue_tasks}</h3>
                      <p>Tarefas Atrasadas</p>
                    </div>
                  </div>

                  <div className={styles.metricCard}>
                    <div
                      className={styles.metricIcon}
                      style={{ backgroundColor: "#f59e0b" }}
                    >
                      <Clock size={24} />
                    </div>
                    <div className={styles.metricContent}>
                      <h3>{reportData.average_completion_time}</h3>
                      <p>Tempo Médio</p>
                    </div>
                  </div>
                </div>

                {/* Gráfico Principal */}
                {renderChart()}

                {/* Resumo de Performance */}
                <div className={styles.dataTable}>
                  <div className={styles.tableHeader}>
                    <h3 className={styles.tableTitle}>Resumo de Performance</h3>
                  </div>
                  <table className={styles.table}>
                    <tbody>
                      <tr>
                        <td>
                          <strong>Taxa de Conclusão</strong>
                        </td>
                        <td>
                          {reportData.total_tasks > 0
                            ? Math.round(
                                ((reportData.tasks_by_status.done || 0) /
                                  reportData.total_tasks) *
                                  100
                              )
                            : 0}
                          %
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <strong>Tarefas Concluídas Atrasadas</strong>
                        </td>
                        <td>{reportData.tasks_completed_late || 0}</td>
                      </tr>
                      <tr>
                        <td>
                          <strong>Próximas Tarefas</strong>
                        </td>
                        <td>{reportData.upcoming_tasks || 0}</td>
                      </tr>
                      <tr>
                        <td>
                          <strong>Produtividade Média</strong>
                        </td>
                        <td>
                          {reportData.total_tasks > 0 &&
                          reportData.average_completion_time
                            ? Math.round(reportData.total_tasks / 30) // Assumindo 30 dias
                            : 0}{" "}
                          tarefas/mês
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className={styles.emptyState}>
                <h3>Nenhum dado encontrado</h3>
                <p>Não há dados disponíveis para os filtros selecionados.</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default ReportsPage;
