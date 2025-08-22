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
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

function ConfigPage() {
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [backups, setBackups] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditPagination, setAuditPagination] = useState({
    total_items: 0,
    total_pages: 0,
    current_page: 1,
    per_page: 20,
    has_next: false,
    has_prev: false,
    next_num: null,
    prev_num: null,
  });
  const [systemStats, setSystemStats] = useState(null);
  const [activeTab, setActiveTab] = useState("backup");
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [auditFilters, setAuditFilters] = useState({
    action: "",
    user_id: "",
  });

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

  const fetchAuditLogs = async (page = 1, perPage = 20, filters = {}) => {
    setLoadingAudit(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        per_page: perPage.toString(),
        ...filters,
      });

      const response = await api.get(`/admin/audit-logs?${params}`);

      // Verificar se a resposta tem a estrutura esperada com paginação
      if (response.data.items && response.data.pagination) {
        setAuditLogs(response.data.items);
        setAuditPagination(response.data.pagination);
      } else {
        // Fallback para compatibilidade com resposta antiga
        setAuditLogs(Array.isArray(response.data) ? response.data : []);
        setAuditPagination({
          total_items: Array.isArray(response.data) ? response.data.length : 0,
          total_pages: 1,
          current_page: 1,
          per_page: perPage,
          has_next: false,
          has_prev: false,
          next_num: null,
          prev_num: null,
        });
      }
    } catch (error) {
      console.error("Erro ao buscar logs de auditoria:", error);
      toast.error("Erro ao carregar logs de auditoria");
      setAuditLogs([]);
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

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= auditPagination.total_pages) {
      fetchAuditLogs(newPage, auditPagination.per_page, auditFilters);
    }
  };

  const handlePerPageChange = (newPerPage) => {
    fetchAuditLogs(1, newPerPage, auditFilters);
  };

  const handleFilterChange = (filterName, value) => {
    const newFilters = { ...auditFilters, [filterName]: value };
    setAuditFilters(newFilters);
    fetchAuditLogs(1, auditPagination.per_page, newFilters);
  };

  const clearFilters = () => {
    setAuditFilters({ action: "", user_id: "" });
    fetchAuditLogs(1, auditPagination.per_page, {});
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
      case "LOGIN_SUCCESS":
      case "LOGIN_FAILED":
      case "LOGOUT":
        return <Shield size={16} className={styles.loginIcon} />;
      case "CREATE_BACKUP":
      case "DELETE_BACKUP":
      case "DOWNLOAD_BACKUP":
        return <Database size={16} className={styles.backupIcon} />;
      case "EXPORT_AUDIT_LOGS":
        return <Download size={16} className={styles.exportIcon} />;
      default:
        return <Activity size={16} className={styles.defaultIcon} />;
    }
  };

  const getActionColor = (action) => {
    switch (action) {
      case "CREATE":
      case "LOGIN_SUCCESS":
        return "#10b981"; // green
      case "UPDATE":
        return "#3b82f6"; // blue
      case "DELETE":
      case "LOGIN_FAILED":
        return "#ef4444"; // red
      case "LOGOUT":
        return "#6b7280"; // gray
      default:
        return "#8b5cf6"; // purple
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
                      <h3 className={styles.cardTitle}>
                        Atividades do Sistema
                        {auditPagination.total_items > 0 && (
                          <span className={styles.totalCount}>
                            ({auditPagination.total_items} registros)
                          </span>
                        )}
                      </h3>
                      <div className={styles.auditControls}>
                        <button
                          className={styles.refreshBtn}
                          onClick={() =>
                            fetchAuditLogs(
                              auditPagination.current_page,
                              auditPagination.per_page,
                              auditFilters
                            )
                          }
                          disabled={loadingAudit}
                          title="Atualizar"
                        >
                          <RefreshCw
                            size={16}
                            className={loadingAudit ? styles.spinning : ""}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Filtros */}
                    <div className={styles.auditFilters}>
                      <div className={styles.filterGroup}>
                        <label htmlFor="actionFilter">Ação:</label>
                        <select
                          id="actionFilter"
                          value={auditFilters.action}
                          onChange={(e) =>
                            handleFilterChange("action", e.target.value)
                          }
                          className={styles.filterSelect}
                        >
                          <option value="">Todas as ações</option>
                          <option value="CREATE">Criação</option>
                          <option value="UPDATE">Atualização</option>
                          <option value="DELETE">Exclusão</option>
                          <option value="LOGIN_SUCCESS">Login</option>
                          <option value="LOGIN_FAILED">Login Falhado</option>
                          <option value="LOGOUT">Logout</option>
                          <option value="CREATE_BACKUP">Criar Backup</option>
                          <option value="DELETE_BACKUP">Excluir Backup</option>
                          <option value="DOWNLOAD_BACKUP">
                            Download Backup
                          </option>
                          <option value="EXPORT_AUDIT_LOGS">
                            Exportar Logs
                          </option>
                        </select>
                      </div>

                      <div className={styles.filterGroup}>
                        <label htmlFor="perPageSelect">Itens por página:</label>
                        <select
                          id="perPageSelect"
                          value={auditPagination.per_page}
                          onChange={(e) =>
                            handlePerPageChange(parseInt(e.target.value))
                          }
                          className={styles.filterSelect}
                        >
                          <option value={10}>10</option>
                          <option value={20}>20</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                        </select>
                      </div>

                      {(auditFilters.action || auditFilters.user_id) && (
                        <button
                          className={styles.clearFiltersBtn}
                          onClick={clearFilters}
                        >
                          Limpar Filtros
                        </button>
                      )}
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
                        <p>
                          {auditFilters.action || auditFilters.user_id
                            ? "Nenhum log corresponde aos filtros aplicados"
                            : "Os logs de auditoria aparecerão aqui"}
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className={styles.auditList}>
                          {auditLogs.map((log) => (
                            <div key={log.id} className={styles.auditItem}>
                              <div className={styles.auditIcon}>
                                {getActionIcon(log.action)}
                              </div>
                              <div className={styles.auditContent}>
                                <div className={styles.auditAction}>
                                  <span
                                    className={styles.actionType}
                                    style={{
                                      color: getActionColor(log.action),
                                    }}
                                  >
                                    {log.action}
                                  </span>
                                  <span className={styles.actionDescription}>
                                    {log.description}
                                  </span>
                                </div>
                                <div className={styles.auditMeta}>
                                  <span className={styles.auditUser}>
                                    <Users size={12} />
                                    {log.user_name || "Sistema"}
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
                                  {log.resource_type && (
                                    <span className={styles.auditResource}>
                                      {log.resource_type}
                                      {log.resource_id &&
                                        ` #${log.resource_id}`}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Paginação */}
                        {auditPagination.total_pages > 1 && (
                          <div className={styles.pagination}>
                            <div className={styles.paginationInfo}>
                              Página {auditPagination.current_page} de{" "}
                              {auditPagination.total_pages} (
                              {auditPagination.total_items} registros)
                            </div>

                            <div className={styles.paginationControls}>
                              <button
                                className={styles.paginationBtn}
                                onClick={() => handlePageChange(1)}
                                disabled={!auditPagination.has_prev}
                                title="Primeira página"
                              >
                                <ChevronsLeft size={16} />
                              </button>

                              <button
                                className={styles.paginationBtn}
                                onClick={() =>
                                  handlePageChange(auditPagination.prev_num)
                                }
                                disabled={!auditPagination.has_prev}
                                title="Página anterior"
                              >
                                <ChevronLeft size={16} />
                              </button>

                              <span className={styles.pageNumbers}>
                                {Array.from(
                                  {
                                    length: Math.min(
                                      5,
                                      auditPagination.total_pages
                                    ),
                                  },
                                  (_, i) => {
                                    let pageNum;
                                    if (auditPagination.total_pages <= 5) {
                                      pageNum = i + 1;
                                    } else if (
                                      auditPagination.current_page <= 3
                                    ) {
                                      pageNum = i + 1;
                                    } else if (
                                      auditPagination.current_page >=
                                      auditPagination.total_pages - 2
                                    ) {
                                      pageNum =
                                        auditPagination.total_pages - 4 + i;
                                    } else {
                                      pageNum =
                                        auditPagination.current_page - 2 + i;
                                    }

                                    return (
                                      <button
                                        key={pageNum}
                                        className={`${styles.pageNumberBtn} ${
                                          pageNum ===
                                          auditPagination.current_page
                                            ? styles.active
                                            : ""
                                        }`}
                                        onClick={() =>
                                          handlePageChange(pageNum)
                                        }
                                      >
                                        {pageNum}
                                      </button>
                                    );
                                  }
                                )}
                              </span>

                              <button
                                className={styles.paginationBtn}
                                onClick={() =>
                                  handlePageChange(auditPagination.next_num)
                                }
                                disabled={!auditPagination.has_next}
                                title="Próxima página"
                              >
                                <ChevronRight size={16} />
                              </button>

                              <button
                                className={styles.paginationBtn}
                                onClick={() =>
                                  handlePageChange(auditPagination.total_pages)
                                }
                                disabled={!auditPagination.has_next}
                                title="Última página"
                              >
                                <ChevronsRight size={16} />
                              </button>
                            </div>
                          </div>
                        )}
                      </>
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
