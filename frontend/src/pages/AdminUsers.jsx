import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import styles from './AdminUsers.module.css';
import api from '../services/axiosInstance';
import { useNavigate } from 'react-router-dom';
import { 
  FiFilter, 
  FiArrowDownCircle, 
  FiPlus, 
  FiEdit, 
  FiUser, 
  FiMail, 
  FiShield,
  FiUserX,
  FiUserCheck,
  FiMoreHorizontal,
  FiTrash2
} from 'react-icons/fi';

function AdminUsers() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('username');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [showDropdown, setShowDropdown] = useState(null);

  // Estado para novo usuário
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    is_admin: false,
    password: '',
  });

  // Manteremos a sidebar aberta por padrão em telas maiores
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);

  const filteredUsers = users.filter(user => {
    let roleMatch = true;
    let statusMatch = true;

    if (filterRole === 'admin') roleMatch = user.is_admin;
    if (filterRole === 'user') roleMatch = !user.is_admin;
    
    if (filterStatus === 'active') statusMatch = user.is_active !== false;
    if (filterStatus === 'inactive') statusMatch = user.is_active === false;

    return roleMatch && statusMatch;
  });

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    if (sortBy === 'username') return a.username.localeCompare(b.username);
    if (sortBy === 'email') return a.email.localeCompare(b.email);
    if (sortBy === 'role') return (b.is_admin ? 1 : 0) - (a.is_admin ? 1 : 0);
    if (sortBy === 'status') return (b.is_active ? 1 : 0) - (a.is_active ? 1 : 0);
    return 0;
  });

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await api.get('/users');
        console.log('Usuários recebidos no frontend:', response.data);
        setUsers(response.data);
      } catch (error) {
        console.error('Erro ao buscar usuários:', error);
        setError('Erro ao buscar usuários. Verifique suas permissões.');
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();

    const handleResize = () => {
      if (window.innerWidth <= 768) {
        setSidebarOpen(false);
      }
    };

    const handleClickOutside = () => {
      setShowDropdown(null);
    };

    window.addEventListener('resize', handleResize);
    document.addEventListener('click', handleClickOutside);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const savedFilter = localStorage.getItem('userFilterRole');
    const savedStatus = localStorage.getItem('userFilterStatus');
    const savedSort = localStorage.getItem('userSortBy');

    if (savedFilter) setFilterRole(savedFilter);
    if (savedStatus) setFilterStatus(savedStatus);
    if (savedSort) setSortBy(savedSort);
  }, []);

  useEffect(() => {
    localStorage.setItem('userFilterRole', filterRole);
    localStorage.setItem('userFilterStatus', filterStatus);
    localStorage.setItem('userSortBy', sortBy);
  }, [filterRole, filterStatus, sortBy]);

  const handleLogout = async () => {
    try {
      await api.post('/logout');
    } catch (err) {
      console.error('Erro ao fazer logout:', err);
    } finally {
      localStorage.removeItem('auth');
      navigate('/login');
    }
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const resetForm = () => {
    setNewUser({ username: '', email: '', is_admin: false, password: '' });
  };

  const handleCreateUser = async () => {
    if (!newUser.username || !newUser.email || !newUser.password) {
      alert('Todos os campos são obrigatórios!');
      return;
    }

    try {
      const response = await api.post('/users/', newUser);
      setUsers([...users, response.data]);
      resetForm();
      setShowUserForm(false);
      console.log('Usuário criado com sucesso:', response.data);
    } catch (error) {
      console.error('Erro ao criar usuário:', error);
      alert('Erro ao criar usuário. Tente novamente.');
    }
  };

  const handleUpdateUser = async (userId, userData) => {
    try {
      const response = await api.put(`/users/${userId}`, userData);
      setUsers(prev => prev.map(u => u.id === userId ? response.data : u));
      setEditingUser(null);
      console.log('Usuário atualizado com sucesso:', response.data);
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      alert('Erro ao atualizar usuário. Tente novamente.');
    }
  };

  const toggleAdmin = async (userId, currentValue) => {
    try {
      await api.put(`/users/${userId}`, { is_admin: !currentValue });
      setUsers(users.map(u => u.id === userId ? { ...u, is_admin: !currentValue } : u));
    } catch (error) {
      console.error('Erro ao alterar permissão:', error);
      alert('Erro ao alterar permissão');
    }
  };

  const toggleUserStatus = async (userId, currentStatus) => {
    try {
      const newStatus = !currentStatus;
      await api.put(`/users/${userId}`, { is_active: newStatus });
      setUsers(users.map(u => u.id === userId ? { ...u, is_active: newStatus } : u));
      setShowDropdown(null);
    } catch (error) {
      console.error('Erro ao alterar status do usuário:', error);
      alert('Erro ao alterar status do usuário');
    }
  };

  const cancelDelete = () => {
    setUserToDelete(null);
    setShowDeleteModal(false);
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;

    try {
      await api.delete(`/users/${userToDelete.id}`);
      setUsers(prev => prev.filter(u => u.id !== userToDelete.id));
    } catch (error) {
      console.error('Erro ao excluir usuário:', error);
      alert('Erro ao excluir usuário');
    } finally {
      setUserToDelete(null);
      setShowDeleteModal(false);
      setShowDropdown(null);
    }
  };

  if (loading) {
    return (
      <div className={styles.spinnerContainer}>
        <div className={styles.spinner}></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorMessage}>
          <h2>Erro</h2>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>Tentar Novamente</button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.adminUsersPage}>
      <Header onLogout={handleLogout} onMenuToggle={toggleSidebar} />

      <div className={styles.pageBody}>
        <Sidebar isOpen={sidebarOpen} />
        
        <main className={styles.contentArea}>
          <div className={styles.usersWrapper}>
            <div className={styles.usersHeader}>
              <h2>Administração de Usuários</h2>
              <button className={styles.addUserBtn} onClick={() => setShowUserForm(true)}>
                <FiPlus className={styles.btnIcon} />
                Novo Usuário
              </button>
            </div>
            
            <div className={styles.controls}>
              <div className={styles.controlGroup}>
                <label className={styles.controlLabel}>
                  <FiFilter className={styles.icon} />
                  Função:
                  <select 
                    className={styles.select} 
                    value={filterRole} 
                    onChange={(e) => setFilterRole(e.target.value)}
                  >
                    <option value="all">Todos</option>
                    <option value="admin">Administradores</option>
                    <option value="user">Usuários</option>
                  </select>
                </label>
              </div>

              <div className={styles.controlGroup}>
                <label className={styles.controlLabel}>
                  <FiFilter className={styles.icon} />
                  Status:
                  <select 
                    className={styles.select} 
                    value={filterStatus} 
                    onChange={(e) => setFilterStatus(e.target.value)}
                  >
                    <option value="all">Todos</option>
                    <option value="active">Ativos</option>
                    <option value="inactive">Inativos</option>
                  </select>
                </label>
              </div>

              <div className={styles.controlGroup}>
                <label className={styles.controlLabel}>
                  <FiArrowDownCircle className={styles.icon} />
                  Ordenar por:
                  <select 
                    className={styles.select} 
                    value={sortBy} 
                    onChange={(e) => setSortBy(e.target.value)}
                  >
                    <option value="username">Nome de usuário</option>
                    <option value="email">Email</option>
                    <option value="role">Função</option>
                    <option value="status">Status</option>
                  </select>
                </label>
              </div>
            </div>

            <div className={styles.usersList}>
              {sortedUsers.length === 0 ? (
                <div className={styles.emptyUsers}>
                  {filterRole === 'admin' && filterStatus === 'all' && "Nenhum administrador encontrado."}
                  {filterRole === 'user' && filterStatus === 'all' && "Nenhum usuário encontrado."}
                  {filterRole === 'all' && filterStatus === 'active' && "Nenhum usuário ativo encontrado."}
                  {filterRole === 'all' && filterStatus === 'inactive' && "Nenhum usuário inativo encontrado."}
                  {filterRole === 'all' && filterStatus === 'all' && "Nenhum usuário cadastrado."}
                </div>
              ) : (
                sortedUsers.map(user => (
                  <div key={user.id} className={`${styles.userItem} ${user.is_active === false ? styles.inactiveUser : ''}`}>
                    <div className={styles.userInfo}>
                      <div className={styles.userAvatar}>
                        <FiUser className={styles.avatarIcon} />
                      </div>
                      <div className={styles.userDetails}>
                        <div className={styles.userName}>
                          {user.username}
                          {user.is_admin && (
                            <span className={styles.adminBadge}>
                              <FiShield className={styles.badgeIcon} />
                              Admin
                            </span>
                          )}
                          {user.is_active === false && (
                            <span className={styles.inactiveBadge}>
                              <FiUserX className={styles.badgeIcon} />
                              Inativo
                            </span>
                          )}
                        </div>
                        <div className={styles.userEmail}>
                          <FiMail className={styles.emailIcon} />
                          {user.email}
                        </div>
                      </div>
                    </div>
                    <div className={styles.userActions}>
                      <label className={styles.adminToggle}>
                        <input
                          type="checkbox"
                          checked={user.is_admin}
                          onChange={() => toggleAdmin(user.id, user.is_admin)}
                        />
                        <span className={styles.toggleSlider}></span>
                        <span className={styles.toggleLabel}>Admin</span>
                      </label>
                      <button
                        className={styles.editBtn}
                        onClick={() => setEditingUser(user)}
                        title="Editar usuário"
                      >
                        <FiEdit />
                      </button>
                      <div className={styles.dropdown}>
                        <button
                          className={styles.moreBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowDropdown(showDropdown === user.id ? null : user.id);
                          }}
                          title="Mais opções"
                        >
                          <FiMoreHorizontal />
                        </button>
                        {showDropdown === user.id && (
                          <div className={styles.dropdownMenu}>
                            <button
                              className={styles.dropdownItem}
                              onClick={() => toggleUserStatus(user.id, user.is_active !== false)}
                            >
                              {user.is_active !== false ? (
                                <>
                                  <FiUserX className={styles.dropdownIcon} />
                                  Inativar Usuário
                                </>
                              ) : (
                                <>
                                  <FiUserCheck className={styles.dropdownIcon} />
                                  Ativar Usuário
                                </>
                              )}
                            </button>
                            <button
                              className={`${styles.dropdownItem} ${styles.dangerItem}`}
                              onClick={() => {
                                setUserToDelete(user);
                                setShowDeleteModal(true);
                              }}
                            >
                              <FiTrash2 className={styles.dropdownIcon} />
                              Excluir Permanentemente
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </main>

        {/* Modal para criar novo usuário */}
        {showUserForm && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>Novo Usuário</h3>
                <button 
                  className={styles.closeButton}
                  onClick={() => {
                    setShowUserForm(false);
                    resetForm();
                  }}
                >
                  ×
                </button>
              </div>
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Nome de usuário</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={newUser.username}
                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                    placeholder="Digite o nome de usuário"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Email</label>
                  <input
                    type="email"
                    className={styles.input}
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    placeholder="Digite o email"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Senha</label>
                  <input
                    type="password"
                    className={styles.input}
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    placeholder="Digite a senha"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={newUser.is_admin}
                      onChange={(e) => setNewUser({ ...newUser, is_admin: e.target.checked })}
                    />
                    <span className={styles.checkboxText}>Administrador</span>
                  </label>
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button 
                  className={styles.cancelBtn}
                  onClick={() => {
                    setShowUserForm(false);
                    resetForm();
                  }}
                >
                  Cancelar
                </button>
                <button 
                  className={styles.saveBtn}
                  onClick={handleCreateUser}
                >
                  Criar Usuário
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal para editar usuário */}
        {editingUser && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>Editar Usuário</h3>
                <button 
                  className={styles.closeButton}
                  onClick={() => setEditingUser(null)}
                >
                  ×
                </button>
              </div>
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Nome de usuário</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={editingUser.username}
                    onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })}
                    placeholder="Digite o nome de usuário"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Email</label>
                  <input
                    type="email"
                    className={styles.input}
                    value={editingUser.email}
                    onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                    placeholder="Digite o email"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={editingUser.is_admin}
                      onChange={(e) => setEditingUser({ ...editingUser, is_admin: e.target.checked })}
                    />
                    <span className={styles.checkboxText}>Administrador</span>
                  </label>
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button 
                  className={styles.cancelBtn}
                  onClick={() => setEditingUser(null)}
                >
                  Cancelar
                </button>
                <button 
                  className={styles.saveBtn}
                  onClick={() => handleUpdateUser(editingUser.id, editingUser)}
                >
                  Salvar Alterações
                </button>
              </div>
            </div>
          </div>
        )}

        <DeleteConfirmModal 
          isOpen={showDeleteModal} 
          onCancel={cancelDelete} 
          onConfirm={confirmDelete} 
          taskTitle={userToDelete?.username || ''} 
        />
      </div>
    </div>
  );
}

export default AdminUsers;

