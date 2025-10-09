import React from "react";
import Modal from "./Modal";
import styles from "./EntityWithMembers.module.css";
import { FiUsers, FiFileText, FiSearch, FiUserPlus, FiUserMinus, FiShield } from "react-icons/fi";
import api from "../services/axiosInstance";

const initialsFromName = (name = "") => {
  const clean = String(name || "").trim().replace(/\s+/g, " ");
  if (!clean) return "?";
  const parts = clean.split(" ");
  const first = parts[0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1] : "";
  const a = first[0] || "";
  const b = last ? (last[0] || "") : (first[1] || "");
  return (a + b).toUpperCase();
};

export default function TeamCreateModal({
  isOpen,
  mode = "create",         // "create" | "edit"
  initial = null,          // { id, name, description, members: [{user_id, username, email, is_manager}] }
  onClose,
  onCreate,                // (payload)=>Promise
  onUpdate,                // (id, payload)=>Promise
  busy = false,
  onAddMember,
  onRemoveMember,
  onToggleManager,
  initialTab = "detalhes",
  onTabChange,             // opcional: (tab)=>void para controlar no pai
}) {
  const isEdit = mode === "edit";

  // Detalhes
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [errors, setErrors] = React.useState({});

  // Membros
  const [tab, setTab] = React.useState("detalhes"); // detalhes | membros
  const [members, setMembers] = React.useState([]); // [{user_id, username, email, is_manager}]
  const [usersQuery, setUsersQuery] = React.useState("");
  const [available, setAvailable] = React.useState([]); // usuários não membros
  const [loadingAvail, setLoadingAvail] = React.useState(false);

  // ---- Controle de abas: só muda ao ABRIR o modal (ou trocar mode) ----
  React.useEffect(() => {
    if (!isOpen) return;
    const startTab = isEdit && initialTab === "membros" ? "membros" : "detalhes";
    setTab(startTab);
    onTabChange?.(startTab);
  }, [isOpen, isEdit, initialTab, onTabChange]);

  // ---- Sincroniza dados quando initial mudar (não mexe na aba) ----
  React.useEffect(() => {
    if (!isOpen) return;
    setName(initial?.name || "");
    setDescription(initial?.description || "");
    setErrors({});
    setMembers(Array.isArray(initial?.members) ? initial.members : []);
    setAvailable([]);
    setUsersQuery("");
  }, [isOpen, initial]);

  const validate = () => {
    const e = {};
    if (!String(name).trim()) e.name = "O nome da equipe é obrigatório.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    const payload = {
      name: String(name).trim(),
      description: String(description || "").trim() || null,
    };
    try {
      if (isEdit) {
        await onUpdate?.(initial.id, payload);
      } else {
        await onCreate?.(payload);
      }
      onClose?.();
    } catch (err) {
      // mantém modal aberto em caso de erro
      console.error("Falha ao salvar equipe:", err);
    }
  };

  const addMember = async (userId) => {
    if (!initial?.id) return;
    const updated = await onAddMember?.(initial.id, userId);
    if (updated?.members) setMembers(updated.members);
    // Opcional: remove localmente o usuário adicionado da lista de disponíveis (responsivo)
    setAvailable((prev) => prev.filter((u) => u.id !== userId));
  };

  const removeMember = async (userId) => {
    if (!initial?.id) return;
    const updated = await onRemoveMember?.(initial.id, userId);
    if (updated?.members) setMembers(updated.members);
    // Recarregaremos via efeito (members em deps); não precisa inserir de volta em available aqui
  };

  const toggleManager = async (userId, isManager) => {
    if (!initial?.id) return;
    const updated = await onToggleManager?.(initial.id, userId, isManager);
    if (updated?.members) setMembers(updated.members);
  };

  // ---- Busca usuários disponíveis (não-membros) com debounce ----
  React.useEffect(() => {
    if (!isOpen || !isEdit) return;

    let active = true;
    const load = async () => {
      setLoadingAvail(true);
      try {
        const params = {};
        const q = String(usersQuery || "").trim();
        if (q) params.search = q;

        const res = await api.get("/users", { params });
        const list = Array.isArray(res.data) ? res.data : res.data?.items || [];

        const memberIds = new Set((members || []).map((m) => m.user_id));
        const filtered = list.filter((u) => !memberIds.has(u.id));

        if (active) setAvailable(filtered);
      } catch (e) {
        if (active) setAvailable([]);
      } finally {
        if (active) setLoadingAvail(false);
      }
    };

    const t = setTimeout(load, 250); // debounce leve
    return () => { active = false; clearTimeout(t); };
  }, [usersQuery, isOpen, isEdit, members]); // <- inclui members para refiltrar após add/remove/toggle

  const switchTab = (next) => {
    setTab(next);
    onTabChange?.(next);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={isEdit ? "Editar Equipe" : "Nova Equipe"}
    >
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === "detalhes" ? styles.active : ""}`}
          onClick={() => switchTab("detalhes")}
        >
          Detalhes
        </button>
        {isEdit && (
          <button
            className={`${styles.tab} ${tab === "membros" ? styles.active : ""}`}
            onClick={() => switchTab("membros")}
          >
            Membros & Gestão
          </button>
        )}
      </div>

      {tab === "detalhes" && (
        <div className={styles.bodyGrid}>
          <div className={styles.field}>
            <label className={styles.label}>Nome da equipe</label>
            <div className={styles.inputWrap}>
              <FiUsers className={styles.icon} />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Equipe Trabalhista"
                autoFocus
              />
            </div>
            {errors.name && <span className={styles.err}>{errors.name}</span>}
          </div>

          <div className={styles.fieldFull}>
            <label className={styles.label}>Descrição</label>
            <div className={styles.inputWrap}>
              <FiFileText className={styles.icon} />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrição da equipe..."
                rows={4}
              />
            </div>
          </div>
        </div>
      )}

      {tab === "membros" && isEdit && (
        <div className={styles.membersPanel}>
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h4>Membros atuais</h4>
            </div>

            {members?.length ? (
              <div className={styles.list}>
                {members.map((m) => (
                  <div key={m.user_id} className={styles.row}>
                    <div className={`${styles.userCol} ${styles.userColRow}`}>
                      <div className={styles.avatarSm}>{initialsFromName(m.username)}</div>
                      <div className={styles.userText}>
                        <div className={styles.userName}>{m.username}</div>
                        <div className={styles.userEmail}>{m.email}</div>
                      </div>
                    </div>
                    <div className={styles.actionsCol}>
                      <button
                        className={`${styles.switchBtn} ${m.is_manager ? styles.on : ""}`}
                        title={m.is_manager ? "Remover como gestor" : "Tornar gestor"}
                        onClick={() => toggleManager(m.user_id, m.is_manager)}
                      >
                        <FiShield /><span>Gestor</span>
                      </button>
                      <button
                        className={styles.iconBtnDanger}
                        title="Remover da equipe"
                        onClick={() => removeMember(m.user_id)}
                      >
                        <FiUserMinus />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.empty}>Nenhum membro na equipe.</div>
            )}
          </div>

          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h4>Adicionar membros</h4>
              <div className={styles.search}>
                <FiSearch />
                <input
                  type="text"
                  placeholder="Buscar usuário..."
                  value={usersQuery}
                  onChange={(e) => setUsersQuery(e.target.value)}
                />
              </div>
            </div>

            {loadingAvail ? (
              <div className={styles.empty}>Carregando...</div>
            ) : available?.length ? (
              <div className={styles.list}>
                {available.map((u) => (
                  <div key={u.id} className={styles.row}>
                    <div className={`${styles.userCol} ${styles.userColRow}`}>
                      <div className={styles.avatarSm}>{initialsFromName(u.username)}</div>
                      <div className={styles.userText}>
                        <div className={styles.userName}>{u.username}</div>
                        <div className={styles.userEmail}>{u.email}</div>
                      </div>
                    </div>
                    <div className={styles.actionsCol}>
                      <button
                        className={styles.iconBtn}
                        title="Adicionar à equipe"
                        onClick={() => addMember(u.id)}
                      >
                        <FiUserPlus />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.empty}>Nenhum usuário disponível.</div>
            )}
          </div>
        </div>
      )}

      <div className={styles.footer}>
        <button className={styles.ghost} onClick={onClose}>Cancelar</button>
        <button className={styles.primary} onClick={submit} disabled={busy}>
          {busy ? "Salvando..." : isEdit ? "Salvar Alterações" : "Criar Equipe"}
        </button>
      </div>
    </Modal>
  );
}
