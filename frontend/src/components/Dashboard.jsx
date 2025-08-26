import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import styles from "./Dashboard.module.css";
import api from "../services/axiosInstance";
import {
  BarChart3,
  Calendar,
  CheckCircle,
  Clock,
  AlertTriangle,
  TrendingUp,
  Target,
  Plus,
  ArrowRight,
  Activity,
  Users,
  Zap,
} from "lucide-react";

function Dashboard() {
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState(null);
  const [recentTasks, setRecentTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Buscar dados do usuário atual
        const userResponse = await api.get("/users/me");
        setCurrentUser(userResponse.data);

        // Buscar todas as tarefas
        const tasksResponse = await api.get("/tasks");
        const allTasks = tasksResponse.data;

        // Filtrar tarefas do usuário ou onde é colaborador
        const userTasks = allTasks.filter(
          (task) =>
            task.user_id === userResponse.data.id ||
            (task.collaborators || []).includes(userResponse.data.id)
        );

        const now = new Date();

        // Função para converter para horário de Brasília
        const getBrasiliaDate = (isoDate) => {
          const date = new Date(isoDate);
          return new Date(date.getTime() - 3 * 60 * 60 * 1000);
        };

        // Função unificada para status da tarefa
        const getTaskStatus = (task) => {
          if (task.status === "done")
            return { text: "Concluída", color: "#10b981" };
          if (task.due_date && getBrasiliaDate(task.due_date) < now)
            return { text: "Atrasada", color: "#ef4444" };
          return { text: "Pendente", color: "#f59e0b" };
        };

        // Métricas
        const totalTasks = userTasks.length;
        const completedTasks = userTasks.filter(
          (t) => t.status === "done"
        ).length;
        const pendingTasks = userTasks.filter(
          (t) => getTaskStatus(t).text === "Pendente"
        ).length;
        const overdueTasks = userTasks.filter(
          (t) => getTaskStatus(t).text === "Atrasada"
        ).length;

        const upcomingTasks = userTasks.filter((t) => {
          if (!t.due_date || t.status === "done") return false;
          const due = getBrasiliaDate(t.due_date);
          const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          return due >= now && due <= nextWeek;
        }).length;

        // Tarefas recentes
        const recentTasksList = userTasks
          .sort(
            (a, b) =>
              new Date(b.updated_at || b.created_at) -
              new Date(a.updated_at || a.created_at)
          )
          .slice(0, 5)
          .map((task) => ({ ...task, statusInfo: getTaskStatus(task) })); // adiciona statusInfo para usar na renderização

        const completionRate =
          totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        const statusDistribution = {
          pending: pendingTasks,
          done: completedTasks,
          overdue: overdueTasks,
        };

        setDashboardData({
          totalTasks,
          completedTasks,
          pendingTasks,
          overdueTasks,
          upcomingTasks,
          completionRate,
          statusDistribution,
        });

        setRecentTasks(recentTasksList);
      } catch (error) {
        console.error("Erro ao buscar dados do dashboard:", error);
        toast.error("Erro ao carregar dashboard. Faça login novamente.", {
          position: "top-right",
          autoClose: 5000,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();

    const handleResize = () => {
      if (window.innerWidth <= 768) setSidebarOpen(false);
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

  const getTaskStatusColor = (task) => {
    if (task.status === "done") return "#10b981";
    if (task.due_date && new Date(task.due_date) < new Date()) return "#ef4444";
    return "#f59e0b";
  };

  const getBrasiliaDate = (isoDate) => {
    const date = new Date(isoDate); // ISO UTC
    // Converte para horário local (Brasília)
    return new Date(date.getTime() - 3 * 60 * 60 * 1000);
  };

  const getTaskStatusText = (task) => {
    if (task.status === "done") return "Concluída";

    if (task.due_date) {
      const due = getBrasiliaDate(task.due_date);
      if (due < new Date()) return "Atrasada";
    }

    return "Pendente";
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Sem prazo";
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className={styles.spinnerContainer}>
        <div className={styles.spinner}></div>
      </div>
    );
  }

  return (
    <div className={styles.dashboardPage}>
      <Header onMenuToggle={toggleSidebar} />

      <div className={styles.pageBody}>
        <Sidebar isOpen={sidebarOpen} onLogout={handleLogout} />

        <main className={styles.contentArea}>
          <div className={styles.dashboardWrapper}>
            {/* Header da página */}
            <div className={styles.pageHeader}>
              <div className={styles.headerContent}>
                <h1 className={styles.pageTitle}>Dashboard</h1>
              </div>
              <div className={styles.breadcrumb}>
                <span className={styles.current}>Dashboard</span>
              </div>
            </div>

            {/* Cards de métricas principais */}
            <div className={styles.metricsGrid}>
              <div className={styles.metricCard}>
                <div
                  className={styles.metricIcon}
                  style={{ backgroundColor: "#3b82f6" }}
                >
                  <Target size={24} />
                </div>
                <div className={styles.metricContent}>
                  <h3>{dashboardData?.totalTasks || 0}</h3>
                  <p>Total de Tarefas</p>
                </div>
                <div className={styles.metricTrend}>
                  <TrendingUp size={16} />
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
                  <h3>{dashboardData?.completedTasks || 0}</h3>
                  <p>Concluídas</p>
                </div>
                <div className={styles.metricProgress}>
                  <span>{dashboardData?.completionRate || 0}%</span>
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
                  <h3>{dashboardData?.pendingTasks || 0}</h3>
                  <p>Pendentes</p>
                </div>
                <div className={styles.metricAction}>
                  <button
                    className={styles.quickActionBtn}
                    onClick={() => navigate("/tasks")}
                  >
                    Ver todas
                  </button>
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
                  <h3>{dashboardData?.overdueTasks || 0}</h3>
                  <p>Atrasadas</p>
                </div>
                <div className={styles.metricAlert}>
                  {dashboardData?.overdueTasks > 0 && <Zap size={16} />}
                </div>
              </div>
            </div>

            {/* Seção de progresso visual */}
            <div className={styles.progressSection}>
              <div className={styles.progressCard}>
                <div className={styles.progressHeader}>
                  <div className={styles.progressTitle}>
                    <Activity size={20} />
                    <span>Progresso Geral</span>
                  </div>
                  <span className={styles.progressPercentage}>
                    {dashboardData?.completionRate || 0}%
                  </span>
                </div>
                <div className={styles.progressBar}>
                  <div
                    className={styles.progressFill}
                    style={{ width: `${dashboardData?.completionRate || 0}%` }}
                  ></div>
                </div>
                <div className={styles.progressStats}>
                  <div className={styles.progressStat}>
                    <div
                      className={styles.statDot}
                      style={{ backgroundColor: "#10b981" }}
                    ></div>
                    <span>
                      Concluídas: {dashboardData?.completedTasks || 0}
                    </span>
                  </div>
                  <div className={styles.progressStat}>
                    <div
                      className={styles.statDot}
                      style={{ backgroundColor: "#f59e0b" }}
                    ></div>
                    <span>Pendentes: {dashboardData?.pendingTasks || 0}</span>
                  </div>
                  <div className={styles.progressStat}>
                    <div
                      className={styles.statDot}
                      style={{ backgroundColor: "#ef4444" }}
                    ></div>
                    <span>Atrasadas: {dashboardData?.overdueTasks || 0}</span>
                  </div>
                </div>
              </div>

              <div className={styles.upcomingCard}>
                <div className={styles.upcomingHeader}>
                  <Calendar size={20} />
                  <span>Próximos Vencimentos</span>
                </div>
                <div className={styles.upcomingContent}>
                  <div className={styles.upcomingNumber}>
                    {dashboardData?.upcomingTasks || 0}
                  </div>
                  <p>tarefas vencem nos próximos 7 dias</p>
                  <button
                    className={styles.upcomingBtn}
                    onClick={() => navigate("/tasks")}
                  >
                    Ver detalhes
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Seção de tarefas recentes e ações rápidas */}
            <div className={styles.bottomSection}>
              <div className={styles.recentTasksCard}>
                <div className={styles.cardHeader}>
                  <h3 className={styles.cardTitle}>
                    <BarChart3 size={20} />
                    Atividade Recente
                  </h3>
                  <button
                    className={styles.viewAllBtn}
                    onClick={() => navigate("/tasks")}
                  >
                    Ver todas
                    <ArrowRight size={16} />
                  </button>
                </div>
                <div className={styles.tasksList}>
                  {recentTasks.length === 0 ? (
                    <div className={styles.emptyState}>
                      <Target size={48} />
                      <p>Nenhuma tarefa encontrada</p>
                      <button
                        className={styles.createTaskBtn}
                        onClick={() => navigate("/tasks/new")}
                      >
                        <Plus size={16} />
                        Criar primeira tarefa
                      </button>
                    </div>
                  ) : (
                    recentTasks.map((task) => (
                      <div key={task.id} className={styles.taskItem}>
                        <div
                          className={styles.taskStatus}
                          style={{ backgroundColor: getTaskStatusColor(task) }}
                        ></div>
                        <div className={styles.taskContent}>
                          <h4 className={styles.taskTitle}>{task.title}</h4>
                          <div className={styles.taskMeta}>
                            <span className={styles.taskDate}>
                              {formatDate(task.due_date)}
                            </span>
                            <span
                              className={styles.taskStatusText}
                              style={{ color: getTaskStatusColor(task) }}
                            >
                              {getTaskStatusText(task)}
                            </span>
                          </div>
                        </div>
                        <button
                          className={styles.taskAction}
                          onClick={() => navigate(`/tasks/${task.id}/edit`)}
                        >
                          <ArrowRight size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className={styles.quickActionsCard}>
                <div className={styles.cardHeader}>
                  <h3 className={styles.cardTitle}>
                    <Zap size={20} />
                    Ações Rápidas
                  </h3>
                </div>
                <div className={styles.quickActions}>
                  <button
                    className={styles.quickAction}
                    onClick={() => navigate("/tasks/new")}
                  >
                    <div
                      className={styles.quickActionIcon}
                      style={{ backgroundColor: "#3b82f6" }}
                    >
                      <Plus size={20} />
                    </div>
                    <span>Nova Tarefa</span>
                  </button>
                  <button
                    className={styles.quickAction}
                    onClick={() => navigate("/tasks")}
                  >
                    <div
                      className={styles.quickActionIcon}
                      style={{ backgroundColor: "#10b981" }}
                    >
                      <BarChart3 size={20} />
                    </div>
                    <span>Ver Tarefas</span>
                  </button>
                  <button
                    className={styles.quickAction}
                    onClick={() => navigate("/reports")}
                  >
                    <div
                      className={styles.quickActionIcon}
                      style={{ backgroundColor: "#f59e0b" }}
                    >
                      <TrendingUp size={20} />
                    </div>
                    <span>Relatórios</span>
                  </button>
                  <button
                    className={styles.quickAction}
                    onClick={() => navigate("/meu-perfil")}
                  >
                    <div
                      className={styles.quickActionIcon}
                      style={{ backgroundColor: "#8b5cf6" }}
                    >
                      <Users size={20} />
                    </div>
                    <span>Meu Perfil</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default Dashboard;
