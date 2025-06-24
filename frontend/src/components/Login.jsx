import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import styles from './Login.module.css'
import { FaEye, FaEyeSlash } from 'react-icons/fa'

function Login() {
  const [email, setEmail] = useState(() => localStorage.getItem('email') || '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    localStorage.setItem('email', email)
  }, [email])

  const validateEmail = (email) => {
    const re = /\S+@\S+\.\S+/
    return re.test(email)
  }

  const validatePassword = (password) => {
    return password.length >= 6
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    let valid = true

    if (!validateEmail(email)) {
      setEmailError('Email inválido')
      valid = false
    } else {
      setEmailError('')
    }

    if (!validatePassword(password)) {
      setPasswordError('Senha deve ter pelo menos 6 caracteres')
      valid = false
    } else {
      setPasswordError('')
    }

    if (!valid) {
      setLoading(false)
      return
    }

    try {
      const _res = await axios.post(
        'http://localhost:5000/api/login',
        { email, password },
        { withCredentials: true }
      )

      localStorage.setItem('auth', 'true')
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data.error || 'Erro no login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <h2>Login</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="E-mail"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            if (emailError) setEmailError('')
          }}
          required
        />
        {emailError && <p className={styles.error}>{emailError}</p>}

        <div className={styles.passwordWrapper}>
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Senha"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              if (passwordError) setPasswordError('')
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

        <button type="submit" disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  )
}

export default Login
