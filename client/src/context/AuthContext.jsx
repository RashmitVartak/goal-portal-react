import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionStorage.getItem('trackstar_session')) {
      api.post('/logout').catch(() => {}).finally(() => {
        setUser(null);
        setLoading(false);
      });
    } else {
      api.get('/me').then(setUser).catch(() => setUser(null)).finally(() => setLoading(false));
    }
  }, []);

  const login = async (employee_id, password) => {
    const u = await api.post('/login', { employee_id, password });
    sessionStorage.setItem('trackstar_session', '1');
    setUser(u);
    return u;
  };

  const logout = async () => {
    await api.post('/logout');
    sessionStorage.removeItem('trackstar_session');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
