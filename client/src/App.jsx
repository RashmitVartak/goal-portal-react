import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Achievements from './pages/Achievements';
import ManagerApprovals from './pages/ManagerApprovals';
import ManagerCheckins from './pages/ManagerCheckins';
import AdminPanel from './pages/AdminPanel';
import Reports from './pages/Reports';
import Analytics from './pages/Analytics';
import Escalation from './pages/Escalation';

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function RoleGuard({ roles, children }) {
  const { user } = useAuth();
  if (!user || (roles && !roles.includes(user.role))) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="achievements" element={<Achievements />} />
        <Route path="approvals" element={<RoleGuard roles={['MANAGER','ADMIN']}><ManagerApprovals /></RoleGuard>} />
        <Route path="checkins" element={<RoleGuard roles={['MANAGER','ADMIN']}><ManagerCheckins /></RoleGuard>} />
        <Route path="admin" element={<RoleGuard roles={['ADMIN']}><AdminPanel /></RoleGuard>} />
        <Route path="reports" element={<Reports />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="escalation" element={<RoleGuard roles={['ADMIN']}><Escalation /></RoleGuard>} />
      </Route>
    </Routes>
  );
}