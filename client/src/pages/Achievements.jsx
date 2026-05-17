import { useState, useEffect, Fragment } from 'react';
import { api } from '../api';

export default function Achievements() {
  const [data, setData] = useState(null);
  const [quarter, setQuarter] = useState('Q1');
  const [error, setError] = useState('');

  const load = () => {
    api.get('/achievements').then(d => {
      setData(d);
      if (d.active_window && ['Q1','Q2','Q3','Q4'].includes(d.active_window)) {
        setQuarter(d.active_window);
      }
    }).catch(err => setError(err.message));
  };
  useEffect(load, []);

  if (!data) return <div className="animate-pulse p-8 text-gray-500">Loading...</div>;
  const { sheet, goals, cycle, active_window, window_dates } = data;
  const isQuarterOpen = active_window === quarter;

  const save = async (gid, actual, status) => {
    setError('');
    try {
      await api.post(`/achievements/${gid}`, { quarter, actual, status });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-3">
        <div>
          <h2 className="text-2xl font-bold">Track Achievements</h2>
          {active_window && window_dates && (
            <p className="text-sm text-gray-500 mt-1">Active window: <span className="font-semibold text-brand">{active_window}</span> ({window_dates.start} to {window_dates.end})</p>
          )}
          {!active_window && <p className="text-sm text-orange-500 mt-1">No check-in window is currently open.</p>}
        </div>
        <div className="flex gap-1">
          {['Q1','Q2','Q3','Q4'].map(q => (
            <button key={q} onClick={() => setQuarter(q)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                quarter===q
                  ? (active_window===q ? 'bg-brand text-gray-900' : 'bg-gray-600 text-white')
                  : (active_window===q ? 'bg-brand/20 text-brand border border-brand' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')
              }`}>{q} {active_window===q ? '●' : ''}</button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm flex justify-between">
          <span>{error}</span><button className="ml-2 font-bold" onClick={() => setError('')}>×</button>
        </div>
      )}

      {!isQuarterOpen && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-lg mb-4 text-sm">
          ⚠️ <strong>{quarter} window is not open.</strong> You can view past data but cannot save changes.{active_window ? ` Currently open: ${active_window}.` : ''}
        </div>
      )}

      {!sheet ? (
        <div className="bg-blue-50 text-blue-700 px-4 py-3 rounded-lg">No approved goal sheet found. Please create and get your goals approved first.</div>
      ) : (
        <div className="space-y-4">
          {goals.map(g => <GoalAchievementCard key={g.goal_id} goal={g} quarter={quarter} onSave={save} disabled={!isQuarterOpen} />)}
          <div className="bg-white rounded-xl shadow-sm p-6 mt-6">
            <h3 className="font-bold mb-4">Progress Summary</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Goal</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Weight</th>
                    {['Q1','Q2','Q3','Q4'].map(q => (
                      <Fragment key={q}>
                        <th className={`px-4 py-2 text-center text-xs font-semibold uppercase ${active_window===q ? 'text-brand' : 'text-gray-500'}`}>{q} Actual</th>
                        <th className={`px-4 py-2 text-center text-xs font-semibold uppercase ${active_window===q ? 'text-brand' : 'text-gray-500'}`}>{q} Score</th>
                      </Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {goals.map(g => (
                    <tr key={g.goal_id}>
                      <td className="px-4 py-2 font-semibold">{g.goal_title}</td>
                      <td className="px-4 py-2">{g.weightage}%</td>
                      {['q1','q2','q3','q4'].map(q => (
                        <Fragment key={q}>
                          <td className="px-2 py-2 text-center">{g[`${q}_actual`] || '—'}</td>
                          <td className="px-2 py-2 text-center">{g[`${q}_score`] != null ? `${g[`${q}_score`]}%` : '—'}</td>
                        </Fragment>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GoalAchievementCard({ goal, quarter, onSave, disabled }) {
  const q = quarter.toLowerCase();
  const [actual, setActual] = useState(goal[`${q}_actual`] || '');
  const [status, setStatus] = useState(goal[`${q}_status`] || 'NOT_STARTED');
  const score = goal[`${q}_score`];

  useEffect(() => {
    setActual(goal[`${q}_actual`] || '');
    setStatus(goal[`${q}_status`] || 'NOT_STARTED');
  }, [quarter, goal]);

  return (
    <div className={`bg-white rounded-xl shadow-sm p-5 ${disabled ? 'opacity-75' : ''}`}>
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex-1">
          <h4 className="font-bold">{goal.goal_title}</h4>
          <p className="text-gray-500 text-xs mt-1">{goal.thrust_area_name || ''} · UoM: {goal.uom_type} · Target: {goal.target_value} · Weight: {goal.weightage}%</p>
        </div>
        {score != null && (
          <div className="text-center">
            <p className={`text-2xl font-bold ${score>=80?'text-green-600':score>=50?'text-yellow-600':'text-red-600'}`}>{score}%</p>
            <p className="text-xs text-gray-500">{quarter} Score</p>
          </div>
        )}
        <div className="flex gap-2 items-end">
          <div>
            <label className="text-xs text-gray-500 block">Actual</label>
            <input value={actual} onChange={e => setActual(e.target.value)} disabled={disabled}
              className={`w-28 border rounded-lg px-3 py-2 text-sm ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block">Status</label>
            <select value={status} onChange={e => setStatus(e.target.value)} disabled={disabled}
              className={`border rounded-lg px-3 py-2 text-sm ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}>
              <option value="NOT_STARTED">Not Started</option>
              <option value="ON_TRACK">On Track</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>
          <button onClick={() => onSave(goal.goal_id, actual, status)} disabled={disabled}
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${disabled ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-brand text-gray-900 hover:bg-brand-dark'}`}>
            {disabled ? '🔒 Locked' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
