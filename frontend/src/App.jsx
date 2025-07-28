import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import PrivateRoute from './components/PrivateRoute'
import SessionRedirect from './components/SessionRedirect'
import AdminUsers from './pages/AdminUsers'


function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<SessionRedirect />} />
        <Route path="/login" element={<Login />} />
        
        {/* Protegendo rotas de usuário autenticado */}
        <Route element={<PrivateRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
        </Route>

        {/* Protegendo rotas de admin */}
        <Route element={<PrivateRoute adminOnly={true} />}>
          <Route path="/admin/users" element={<AdminUsers />} />
        </Route>
      </Routes>
    </Router>
  )
}

export default App
