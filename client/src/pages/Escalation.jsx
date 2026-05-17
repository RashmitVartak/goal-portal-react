import { useState, useEffect } from 'react';
import { api } from '../api';

export default function Escalation() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState(0);
  const [error, setError] = useState('');

  const load = () => {
    api.get('/escalation').then(setData).catch(err => setError(err.message));
  };
  useEffect(load, []);

  if (error) return <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg">{error}</div>;
  if (!data) return <div className="animate-pulse p-8 text-gray-500">Loading...</div>;
  const { rules, log } = data;

  const runEngine = async () => {
    if (confirm('Run escalation engine?')) {
      const res = await api.post('/escalation/run');
      alert(`Done. ${res.count} new escalation(s) created.`);
      load();
    }
  };

  const resolve = async (lid, notes) => { await api.post(`/escalation/resolve/${lid}`, { notes }); load(); };

  const addRule = async (f) => { await api.post('/escalation/rules', f); load(); };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Escalation Management</h2>
      <div className="flex gap-1 mb-6">
        {['Run Engine','Escalation Log','Manage Rules'].map((t,i) => (
          <button key={t} onClick={() => setTab(i)} className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab===i?'bg-blue-600 text-white':'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>{t}</button>
        ))}
      </div>
      {tab===0 && (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <h3 className="text-xl font-bold mb-2">Escalation Engine</h3>
          <p className="text-gray-500 mb-6">Check all employees against escalation rules.</p>
          <button onClick={runEngine} className="bg-yellow-500 text-white px-8 py-3 rounded-lg font-bold text-lg hover:bg-yellow-600">⚡ Run Escalation Check</button>
        </div>
      )}
      {tab===1 && (
        <div>
          {log.length === 0 ? <p className="text-gray-500">No escalations logged.</p> : (
            <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50"><tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Employee</th>
                  <th className="px-4 py-2 text-xs font-semibold text-gray-500">Rule</th>
                  <th className="px-4 py-2 text-xs font-semibold text-gray-500">Type</th>
                  <th className="px-4 py-2 text-xs font-semibold text-gray-500">Level</th>
                  <th className="px-4 py-2 text-xs font-semibold text-gray-500">Status</th>
                  <th className="px-4 py-2 text-xs font-semibold text-gray-500">Created</th>
                  <th className="px-4 py-2 text-xs font-semibold text-gray-500">Actions</th>
                </tr></thead>
                <tbody className="divide-y">{log.map(l => <EscRow key={l.log_id} l={l} onResolve={resolve} />)}</tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {tab===2 && <RulesTab rules={rules} onAdd={addRule} />}
    </div>
  );
}

function EscRow({ l, onResolve }) {
  const [notes, setNotes] = useState('');
  return (
    <tr>
      <td className="px-4 py-2 font-semibold">{l.employee_name}</td>
      <td className="px-4 py-2 text-center">{l.rule_name}</td>
      <td className="px-4 py-2 text-center text-xs">{l.escalation_type}</td>
      <td className="px-4 py-2 text-center"><span className={`text-xs px-2 py-1 rounded-full font-bold ${l.escalation_level===1?'bg-yellow-100 text-yellow-700':'bg-red-100 text-red-700'}`}>L{l.escalation_level}</span></td>
      <td className="px-4 py-2 text-center"><span className={`text-xs px-2 py-1 rounded-full font-bold ${l.status==='OPEN'?'bg-red-100 text-red-700':'bg-green-100 text-green-700'}`}>{l.status}</span></td>
      <td className="px-4 py-2 text-center text-xs">{l.created_at}</td>
      <td className="px-4 py-2">{l.status==='OPEN' ? (
        <div className="flex gap-1">
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes" className="w-28 border rounded px-2 py-1 text-xs" />
          <button onClick={() => onResolve(l.log_id, notes)} className="bg-green-600 text-white px-3 py-1 rounded text-xs">Resolve</button>
        </div>
      ) : <span className="text-xs text-gray-500">{l.notes||''}</span>}</td>
    </tr>
  );
}

function RulesTab({ rules, onAdd }) {
  const [show, setShow] = useState(false);
  const [f, setF] = useState({ rule_name:'',trigger_condition:'GOAL_NOT_SUBMITTED',days_threshold:7,escalation_level:1,notify_employee:true,notify_manager:true,notify_skip_level:false,notify_hr:false });
  const save = async (e) => { e.preventDefault(); await onAdd(f); setShow(false); };
  return (
    <div>
      <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50"><tr>
            {['Rule','Condition','Days','Level','Emp','Mgr','Skip','HR','Active'].map(c => <th key={c} className="px-4 py-2 text-xs font-semibold text-gray-500">{c}</th>)}
          </tr></thead>
          <tbody className="divide-y">{rules.map(r => (
            <tr key={r.rule_id}>
              <td className="px-4 py-2 font-semibold">{r.rule_name}</td>
              <td className="px-4 py-2 text-center text-xs">{r.trigger_condition}</td>
              <td className="px-4 py-2 text-center">{r.days_threshold}</td>
              <td className="px-4 py-2 text-center">L{r.escalation_level}</td>
              <td className="px-4 py-2 text-center">{r.notify_employee?'✅':'—'}</td>
              <td className="px-4 py-2 text-center">{r.notify_manager?'✅':'—'}</td>
              <td className="px-4 py-2 text-center">{r.notify_skip_level?'✅':'—'}</td>
              <td className="px-4 py-2 text-center">{r.notify_hr?'✅':'—'}</td>
              <td className="px-4 py-2 text-center">{r.is_active?'✅':'—'}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <button onClick={() => setShow(!show)} className="mt-3 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">+ Add Rule</button>
      {show && (
        <form onSubmit={save} className="bg-gray-50 rounded-lg p-4 mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
          <input placeholder="Rule Name*" className="col-span-2 border rounded px-3 py-2 text-sm" value={f.rule_name} onChange={e => setF({...f,rule_name:e.target.value})} required />
          <select className="border rounded px-3 py-2 text-sm" value={f.trigger_condition} onChange={e => setF({...f,trigger_condition:e.target.value})}>
            <option>GOAL_NOT_SUBMITTED</option><option>GOAL_NOT_APPROVED</option><option>CHECKIN_NOT_COMPLETED</option>
          </select>
          <input type="number" placeholder="Days" className="border rounded px-3 py-2 text-sm" value={f.days_threshold} onChange={e => setF({...f,days_threshold:parseInt(e.target.value)})} min={1} />
          <input type="number" placeholder="Level" className="border rounded px-3 py-2 text-sm" value={f.escalation_level} onChange={e => setF({...f,escalation_level:parseInt(e.target.value)})} min={1} max={3} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.notify_employee} onChange={e => setF({...f,notify_employee:e.target.checked})} />Employee</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.notify_manager} onChange={e => setF({...f,notify_manager:e.target.checked})} />Manager</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.notify_skip_level} onChange={e => setF({...f,notify_skip_level:e.target.checked})} />Skip-Level</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.notify_hr} onChange={e => setF({...f,notify_hr:e.target.checked})} />HR</label>
          <button type="submit" className="bg-green-600 text-white py-2 rounded-lg text-sm">Add Rule</button>
        </form>
      )}
    </div>
  );
}
