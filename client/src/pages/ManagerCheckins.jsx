import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';

export default function ManagerCheckins() {
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quarter, setQuarter] = useState('Q1');
  const [error, setError] = useState('');
  const [showSharedForm, setShowSharedForm] = useState(false);
  const [thrustAreas, setThrustAreas] = useState([]);
  const [sgForm, setSgForm] = useState({ title:'', description:'', thrust_area_id:'', uom_type:'NUMERIC_MIN', target_value:'', department:'' });

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/manager/checkins?quarter=${quarter}`)
      .then(data => { setTeam(data || []); setError(''); })
      .catch(err => { setError(err.message); setTeam([]); })
      .finally(() => setLoading(false));
  }, [quarter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get('/thrust-areas').then(setThrustAreas).catch(() => {}); }, []);

  const addComment = async (sheet_id, comment) => {
    if (comment.trim()) {
      try {
        await api.post('/manager/checkins/comment', { sheet_id, quarter, comment });
        load();
      } catch (err) { setError(err.message); }
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Team Check-ins</h2>
        <div className="flex gap-1">
          {['Q1','Q2','Q3','Q4'].map(q => (
            <button key={q} onClick={() => setQuarter(q)} className={`px-4 py-2 rounded-lg text-sm font-semibold ${quarter===q?'bg-blue-600 text-white':'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>{q}</button>
          ))}
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm">{error}<button className="ml-2 font-bold" onClick={() => setError('')}>×</button></div>}

      {loading ? <div className="animate-pulse p-8 text-gray-500">Loading...</div> :
       team.length === 0 ? <div className="bg-blue-50 text-blue-700 px-4 py-3 rounded-lg">No team members found.</div> : (
        team.map((item, i) => <TeamMemberCard key={item.member.employee_id || i} item={item} quarter={quarter} onComment={addComment} />)
      )}

      <div className="mt-6 bg-white rounded-xl shadow-sm p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold">📌 Push Shared Goal / Departmental KPI</h3>
          <button onClick={() => setShowSharedForm(!showSharedForm)} className="bg-brand text-gray-900 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark">
            {showSharedForm ? 'Cancel' : '+ Push Goal to Team'}
          </button>
        </div>
        <p className="text-gray-500 text-sm mb-3">Push a departmental KPI to your team. Employees can add it to their goal sheet but can only adjust weightage — title and target are locked.</p>
        {showSharedForm && (
          <form onSubmit={async (e) => {
            e.preventDefault();
            try {
              await api.post('/admin/shared-goals', sgForm);
              setSgForm({ title:'', description:'', thrust_area_id:'', uom_type:'NUMERIC_MIN', target_value:'', department:'' });
              setShowSharedForm(false);
              setError('');
              alert('Shared goal pushed to team!');
            } catch (err) { setError(err.message); }
          }} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold mb-1">Goal Title *</label>
              <input value={sgForm.title} onChange={e => setSgForm({...sgForm, title: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" required />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold mb-1">Description</label>
              <input value={sgForm.description} onChange={e => setSgForm({...sgForm, description: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Thrust Area</label>
              <select value={sgForm.thrust_area_id} onChange={e => setSgForm({...sgForm, thrust_area_id: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">Select...</option>
                {thrustAreas.map(t => <option key={t.thrust_area_id} value={t.thrust_area_id}>{t.thrust_area_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">UoM Type *</label>
              <select value={sgForm.uom_type} onChange={e => setSgForm({...sgForm, uom_type: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
                {['NUMERIC_MIN','NUMERIC_MAX','PERCENT_MIN','PERCENT_MAX','TIMELINE','ZERO'].map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Target Value *</label>
              <input value={sgForm.target_value} onChange={e => setSgForm({...sgForm, target_value: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" required />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Department (blank = all)</label>
              <input value={sgForm.department} onChange={e => setSgForm({...sgForm, department: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. Sales" />
            </div>
            <div className="md:col-span-2">
              <button type="submit" className="bg-brand text-gray-900 px-6 py-2 rounded-lg font-semibold hover:bg-brand-dark">Push Shared Goal</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function TeamMemberCard({ item, quarter, onComment }) {
  const [comment, setComment] = useState('');
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const { member: m, goals, comments, weighted_score } = item;
  const q = quarter.toLowerCase();
  const statusColors = { COMPLETED: 'bg-green-100 text-green-700', ON_TRACK: 'bg-blue-100 text-blue-700', NOT_STARTED: 'bg-gray-100 text-gray-600' };

  const loadSummary = async () => {
    if (!m.sheet_id) return;
    setAiLoading(true);
    try {
      const res = await api.get(`/ai/checkin-summary/${m.sheet_id}?quarter=${quarter}`);
      setAiSummary(res);
    } catch { setAiSummary(null); }
    setAiLoading(false);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm mb-4">
      <div className="px-6 py-4 border-b flex justify-between items-center">
        <div>
          <h3 className="font-bold">{m.employee_name}</h3>
          <p className="text-gray-500 text-sm">{m.designation} — {m.department}</p>
        </div>
        <div className="flex items-center gap-3">
          {goals.length > 0 && (
            <button onClick={loadSummary} disabled={aiLoading}
              className="bg-amber-50 border border-amber-200 text-amber-700 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-amber-100 transition-colors">
              {aiLoading ? '🤖 Generating...' : '🤖 AI Summary'}
            </button>
          )}
          {goals.length > 0 && (
            <span className={`text-lg font-bold ${weighted_score>=80?'text-green-600':weighted_score>=50?'text-yellow-600':'text-gray-500'}`}>
              {quarter}: {weighted_score}%
            </span>
          )}
        </div>
      </div>

      {aiSummary && (
        <div className="px-6 py-4 bg-amber-50 border-b border-amber-200">
          <div className="flex justify-between items-start mb-3">
            <h4 className="font-bold text-amber-800 text-sm">🤖 AI Check-in Summary</h4>
            <button onClick={() => setAiSummary(null)} className="text-amber-400 hover:text-amber-600 text-sm">×</button>
          </div>
          <div className="text-sm text-gray-700 whitespace-pre-line mb-3">{aiSummary.summary.replace(/\*\*/g, '')}</div>
          {aiSummary.stats && (
            <div className="flex gap-3 mb-3 flex-wrap">
              <span className="bg-white border rounded px-2 py-1 text-xs font-semibold">Score: {aiSummary.stats.weighted_score}%</span>
              <span className="bg-green-50 border border-green-200 rounded px-2 py-1 text-xs text-green-700">{aiSummary.stats.completed} completed</span>
              <span className="bg-blue-50 border border-blue-200 rounded px-2 py-1 text-xs text-blue-700">{aiSummary.stats.on_track} on track</span>
              <span className="bg-gray-50 border rounded px-2 py-1 text-xs text-gray-600">{aiSummary.stats.not_started} not started</span>
            </div>
          )}
          {aiSummary.recommendations && aiSummary.recommendations.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-amber-800 mb-1">💡 Recommendations:</p>
              <ul className="text-xs text-gray-600 space-y-1">
                {aiSummary.recommendations.map((r, i) => <li key={i}>• {r}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
      {goals.length > 0 ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50"><tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Goal</th>
                <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Target</th>
                <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Actual</th>
                <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Score</th>
                <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Weight</th>
              </tr></thead>
              <tbody className="divide-y">{goals.map(g => (
                <tr key={g.goal_id}>
                  <td className="px-4 py-2 font-semibold">{g.goal_title}</td>
                  <td className="px-4 py-2 text-center">{g.target_value}</td>
                  <td className="px-4 py-2 text-center">{g[`${q}_actual`] || '—'}</td>
                  <td className="px-4 py-2 text-center"><span className={`text-xs px-2 py-1 rounded-full font-semibold ${statusColors[g[`${q}_status`]] || statusColors.NOT_STARTED}`}>{(g[`${q}_status`] || 'NOT_STARTED').replace(/_/g,' ')}</span></td>
                  <td className="px-4 py-2 text-center">{g[`${q}_score`] != null ? `${g[`${q}_score`]}%` : '—'}</td>
                  <td className="px-4 py-2 text-center">{g.weightage}%</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div className="px-6 py-4 border-t">
            {comments.map(c => (
              <div key={c.comment_id} className="border-l-4 border-blue-500 pl-3 mb-2">
                <p className="text-xs text-gray-500">{c.created_at}</p>
                <p className="text-sm">{c.comment_text}</p>
              </div>
            ))}
            <div className="flex gap-2 mt-2">
              <input value={comment} onChange={e => setComment(e.target.value)} placeholder="Add check-in comment..." className="flex-1 border rounded-lg px-3 py-2 text-sm" />
              <button onClick={() => { onComment(m.sheet_id, comment); setComment(''); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">Send</button>
            </div>
          </div>
        </>
      ) : (
        <div className="px-6 py-4 text-gray-500 text-sm">Goals: {m.goal_status || 'Not Started'}</div>
      )}
    </div>
  );
}
