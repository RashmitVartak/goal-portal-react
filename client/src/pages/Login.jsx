import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [empId, setEmpId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, user } = useAuth();
  const navigate = useNavigate();

  if (user) { navigate('/'); return null; }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await login(empId, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🏁</div>
          <h1 className="text-2xl font-bold text-gray-900">Goal Portal</h1>
          <p className="text-gray-500 mt-1">Sign in to continue</p>
        </div>
        {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-1">Employee ID</label>
            <input type="text" value={empId} onChange={e => setEmpId(e.target.value)} placeholder="e.g. EMP001"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" required />
          </div>
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-1">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" required />
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors">Sign In</button>
        </form>
        <div className="mt-6 bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
          <p className="font-semibold mb-1">Demo Accounts:</p>
          <p>Admin: EMP001 / admin123</p>
          <p>Manager: EMP002 / manager123</p>
          <p>Employee: EMP003 / emp123</p>
        </div>
      </div>
    </div>
  );
}
