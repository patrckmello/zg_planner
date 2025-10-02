import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import styles from './Login.module.css';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import logo from "../assets/zg.png";

function Login() {
  const [email, setEmail] = useState(() => localStorage.getItem('email') || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    localStorage.setItem('email', email);
  }, [email]);

  const validateEmail = (email) => /\S+@\S+\.\S+/.test(email);
  const validatePassword = (password) => password.length >= 6;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    let valid = true;

    if (!validateEmail(email)) {
      setEmailError('Email inválido');
      valid = false;
    } else {
      setEmailError('');
    }

    if (!validatePassword(password)) {
      setPasswordError('Senha deve ter pelo menos 6 caracteres');
      valid = false;
    } else {
      setPasswordError('');
    }

    if (!valid) {
      setLoading(false);
      return;
    }

    try {
      const res = await axios.post('http://10.1.243.120:5555/api/login', { email, password });

      localStorage.setItem('access_token', res.data.access_token);
      localStorage.setItem('refresh_token', res.data.refresh_token);
      localStorage.setItem('user', JSON.stringify(res.data.user));

      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data.error || 'Erro no login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <main className={styles.card}>
        <div className={styles.leftPanel}>
          <h2 className={styles.title}>Entrar no sistema</h2>
          <form onSubmit={handleSubmit} className={styles.form}>
            <input
              type="email"
              className={styles.input}
              placeholder="E-mail"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError('');
              }}
              required
            />
            {emailError && <p className={styles.error}>{emailError}</p>}

            <div className={styles.passwordWrapper}>
              <input
                type={showPassword ? 'text' : 'password'}
                className={styles.input}
                placeholder="Senha"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (passwordError) setPasswordError('');
                }}
                required
              />
              <button
                type="button"
                className={styles.showPasswordBtn}
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Esconder senha' : 'Mostrar senha'}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
            {passwordError && <p className={styles.error}>{passwordError}</p>}

            <button
              type="submit"
              disabled={loading}
              className={styles.submitBtn}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
          {error && <p className={styles.error}>{error}</p>}
        </div>

        <div className={styles.rightPanel}>
          <img src={logo} alt="Zavagna Gralha" className={styles.logo} />
        </div>
      </main>
    </div>
  );
}

export default Login;
