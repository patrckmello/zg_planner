import React from "react";
import Modal from "./Modal";
import styles from "./EntityWithMembers.module.css";
import { FiBriefcase, FiFileText, FiSearch, FiUserPlus, FiUserMinus } from "react-icons/fi";
import api from "../services/axiosInstance";

const initialsFromName = (name = "") => {
  const clean = name.trim().replace(/\s+/g, " ");
  if (!clean) return "?";
  const parts = clean.split(" ");
  const first = parts[0];
  const last = parts.length > 1 ? parts[parts.length - 1] : null;

  const a = first?.[0] ?? "";
  const b = last ? (last?.[0] ?? "") : (first?.[1] ?? "");
  return (a + b).toUpperCase();
};

const parseUsers = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.users)) return data.users;  // backend pode devolver { users: [...] }
  if (Array.isArray(data?.items)) return data.items;
  return [];
};

export default function RoleCreateModal({
  isOpen,
  mode = "create",          // "create" | "edit"
  initial = null,           // { id, name, description, users_count? }
  onClose,
  onCreate,                 // (payload)=>Promise
  onUpdate,                 // (id, payload)=>Promise
  busy = false,
  initialTab = "detalhes",
  onMembersChanged,
}) {
  const isEdit = mode === "edit";

  // Detalhes
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [errors, setErrors] = React.useState({});

  // Membros
  const [tab, setTab] = React.useState("detalhes"); // detalhes | membros
  const [roleUsers, setRoleUsers] = React.useState([]); // [{id, username, email}]
  const [usersQuery, setUsersQuery] = React.useState("");
  const [available, setAvailable] = React.useState([]);
  const [loadingAvail, setLoadingAvail] = React.useState(false);

  // --------- LOADERS ---------
  const loadRoleUsers = React.useCallback(async () => {
    if (!isOpen || !isEdit || !initial?.id) return;
    try {
      const { data } = await api.get(`/roles/${initial.id}/users`);
      setRoleUsers(parseUsers(data));
    } catch {
      setRoleUsers([]);
    }
  }, [isOpen, isEdit, initial?.id]);

  const loadAvailableUsers = React.useCallback(async (signal) => {
    if (!isOpen || !isEdit) return;
    setLoadingAvail(true);
    try {
      const res = await api.get("/users", { params: usersQuery ? { search: usersQuery } : {} });
      const list = Array.isArray(res.data) ? res.data : res.data?.items || [];
      const roleIds = new Set((roleUsers || []).map(u => u.id));
      const filtered = list.filter(u => !roleIds.has(u.id));
      if (!signal?.aborted) setAvailable(filtered);
    } catch {
      if (!signal?.aborted) setAvailable([]);
    } finally {
      if (!signal?.aborted) setLoadingAvail(false);
    }
  }, [isOpen, isEdit, usersQuery, roleUsers]);

  // --------- EFFECTS DE CONTROLE ---------

  // Define a aba ao abrir o modal, respeitando initialTab no edit
  React.useEffect(() => {
    if (!isOpen) return;
    const start = isEdit && initialTab === "membros" ? "membros" : "detalhes";
    setTab(start);
    setErrors({});
    setUsersQuery("");
  }, [isOpen, isEdit, initialTab]);

  // Sincroniza dados básicos quando initial mudar
  React.useEffect(() => {
    if (!isOpen) return;
    setName(initial?.name || "");
    setDescription(initial?.description || "");
    setRoleUsers([]); // zera e recarrega quando necessário
    setAvailable([]);
  }, [isOpen, initial]);

  // Quando abrir em "membros" (ou trocar para "membros"), carrega os membros do cargo
  React.useEffect(() => {
    if (!isOpen || !isEdit) return;
    if (tab === "membros") {
      loadRoleUsers();
    }
  }, [tab, isOpen, isEdit, loadRoleUsers]);

  // Busca usuários disponíveis com debounce e sempre que roleUsers mudar (para manter lista coerente)
  React.useEffect(() => {
    if (!isOpen || !isEdit) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => loadAvailableUsers(ctrl.signal), 250);
    return () => { ctrl.abort(); clearTimeout(t); };
  }, [usersQuery, roleUsers, isOpen, isEdit, loadAvailableUsers]);

  // --------- VALIDAÇÃO / SUBMIT ---------
  const validate = () => {
    const e = {};
    if (!name.trim()) e.name = "O nome do cargo é obrigatório.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    const payload = { name: name.trim(), description: description.trim() || null };
    if (isEdit) await onUpdate?.(initial.id, payload);
    else await onCreate?.(payload);
    onClose?.();
  };

  // --------- AÇÕES MEMBROS ---------
  const addUser = async (userId) => {
    if (!initial?.id) return;
    await api.post(`/roles/${initial.id}/users/${userId}`);
    // Recarrega lista de membros e disponíveis
    await loadRoleUsers();
    onMembersChanged?.(); 
  };

  const removeUser = async (userId) => {
    if (!initial?.id) return;
    await api.delete(`/roles/${initial.id}/users/${userId}`);
    // Recarrega lista de membros e disponíveis
    await loadRoleUsers();
    onMembersChanged?.(); 
  };

  const switchTab = (next) => setTab(next);

  // --------- RENDER ---------
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={isEdit ? "Editar Cargo" : "Novo Cargo"}
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
            Membros
          </button>
        )}
      </div>

      {tab === "detalhes" && (
        <div className={styles.bodyGrid}>
          <div className={styles.field}>
            <label className={styles.label}>Nome do cargo</label>
            <div className={styles.inputWrap}>
              <FiBriefcase className={styles.icon} />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Coordenador Jurídico"
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
                placeholder="Descreva o papel deste cargo..."
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
              <h4>Membros do cargo</h4>
            </div>

            {roleUsers?.length ? (
              <div className={styles.list}>
                {roleUsers.map((u) => (
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
                        className={styles.iconBtnDanger}
                        title="Remover do cargo"
                        onClick={() => removeUser(u.id)}
                      >
                        <FiUserMinus />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.empty}>Nenhum usuário com este cargo.</div>
            )}
          </div>

          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h4>Adicionar usuários</h4>
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
                        title="Adicionar ao cargo"
                        onClick={() => addUser(u.id)}
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
          {busy ? "Salvando..." : isEdit ? "Salvar Alterações" : "Criar Cargo"}
        </button>
      </div>
    </Modal>
  );
}
