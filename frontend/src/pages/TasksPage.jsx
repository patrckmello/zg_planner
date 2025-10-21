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

  // ===== helpers =====
  const excludeDone = (list = []) => list.filter((t) => t?.status !== "done");

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
    return new Set(raw.map((t) => t.team_id ?? t.id));
  };

  // assigned_users pode conter o dono; tratamos abaixo
  const isInAssignedUsers = (t, me) =>
    Array.isArray(t?.assigned_users) &&
    t.assigned_users.includes(me?.id) &&
    !(t.user_id === me?.id && t.assigned_users.length === 1); // se for o único, é pessoal

  const wasAssignedToMeByOthers = (t, me) =>
    t?.user_id === me?.id &&
    t?.assigned_by_user_id != null &&
    t?.assigned_by_user_id !== me?.id;

  const isPersonalMine = (t, me) =>
    t?.user_id === me?.id &&
    (t?.assigned_by_user_id == null || t?.assigned_by_user_id === me?.id);

  // ===== contadores (ignora 'done' e não mistura pessoais na aba equipe) =====
  const computeCounts = (allTasks, user) => {
    if (!user) return { my_tasks: 0, team_tasks: 0, collaborative_tasks: 0 };

    const tasksNoDone = excludeDone(allTasks);
    const userTeamIds = getUserTeamIds(user);
    const mgr = isManager(user);

    const isMyTask = (t) =>
      t.user_id === user.id &&
      (t.assigned_by_user_id === null || t.assigned_by_user_id === user.id);

    const iAssignedToOthers = (t) =>
      mgr && t.assigned_by_user_id === user.id && t.user_id !== user.id;

    const inMyTeam = (t) =>
      t.team_id == null || userTeamIds.size === 0 || userTeamIds.has(t.team_id);

    let myTasks = 0;
    let teamTasks = 0;
    let collabTasks = 0;

    for (const t of tasksNoDone) {
      const personal = isPersonalMine(t, user);

      // "Minhas": só pessoais
      if (isMyTask(t)) myTasks += 1;

      // "Equipe": não conta pessoais
      const teamHit =
        inMyTeam(t) &&
        !personal &&
        (isInAssignedUsers(t, user) ||
          wasAssignedToMeByOthers(t, user) ||
          iAssignedToOthers(t));
      if (teamHit) teamTasks += 1;

      // "Colaborativas": seguem por collaborators, sem duplicar pessoais/equipe
      const collabOnly =
        Array.isArray(t.collaborators) &&
        t.collaborators.includes(user.id) &&
        !isMyTask(t) &&
        !isInAssignedUsers(t, user);
      if (collabOnly) collabTasks += 1;
    }

    return {
      my_tasks: myTasks,
      team_tasks: teamTasks,
      collaborative_tasks: collabTasks,
    };
  };

  // ===== listagem por aba =====
  const getFilteredTasks = (allTasks, tab, user) => {
    if (!user) return allTasks;

    switch (tab) {
      case "minhas":
        // Apenas pessoais (não inclui multi-atribuição onde o dono é um dos assigned_users)
        return allTasks.filter(
          (t) =>
            t.user_id === user.id &&
            (t.assigned_by_user_id === null || t.assigned_by_user_id === user.id)
        );

      case "equipe": {
        const mgr = isManager(user);
        const userTeamIds = getUserTeamIds(user);

        return allTasks.filter((task) => {
          const multiAssignedIncludesMe = isInAssignedUsers(task, user);
          const assignedToMeByOthers = wasAssignedToMeByOthers(task, user);
          const iAssignedToOthers =
            mgr && task.assigned_by_user_id === user.id && task.user_id !== user.id;

          const inMyTeam =
            task.team_id == null ||
            userTeamIds.size === 0 ||
            userTeamIds.has(task.team_id);

          const personal = isPersonalMine(task, user);

          return (
            inMyTeam &&
            !personal &&
            (multiAssignedIncludesMe || assignedToMeByOthers || iAssignedToOthers)
          );
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

        // contadores sem 'done'
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
                    {activeTab === "colaborativas" &&
                      "Você não está colaborando em nenhuma tarefa."}
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
