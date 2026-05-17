import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect } from 'react';
import { api } from '../api';

const nav = [
  { to: '/', label: 'Dashboard', icon: '📋', roles: ['EMPLOYEE','MANAGER','ADMIN'] },
  { to: '/achievements', label: 'Track Achievements', icon: '📈', roles: ['EMPLOYEE','MANAGER','ADMIN'] },
  { to: '/approvals', label: 'Approve Goals', icon: '✅', roles: ['MANAGER','ADMIN'] },
  { to: '/checkins', label: 'Team Check-ins', icon: '👥', roles: ['MANAGER','ADMIN'] },
  { to: '/admin', label: 'Admin Panel', icon: '⚙️', roles: ['ADMIN'] },
  { to: '/escalation', label: 'Escalation', icon: '⚠️', roles: ['ADMIN'] },
  { to: '/reports', label: 'Reports', icon: '📊', roles: ['EMPLOYEE','MANAGER','ADMIN'] },
  { to: '/analytics', label: 'Analytics', icon: '📉', roles: ['EMPLOYEE','MANAGER','ADMIN'] },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const [notifCount, setNotifCount] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    api.get('/notifications').then(d => setNotifCount(d.unread_count)).catch(() => {});
  }, []);

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 bg-slate-900 transform transition-transform duration-300 lg:relative lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-5 border-b border-slate-700">
          <h1 className="text-lg font-bold flex items-center gap-2"><span className="text-2xl">⭐</span><span className="text-brand">TrackStar</span></h1>
        </div>
        <nav className="mt-4 px-3 space-y-1">
          {nav.filter(n => n.roles.includes(user.role)).map(n => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${isActive ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
              <span>{n.icon}</span>{n.label}
            </NavLink>
          ))}
        </nav>
        <div className="absolute bottom-0 w-full p-4 border-t border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white text-sm font-semibold">{user.employee_name}</p>
              <p className="text-slate-400 text-xs">{user.role} · {user.department}</p>
            </div>
            <button onClick={logout} className="text-slate-400 hover:text-white text-sm">Logout</button>
          </div>
        </div>
      </aside>
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b px-6 py-3 flex items-center justify-between lg:justify-end">
          <button className="lg:hidden text-gray-600" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
          <div className="flex items-center gap-4">
            {notifCount > 0 && <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">🔔 {notifCount}</span>}
            <span className="text-sm text-gray-600">{user.employee_name}</span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />}
    </div>
  );
}
