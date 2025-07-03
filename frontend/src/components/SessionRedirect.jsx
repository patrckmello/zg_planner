import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const SessionRedirect = () => {
  const navigate = useNavigate()

  useEffect(() => {
    fetch('http://localhost:5555/api/check-session', {
      credentials: 'include'
    })
      .then(res => res.json())
      .then(data => {
        if (data.logged_in) {
          navigate('/dashboard')
        } else {
          navigate('/login')
        }
      })
      .catch(() => {
        navigate('/login') // fallback se erro
      })
  }, [navigate])

  return null // ou um spinner se quiser
}

export default SessionRedirect
