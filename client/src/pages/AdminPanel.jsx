import { useState, useEffect } from 'react';
import { api } from '../api';

const tabNames = ['Cycles','Employees','Thrust Areas','Shared Goals','Unlock Sheets','Audit Trail'];

export default function AdminPanel() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState(0);
  const [error, setError] = useState('');

  const load = () => {
    api.get('/admin/data').then(setData).catch(err => setError(err.message));
  };
  useEffect(load, []);

  if (error) return <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg">{error}</div>;
  if (!data) return <div className="animate-pulse p-8 text-gray-500">Loading...</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Admin Panel</h2>
      <div className="flex gap-1 mb-6 flex-wrap">
        {tabNames.map((t,i) => <button key={t} onClick={() => setTab(i)} className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab===i?'bg-blue-600 text-white':'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>{t}</button>)}
      </div>
      {tab===0 && <CyclesTab cycles={data.cycles} onReload={load} />}
      {tab===1 && <EmployeesTab employees={data.employees} onReload={load} />}
      {tab===2 && <ThrustAreasTab areas={data.thrust_areas} onReload={load} />}
      {tab===3 && <SharedGoalsTab goals={data.shared_goals} areas={data.thrust_areas} onReload={load} />}
      {tab===4 && <UnlockTab sheets={data.locked_sheets} onReload={load} />}
      {tab===5 && <AuditTab audit={data.audit} />}
    </div>
  );
}

