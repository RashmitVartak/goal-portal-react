import { useState, useEffect } from 'react';
import { api } from '../api';

export default function Reports() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState(0);
  useEffect(() => { api.get('/reports').then(setData); }, []);
  if (!data) return <div className="animate-pulse">Loading...</div>;
  const { report, completion, checkins, cycle, role, department } = data;
  const scopeLabel = role === 'ADMIN' ? 'All Departments' : role === 'MANAGER' ? `${department} (Your Team)` : 'My Goals';

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold">Reports</h2>
          <p className="text-sm text-gray-500">Showing: <span className="font-semibold text-brand">{scopeLabel}</span></p>
        </div>
      </div>
      <div className="flex gap-1 mb-6">
        {['Achievement Report','Completion Dashboard'].map((t,i) => (
          <button key={t} onClick={() => setTab(i)} className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab===i?'bg-brand text-gray-900':'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>{t}</button>
        ))}
      </div>
      {tab===0 && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold">Achievement Report {cycle && `— ${cycle.cycle_name}`}</h3>
            {report.length > 0 && <a href="/api/reports/export" className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-700">📥 Export CSV</a>}
          </div>
          {report.length === 0 ? <p className="text-gray-500">No approved goals to report on.</p> : (
            <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50"><tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Employee</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Dept</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Goal</th>
                  <th className="px-3 py-2 text-xs font-semibold text-gray-500">UoM</th>
                  <th className="px-3 py-2 text-xs font-semibold text-gray-500">Target</th>
                  <th className="px-3 py-2 text-xs font-semibold text-gray-500">Wt%</th>
                  {['Q1','Q2','Q3','Q4'].map(q => [
                    <th key={q+'a'} className="px-2 py-2 text-xs font-semibold text-gray-500">{q} Act</th>,
                    <th key={q+'s'} className="px-2 py-2 text-xs font-semibold text-gray-500">{q} %</th>
                  ])}
                </tr></thead>
                <tbody className="divide-y">{report.map((r,i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-2">{r.employee_name}</td>
                    <td className="px-3 py-2">{r.department}</td>
                    <td className="px-3 py-2 font-semibold">{r.goal_title}</td>
                    <td className="px-3 py-2 text-center text-xs">{r.uom_type}</td>
                    <td className="px-3 py-2 text-center">{r.target_value}</td>
                    <td className="px-3 py-2 text-center">{r.weightage}%</td>
                    {['q1','q2','q3','q4'].map(q => [
                      <td key={q+'a'} className="px-2 py-2 text-center">{r[`${q}_actual`]||'—'}</td>,
                      <td key={q+'s'} className="px-2 py-2 text-center">{r[`${q}_score`]!=null?`${r[`${q}_score`]}%`:'—'}</td>
                    ])}
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {tab===1 && (
        <div>
          <h3 className="font-bold mb-4">Completion Dashboard {cycle && `— ${cycle.cycle_name}`}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Stat label="Total Employees" value={completion.total} />
            <Stat label="Goals Submitted" value={completion.submitted} color="text-blue-600" />
            <Stat label="Goals Approved" value={completion.approved} color="text-green-600" />
            <Stat label="Not Started" value={completion.not_started} color="text-red-600" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h4 className="font-bold mb-4">By Department</h4>
              {Object.entries(completion.by_dept || {}).map(([dept,d]) => {
                const pct = d.total > 0 ? Math.round(d.approved/d.total*100) : 0;
                return (
                  <div key={dept} className="mb-3">
                    <div className="flex justify-between text-sm mb-1"><span>{dept}</span><span>{d.approved}/{d.total} ({pct}%)</span></div>
                    <div className="h-2 bg-gray-200 rounded-full"><div className="h-2 bg-green-500 rounded-full" style={{width:`${pct}%`}} /></div>
                  </div>
                );
              })}
            </div>
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h4 className="font-bold mb-4">Quarterly Check-in Completion</h4>
              {Object.entries(checkins || {}).map(([q,d]) => {
                const pct = d.total > 0 ? Math.round(d.done/d.total*100) : 0;
                return (
                  <div key={q} className="mb-3">
                    <div className="flex justify-between text-sm mb-1"><span>{q}</span><span>{d.done}/{d.total} ({pct}%)</span></div>
                    <div className="h-2 bg-gray-200 rounded-full"><div className="h-2 bg-blue-500 rounded-full" style={{width:`${pct}%`}} /></div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color = '' }) {
  return <div className="bg-white rounded-xl shadow-sm p-5"><p className="text-gray-500 text-sm">{label}</p><p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p></div>;
}
