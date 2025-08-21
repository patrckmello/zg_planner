import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import api from "../services/axiosInstance";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import styles from "./ProfilePage.module.css";
import {
  User,
  Mail,
  Calendar,
  Shield,
  Crown,
  Eye,
  EyeOff,
  Save,
  Palette,
} from "lucide-react";

function ProfilePage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [selectedColor, setSelectedColor] = useState("#3498db");
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingColor, setSavingColor] = useState(false);

  // Cores disponíveis para o ícone do usuário
  const availableColors = [
    "#3498db",
    "#e74c3c",
    "#2ecc71",
    "#f39c12",
    "#9b59b6",
    "#1abc9c",
    "#34495e",
    "#e67e22",
    "#95a5a6",
    "#16a085",
    "#27ae60",
    "#2980b9",
    "#8e44ad",
    "#f1c40f",
    "#d35400",
  ];

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const response = await api.get("/users/me");
      setUser(response.data);
      setSelectedColor(response.data.icon_color || "#3498db");
    } catch (error) {
      console.error("Erro ao buscar dados do usuário:", error);
      toast.error("Erro ao carregar dados do perfil");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    window.location.href = "/login";
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handlePasswordChange = (field, value) => {
    setPasswordData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const togglePasswordVisibility = (field) => {
    setShowPasswords((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast.error("A nova senha deve ter pelo menos 6 caracteres");
      return;
    }

    setSavingPassword(true);
    try {
      await api.put("/users/change-password", {
        current_password: passwordData.currentPassword,
        new_password: passwordData.newPassword,
      });

      toast.success("Senha alterada com sucesso!");
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setShowPasswordForm(false);
    } catch (error) {
      console.error("Erro ao alterar senha:", error);
      toast.error(error.response?.data?.message || "Erro ao alterar senha");
    } finally {
      setSavingPassword(false);
    }
  };

  const handleColorChange = async (color) => {
    setSelectedColor(color);
    setSavingColor(true);

    try {
      await api.put("/users/update-icon-color", {
        icon_color: color,
      });

      setUser((prev) => ({
        ...prev,
        icon_color: color,
      }));

      toast.success("Cor do ícone atualizada com sucesso!");
      setShowColorPicker(false);

      // Recarregar a página para atualizar o header e sidebar
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error("Erro ao atualizar cor do ícone:", error);
      toast.error("Erro ao atualizar cor do ícone");
    } finally {
      setSavingColor(false);
    }
  };

  const getUserBadgeInfo = (user) => {
    if (user?.is_admin) {
      return { color: "#e74c3c", icon: Crown, text: "Administrador" };
    } else if (user?.is_manager) {
      return { color: "#f39c12", icon: Shield, text: "Gestor" };
    } else {
      return { color: "#3498db", icon: User, text: "Usuário" };
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Não informado";
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className={styles.spinnerContainer}>
        <div className={styles.spinner}></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={styles.errorContainer}>
        <p>Erro ao carregar dados do usuário</p>
      </div>
    );
  }

  const badgeInfo = getUserBadgeInfo(user);
  const BadgeIcon = badgeInfo.icon;
  const userInitial = user.username
    ? user.username.charAt(0).toUpperCase()
    : "U";

  return (
    <div className={styles.profilePage}>
      <Header onMenuToggle={toggleSidebar} />

      <div className={styles.pageBody}>
        <Sidebar isOpen={sidebarOpen} onLogout={handleLogout} />

        <div className={styles.contentArea}>
          <div className={styles.profileWrapper}>
            <div className={styles.pageHeader}>
              <div className={styles.headerContent}>
                <h1 className={styles.pageTitle}>Meu Perfil</h1>
              </div>
              <div className={styles.breadcrumb}>
                <span>Conta</span>
                <span className={styles.separator}>/</span>
                <span className={styles.current}>Meu Perfil</span>
              </div>
            </div>

            <div className={styles.profileContent}>
              {/* Card do Avatar e Informações Básicas */}
              <div className={styles.profileCard}>
                <div className={styles.avatarSection}>
                  <div
                    className={styles.userAvatar}
                    style={{ backgroundColor: selectedColor }}
                  >
                    <span>{userInitial}</span>
                  </div>
                  <button
                    className={styles.colorButton}
                    onClick={() => setShowColorPicker(!showColorPicker)}
                    disabled={savingColor}
                  >
                    <Palette size={16} />
                    Alterar Cor
                  </button>

                  {showColorPicker && (
                    <div className={styles.colorPicker}>
                      <div className={styles.colorGrid}>
                        {availableColors.map((color) => (
                          <button
                            key={color}
                            className={`${styles.colorOption} ${
                              selectedColor === color ? styles.selected : ""
                            }`}
                            style={{ backgroundColor: color }}
                            onClick={() => handleColorChange(color)}
                            disabled={savingColor}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className={styles.userInfo}>
                  <h2 className={styles.userName}>{user.username}</h2>
                  <div
                    className={styles.userBadge}
                    style={{ backgroundColor: badgeInfo.color }}
                  >
                    <BadgeIcon size={14} />
                    <span>{badgeInfo.text}</span>
                  </div>
                </div>
              </div>

              {/* Card de Informações Detalhadas */}
              <div className={styles.infoCard}>
                <h3 className={styles.cardTitle}>Informações da Conta</h3>

                <div className={styles.infoGrid}>
                  <div className={styles.infoItem}>
                    <div className={styles.infoLabel}>
                      <User size={18} />
                      <span>Nome Completo</span>
                    </div>
                    <div className={styles.infoValue}>{user.username}</div>
                  </div>

                  <div className={styles.infoItem}>
                    <div className={styles.infoLabel}>
                      <Mail size={18} />
                      <span>E-mail</span>
                    </div>
                    <div className={styles.infoValue}>{user.email}</div>
                  </div>

                  <div className={styles.infoItem}>
                    <div className={styles.infoLabel}>
                      <Shield size={18} />
                      <span>Tipo de Usuário</span>
                    </div>
                    <div className={styles.infoValue}>
                      <div
                        className={styles.typeBadge}
                        style={{ backgroundColor: badgeInfo.color }}
                      >
                        <BadgeIcon size={14} />
                        <span>{badgeInfo.text}</span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.infoItem}>
                    <div className={styles.infoLabel}>
                      <Calendar size={18} />
                      <span>Data de Criação</span>
                    </div>
                    <div className={styles.infoValue}>
                      {formatDate(user.created_at)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Card de Segurança */}
              <div className={styles.securityCard}>
                <h3 className={styles.cardTitle}>Segurança</h3>

                {!showPasswordForm ? (
                  <div className={styles.passwordSection}>
                    <p className={styles.passwordDescription}>
                      Mantenha sua conta segura alterando sua senha
                      regularmente.
                    </p>
                    <button
                      className={styles.changePasswordBtn}
                      onClick={() => setShowPasswordForm(true)}
                    >
                      Alterar Senha
                    </button>
                  </div>
                ) : (
                  <form
                    className={styles.passwordForm}
                    onSubmit={handlePasswordSubmit}
                  >
                    <div className={styles.formGroup}>
                      <label>Senha Atual</label>
                      <div className={styles.passwordInput}>
                        <input
                          type={showPasswords.current ? "text" : "password"}
                          value={passwordData.currentPassword}
                          onChange={(e) =>
                            handlePasswordChange(
                              "currentPassword",
                              e.target.value
                            )
                          }
                          required
                        />
                        <button
                          type="button"
                          className={styles.togglePassword}
                          onClick={() => togglePasswordVisibility("current")}
                        >
                          {showPasswords.current ? (
                            <EyeOff size={18} />
                          ) : (
                            <Eye size={18} />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className={styles.formGroup}>
                      <label>Nova Senha</label>
                      <div className={styles.passwordInput}>
                        <input
                          type={showPasswords.new ? "text" : "password"}
                          value={passwordData.newPassword}
                          onChange={(e) =>
                            handlePasswordChange("newPassword", e.target.value)
                          }
                          required
                          minLength={6}
                        />
                        <button
                          type="button"
                          className={styles.togglePassword}
                          onClick={() => togglePasswordVisibility("new")}
                        >
                          {showPasswords.new ? (
                            <EyeOff size={18} />
                          ) : (
                            <Eye size={18} />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className={styles.formGroup}>
                      <label>Confirmar Nova Senha</label>
                      <div className={styles.passwordInput}>
                        <input
                          type={showPasswords.confirm ? "text" : "password"}
                          value={passwordData.confirmPassword}
                          onChange={(e) =>
                            handlePasswordChange(
                              "confirmPassword",
                              e.target.value
                            )
                          }
                          required
                          minLength={6}
                        />
                        <button
                          type="button"
                          className={styles.togglePassword}
                          onClick={() => togglePasswordVisibility("confirm")}
                        >
                          {showPasswords.confirm ? (
                            <EyeOff size={18} />
                          ) : (
                            <Eye size={18} />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className={styles.formActions}>
                      <button
                        type="button"
                        className={styles.cancelBtn}
                        onClick={() => {
                          setShowPasswordForm(false);
                          setPasswordData({
                            currentPassword: "",
                            newPassword: "",
                            confirmPassword: "",
                          });
                        }}
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className={styles.saveBtn}
                        disabled={savingPassword}
                      >
                        {savingPassword ? (
                          <div className={styles.buttonSpinner}></div>
                        ) : (
                          <>
                            <Save size={16} />
                            Salvar Senha
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;
