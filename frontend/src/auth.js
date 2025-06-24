export function isAuthenticated() {
  return localStorage.getItem('auth') === 'true'
}
