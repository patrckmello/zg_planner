import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import PrivateRoute from './components/PrivateRoute'
import SessionRedirect from './components/SessionRedirect'
import AdminUsers from './pages/AdminUsers'
import AdminRoles from './pages/AdminRoles'
import AdminTeams from './pages/AdminTeams'


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
          <Route path="/admin/cargos" element={<AdminRoles />} />
          <Route path="/admin/equipes" element={<AdminTeams />} />
        </Route>
      </Routes>
    </Router>
  )
}

export default App

