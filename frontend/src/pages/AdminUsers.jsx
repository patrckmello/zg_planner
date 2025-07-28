// frontend/src/pages/AdminUsers.jsx
import React, { useEffect, useState } from 'react';
import api from '../services/axiosInstance';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Estado para novo usuário, agora com password
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    is_admin: false,
    password: '',
  });

  // Fetch usuários na inicialização
  useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await api.get('/users');
        setUsers(res.data);
      } catch (e) {
        setError('Erro ao buscar usuários');
      } finally {
        setLoading(false);
      }
    }
    fetchUsers();
  }, []);

  // Função para criar usuário
  async function handleCreateUser() {
    if (!newUser.password) {
      alert('Senha é obrigatória!');
      return;
    }

    try {
      const res = await api.post('/users/', newUser);
      setUsers([...users, res.data]);
      setNewUser({ username: '', email: '', is_admin: false, password: '' });
    } catch {
      alert('Erro ao criar usuário');
    }
  }

  // Função para toggle is_admin
  async function toggleAdmin(userId, currentValue) {
    try {
      await api.put(`/users/${userId}`, { is_admin: !currentValue });
      setUsers(users.map(u => u.id === userId ? { ...u, is_admin: !currentValue } : u));
    } catch {
      alert('Erro ao alterar permissão');
    }
  }

  if (loading) return <p>Carregando usuários...</p>;
  if (error) return <p>{error}</p>;

  return (
    <div>
      <h2>Administração de Usuários</h2>

      <div>
        <input
          type="text"
          placeholder="Username"
          value={newUser.username}
          onChange={e => setNewUser({ ...newUser, username: e.target.value })}
        />
        <input
          type="email"
          placeholder="Email"
          value={newUser.email}
          onChange={e => setNewUser({ ...newUser, email: e.target.value })}
        />
        <input
          type="password"
          placeholder="Senha"
          value={newUser.password}
          onChange={e => setNewUser({ ...newUser, password: e.target.value })}
        />
        <label>
          Admin?
          <input
            type="checkbox"
            checked={newUser.is_admin}
            onChange={e => setNewUser({ ...newUser, is_admin: e.target.checked })}
          />
        </label>
        <button onClick={handleCreateUser}>Criar Usuário</button>
      </div>

      <ul>
        {users.map(user => (
          <li key={user.id}>
            {user.username} ({user.email}) - Admin: 
            <input
              type="checkbox"
              checked={user.is_admin}
              onChange={() => toggleAdmin(user.id, user.is_admin)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
