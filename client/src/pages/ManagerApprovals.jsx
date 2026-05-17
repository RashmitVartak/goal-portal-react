import { useState, useEffect } from 'react';
import { api } from '../api';

export default function ManagerApprovals() {
  const [data, setData] = useState(null);
  const [editGoal, setEditGoal] = useState(null);
  const [error, setError] = useState('');

  const [weightError, setWeightError] = useState('');

  const load = () => {
    api.get('/manager/approvals').then(setData).catch(err => setError(err.message));
  };
  useEffect(load, []);

  if (error) return <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg">{error}</div>;
  if (!data) return <div className="animate-pulse p-8 text-gray-500">Loading...</div>;

  const approve = async (sid) => {
    if (confirm('Approve this goal sheet?')) {
      try { await api.post(`/manager/approve/${sid}`); load(); } catch (err) { setError(err.message); }
    }
  };
  const returnSheet = async (sid, reason) => {
    try { await api.post(`/manager/return/${sid}`, { reason }); load(); } catch (err) { setError(err.message); }
  };
  const saveGoal = async (gid) => {
    const item = data.find(d => d.goals.some(g => g.goal_id === gid));
    if (item) {
      const otherWeight = item.goals.filter(g => g.goal_id !== gid).reduce((s, g) => s + g.weightage, 0);
      const newTotal = otherWeight + parseFloat(editGoal.weightage || 0);
      if (newTotal > 100) {
        setWeightError(`Total weightage would be ${newTotal}%. Must not exceed 100%.`);
        return;
      }
    }
    try { await api.put(`/manager/goals/${gid}`, editGoal); setEditGoal(null); load(); } catch (err) { setError(err.message); }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Approve Goals</h2>
      {data.length === 0 ? (
        <div className="bg-blue-50 text-blue-700 px-4 py-3 rounded-lg">No pending goal sheets for approval.</div>
      ) : (
        data.map(item => <ApprovalCard key={item.sheet.sheet_id} item={item} onApprove={approve} onReturn={returnSheet} onEditGoal={setEditGoal} />)
      )}
      {editGoal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h3 className="font-bold text-lg mb-4">Edit Goal</h3>
            {weightError && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm">
                <div className="text-2xl text-center mb-2">⚠️</div>
                <p className="text-center font-semibold">{weightError}</p>
                <button onClick={() => setWeightError('')} className="mt-2 w-full bg-red-100 text-red-700 py-1.5 rounded-lg text-sm font-semibold hover:bg-red-200">OK, Got it</button>
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Target Value</label>
                <input value={editGoal.target_value || ''} onChange={e => setEditGoal({...editGoal, target_value: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Weightage %</label>
                <input type="number" value={editGoal.weightage} onChange={e => setEditGoal({...editGoal, weightage: parseFloat(e.target.value)})} min={10} max={100} step={5} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => saveGoal(editGoal.goal_id)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">Save</button>
                <button onClick={() => { setEditGoal(null); setWeightError(''); }} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ApprovalCard({ item, onApprove, onReturn, onEditGoal }) {
  const [reason, setReason] = useState('');
  const { sheet: s, goals, total_weight } = item;
  return (
    <div className="bg-white rounded-xl shadow-sm mb-6">
      <div className="px-6 py-4 border-b flex justify-between items-center">
        <div>
          <h3 className="font-bold">{s.employee_name}</h3>
          <p className="text-gray-500 text-sm">{s.designation} — {s.department} · Submitted: {s.submitted_at}</p>
        </div>
        <span className="bg-yellow-100 text-yellow-700 text-xs px-3 py-1 rounded-full font-semibold">Pending</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Goal</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Thrust Area</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">UoM</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Target</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Weight</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Edit</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {goals.map(g => (
              <tr key={g.goal_id}>
                <td className="px-6 py-3"><strong>{g.goal_title}</strong>{g.goal_description && <div className="text-gray-500 text-xs">{g.goal_description.slice(0,80)}</div>}</td>
                <td className="px-6 py-3">{g.thrust_area_name || '—'}</td>
                <td className="px-6 py-3">{g.uom_type}</td>
                <td className="px-6 py-3">{g.target_value}</td>
                <td className="px-6 py-3 font-bold">{g.weightage}%</td>
                <td className="px-6 py-3"><button onClick={() => onEditGoal({...g})} className="text-blue-600 text-xs font-semibold hover:text-blue-800">Edit</button></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-bold bg-gray-50">
              <td colSpan={4} className="px-6 py-3 text-right">Total:</td>
              <td className="px-6 py-3">{total_weight}%</td>
              <td className="px-6 py-3">{total_weight !== 100 ? <span className="text-red-500 text-xs">Must be 100%</span> : <span className="text-green-500 text-xs">OK</span>}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="px-6 py-4 border-t grid grid-cols-1 md:grid-cols-2 gap-4">
        <button onClick={() => onApprove(s.sheet_id)} className="bg-green-600 text-white py-2.5 rounded-lg font-semibold hover:bg-green-700">✅ Approve</button>
        <div className="flex gap-2">
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Feedback for rework..." className="flex-1 border rounded-lg px-3 py-2 text-sm" />
          <button onClick={() => onReturn(s.sheet_id, reason)} className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-100">Return</button>
        </div>
      </div>
    </div>
  );
}
