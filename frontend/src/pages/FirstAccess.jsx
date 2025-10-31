// src/pages/FirstAccess.jsx
import React, { useState } from 'react';
import axios from 'axios';
import styles from '../components/Login.module.css';
import { useLocation, useNavigate } from 'react-router-dom';

const API = 'http://10.1.243.120:5555/api';

export default function FirstAccess() {
  const [current, setCurrent] = useState('');
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const emailFromLogin = location.state?.email || localStorage.getItem('email') || '';

  const handleChange = async (e) => {
    e.preventDefault();
    setErr('');
    if (pw.length < 8) { setErr('A nova senha deve ter pelo menos 8 caracteres'); return; }
    if (pw !== confirm) { setErr('As senhas não conferem'); return; }

    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');
      await axios.put(
        `${API}/users/change-password`,
        { current_password: current, new_password: pw, confirm_password: confirm },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // sucesso: limpa tudo e volta pro login
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      navigate('/login', { state: { msg: 'Senha alterada com sucesso. Faça login novamente.' } });
    } catch (e) {
      setErr(e.response?.data?.message || e.response?.data?.error || 'Erro ao alterar senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <main className={styles.card}>
        <div className={styles.leftPanel}>
          <h2 className={styles.title}>Primeiro acesso</h2>
          <p style={{marginTop: -6, marginBottom: 14, color:'#475569', textAlign:'center'}}>
            Olá{emailFromLogin ? `, ${emailFromLogin}` : ''}! Defina sua nova senha para continuar.
          </p>

          <form onSubmit={handleChange} className={styles.form}>
            <input
              type="password"
              className={styles.input}
              placeholder="Senha atual"
              value={current}
              onChange={(e)=>setCurrent(e.target.value)}
              required
            />
            <input
              type="password"
              className={styles.input}
              placeholder="Nova senha (mín. 8 caracteres)"
              value={pw}
              onChange={(e)=>setPw(e.target.value)}
              required
            />
            <input
              type="password"
              className={styles.input}
              placeholder="Confirmar nova senha"
              value={confirm}
              onChange={(e)=>setConfirm(e.target.value)}
              required
            />

            <button type="submit" disabled={loading} className={styles.submitBtn}>
              {loading ? 'Salvando...' : 'Salvar nova senha'}
            </button>

            {err && <p className={styles.error}>{err}</p>}
          </form>
        </div>

        <div className={styles.rightPanel}>
          {/* Pode reutilizar o mesmo logo do login */}
          <div className={styles.logo} style={{color:'#fff', textAlign:'center'}}>
            <strong>ZG Planner</strong><br/>Troca de senha
          </div>
        </div>
      </main>
    </div>
  );
}
