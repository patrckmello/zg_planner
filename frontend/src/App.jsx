import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import PrivateRoute from './components/PrivateRoute'
import SessionRedirect from './components/SessionRedirect'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<SessionRedirect />} />
        <Route path="/login" element={<Login />} />
        
        {/* Protegendo as rotas abaixo */}
        <Route element={<PrivateRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
        </Route>
      </Routes>
    </Router>
  )
}

export default App
