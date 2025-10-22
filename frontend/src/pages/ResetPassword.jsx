import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import styles from './ForgotPassword.module.css';
import logo from '../assets/zg.png';

const API = 'http://10.1.243.120:5555/api';
axios.defaults.timeout = 10000;

export default function ResetPassword() {
  const q = useMemo(() => new URLSearchParams(window.location.search), []);
  const token = q.get('token') || '';
  const navigate = useNavigate();

  const [valid, setValid] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newPwd, setNewPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);

  useEffect(() => {
    async function validate() {
      try {
        await axios.get(`${API}/password/validate`, { params: { token }, timeout: 10000 });
        setValid(true);
      } catch {
        setValid(false);
      } finally {
        setLoading(false);
      }
    }
    validate();
  }, [token]);

  async function submit(e) {
    e.preventDefault();
    setErr('');

    if (newPwd.length < 6) {
      setErr('Senha deve ter pelo menos 6 caracteres');
      return;
    }
    if (newPwd !== confirm) {
      setErr('As senhas não coincidem');
      return;
    }

    try {
      await axios.post(`${API}/password/reset`, { token, new_password: newPwd }, { timeout: 10000 });
      setOk(true);
      setTimeout(() => navigate('/login'), 1500);
    } catch (error) {
      if (error.code === 'ECONNABORTED' || !error.response) {
        setErr('Não foi possível conectar ao servidor. Tente novamente em alguns minutos.');
      } else {
        setErr(error.response?.data?.error || 'Não foi possível redefinir a senha.');
      }
    }
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <main className={styles.card}>
          <div className={styles.leftPanel}>
            <h2 className={styles.title}>Validando link...</h2>
          </div>
          <div className={styles.rightPanel}>
            <img src={logo} alt="Zavagna Gralha" className={styles.logo} />
          </div>
        </main>
      </div>
    );
  }

  if (!valid) {
    return (
      <div className={styles.container}>
        <main className={styles.card}>
          <div className={styles.leftPanel}>
            <h2 className={styles.title}>Link inválido ou expirado</h2>
            <div className={styles.helperRow}>
              <button
                type="button"
                className={styles.linkBtn}
                onClick={() => navigate('/password/forgot')}
              >
                Solicitar novo link
              </button>
            </div>
          </div>
          <div className={styles.rightPanel}>
            <img src={logo} alt="Zavagna Gralha" className={styles.logo} />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <main className={styles.card}>
        <div className={styles.leftPanel}>
          {!ok ? (
            <>
              <h2 className={styles.title}>Criar nova senha</h2>
              <form onSubmit={submit} className={styles.form}>
                <input
                  type="password"
                  className={styles.input}
                  placeholder="Nova senha"
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                />
                <input
                  type="password"
                  className={styles.input}
                  placeholder="Confirmar nova senha"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
                <button type="submit" className={styles.submitBtn}>
                  Salvar nova senha
                </button>

                <div className={styles.helperRow}>
                  <button
                    type="button"
                    className={styles.linkBtn}
                    onClick={() => navigate('/login')}
                  >
                    Cancelar e voltar ao login
                  </button>
                </div>
              </form>
              {err && <p className={styles.error}>{err}</p>}
            </>
          ) : (
            <>
              <h2 className={styles.title}>Senha alterada!</h2>
              <p style={{ textAlign: 'center' }}>Redirecionando para o login...</p>
            </>
          )}
        </div>

        <div className={styles.rightPanel}>
          <img src={logo} alt="Zavagna Gralha" className={styles.logo} />
        </div>
      </main>
    </div>
  );
}
