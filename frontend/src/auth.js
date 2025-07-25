import axios from 'axios';

export async function isAuthenticated() {
  try {
    const token = localStorage.getItem('access_token');
    await axios.get('http://localhost:5555/api/dashboard', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return true;
  } catch {
    return false;
  }
}
