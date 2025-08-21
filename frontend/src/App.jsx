import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import TasksPage from "./pages/TasksPage";
import PrivateRoute from "./components/PrivateRoute";
import SessionRedirect from "./components/SessionRedirect";
import AdminUsers from "./pages/AdminUsers";
import AdminRoles from "./pages/AdminRoles";
import AdminTeams from "./pages/AdminTeams";
import TaskFormPage from "./pages/TaskFormPage";
import EditTaskFormPage from "./pages/EditTaskFormPage";
import ReportsPage from "./pages/ReportsPage";
import ProfilePage from "./pages/ProfilePage";
import ConfigPage from "./pages/ConfigPage";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<SessionRedirect />} />
        <Route path="/login" element={<Login />} />

        {/* Protegendo rotas de usuário autenticado */}
        <Route element={<PrivateRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/tasks/new" element={<TaskFormPage />} />
          <Route path="/tasks/:id/edit" element={<EditTaskFormPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/meu-perfil" element={<ProfilePage />} />
        </Route>

        {/* Protegendo rotas de admin */}
        <Route element={<PrivateRoute adminOnly={true} />}>
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/cargos" element={<AdminRoles />} />
          <Route path="/admin/equipes" element={<AdminTeams />} />
          <Route path="/admin/config" element={<ConfigPage />} />
        </Route>
      </Routes>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        closeOnClick
        pauseOnHover
        draggable
        theme="colored"
      />
    </Router>
  );
}

export default App;
