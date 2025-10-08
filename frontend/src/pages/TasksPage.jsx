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

  // -------- helpers usados na aba "equipe" e nos counters --------
  const isManager = (user) => {
    if (!user) return false;
    const byAdminFlag = !!user.is_admin;

    const byRole =
      Array.isArray(user.roles) &&
      user.roles.some((r) =>
        ["manager", "gestor", "admin", "administrador"].includes(
          (r?.name ?? r)?.toString()?.toLowerCase()
        )
      );

    const byTeamMgr =
      Array.isArray(user.user_teams) &&
      user.user_teams.some((ut) => ut?.is_manager);

    return byAdminFlag || byRole || byTeamMgr;
  };

  const getUserTeamIds = (user) => {
    const raw = user?.teams ?? user?.user_teams ?? [];
    // suporta payloads [{id,...}] ou [{team_id,...}]
    return new Set(raw.map((t) => t.team_id ?? t.id));
  };

  const computeCounts = (allTasks, user) => {
    if (!user) return { my_tasks: 0, team_tasks: 0, collaborative_tasks: 0 };

    const userTeamIds = getUserTeamIds(user);
    const mgr = isManager(user);

    const isMyTask = (t) =>
      t.user_id === user.id &&
      (t.assigned_by_user_id === null || t.assigned_by_user_id === user.id);

    const assignedToMeByOthers = (t) =>
      t.user_id === user.id &&
      t.assigned_by_user_id != null &&
      t.assigned_by_user_id !== user.id;

    const multiAssignedIncludesMe = (t) =>
      Array.isArray(t.collaborators) &&
      t.collaborators.includes(user.id) &&
      (t.collaborators.length > 1 || t.user_id !== user.id);

    const iAssignedToOthers = (t) =>
      mgr && t.assigned_by_user_id === user.id && t.user_id !== user.id;

    const inMyTeam = (t) =>
      t.team_id == null || userTeamIds.size === 0 || userTeamIds.has(t.team_id);

    let myTasks = 0;
    let teamTasks = 0;
    let collabTasks = 0;

    for (const t of allTasks) {
      if (isMyTask(t)) myTasks += 1;

      if (
        inMyTeam(t) &&
        (assignedToMeByOthers(t) || multiAssignedIncludesMe(t) || iAssignedToOthers(t))
      ) {
        teamTasks += 1;
      }

      if (multiAssignedIncludesMe(t)) collabTasks += 1;
    }

    return {
      my_tasks: myTasks,
      team_tasks: teamTasks,
      collaborative_tasks: collabTasks,
    };
  };
  // ---------------------------------------------------------------

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

      case "equipe": {
        const mgr = isManager(user);
        const userTeamIds = getUserTeamIds(user);

        return allTasks.filter((task) => {
          // 1) atribuíram PARA MIM (por outra pessoa)
          const assignedToMeByOthers =
            task.user_id === user.id &&
            task.assigned_by_user_id != null &&
            task.assigned_by_user_id !== user.id;

          // 2) multi-atribuídas que me incluem
          const multiAssignedIncludesMe =
            Array.isArray(task.collaborators) &&
            task.collaborators.includes(user.id) &&
            (task.collaborators.length > 1 || task.user_id !== user.id);

          // 3) (somente gestor) tarefas QUE EU ATRIBUÍ para outra pessoa, p/ acompanhamento
          const iAssignedToOthers =
            mgr && task.assigned_by_user_id === user.id && task.user_id !== user.id;

          // (opcional): restringe à(s) minha(s) equipe(s) quando houver team_id
          const inMyTeam =
            task.team_id == null ||
            userTeamIds.size === 0 ||
            userTeamIds.has(task.team_id);

          return inMyTeam && (assignedToMeByOthers || multiAssignedIncludesMe || iAssignedToOthers);
        });
      }

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
        const me = userResponse.data;
        setCurrentUser(me);

        // ⚠️ sem arquivadas para o primeiro load ficar leve
        const tasksResponse = await api.get("/tasks");
        const all = tasksResponse.data;
        setTasks(all);

        // Counter garantido com a mesma regra da UI:
        setTaskCounts(computeCounts(all, me));
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
    setTasks((prev) => {
      let next;
      if (updateData.deleted) {
        next = prev.filter((t) => t.id !== taskId);
      } else {
        next = prev.map((t) => (t.id === taskId ? { ...t, ...updateData } : t));
      }
      if (currentUser) {
        setTaskCounts(computeCounts(next, currentUser));
      }
      return next;
    });
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
