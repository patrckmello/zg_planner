import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import api from "../services/axiosInstance";
import styles from "./ReportsPage.module.css";
import {
  BarChart2,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertTriangle,
  Calendar,
  Filter,
  Download,
  PieChart,
  Activity,
  Target,
} from "lucide-react";

function ReportsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
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

  const exportReport = () => {
    if (!reportData) return;

    const dataStr = JSON.stringify(reportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio-pessoal-${
      new Date().toISOString().split("T")[0]
    }.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: "#f39c12",
      in_progress: "#3498db",
      done: "#27ae60",
      cancelled: "#e74c3c",
    };
    return colors[status] || "#95a5a6";
  };

  const getPriorityColor = (priority) => {
    const colors = {
      Alta: "#e74c3c",
      Média: "#f39c12",
      Baixa: "#27ae60",
    };
    return colors[priority] || "#95a5a6";
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
            <div className={styles.pageHeader}>
              <div className={styles.titleSection}>
                <BarChart2 size={32} className={styles.pageIcon} />
                <div>
                  <h1>Relatórios Pessoais</h1>
                  <p>Análise detalhada do seu desempenho e produtividade</p>
                </div>
              </div>
              <button
                onClick={exportReport}
                className={styles.exportBtn}
                disabled={!reportData}
              >
                <Download size={18} />
                Exportar
              </button>
            </div>

            {/* Filtros */}
            <div className={styles.filtersCard}>
              <div className={styles.filtersHeader}>
                <Filter size={20} />
                <span>Filtros</span>
              </div>
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
            </div>

            {reportData && (
              <>
                {/* Cards de Métricas Principais */}
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
                      style={{ backgroundColor: "#27ae60" }}
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
                      style={{ backgroundColor: "#e74c3c" }}
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
                      style={{ backgroundColor: "#f39c12" }}
                    >
                      <Clock size={24} />
                    </div>
                    <div className={styles.metricContent}>
                      <h3>{reportData.average_completion_time}</h3>
                      <p>Tempo Médio</p>
                    </div>
                  </div>
                </div>

                {/* Gráficos e Análises */}
                <div className={styles.chartsGrid}>
                  {/* Status das Tarefas */}
                  <div className={styles.chartCard}>
                    <div className={styles.chartHeader}>
                      <PieChart size={20} />
                      <h3>Distribuição por Status</h3>
                    </div>
                    <div className={styles.statusChart}>
                      {Object.entries(reportData.tasks_by_status).map(
                        ([status, count]) => (
                          <div key={status} className={styles.statusItem}>
                            <div
                              className={styles.statusIndicator}
                              style={{
                                backgroundColor: getStatusColor(status),
                              }}
                            ></div>
                            <span className={styles.statusLabel}>
                              {status === "pending"
                                ? "Pendente"
                                : status === "in_progress"
                                ? "Em Andamento"
                                : status === "done"
                                ? "Concluída"
                                : status === "cancelled"
                                ? "Cancelada"
                                : status}
                            </span>
                            <span className={styles.statusCount}>{count}</span>
                          </div>
                        )
                      )}
                    </div>
                  </div>

                  {/* Prioridades */}
                  <div className={styles.chartCard}>
                    <div className={styles.chartHeader}>
                      <TrendingUp size={20} />
                      <h3>Distribuição por Prioridade</h3>
                    </div>
                    <div className={styles.priorityChart}>
                      {Object.entries(reportData.tasks_by_priority).map(
                        ([priority, count]) => (
                          <div key={priority} className={styles.priorityItem}>
                            <div
                              className={styles.priorityIndicator}
                              style={{
                                backgroundColor: getPriorityColor(priority),
                              }}
                            ></div>
                            <span className={styles.priorityLabel}>
                              {priority}
                            </span>
                            <span className={styles.priorityCount}>
                              {count}
                            </span>
                          </div>
                        )
                      )}
                    </div>
                  </div>

                  {/* Categorias */}
                  <div className={styles.chartCard}>
                    <div className={styles.chartHeader}>
                      <Activity size={20} />
                      <h3>Distribuição por Categoria</h3>
                    </div>
                    <div className={styles.categoryChart}>
                      {Object.entries(reportData.tasks_by_category).map(
                        ([category, count]) => (
                          <div key={category} className={styles.categoryItem}>
                            <span className={styles.categoryLabel}>
                              {category}
                            </span>
                            <div className={styles.categoryBar}>
                              <div
                                className={styles.categoryFill}
                                style={{
                                  width: `${
                                    (count /
                                      Math.max(
                                        ...Object.values(
                                          reportData.tasks_by_category
                                        )
                                      )) *
                                    100
                                  }%`,
                                }}
                              ></div>
                            </div>
                            <span className={styles.categoryCount}>
                              {count}
                            </span>
                          </div>
                        )
                      )}
                    </div>
                  </div>

                  {/* Resumo de Performance */}
                  <div className={styles.chartCard}>
                    <div className={styles.chartHeader}>
                      <Calendar size={20} />
                      <h3>Resumo de Performance</h3>
                    </div>
                    <div className={styles.performanceStats}>
                      <div className={styles.performanceStat}>
                        <span className={styles.performanceLabel}>
                          Taxa de Conclusão
                        </span>
                        <span className={styles.performanceValue}>
                          {reportData.total_tasks > 0
                            ? Math.round(
                                ((reportData.tasks_by_status.done || 0) /
                                  reportData.total_tasks) *
                                  100
                              )
                            : 0}
                          %
                        </span>
                      </div>
                      <div className={styles.performanceStat}>
                        <span className={styles.performanceLabel}>
                          Tarefas Atrasadas
                        </span>
                        <span className={styles.performanceValue}>
                          {reportData.tasks_completed_late}
                        </span>
                      </div>
                      <div className={styles.performanceStat}>
                        <span className={styles.performanceLabel}>
                          Próximas Tarefas
                        </span>
                        <span className={styles.performanceValue}>
                          {reportData.upcoming_tasks}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default ReportsPage;
