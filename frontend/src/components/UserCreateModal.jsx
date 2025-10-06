import React from "react";
import Modal from "./Modal";
import styles from "./UserCreateModal.module.css";
import {
  FiUser, FiMail, FiShield, FiEye, FiEyeOff,
  FiRefreshCw, FiCopy, FiSearch
} from "react-icons/fi";
import api from "../services/axiosInstance";

function strength(pw) {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[a-z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(s, 5);
}
function genPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*?";
  let out = "";
  for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random()*chars.length)];
  return out;
}

export default function UserCreateModal({
  isOpen,
  mode = "create", // "create" | "edit"
  initial = null,  // dados do usuário ao editar
  onClose,
  onCreate,        // (payload)=>Promise
  onUpdate,        // (id, payload)=>Promise
  busy = false,
}) {
  const isEdit = mode === "edit";
  const [tab, setTab] = React.useState("perfil"); // perfil | permissoes | equipes | visual

  const [username, setUsername] = React.useState(initial?.username || "");
  const [email, setEmail] = React.useState(initial?.email || "");
  const [isAdmin, setIsAdmin] = React.useState(!!initial?.is_admin);
  const [isActive, setIsActive] = React.useState(initial?.is_active !== false);
  const [password, setPassword] = React.useState("");
  const [showPw, setShowPw] = React.useState(false);
  const [iconColor, setIconColor] = React.useState(initial?.icon_color || "#3498db");

  const [allRoles, setAllRoles] = React.useState([]);
  const [allTeams, setAllTeams] = React.useState([]);
  const [rolesSearch, setRolesSearch] = React.useState("");
  const [teamsSearch, setTeamsSearch] = React.useState("");

  const [selectedRoles, setSelectedRoles] = React.useState(
    initial?.roles?.map(r=>r.id) || []
  );
  const [selectedTeams, setSelectedTeams] = React.useState(
    initial?.equipes?.map(t=>({ id: t.id, is_manager: t.is_manager })) || []
  );

  const [errors, setErrors] = React.useState({});
  const [touched, setTouched] = React.useState({});

  const pwScore = React.useMemo(()=>strength(password), [password]);

  React.useEffect(()=>{
    if (!isOpen) return;
    // reset ao abrir
    setTab("perfil");
    setUsername(initial?.username || "");
    setEmail(initial?.email || "");
    setIsAdmin(!!initial?.is_admin);
    setIsActive(initial?.is_active !== false);
    setPassword("");
    setShowPw(false);
    setIconColor(initial?.icon_color || "#3498db");
    setSelectedRoles(initial?.roles?.map(r=>r.id) || []);
    setSelectedTeams(initial?.equipes?.map(t=>({ id: t.id, is_manager: t.is_manager })) || []);
    setErrors({});
    setTouched({});

    // carrega listas
    (async()=>{
      try{
        const [rolesRes, teamsRes] = await Promise.all([
          api.get("/roles"),
          api.get("/teams")
        ]);
        const listRoles = Array.isArray(rolesRes.data) ? rolesRes.data : rolesRes.data?.items || [];
        const listTeams = Array.isArray(teamsRes.data) ? teamsRes.data : teamsRes.data?.items || [];
        setAllRoles(listRoles);
        setAllTeams(listTeams);
      }catch(e){
        setAllRoles([]);
        setAllTeams([]);
      }
    })();
  }, [isOpen, initial]);

  const filteredRoles = React.useMemo(()=>{
    const q = rolesSearch.trim().toLowerCase();
    return q ? allRoles.filter(r => (r.name || "").toLowerCase().includes(q)) : allRoles;
  }, [allRoles, rolesSearch]);

  const filteredTeams = React.useMemo(()=>{
    const q = teamsSearch.trim().toLowerCase();
    return q ? allTeams.filter(t => (t.name || "").toLowerCase().includes(q)) : allTeams;
  }, [allTeams, teamsSearch]);

  const markTouched = (k)=> setTouched(t=>({ ...t, [k]: true }));

  const validate = () => {
    const e = {};
    if (!username.trim()) e.username = "Informe o nome do usuário";
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) e.email = "Informe um e-mail";
    else if (!re.test(email)) e.email = "E-mail inválido";
    if (!isEdit) {
      if (!password) e.password = "Crie uma senha";
      else if (password.length < 8) e.password = "Mínimo de 8 caracteres";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const toggleRole = (id) => {
    setSelectedRoles(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);
  };

  const toggleTeam = (id) => {
    setSelectedTeams(prev => {
      const exists = prev.find(p=>p.id===id);
      if (exists) return prev.filter(p=>p.id!==id);
      return [...prev, { id, is_manager:false }];
    });
  };

  const toggleManager = (id) => {
    setSelectedTeams(prev => prev.map(p => p.id===id ? ({...p, is_manager: !p.is_manager}) : p));
  };

  const copyPassword = async () => {
    try { await navigator.clipboard.writeText(password); } catch {}
  };

  const handleGenerate = () => {
    const pw = genPassword();
    setPassword(pw);
    setShowPw(true);
    setTouched(t => ({ ...t, password: true }));
  };

  const submit = async () => {
    if (!validate()) {
      setTouched({ username: true, email: true, password: true });
      return;
    }
    const payload = {
      username: username.trim(),
      email: email.trim(),
      is_admin: isAdmin,
      icon_color: iconColor,
      roles: selectedRoles,
      teams: selectedTeams,
      ...(isEdit ? {} : { password }),
      ...(isEdit ? { is_active: isActive } : {}),
    };

    try{
      if (isEdit && initial) {
        const { password: _omit, ...withoutPass } = payload;
        await onUpdate(initial.id, withoutPass);
      } else {
        await onCreate(payload);
      }
      onClose();
    }catch{
      // erro já tratado por toasts no caller
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={isEdit ? "Editar usuário" : "Novo usuário"}
      ariaLabelledById="userCreateTitle"
    >
      {/* Tabs */}
      <div className={styles.tabs}>
        {["perfil","permissoes","equipes","visual"].map((t) => (
          <button
            key={t}
            className={`${styles.tab} ${tab===t ? styles.active : ""}`}
            onClick={()=>setTab(t)}
          >
            {t === "perfil" ? "Perfil" :
             t === "permissoes" ? "Permissões" :
             t === "equipes" ? "Equipes & Gestão" :
             "Visual"}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      <div className={styles.content}>
        {tab === "perfil" && (
          <div className={styles.grid2}>
            <div className={styles.field}>
              <label className={styles.label}>Nome do usuário</label>
              <div className={styles.inputWrap}>
                <FiUser className={styles.icon} />
                <input
                  data-autofocus
                  type="text"
                  value={username}
                  onChange={(e)=>setUsername(e.target.value)}
                  onBlur={()=>markTouched("username")}
                  placeholder="Michel Zavagna Gralha"
                  aria-invalid={!!errors.username}
                />
              </div>
              {touched.username && errors.username && <span className={styles.err}>{errors.username}</span>}
            </div>

            <div className={styles.field}>
              <label className={styles.label}>E-mail</label>
              <div className={styles.inputWrap}>
                <FiMail className={styles.icon} />
                <input
                  type="email"
                  value={email}
                  onChange={(e)=>setEmail(e.target.value)}
                  onBlur={()=>markTouched("email")}
                  placeholder="nome@empresa.com"
                  aria-invalid={!!errors.email}
                />
              </div>
              {touched.email && errors.email && <span className={styles.err}>{errors.email}</span>}
            </div>

            {!isEdit && (
              <div className={styles.fieldFull}>
                <label className={styles.label}>Senha</label>
                <div className={styles.inputWrap}>
                  <button
                    type="button"
                    className={styles.eye}
                    onClick={()=>setShowPw(s=>!s)}  /* <-- funciona */
                    aria-label={showPw ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPw ? <FiEyeOff/> : <FiEye/>}
                  </button>
                  <input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e)=>setPassword(e.target.value)}
                    onBlur={()=>markTouched("password")}
                    placeholder="Mínimo 8 caracteres"
                    aria-invalid={!!errors.password}
                  />
                </div>
                <div className={styles.pwRow}>
                  <div className={styles.meter}>
                    {Array.from({length:5}).map((_,i)=>(
                      <span key={i} data-active={i < pwScore} />
                    ))}
                  </div>
                  <div className={styles.pwActions}>
                    <button className={styles.linkBtn} type="button" onClick={handleGenerate}>
                      <FiRefreshCw/> Gerar
                    </button>
                    <button className={styles.linkBtn} type="button" onClick={copyPassword} disabled={!password}>
                      <FiCopy/> Copiar
                    </button>
                  </div>
                </div>
                {touched.password && errors.password && <span className={styles.err}>{errors.password}</span>}
              </div>
            )}

            {isEdit && (
              <div className={styles.field}>
                <label className={styles.label}>Status</label>
                <label className={styles.switch}>
                  <input type="checkbox" checked={isActive} onChange={(e)=>setIsActive(e.target.checked)} />
                  <span className={styles.slider}></span>
                  <span className={styles.switchLabel}>Ativo</span>
                </label>
              </div>
            )}

            {initial?.created_at && (
              <div className={styles.field}>
                <label className={styles.label}>Criado em</label>
                <div className={styles.readonlyBox}>
                  {new Date(initial.created_at).toLocaleString()}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "permissoes" && (
          <div className={styles.panel}>
            <div className={styles.block}>
              <label className={styles.label}>Perfil administrativo</label>
              <label className={styles.switch}>
                <input type="checkbox" checked={isAdmin} onChange={(e)=>setIsAdmin(e.target.checked)} />
                <span className={styles.slider}></span>
                <span className={styles.switchLabel}><FiShield/> Administrador</span>
              </label>
              <p className={styles.hint}>Admins costumam ter acesso total ao sistema.</p>
            </div>

            <div className={styles.block}>
              <div className={styles.flexBetween}>
                <label className={styles.label}>Cargos</label>
                <div className={styles.search}>
                  <FiSearch/>
                  <input
                    type="text"
                    placeholder="Buscar cargo..."
                    value={rolesSearch}
                    onChange={(e)=>setRolesSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.list}>
                {filteredRoles.map(r => (
                  <label key={r.id} className={styles.itemRow}>
                    <input
                      type="checkbox"
                      checked={selectedRoles.includes(r.id)}
                      onChange={()=>toggleRole(r.id)}
                    />
                    <span>{r.name}</span>
                  </label>
                ))}
                {filteredRoles.length === 0 && <div className={styles.empty}>Nenhum cargo encontrado.</div>}
              </div>

              {selectedRoles.length > 0 && (
                <div className={styles.chips}>
                  {selectedRoles.map(id=>{
                    const r = allRoles.find(x=>x.id===id);
                    return (
                      <span key={id} className={styles.chip}>
                        {r?.name || `#${id}`}
                        <button onClick={()=>toggleRole(id)} aria-label="Remover">✕</button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "equipes" && (
          <div className={styles.panel}>
            <div className={styles.flexBetween}>
              <label className={styles.label}>Equipes</label>
              <div className={styles.search}>
                <FiSearch/>
                <input
                  type="text"
                  placeholder="Buscar equipe..."
                  value={teamsSearch}
                  onChange={(e)=>setTeamsSearch(e.target.value)}
                />
              </div>
            </div>

            <div className={styles.list}>
              {filteredTeams.map(t => {
                const sel = selectedTeams.find(s=>s.id===t.id);
                const checked = !!sel;
                return (
                  <div key={t.id} className={styles.teamRow}>
                    <label className={styles.itemRow}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={()=>toggleTeam(t.id)}
                      />
                      <span>{t.name}</span>
                    </label>
                    <label className={`${styles.switch} ${!checked ? styles.switchDisabled : ""}`}>
                      <input
                        type="checkbox"
                        checked={!!sel?.is_manager}
                        onChange={()=>toggleManager(t.id)}
                        disabled={!checked}
                      />
                      <span className={styles.slider}></span>
                      <span className={styles.switchLabel}>Gestor</span>
                    </label>
                  </div>
                );
              })}
              {filteredTeams.length === 0 && <div className={styles.empty}>Nenhuma equipe encontrada.</div>}
            </div>
          </div>
        )}

        {tab === "visual" && (
          <div className={styles.grid2}>
            <div className={styles.field}>
              <label className={styles.label}>Cor do avatar</label>
              <div className={styles.colorRow}>
                <input
                  type="color"
                  value={iconColor}
                  onChange={(e)=>setIconColor(e.target.value)}
                  className={styles.colorInput}
                />
                <div className={styles.presets}>
                  {["#3498db","#609fdf","#3b82f6","#22c55e","#ef4444","#f59e0b","#9333ea","#111827"].map(c=>(
                    <button
                      key={c}
                      type="button"
                      className={styles.swatch}
                      style={{ background: c }}
                      onClick={()=>setIconColor(c)}
                      aria-label={`Escolher ${c}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Preview</label>
              <div className={styles.avatarPreview}>
                <div className={styles.avatar} style={{ background: iconColor }}>
                  {(username?.[0] || "U").toUpperCase()}
                </div>
                <div className={styles.previewMeta}>
                  <div className={styles.previewName}>{username || "Usuário"}</div>
                  <div className={styles.previewMail}>{email || "email@exemplo.com"}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <button className={styles.ghost} onClick={onClose}>Cancelar</button>
        <button className={styles.primary} onClick={submit} disabled={busy}>
          {busy ? "Salvando..." : (isEdit ? "Salvar alterações" : "Criar usuário")}
        </button>
      </div>
    </Modal>
  );
}
