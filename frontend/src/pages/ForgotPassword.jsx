import React, { useState, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import styles from './ForgotPassword.module.css';      // reutiliza o mesmo CSS do login
import logo from '../assets/zg.png';

const API = 'http://10.1.243.120:5555/api';
axios.defaults.timeout = 10000;

export default function ForgotPassword() {
  const q = useMemo(() => new URLSearchParams(window.location.search), []);
  const initialEmail = q.get('email') || '';

  const [email, setEmail] = useState(initialEmail);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      await axios.post(`${API}/password/forgot`, { email }, { timeout: 10000 });
      // Resposta é sempre 200 (genérica), indicamos sucesso na UI
      setSent(true);
    } catch (error) {
      if (error.code === 'ECONNABORTED' || !error.response) {
        setErr('Não foi possível conectar ao servidor. Tente novamente em alguns minutos.');
      } else {
        setErr(error.response?.data?.error || 'Não foi possível enviar o e-mail de redefinição.');
      }
      setSent(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      <main className={styles.card}>
        <div className={styles.leftPanel}>
          <h2 className={styles.title}>Redefinir senha</h2>

          {!sent ? (
            <form onSubmit={submit} className={styles.form}>
              <input
                type="email"
                className={styles.input}
                placeholder="E-mail corporativo"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <button type="submit" disabled={loading} className={styles.submitBtn}>
                {loading ? 'Enviando...' : 'Enviar link por e-mail'}
              </button>

              <div className={styles.helperRow}>
                <button
                  type="button"
                  className={styles.linkBtn}
                  onClick={() => navigate('/login')}
                >
                  Voltar para o login
                </button>
              </div>
            </form>
          ) : (
            <>
              <p style={{ textAlign: 'center' }}>
                Se o endereço existir e estiver ativo, você receberá um link para redefinir sua senha.
              </p>
              <div className={styles.helperRow}>
                <button
                  type="button"
                  className={styles.linkBtn}
                  onClick={() => navigate('/login')}
                >
                  Ir para o login
                </button>
              </div>
            </>
          )}

          {err && <p className={styles.error}>{err}</p>}
        </div>

        <div className={styles.rightPanel}>
          <img src={logo} alt="Zavagna Gralha" className={styles.logo} />
        </div>
      </main>
    </div>
  );
}
