import axios from 'axios'

export async function isAuthenticated() {
  try {
    await axios.get('http://localhost:5000/api/dashboard', { withCredentials: true })
    return true
  } catch {
    return false
  }
}
