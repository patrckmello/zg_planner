import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import api from "../services/axiosInstance";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import styles from "./ConfigPage.module.css";
import {
  Settings,
  Database,
  Download,
  FileText,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  Trash2,
  RefreshCw,
  Shield,
  Activity,
  Users,
  BarChart3,
} from "lucide-react";

function ConfigPage() {
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [backups, setBackups] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [systemStats, setSystemStats] = useState(null);
  const [activeTab, setActiveTab] = useState("backup");
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchBackups(), fetchAuditLogs(), fetchSystemStats()]);
    } catch (error) {
      console.error("Erro ao carregar dados iniciais:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBackups = async () => {
    setLoadingBackups(true);
    try {
      const response = await api.get("/admin/backups");
      setBackups(response.data);
    } catch (error) {
      console.error("Erro ao buscar backups:", error);
      toast.error("Erro ao carregar histórico de backups");
    } finally {
      setLoadingBackups(false);
    }
  };

  const fetchAuditLogs = async () => {
    setLoadingAudit(true);
    try {
      const response = await api.get("/admin/audit-logs");
      setAuditLogs(response.data);
    } catch (error) {
      console.error("Erro ao buscar logs de auditoria:", error);
      toast.error("Erro ao carregar logs de auditoria");
    } finally {
      setLoadingAudit(false);
    }
  };

  const fetchSystemStats = async () => {
    setLoadingStats(true);
    try {
      const response = await api.get("/admin/system-stats");
      setSystemStats(response.data);
    } catch (error) {
      console.error("Erro ao buscar estatísticas do sistema:", error);
      toast.error("Erro ao carregar estatísticas do sistema");
    } finally {
      setLoadingStats(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    window.location.href = "/login";
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const createBackup = async () => {
    setCreatingBackup(true);
    try {
      const response = await api.post("/admin/create-backup");
      toast.success("Backup criado com sucesso!");
      await fetchBackups(); // Recarregar lista de backups
    } catch (error) {
      console.error("Erro ao criar backup:", error);
      toast.error(error.response?.data?.message || "Erro ao criar backup");
    } finally {
      setCreatingBackup(false);
    }
  };

  const downloadBackup = async (backupId, filename) => {
    try {
      const response = await api.get(`/admin/download-backup/${backupId}`, {
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success("Download iniciado!");
    } catch (error) {
      console.error("Erro ao baixar backup:", error);
      toast.error("Erro ao baixar backup");
    }
  };

  const deleteBackup = async (backupId) => {
    if (!window.confirm("Tem certeza que deseja excluir este backup?")) {
      return;
    }

    try {
      await api.delete(`/admin/delete-backup/${backupId}`);
      toast.success("Backup excluído com sucesso!");
      await fetchBackups();
    } catch (error) {
      console.error("Erro ao excluir backup:", error);
      toast.error("Erro ao excluir backup");
    }
  };

  const exportAuditLogs = async () => {
    try {
      const response = await api.get("/admin/export-audit-logs", {
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `audit_logs_${new Date().toISOString().split("T")[0]}.csv`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success("Exportação de auditoria iniciada!");
    } catch (error) {
      console.error("Erro ao exportar logs de auditoria:", error);
      toast.error("Erro ao exportar logs de auditoria");
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getActionIcon = (action) => {
    switch (action) {
      case "CREATE":
        return <CheckCircle size={16} className={styles.createIcon} />;
      case "UPDATE":
        return <RefreshCw size={16} className={styles.updateIcon} />;
      case "DELETE":
        return <Trash2 size={16} className={styles.deleteIcon} />;
      case "LOGIN":
        return <Shield size={16} className={styles.loginIcon} />;
      default:
        return <Activity size={16} className={styles.defaultIcon} />;
    }
  };

  if (loading) {
    return (
      <div className={styles.spinnerContainer}>
        <div className={styles.spinner}></div>
      </div>
    );
  }

  return (
    <div className={styles.configPage}>
      <Header onMenuToggle={toggleSidebar} />

      <div className={styles.pageBody}>
        <Sidebar isOpen={sidebarOpen} onLogout={handleLogout} />

        <div className={styles.contentArea}>
          <div className={styles.configWrapper}>
            <div className={styles.pageHeader}>
              <div className={styles.headerContent}>
                <h1 className={styles.pageTitle}>Configurações do Sistema</h1>
              </div>
              <div className={styles.breadcrumb}>
                <span>Administração</span>
                <span className={styles.separator}>/</span>
                <span className={styles.current}>Configurações</span>
              </div>
            </div>

            {/* Estatísticas do Sistema */}
            {systemStats && (
              <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                  <div className={styles.statIcon}>
                    <Users size={24} />
                  </div>
                  <div className={styles.statContent}>
                    <div className={styles.statValue}>
                      {systemStats.total_users}
                    </div>
                    <div className={styles.statLabel}>Usuários Ativos</div>
                  </div>
                </div>

                <div className={styles.statCard}>
                  <div className={styles.statIcon}>
                    <BarChart3 size={24} />
                  </div>
                  <div className={styles.statContent}>
                    <div className={styles.statValue}>
                      {systemStats.total_tasks}
                    </div>
                    <div className={styles.statLabel}>Tarefas Criadas</div>
                  </div>
                </div>

                <div className={styles.statCard}>
                  <div className={styles.statIcon}>
                    <Database size={24} />
                  </div>
                  <div className={styles.statContent}>
                    <div className={styles.statValue}>
                      {systemStats.total_backups}
                    </div>
                    <div className={styles.statLabel}>Backups Realizados</div>
                  </div>
                </div>

                <div className={styles.statCard}>
                  <div className={styles.statIcon}>
                    <Activity size={24} />
                  </div>
                  <div className={styles.statContent}>
                    <div className={styles.statValue}>
                      {systemStats.total_audit_logs}
                    </div>
                    <div className={styles.statLabel}>Logs de Auditoria</div>
                  </div>
                </div>
              </div>
            )}

            {/* Tabs de Navegação */}
            <div className={styles.tabsContainer}>
              <div className={styles.tabs}>
                <button
                  className={`${styles.tab} ${
                    activeTab === "backup" ? styles.active : ""
                  }`}
                  onClick={() => setActiveTab("backup")}
                >
                  <Database size={18} />
                  Backup do Banco
                </button>
                <button
                  className={`${styles.tab} ${
                    activeTab === "audit" ? styles.active : ""
                  }`}
                  onClick={() => setActiveTab("audit")}
                >
                  <FileText size={18} />
                  Auditoria
                </button>
              </div>
            </div>

            {/* Conteúdo das Tabs */}
            <div className={styles.tabContent}>
              {activeTab === "backup" && (
                <div className={styles.backupSection}>
                  <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>
                      Gerenciamento de Backup
                    </h2>
                    <button
                      className={styles.createBackupBtn}
                      onClick={createBackup}
                      disabled={creatingBackup}
                    >
                      {creatingBackup ? (
                        <div className={styles.buttonSpinner}></div>
                      ) : (
                        <>
                          <Database size={16} />
                          Criar Backup
                        </>
                      )}
                    </button>
                  </div>

                  <div className={styles.backupCard}>
                    <div className={styles.cardHeader}>
                      <h3 className={styles.cardTitle}>Histórico de Backups</h3>
                      <button
                        className={styles.refreshBtn}
                        onClick={fetchBackups}
                        disabled={loadingBackups}
                        title="Atualizar"
                      >
                        <RefreshCw
                          size={16}
                          className={loadingBackups ? styles.spinning : ""}
                        />
                        <span className={styles.buttonText}>↻</span>
                      </button>
                    </div>

                    {loadingBackups ? (
                      <div className={styles.loadingState}>
                        <div className={styles.smallSpinner}></div>
                        <span>Carregando backups...</span>
                      </div>
                    ) : backups.length === 0 ? (
                      <div className={styles.emptyState}>
                        <Database size={48} />
                        <h3>Nenhum backup encontrado</h3>
                        <p>Crie seu primeiro backup para começar</p>
                      </div>
                    ) : (
                      <div className={styles.backupList}>
                        {backups.map((backup) => (
                          <div key={backup.id} className={styles.backupItem}>
                            <div className={styles.backupInfo}>
                              <div className={styles.backupName}>
                                <Database size={18} />
                                <span>{backup.filename}</span>
                              </div>
                              <div className={styles.backupMeta}>
                                <span className={styles.backupDate}>
                                  <Calendar size={14} />
                                  {formatDate(backup.created_at)}
                                </span>
                                <span className={styles.backupSize}>
                                  {formatFileSize(backup.file_size)}
                                </span>
                                <span
                                  className={`${styles.backupStatus} ${
                                    styles[backup.status]
                                  }`}
                                >
                                  {backup.status === "completed" ? (
                                    <CheckCircle size={14} />
                                  ) : (
                                    <AlertCircle size={14} />
                                  )}
                                  {backup.status === "completed"
                                    ? "Concluído"
                                    : "Erro"}
                                </span>
                              </div>
                            </div>
                            <div className={styles.backupActions}>
                              <button
                                className={styles.downloadBtn}
                                onClick={() =>
                                  downloadBackup(backup.id, backup.filename)
                                }
                                title="Baixar backup"
                              >
                                <Download size={16} />
                                <span className={styles.buttonText}>⬇</span>
                              </button>
                              <button
                                className={styles.deleteBtn}
                                onClick={() => deleteBackup(backup.id)}
                                title="Excluir backup"
                              >
                                <Trash2 size={16} />
                                <span className={styles.buttonText}>🗑</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === "audit" && (
                <div className={styles.auditSection}>
                  <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>Logs de Auditoria</h2>
                    <button
                      className={styles.exportBtn}
                      onClick={exportAuditLogs}
                    >
                      <Download size={16} />
                      Exportar Logs
                    </button>
                  </div>

                  <div className={styles.auditCard}>
                    <div className={styles.cardHeader}>
                      <h3 className={styles.cardTitle}>Atividades Recentes</h3>
                      <button
                        className={styles.refreshBtn}
                        onClick={fetchAuditLogs}
                        disabled={loadingAudit}
                        title="Atualizar"
                      >
                        <RefreshCw
                          size={16}
                          className={loadingAudit ? styles.spinning : ""}
                        />
                        <span className={styles.buttonText}>↻</span>
                      </button>
                    </div>

                    {loadingAudit ? (
                      <div className={styles.loadingState}>
                        <div className={styles.smallSpinner}></div>
                        <span>Carregando logs...</span>
                      </div>
                    ) : auditLogs.length === 0 ? (
                      <div className={styles.emptyState}>
                        <FileText size={48} />
                        <h3>Nenhum log encontrado</h3>
                        <p>Os logs de auditoria aparecerão aqui</p>
                      </div>
                    ) : (
                      <div className={styles.auditList}>
                        {auditLogs.map((log) => (
                          <div key={log.id} className={styles.auditItem}>
                            <div className={styles.auditIcon}>
                              {getActionIcon(log.action)}
                            </div>
                            <div className={styles.auditContent}>
                              <div className={styles.auditAction}>
                                <span className={styles.actionType}>
                                  {log.action}
                                </span>
                                <span className={styles.actionDescription}>
                                  {log.description}
                                </span>
                              </div>
                              <div className={styles.auditMeta}>
                                <span className={styles.auditUser}>
                                  <Users size={12} />
                                  {log.user_name}
                                </span>
                                <span className={styles.auditDate}>
                                  <Clock size={12} />
                                  {formatDate(log.created_at)}
                                </span>
                                {log.ip_address && (
                                  <span className={styles.auditIp}>
                                    IP: {log.ip_address}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConfigPage;
