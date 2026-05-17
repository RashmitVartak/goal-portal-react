import { useState, useEffect } from 'react';
import { api } from '../api';

const UOM_LABELS = { NUMERIC_MIN: 'Numeric (Higher=Better)', NUMERIC_MAX: 'Numeric (Lower=Better)', PERCENT_MIN: '% (Higher=Better)', PERCENT_MAX: '% (Lower=Better)', TIMELINE: 'Timeline', ZERO: 'Zero-based' };

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [thrustAreas, setThrustAreas] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editGoal, setEditGoal] = useState(null);
  const [form, setForm] = useState({ goal_title: '', goal_description: '', thrust_area_id: '', uom_type: 'NUMERIC_MIN', target_value: '', weightage: 10 });
  const [error, setError] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);

  const load = () => { api.get('/dashboard').then(setData); api.get('/thrust-areas').then(setThrustAreas); };
  useEffect(load, []);

  if (!data) return <div className="animate-pulse">Loading...</div>;
  const { cycle, sheet, goals, team_pending, shared_goals, active_window, window_dates } = data;
  const totalWeight = goals.reduce((s, g) => s + g.weightage, 0);
  const isGoalSettingOpen = active_window === 'GOAL_SETTING';

  const createSheet = async () => { await api.post('/goal-sheets'); load(); };

  const addGoal = async (e) => {
    e.preventDefault(); setError('');
    const newTotal = totalWeight + parseFloat(form.weightage || 0);
    if (newTotal > 100) {
      setError(`Adding this goal would make total weightage ${newTotal}%. Total must not exceed 100% (current: ${totalWeight}%).`);
      return;
    }
    try {
      await api.post('/goals', { ...form, thrust_area_id: form.thrust_area_id || null });
      setForm({ goal_title: '', goal_description: '', thrust_area_id: '', uom_type: 'NUMERIC_MIN', target_value: '', weightage: 10 });
      setShowForm(false); load();
    } catch (err) { setError(err.message); }
  };

  const saveEdit = async (e) => {
    e.preventDefault(); setError('');
    const otherWeight = goals.filter(g => g.goal_id !== editGoal.goal_id).reduce((s, g) => s + g.weightage, 0);
    const newTotal = otherWeight + parseFloat(editGoal.weightage || 0);
    if (newTotal > 100) {
      setError(`Saving this would make total weightage ${newTotal}%. Total must not exceed 100% (other goals: ${otherWeight}%).`);
      return;
    }
    try {
      await api.put(`/goals/${editGoal.goal_id}`, editGoal);
      setEditGoal(null); load();
    } catch (err) { setError(err.message); }
  };

  const deleteGoal = (id) => {
    setConfirmAction({ message: 'Are you sure you want to delete this goal?', onConfirm: async () => { await api.del(`/goals/${id}`); setConfirmAction(null); load(); } });
  };

  const submitGoals = () => {
    setConfirmAction({ message: 'Submit your goals for manager approval? You won\'t be able to edit after submission.', onConfirm: async () => {
      try { await api.post('/goal-sheets/submit'); setConfirmAction(null); load(); } catch (err) { setConfirmAction(null); setError(err.message); }
    }});
  };

  const addShared = async (sgid, w) => {
    try { await api.post(`/goals/add-shared/${sgid}`, { weightage: w }); load(); } catch (err) { setError(err.message); }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
          {cycle && <p className="text-gray-500 text-sm">{cycle.cycle_name}</p>}
        </div>
      </div>

      {error && (
        <Modal title="⚠️ Error" onClose={() => setError('')}>
          <div className="text-center">
            <div className="text-5xl mb-4">⚠️</div>
            <p className="text-red-600 font-semibold text-lg mb-2">Validation Error</p>
            <p className="text-gray-600 mb-6">{error}</p>
            <button onClick={() => setError('')} className="bg-blue-600 text-white px-8 py-2.5 rounded-lg font-semibold hover:bg-blue-700">OK, Got it</button>
          </div>
        </Modal>
      )}

      {confirmAction && (
        <Modal title="Confirm Action" onClose={() => setConfirmAction(null)}>
          <div className="text-center">
            <div className="text-5xl mb-4">🤔</div>
            <p className="text-gray-700 mb-6">{confirmAction.message}</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setConfirmAction(null)} className="bg-gray-100 text-gray-700 px-6 py-2.5 rounded-lg font-semibold hover:bg-gray-200">Cancel</button>
              <button onClick={confirmAction.onConfirm} className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-blue-700">Confirm</button>
            </div>
          </div>
        </Modal>
      )}

      {!cycle && <div className="bg-yellow-50 text-yellow-700 px-4 py-3 rounded-lg">No active cycle. Contact Admin.</div>}

      {cycle && <>
        {active_window && window_dates && (
          <div className={`px-4 py-3 rounded-lg mb-4 text-sm ${isGoalSettingOpen ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-amber-50 border border-amber-200 text-amber-700'}`}>
            {isGoalSettingOpen
              ? `✅ Goal Setting window is open (${window_dates.start} to ${window_dates.end}). You can create, edit, and submit goals.`
              : `⚠️ Goal Setting window is closed. Current window: ${active_window}. Goals cannot be created or modified.`}
          </div>
        )}
        {!active_window && (
          <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-lg mb-4 text-sm">
            ⚠️ No window is currently open. Goal creation and achievement tracking are disabled.
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Goals" value={`${goals.length} / 8`} color="blue" />
          <StatCard label="Total Weightage" value={`${totalWeight}%`} sub={totalWeight !== 100 && goals.length > 0 ? `${100 - totalWeight}% remaining` : null} color={totalWeight === 100 ? 'green' : 'orange'} />
          <StatCard label="Sheet Status" value={sheet ? sheet.status : 'Not Created'} color={sheet?.status === 'APPROVED' ? 'green' : sheet?.status === 'RETURNED' ? 'red' : 'blue'} />
          {data.user.role !== 'EMPLOYEE' && <StatCard label="Pending Approvals" value={team_pending} color="yellow" />}
        </div>

        {sheet?.status === 'RETURNED' && sheet.rejection_reason && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded mb-4"><strong>Manager Feedback:</strong> {sheet.rejection_reason}</div>
        )}

        {!sheet && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-10 text-center">
              <h3 className="text-xl font-semibold mb-2">Start your goal setting journey</h3>
              <p className="text-gray-500 mb-4">Create a goal sheet for the current cycle.</p>
              <button onClick={createSheet} className="bg-brand text-gray-900 px-6 py-3 rounded-lg font-semibold hover:bg-brand-dark">+ Create Goal Sheet</button>
            </div>
            {shared_goals.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="font-bold mb-3">📌 Departmental KPIs</h3>
                <p className="text-gray-500 text-xs mb-3">These shared goals will be available after you create your goal sheet.</p>
                {shared_goals.map(sg => (
                  <div key={sg.shared_goal_id} className="border rounded-lg p-3 mb-2">
                    <p className="font-semibold text-sm">{sg.source_goal_title}</p>
                    <p className="text-xs text-gray-500">Target: {sg.target_value} | {sg.uom_type}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {sheet && goals.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm mb-6">
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h3 className="font-bold">My Goals</h3>
              {sheet.status === 'APPROVED' && <span className="bg-green-100 text-green-700 text-xs px-3 py-1 rounded-full font-semibold">🔒 Locked</span>}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50"><tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Goal</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Thrust Area</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">UoM</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Target</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Weight</th>
                  {['DRAFT','RETURNED'].includes(sheet.status) && <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>}
                </tr></thead>
                <tbody className="divide-y">
                  {goals.map(g => (
                    <tr key={g.goal_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4"><div className="font-semibold">{g.goal_title}{g.is_shared ? <span className="ml-2 text-xs bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded">Shared</span> : null}</div>{g.goal_description && <div className="text-gray-500 text-xs mt-1">{g.goal_description.slice(0,80)}</div>}</td>
                      <td className="px-6 py-4 text-gray-600">{g.thrust_area_name || '—'}</td>
                      <td className="px-6 py-4"><span className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded">{g.uom_type}</span></td>
                      <td className="px-6 py-4">{g.target_value}</td>
                      <td className="px-6 py-4 font-bold">{g.weightage}%</td>
                      {['DRAFT','RETURNED'].includes(sheet.status) && (
                        <td className="px-6 py-4 space-x-2">
                          <button onClick={() => setEditGoal({...g})} className="text-blue-600 hover:text-blue-800 text-xs font-semibold">Edit</button>
                          <button onClick={() => deleteGoal(g.goal_id)} className="text-red-600 hover:text-red-800 text-xs font-semibold">Delete</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {editGoal && (
          <Modal title={`Edit: ${editGoal.goal_title}`} onClose={() => setEditGoal(null)}>
            <form onSubmit={saveEdit} className="space-y-4">
              {editGoal.is_shared ? (
                <><p className="text-gray-600 text-sm">Shared goal — only weightage can be changed.</p>
                <Input label="Weightage %" type="number" value={editGoal.weightage} onChange={v => setEditGoal({...editGoal, weightage: parseFloat(v)})} min={10} max={100} step={5} /></>
              ) : (
                <>
                <Input label="Goal Title" value={editGoal.goal_title} onChange={v => setEditGoal({...editGoal, goal_title: v})} required />
                <Input label="Description" value={editGoal.goal_description || ''} onChange={v => setEditGoal({...editGoal, goal_description: v})} textarea />
                <Select label="Thrust Area" value={editGoal.thrust_area_id || ''} onChange={v => setEditGoal({...editGoal, thrust_area_id: v})} options={thrustAreas.map(t => ({ value: t.thrust_area_id, label: t.thrust_area_name }))} />
                <Select label="UoM Type" value={editGoal.uom_type} onChange={v => setEditGoal({...editGoal, uom_type: v})} options={Object.entries(UOM_LABELS).map(([v,l]) => ({value:v,label:l}))} />
                <Input label="Target Value" value={editGoal.target_value || ''} onChange={v => setEditGoal({...editGoal, target_value: v})} required />
                <Input label="Weightage %" type="number" value={editGoal.weightage} onChange={v => setEditGoal({...editGoal, weightage: parseFloat(v)})} min={10} max={100} step={5} />
                </>
              )}
              <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700">Save Changes</button>
            </form>
          </Modal>
        )}

        {sheet && ['DRAFT','RETURNED'].includes(sheet.status) && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold">Add New Goal</h3>
                {!showForm && goals.length < 8 && <button onClick={() => setShowForm(true)} className="bg-brand text-gray-900 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark">+ Add Goal</button>}
              </div>
              {goals.length >= 8 && <p className="text-yellow-600">Maximum 8 goals reached.</p>}
              {showForm && goals.length < 8 && (
                <form onSubmit={addGoal} className="space-y-4">
                  <Input label="Goal Title *" value={form.goal_title} onChange={v => setForm({...form, goal_title: v})} required />
                  <Input label="Description" value={form.goal_description} onChange={v => setForm({...form, goal_description: v})} textarea />
                  <Select label="Thrust Area *" value={form.thrust_area_id} onChange={v => setForm({...form, thrust_area_id: v})} options={thrustAreas.map(t => ({ value: t.thrust_area_id, label: t.thrust_area_name }))} />

                  <div className="grid grid-cols-3 gap-4">
                    <Select label="UoM Type *" value={form.uom_type} onChange={v => setForm({...form, uom_type: v})} options={Object.entries(UOM_LABELS).map(([v,l]) => ({value:v,label:l}))} />
                    <Input label="Target Value *" value={form.target_value} onChange={v => setForm({...form, target_value: v})} required />
                    <Input label="Weightage % *" type="number" value={form.weightage} onChange={v => setForm({...form, weightage: parseFloat(v)})} min={10} max={100} step={5} />
                  </div>
                  <div className="flex gap-3">
                    <button type="submit" className="bg-brand text-gray-900 px-6 py-2 rounded-lg font-semibold hover:bg-brand-dark">Add Goal</button>
                    <button type="button" onClick={() => setShowForm(false)} className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg">Cancel</button>
                  </div>
                </form>
              )}
            </div>
            <div className="space-y-4">
              <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-brand">
                <h3 className="font-bold mb-1">📌 Shared Goals</h3>
                <p className="text-gray-500 text-xs mb-3">Departmental KPIs pushed by your manager/admin. Add them to your sheet.</p>
                {shared_goals.length === 0 ? <p className="text-gray-500 text-sm">No shared goals available.</p> : (
                  shared_goals.map(sg => <SharedGoalCard key={sg.shared_goal_id} sg={sg} onAdd={addShared} />)
                )}
              </div>
              {goals.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm p-6 text-center">
                  {totalWeight === 100 ? (
                    <><p className="text-green-600 font-bold mb-3">✅ Weightage = 100%</p>
                    <button onClick={submitGoals} className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700">Submit for Approval</button></>
                  ) : (
                    <button onClick={() => setError(`Total weightage is ${totalWeight}%. It must equal exactly 100% before you can submit. Please add or adjust goals.`)} className="w-full bg-red-50 text-red-600 py-3 rounded-lg font-semibold hover:bg-red-100 border border-red-200">⚠️ Weightage = {totalWeight}% — Must be 100%</button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {sheet?.status === 'APPROVED' && (
          <div>
            <div className="bg-green-50 border-l-4 border-green-500 text-green-700 px-4 py-3 rounded mt-4">✅ Your goals are approved and locked. Go to <a href="/achievements" className="underline font-semibold">Track Achievements</a> to log progress.</div>
            {shared_goals.length > 0 && (
              <div className="mt-4 bg-white rounded-xl shadow-sm p-6 border-l-4 border-brand">
                <h3 className="font-bold mb-1">📌 Available Shared Goals</h3>
                <p className="text-gray-500 text-xs mb-3">These departmental KPIs are available but your sheet is locked. Contact Admin to unlock if you need to add them.</p>
                {shared_goals.map(sg => (
                  <div key={sg.shared_goal_id} className="border border-amber-200 bg-amber-50 rounded-lg p-3 mb-2">
                    <p className="font-semibold text-sm">{sg.source_goal_title}</p>
                    <p className="text-xs text-gray-500">Target: {sg.target_value} | {sg.uom_type}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </>}
    </div>
  );
}

function StatCard({ label, value, sub, color }) {
  const colors = { blue: 'text-blue-600', green: 'text-green-600', red: 'text-red-600', orange: 'text-orange-600', yellow: 'text-yellow-600' };
  return (
    <div className="bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition-shadow">
      <p className="text-gray-500 text-sm">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${colors[color] || ''}`}>{value}</p>
      {sub && <p className="text-orange-500 text-xs mt-1">{sub}</p>}
    </div>
  );
}

function SharedGoalCard({ sg, onAdd }) {
  const [w, setW] = useState(10);
  return (
    <div className="border border-amber-200 bg-amber-50 rounded-lg p-3 mb-2">
      <p className="font-semibold text-sm">{sg.source_goal_title}</p>
      <p className="text-xs text-gray-500">Target: {sg.target_value} | {sg.uom_type}</p>
      {sg.thrust_area_name && <p className="text-xs text-amber-600">Thrust: {sg.thrust_area_name}</p>}
      <div className="flex gap-2 mt-2">
        <input type="number" value={w} onChange={e => setW(parseFloat(e.target.value))} min={10} max={100} step={5} className="w-20 border rounded px-2 py-1 text-sm" />
        <span className="text-sm text-gray-500 self-center">%</span>
        <button onClick={() => onAdd(sg.shared_goal_id, w)} className="bg-brand text-gray-900 px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-brand-dark">+ Add to My Goals</button>
      </div>
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <h3 className="font-bold text-lg">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, textarea, ...props }) {
  const cls = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm";
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>
      {textarea ? <textarea value={value} onChange={e => onChange(e.target.value)} className={cls} rows={2} {...props} />
        : <input value={value} onChange={e => onChange(e.target.value)} className={cls} {...props} />}
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm">
        <option value="">Select...</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
