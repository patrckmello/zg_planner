// frontend/src/auth.js
export async function isAuthenticated() {
  const token = localStorage.getItem('access_token');
  const userStr = localStorage.getItem('user');

  if (!token || !userStr) return null;

  try {
    const user = JSON.parse(userStr);
    return user; // deve conter is_admin
  } catch {
    return null;
  }
}