function CyclesTab({ cycles, onReload }) {
  const [show, setShow] = useState(false);
  const [f, setF] = useState({ cycle_name:'', cycle_year:2027, goal_setting_start:'', goal_setting_end:'', q1_start:'', q1_end:'', q2_start:'', q2_end:'', q3_start:'', q3_end:'', q4_start:'', q4_end:'' });
  const save = async (e) => { e.preventDefault(); await api.post('/admin/cycles', f); setShow(false); onReload(); };

  const periods = [
    { key: 'goal_setting', label: 'Goal Setting', desc: 'Create, edit & submit goals', icon: '📝' },
    { key: 'q1', label: 'Q1 Check-in', desc: 'First quarterly review', icon: '1️⃣' },
    { key: 'q2', label: 'Q2 Check-in', desc: 'Second quarterly review', icon: '2️⃣' },
    { key: 'q3', label: 'Q3 Check-in', desc: 'Third quarterly review', icon: '3️⃣' },
    { key: 'q4', label: 'Q4 / Annual', desc: 'Final achievement capture', icon: '4️⃣' },
  ];

  return (
    <div>
      <Table cols={['Name','Year','Goal Setting','Q1','Q2','Q3','Q4','Active']}
        rows={cycles.map(c => [c.cycle_name,c.cycle_year,`${c.goal_setting_start} → ${c.goal_setting_end}`,`${c.q1_start} → ${c.q1_end}`,`${c.q2_start} → ${c.q2_end}`,`${c.q3_start} → ${c.q3_end}`,`${c.q4_start} → ${c.q4_end}`,c.is_active?'✅':'—'])} />
      <button onClick={() => setShow(!show)} className="mt-3 bg-brand text-gray-900 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark">{show ? 'Cancel' : '+ New Cycle'}</button>

      {show && (
        <form onSubmit={save} className="mt-4 bg-white border rounded-xl shadow-sm overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b">
            <h4 className="font-bold text-lg">Create New Cycle</h4>
            <p className="text-gray-500 text-xs mt-1">Define the fiscal year and all quarterly windows</p>
          </div>

          <div className="px-6 py-4 border-b">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Cycle Name *</label>
                <input placeholder="e.g. FY 2027-28" className="w-full border rounded-lg px-3 py-2.5 text-sm" value={f.cycle_name} onChange={e => setF({...f,cycle_name:e.target.value})} required />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Year *</label>
                <input type="number" className="w-full border rounded-lg px-3 py-2.5 text-sm" value={f.cycle_year} onChange={e => setF({...f,cycle_year:parseInt(e.target.value)})} required />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-1/4">Period</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Start Date *</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">End Date *</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {periods.map(p => (
                  <tr key={p.key} className="hover:bg-gray-50">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{p.icon}</span>
                        <span className="font-semibold">{p.label}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-gray-500 text-xs">{p.desc}</td>
                    <td className="px-6 py-3">
                      <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm" value={f[`${p.key}_start`]} onChange={e => setF({...f,[`${p.key}_start`]:e.target.value})} required />
                    </td>
                    <td className="px-6 py-3">
                      <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm" value={f[`${p.key}_end`]} onChange={e => setF({...f,[`${p.key}_end`]:e.target.value})} required />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 bg-gray-50 border-t flex justify-end gap-3">
            <button type="button" onClick={() => setShow(false)} className="bg-gray-100 text-gray-700 px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-200">Cancel</button>
            <button type="submit" className="bg-green-600 text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-green-700">Create Cycle</button>
          </div>
        </form>
      )}
    </div>
  );
}

function EmployeesTab({ employees, onReload }) {
  const [show, setShow] = useState(false);
  const [f, setF] = useState({ employee_id:'',employee_name:'',email:'',department:'',designation:'',role:'EMPLOYEE',manager_id:'',password:'password123' });

  const save = async (e) => { e.preventDefault(); await api.post('/admin/employees', f); setShow(false); onReload(); };
  const deleteEmp = async (id) => {
    if (confirm(`Deactivate employee ${id}?`)) { await api.del(`/admin/employees/${id}`); onReload(); }
  };

  return (
    <div>
      <div className="overflow-x-auto bg-white rounded-xl shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50"><tr>
            {['ID','Name','Email','Dept','Designation','Role','Manager','Actions'].map(c => <th key={c} className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{c}</th>)}
          </tr></thead>
          <tbody className="divide-y">
            {employees.map(emp => (
              <tr key={emp.employee_id} className={`hover:bg-gray-50 ${!emp.is_active ? 'opacity-40' : ''}`}>
                <td className="px-4 py-2">{emp.employee_id}</td>
                <td className="px-4 py-2">{emp.employee_name}</td>
                <td className="px-4 py-2">{emp.email}</td>
                <td className="px-4 py-2">{emp.department}</td>
                <td className="px-4 py-2">{emp.designation}</td>
                <td className="px-4 py-2">
                  <span className={`text-xs px-2 py-1 rounded-full font-semibold ${emp.role==='ADMIN'?'bg-red-100 text-red-700':emp.role==='MANAGER'?'bg-yellow-100 text-yellow-700':'bg-blue-100 text-blue-700'}`}>{emp.role}</span>
                </td>
                <td className="px-4 py-2">{emp.manager_id||'—'}</td>
                <td className="px-4 py-2">
                  {emp.is_active ? (
                    <button onClick={() => deleteEmp(emp.employee_id)} className="text-red-600 hover:text-red-800 text-xs font-semibold">Deactivate</button>
                  ) : (
                    <span className="text-gray-400 text-xs">Inactive</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={() => setShow(!show)} className="mt-3 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">+ Add Employee</button>
      {show && <form onSubmit={save} className="bg-gray-50 rounded-lg p-4 mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
        <input placeholder="Employee ID*" className="border rounded px-3 py-2 text-sm" value={f.employee_id} onChange={e => setF({...f,employee_id:e.target.value})} required />
        <input placeholder="Name*" className="border rounded px-3 py-2 text-sm" value={f.employee_name} onChange={e => setF({...f,employee_name:e.target.value})} required />
        <input placeholder="Email" className="border rounded px-3 py-2 text-sm" value={f.email} onChange={e => setF({...f,email:e.target.value})} />
        <input placeholder="Department" className="border rounded px-3 py-2 text-sm" value={f.department} onChange={e => setF({...f,department:e.target.value})} />
        <input placeholder="Designation" className="border rounded px-3 py-2 text-sm" value={f.designation} onChange={e => setF({...f,designation:e.target.value})} />
        <select className="border rounded px-3 py-2 text-sm" value={f.role} onChange={e => setF({...f,role:e.target.value})}>
          <option>EMPLOYEE</option><option>MANAGER</option><option>ADMIN</option>
        </select>
        <select className="border rounded px-3 py-2 text-sm" value={f.manager_id} onChange={e => setF({...f,manager_id:e.target.value})}>
          <option value="">No Manager</option>{employees.map(emp => <option key={emp.employee_id} value={emp.employee_id}>{emp.employee_name}</option>)}
        </select>
        <input placeholder="Password" className="border rounded px-3 py-2 text-sm" value={f.password} onChange={e => setF({...f,password:e.target.value})} />
        <button type="submit" className="bg-green-600 text-white py-2 rounded-lg text-sm">Add</button>
      </form>}
    </div>
  );
}

function ThrustAreasTab({ areas, onReload }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [editing, setEditing] = useState(null);

  const save = async (e) => { e.preventDefault(); await api.post('/admin/thrust-areas', { name, description: desc }); setName(''); setDesc(''); onReload(); };
  const saveEdit = async () => {
    await api.put(`/admin/thrust-areas/${editing.thrust_area_id}`, { name: editing.thrust_area_name, description: editing.description });
    setEditing(null); onReload();
  };

  return (
    <div>
      <div className="overflow-x-auto bg-white rounded-xl shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50"><tr>
            {['Name','Description','Actions'].map(c => <th key={c} className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{c}</th>)}
          </tr></thead>
          <tbody className="divide-y">
            {areas.map(a => (
              <tr key={a.thrust_area_id} className="hover:bg-gray-50">
                <td className="px-4 py-2">{a.thrust_area_name}</td>
                <td className="px-4 py-2">{a.description || ''}</td>
                <td className="px-4 py-2">
                  <button onClick={() => setEditing({...a})} className="text-blue-600 hover:text-blue-800 text-xs font-semibold">Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h3 className="font-bold text-lg mb-4">Edit Thrust Area</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Name</label>
                <input value={editing.thrust_area_name} onChange={e => setEditing({...editing, thrust_area_name: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Description</label>
                <input value={editing.description || ''} onChange={e => setEditing({...editing, description: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="flex gap-3">
                <button onClick={saveEdit} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">Save</button>
                <button onClick={() => setEditing(null)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={save} className="flex gap-3 mt-3">
        <input placeholder="Name*" className="border rounded px-3 py-2 text-sm flex-1" value={name} onChange={e => setName(e.target.value)} required />
        <input placeholder="Description" className="border rounded px-3 py-2 text-sm flex-1" value={desc} onChange={e => setDesc(e.target.value)} />
        <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm">Add</button>
      </form>
    </div>
  );
}

function SharedGoalsTab({ goals, areas, onReload }) {
  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState(null);
  const [f, setF] = useState({ title:'',description:'',thrust_area_id:'',uom_type:'NUMERIC_MIN',target_value:'',department:'' });

  const save = async (e) => { e.preventDefault(); await api.post('/admin/shared-goals', f); setShow(false); setF({ title:'',description:'',thrust_area_id:'',uom_type:'NUMERIC_MIN',target_value:'',department:'' }); onReload(); };
  const saveEdit = async () => {
    await api.put(`/admin/shared-goals/${editing.shared_goal_id}`, {
      title: editing.source_goal_title, description: editing.source_goal_description,
      thrust_area_id: editing.thrust_area_id, uom_type: editing.uom_type,
      target_value: editing.target_value, department: editing.department
    });
    setEditing(null); onReload();
  };
  const deleteSG = async (id) => {
    if (confirm('Delete this shared goal?')) { await api.del(`/admin/shared-goals/${id}`); onReload(); }
  };

  return (
    <div>
      {goals.length > 0 && (
        <div className="overflow-x-auto bg-white rounded-xl shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr>
              {['Title','Thrust Area','UoM','Target','Dept','Created By','Actions'].map(c => <th key={c} className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{c}</th>)}
            </tr></thead>
            <tbody className="divide-y">
              {goals.map(g => (
                <tr key={g.shared_goal_id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-semibold">{g.source_goal_title}</td>
                  <td className="px-4 py-2">{g.thrust_area_name||'—'}</td>
                  <td className="px-4 py-2">{g.uom_type}</td>
                  <td className="px-4 py-2">{g.target_value}</td>
                  <td className="px-4 py-2">{g.department||'All'}</td>
                  <td className="px-4 py-2">{g.created_by}</td>
                  <td className="px-4 py-2 space-x-2">
                    <button onClick={() => setEditing({...g})} className="text-blue-600 hover:text-blue-800 text-xs font-semibold">Edit</button>
                    <button onClick={() => deleteSG(g.shared_goal_id)} className="text-red-600 hover:text-red-800 text-xs font-semibold">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6">
            <h3 className="font-bold text-lg mb-4">Edit Shared Goal</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Title</label>
                <input value={editing.source_goal_title} onChange={e => setEditing({...editing, source_goal_title: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Description</label>
                <input value={editing.source_goal_description || ''} onChange={e => setEditing({...editing, source_goal_description: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">Thrust Area</label>
                  <select value={editing.thrust_area_id || ''} onChange={e => setEditing({...editing, thrust_area_id: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="">Select</option>{areas.map(a => <option key={a.thrust_area_id} value={a.thrust_area_id}>{a.thrust_area_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">UoM</label>
                  <select value={editing.uom_type} onChange={e => setEditing({...editing, uom_type: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
                    {['NUMERIC_MIN','NUMERIC_MAX','PERCENT_MIN','PERCENT_MAX','TIMELINE','ZERO'].map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Target</label>
                  <input value={editing.target_value || ''} onChange={e => setEditing({...editing, target_value: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Department</label>
                  <input value={editing.department || ''} onChange={e => setEditing({...editing, department: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Blank = all" />
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={saveEdit} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">Save</button>
                <button onClick={() => setEditing(null)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <button onClick={() => setShow(!show)} className="mt-3 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">+ Push Shared Goal</button>
      {show && <form onSubmit={save} className="bg-gray-50 rounded-lg p-4 mt-3 grid grid-cols-2 md:grid-cols-3 gap-3">
        <input placeholder="Goal Title*" className="col-span-2 border rounded px-3 py-2 text-sm" value={f.title} onChange={e => setF({...f,title:e.target.value})} required />
        <input placeholder="Description" className="border rounded px-3 py-2 text-sm" value={f.description} onChange={e => setF({...f,description:e.target.value})} />
        <select className="border rounded px-3 py-2 text-sm" value={f.thrust_area_id} onChange={e => setF({...f,thrust_area_id:e.target.value})}>
          <option value="">Thrust Area</option>{areas.map(a => <option key={a.thrust_area_id} value={a.thrust_area_id}>{a.thrust_area_name}</option>)}
        </select>
        <select className="border rounded px-3 py-2 text-sm" value={f.uom_type} onChange={e => setF({...f,uom_type:e.target.value})}>
          {['NUMERIC_MIN','NUMERIC_MAX','PERCENT_MIN','PERCENT_MAX','TIMELINE','ZERO'].map(u => <option key={u}>{u}</option>)}
        </select>
        <input placeholder="Target*" className="border rounded px-3 py-2 text-sm" value={f.target_value} onChange={e => setF({...f,target_value:e.target.value})} required />
        <input placeholder="Department (blank=all)" className="border rounded px-3 py-2 text-sm" value={f.department} onChange={e => setF({...f,department:e.target.value})} />
        <button type="submit" className="bg-green-600 text-white py-2 rounded-lg text-sm">Create</button>
      </form>}
    </div>
  );
}

function UnlockItem({ sheet, onReload }) {
  const [reason, setReason] = useState('');
  const unlock = async () => { await api.post(`/admin/unlock/${sheet.sheet_id}`, { reason }); onReload(); };
  return (
    <div className="bg-gray-50 rounded-lg p-4 flex items-center gap-4">
      <strong className="flex-1">{sheet.employee_name}</strong>
      <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Unlock reason" className="border rounded px-3 py-2 text-sm w-48" />
      <button onClick={unlock} className="bg-yellow-500 text-white px-4 py-2 rounded-lg text-sm">Unlock</button>
    </div>
  );
}

function UnlockTab({ sheets, onReload }) {
  if (sheets.length === 0) return <p className="text-gray-500">No locked sheets.</p>;
  return (
    <div className="space-y-2">
      {sheets.map(s => <UnlockItem key={s.sheet_id} sheet={s} onReload={onReload} />)}
    </div>
  );
}

function AuditTab({ audit }) {
  if (audit.length === 0) return <p className="text-gray-500">No audit entries.</p>;
  return (
    <Table cols={['Time','Entity','Action','Field','Old','New','By','Reason']}
      rows={audit.map(a => [a.created_at,`${a.entity_type} #${a.entity_id}`,a.action,a.field_changed||'—',a.old_value||'—',a.new_value||'—',a.changed_by,a.change_reason||'—'])} />
  );
}

function Table({ cols, rows }) {
  return (
    <div className="overflow-x-auto bg-white rounded-xl shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-gray-50"><tr>{cols.map(c => <th key={c} className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{c}</th>)}</tr></thead>
        <tbody className="divide-y">{rows.map((r,i) => <tr key={i} className="hover:bg-gray-50">{r.map((c,j) => <td key={j} className="px-4 py-2">{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
