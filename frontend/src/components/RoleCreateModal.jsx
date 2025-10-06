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
  const b = last ? (last?.[0] ?? "") : (first?.[1] ?? ""); // se não tiver sobrenome, usa 2ª letra do primeiro nome
  return (a + b).toUpperCase();
};

const parseUsers = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.users)) return data.users;  // <— seu backend atual
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
}) {
  const isEdit = mode === "edit";

  // Detalhes
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [errors, setErrors] = React.useState({});

  // Membros (relacionados a esse cargo)
  const [tab, setTab] = React.useState("detalhes"); // detalhes | membros
  const [roleUsers, setRoleUsers] = React.useState([]); // [{id, username, email}]
  const [usersQuery, setUsersQuery] = React.useState("");
  const [available, setAvailable] = React.useState([]);
  const [loadingAvail, setLoadingAvail] = React.useState(false);

  React.useEffect(() => {
    if (!isOpen) return;
    setTab("detalhes");
    setName(initial?.name || "");
    setDescription(initial?.description || "");
    setErrors({});
    setRoleUsers([]);
    setAvailable([]);
    setUsersQuery("");

    // Carregar membros do cargo ao abrir em modo edição
    (async () => {
      if (!isEdit || !initial?.id) return;
      try {
        const res = await api.get(`/roles/${initial.id}/users`);
        setRoleUsers(parseUsers(res.data));
      } catch {
        setRoleUsers([]);
      }
    })();
  }, [isOpen, isEdit, initial]);

  // Carregar usuários disponíveis (não pertencentes ao cargo) com busca
  React.useEffect(() => {
    if (!isOpen || !isEdit) return;
    let active = true;
    const load = async () => {
      setLoadingAvail(true);
      try {
        const res = await api.get("/users", { params: usersQuery ? { search: usersQuery } : {} });
        const list = Array.isArray(res.data) ? res.data : res.data?.items || [];
        const roleIds = new Set((roleUsers || []).map(u => u.id));
        const filtered = list.filter(u => !roleIds.has(u.id));
        if (active) setAvailable(filtered);
      } catch {
        if (active) setAvailable([]);
      } finally {
        if (active) setLoadingAvail(false);
      }
    };
    const t = setTimeout(load, 250);
    return () => { active = false; clearTimeout(t); };
  }, [usersQuery, isOpen, isEdit, roleUsers]);

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

  // membros do cargo
  const addUser = async (userId) => {
    if (!initial?.id) return;
    await api.post(`/roles/${initial.id}/users/${userId}`);
    const refetch = await api.get(`/roles/${initial.id}/users`);
    setRoleUsers(parseUsers(refetch.data));
  };

  const removeUser = async (userId) => {
    if (!initial?.id) return;
    await api.delete(`/roles/${initial.id}/users/${userId}`); // ajuste se necessário
    const refetch = await api.get(`/roles/${initial.id}/users`);
    setRoleUsers(parseUsers(refetch.data));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={isEdit ? "Editar Cargo" : "Novo Cargo"}
    >
      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab==="detalhes" ? styles.active : ""}`} onClick={()=>setTab("detalhes")}>
          Detalhes
        </button>
        {isEdit && (
          <button className={`${styles.tab} ${tab==="membros" ? styles.active : ""}`} onClick={()=>setTab("membros")}>
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
                onChange={(e)=>setName(e.target.value)}
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
                onChange={(e)=>setDescription(e.target.value)}
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
                {roleUsers.map((u)=>(
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
                            onClick={()=>removeUser(u.id)}
                        >
                            <FiUserMinus/>
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
                <FiSearch/>
                <input
                  type="text"
                  placeholder="Buscar usuário..."
                  value={usersQuery}
                  onChange={(e)=>setUsersQuery(e.target.value)}
                />
              </div>
            </div>

            {loadingAvail ? (
              <div className={styles.empty}>Carregando...</div>
            ) : available?.length ? (
              <div className={styles.list}>
                {available.map((u)=>(
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
                            onClick={()=>addUser(u.id)}
                        >
                            <FiUserPlus/>
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
