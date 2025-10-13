import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./Header.module.css";
import api from "../services/axiosInstance";
import { Menu, Calendar, User, Shield, Crown } from "lucide-react";

function Header({ onMenuToggle }) {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await api.get("/users/me");
        setUser(response.data);
      } catch (error) {
        console.error("Erro ao buscar usuário:", error);
      }
    };

    fetchUser();
  }, [user?.icon_color]);

  const getUserBadgeInfo = (user) => {
    if (user?.is_admin) {
      return { color: "#e74c3c", icon: Crown, text: "Admin" };
    } else if (user?.is_manager) {
      return { color: "#f39c12", icon: Shield, text: "Gestor" };
    } else {
      return { color: "#3498db", icon: User, text: "Usuário" };
    }
  };

  const getFirstName = (fullName) => {
    if (!fullName) return "Usuário";
    return fullName.split(" ")[0];
  };

  if (!user) {
    return (
      <header className={styles.header}>
        <div className={styles.leftSection}>
          <div className={styles.menuToggle} onClick={onMenuToggle}>
            <Menu size={20} className={styles.menuIcon} />
          </div>
        </div>

        <div className={styles.centerSection}>
          <div className={styles.logoContainer}>
            <Calendar size={24} className={styles.logoIcon} />
            <h1 className={styles.logo}>ZG Planner</h1>
          </div>
        </div>

        <div className={styles.rightSection}>
          <div className={styles.userInfo}>
            <div className={styles.loadingAvatar}></div>
            <div className={styles.userDetails}>
              <span className={styles.username}>Carregando...</span>
            </div>
          </div>
        </div>
      </header>
    );
  }

  const username = user.username || "Usuário";
  const firstName = getFirstName(username);
  const userInitial = username.charAt(0).toUpperCase();
  const badgeInfo = getUserBadgeInfo(user);
  const BadgeIcon = badgeInfo.icon;

  return (
    <header className={styles.header}>
      <div className={styles.leftSection}>
        <div className={styles.menuToggle} onClick={onMenuToggle}>
          <Menu size={20} className={styles.menuIcon} />
        </div>
      </div>

      <div className={styles.centerSection}>
        <div className={styles.logoContainer}>
          <Calendar size={24} className={styles.logoIcon} />
          <h1 className={styles.logo}>ZG Planner</h1>
        </div>
      </div>

      <div className={styles.rightSection}>
        {/* Área clicável do perfil */}
        <div
          className={styles.userInfo}
          onClick={() => navigate("/meu-perfil")}
          style={{ cursor: "pointer" }}
          title="Ir para meu perfil"
        >
          <div
            className={styles.userAvatar}
            style={{ backgroundColor: user.icon_color || "#3498db" }}
          >
            <span>{userInitial}</span>
          </div>
          <div className={styles.userDetails}>
            <span className={styles.username}>Olá, {firstName}</span>
            <div
              className={styles.userBadge}
              style={{ backgroundColor: badgeInfo.color }}
            >
              <BadgeIcon size={12} />
              <span>{badgeInfo.text}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
