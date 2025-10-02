import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import TaskTabs from "../components/TaskTabs";
import ViewModeSelector from "../components/ViewModeSelector";
import KanbanBoard from "../components/KanbanBoard";
import styles from "./TasksPage.module.css";
import api from "../services/axiosInstance";
import { FiPlus, FiClipboard } from "react-icons/fi";

function TasksPage() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("minhas");
  const [viewMode, setViewMode] = useState("status");
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const [currentUser, setCurrentUser] = useState(null);
  const [taskCounts, setTaskCounts] = useState({
    my_tasks: 0,
    team_tasks: 0,
    collaborative_tasks: 0,
  });

  // Filtrar tarefas baseado na aba ativa
  const getFilteredTasks = (allTasks, tab, user) => {
    if (!user) return allTasks;

    switch (tab) {
      case "minhas":
        return allTasks.filter(
          (task) =>
            task.user_id === user.id &&
            (task.assigned_by_user_id === null ||
              task.assigned_by_user_id === user.id)
        );
      case "equipe":
        return allTasks.filter(
          (task) =>
            (task.team_id !== null ||
              (task.assigned_by_user_id === user.id &&
                task.user_id !== user.id)) &&
            !(
              task.collaborators &&
              task.collaborators.includes(user.id) &&
              task.user_id !== user.id &&
              task.assigned_by_user_id !== user.id
            )
        );
      case "colaborativas":
        return allTasks.filter(
          (task) => task.collaborators && task.collaborators.includes(user.id)
        );
      default:
        return allTasks;
    }
  };

  const filteredTasks = getFilteredTasks(tasks, activeTab, currentUser);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const userResponse = await api.get("/users/me");
        setCurrentUser(userResponse.data);

        // ⚠️ continua sem arquivadas para o primeiro load ficar leve
        const tasksResponse = await api.get("/tasks");
        setTasks(tasksResponse.data);

        const countsResponse = await api.get("/tasks/counts");
        setTaskCounts(countsResponse.data);
      } catch (error) {
        console.error("Erro ao buscar dados:", error);
        toast.error("Erro ao buscar dados. Faça login novamente.", {
          position: "top-right",
          autoClose: 5000,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    const handleResize = () => {
      if (window.innerWidth <= 768) setSidebarOpen(false);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // preferências
  useEffect(() => localStorage.setItem("tasksActiveTab", activeTab), [activeTab]);
  useEffect(() => localStorage.setItem("tasksViewMode", viewMode), [viewMode]);
  useEffect(() => {
    const savedTab = localStorage.getItem("tasksActiveTab");
    const savedViewMode = localStorage.getItem("tasksViewMode");
    if (savedTab) setActiveTab(savedTab);
    if (savedViewMode) setViewMode(savedViewMode);
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

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  const handleTaskUpdate = (taskId, updateData) => {
    if (updateData.deleted) {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } else {
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...updateData } : t)));
    }
    api.get("/tasks/counts").then((res) => setTaskCounts(res.data));
  };

  const handleTabChange = (newTab) => setActiveTab(newTab);
  const handleViewModeChange = (newViewMode) => setViewMode(newViewMode);

  if (loading) {
    return (
      <div className={styles.spinnerContainer}>
        <div className={styles.spinner}></div>
      </div>
    );
  }

  return (
    <div className={styles.tasksPage}>
      <Header onMenuToggle={toggleSidebar} />

      <div className={styles.pageBody}>
        <Sidebar isOpen={sidebarOpen} onLogout={handleLogout} />

        <main className={styles.contentArea}>
          <div className={styles.tasksWrapper}>
            <div className={styles.pageHeader}>
              <div className={styles.headerContent}>
                <h1 className={styles.pageTitle}>Minhas Tarefas</h1>
                <button
                  className={styles.addTaskBtn}
                  onClick={() => navigate("/tasks/new")}
                >
                  <FiPlus />
                  Nova Tarefa
                </button>
              </div>

              <div className={styles.breadcrumb}>
                <span>Dashboard</span>
                <span className={styles.separator}>›</span>
                <span className={styles.current}>Tarefas</span>
              </div>
            </div>

            <TaskTabs
              activeTab={activeTab}
              onTabChange={handleTabChange}
              taskCounts={taskCounts}
            />

            <ViewModeSelector
              viewMode={viewMode}
              onViewModeChange={handleViewModeChange}
            />

            <div className={styles.kanbanContainer}>
              {filteredTasks.length === 0 ? (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>
                    <FiClipboard />
                  </div>
                  <h3 className={styles.emptyTitle}>Nenhuma tarefa encontrada</h3>
                  <p className={styles.emptyDescription}>
                    {activeTab === "minhas" && "Você ainda não criou nenhuma tarefa."}
                    {activeTab === "equipe" && "Não há tarefas atribuídas à sua equipe."}
                    {activeTab === "colaborativas" && "Você não está colaborando em nenhuma tarefa."}
                  </p>
                  <button
                    className={styles.emptyAction}
                    onClick={() => navigate("/tasks/new")}
                  >
                    <FiPlus />
                    Criar primeira tarefa
                  </button>
                </div>
              ) : (
                <KanbanBoard
                  tasks={filteredTasks}
                  onTaskUpdate={handleTaskUpdate}
                  viewMode={viewMode}
                  activeTab={activeTab}
                  currentUser={currentUser}
                />
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default TasksPage;
