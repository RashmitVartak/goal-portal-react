import { useState, useEffect, Fragment } from 'react';
import { api } from '../api';

export default function Achievements() {
  const [data, setData] = useState(null);
  const [quarter, setQuarter] = useState('Q1');
  const [error, setError] = useState('');

  const load = () => {
    api.get('/achievements').then(setData).catch(err => setError(err.message));
  };
  useEffect(load, []);

  if (!data) return <div className="animate-pulse p-8 text-gray-500">Loading...</div>;
  const { sheet, goals, cycle } = data;

  const save = async (gid, actual, status) => {
    try {
      await api.post(`/achievements/${gid}`, { quarter, actual, status });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Track Achievements</h2>
        <div className="flex gap-1">
          {['Q1','Q2','Q3','Q4'].map(q => (
            <button key={q} onClick={() => setQuarter(q)} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${quarter===q?'bg-blue-600 text-white':'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>{q}</button>
          ))}
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm">{error}<button className="ml-2 font-bold" onClick={() => setError('')}>×</button></div>}

      {!sheet ? (
        <div className="bg-blue-50 text-blue-700 px-4 py-3 rounded-lg">No approved goal sheet found. Please create and get your goals approved first.</div>
      ) : (
        <div className="space-y-4">
          {goals.map(g => <GoalAchievementCard key={g.goal_id} goal={g} quarter={quarter} onSave={save} />)}
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
                        <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500 uppercase">{q} Actual</th>
                        <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500 uppercase">{q} Score</th>
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

function GoalAchievementCard({ goal, quarter, onSave }) {
  const q = quarter.toLowerCase();
  const [actual, setActual] = useState(goal[`${q}_actual`] || '');
  const [status, setStatus] = useState(goal[`${q}_status`] || 'NOT_STARTED');
  const score = goal[`${q}_score`];

  useEffect(() => {
    setActual(goal[`${q}_actual`] || '');
    setStatus(goal[`${q}_status`] || 'NOT_STARTED');
  }, [quarter, goal]);

  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
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
            <input value={actual} onChange={e => setActual(e.target.value)} className="w-28 border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block">Status</label>
            <select value={status} onChange={e => setStatus(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
              <option value="NOT_STARTED">Not Started</option>
              <option value="ON_TRACK">On Track</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>
          <button onClick={() => onSave(goal.goal_id, actual, status)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">Save</button>
        </div>
      </div>
    </div>
  );
}
