import { useState, useEffect } from 'react';
import { api } from '../api';

export default function Analytics() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState(0);
  useEffect(() => { api.get('/analytics').then(setData); }, []);
  if (!data) return <div className="animate-pulse">Loading...</div>;
  const { qoq, dist_ta, dist_uom, heatmap, mgr_eff, role, department } = data;
  const scopeLabel = role === 'ADMIN' ? 'All Departments' : role === 'MANAGER' ? `${department} (Your Team)` : 'My Goals';
  const showMgrTab = role === 'ADMIN';
  const tabs = showMgrTab ? ['QoQ Trends','Goal Distribution','Heatmap','Manager Effectiveness'] : ['QoQ Trends','Goal Distribution','Heatmap'];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold">Analytics</h2>
          <p className="text-sm text-gray-500">Showing: <span className="font-semibold text-brand">{scopeLabel}</span></p>
        </div>
      </div>
      <div className="flex gap-1 mb-6 flex-wrap">
        {tabs.map((t,i) => <button key={t} onClick={() => setTab(i)} className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab===i?'bg-brand text-gray-900':'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>{t}</button>)}
      </div>
      {tab===0 && (
        <div>
          <h3 className="font-bold mb-4">Quarter-on-Quarter Achievement Trends</h3>
          {qoq.length === 0 ? <p className="text-gray-500">No data yet.</p> : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {qoq.map(q => (
                <div key={q.quarter} className="bg-white rounded-xl shadow-sm p-5 text-center">
                  <p className="text-gray-500 text-sm">{q.quarter}</p>
                  <p className={`text-3xl font-bold mt-2 ${q.avg_score>=80?'text-green-600':q.avg_score>=50?'text-yellow-600':'text-red-600'}`}>{q.avg_score}%</p>
                  <p className="text-xs text-gray-400 mt-1">{q.count} data points</p>
                  <div className="mt-3 h-2 bg-gray-200 rounded-full"><div className={`h-2 rounded-full ${q.avg_score>=80?'bg-green-500':q.avg_score>=50?'bg-yellow-500':'bg-red-500'}`} style={{width:`${q.avg_score}%`}} /></div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {tab===1 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h4 className="font-bold mb-4">By Thrust Area</h4>
            {dist_ta.length === 0 ? <p className="text-gray-500">No data.</p> : (() => {
              const max = Math.max(...dist_ta.map(d=>d.count));
              return dist_ta.map(d => (
                <div key={d.name} className="mb-3">
                  <div className="flex justify-between text-sm mb-1"><span>{d.name}</span><span>{d.count}</span></div>
                  <div className="h-2 bg-gray-200 rounded-full"><div className="h-2 bg-blue-500 rounded-full" style={{width:`${d.count/max*100}%`}} /></div>
                </div>
              ));
            })()}
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h4 className="font-bold mb-4">By UoM Type</h4>
            {dist_uom.length === 0 ? <p className="text-gray-500">No data.</p> : (() => {
              const max = Math.max(...dist_uom.map(d=>d.count));
              return dist_uom.map(d => (
                <div key={d.name} className="mb-3">
                  <div className="flex justify-between text-sm mb-1"><span>{d.name}</span><span>{d.count}</span></div>
                  <div className="h-2 bg-gray-200 rounded-full"><div className="h-2 bg-cyan-500 rounded-full" style={{width:`${d.count/max*100}%`}} /></div>
                </div>
              ));
            })()}
          </div>
        </div>
      )}
      {tab===2 && (
        <div>
          <h3 className="font-bold mb-4">Completion Heatmap</h3>
          {heatmap.length === 0 ? <p className="text-gray-500">No data.</p> : (
            <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50"><tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Employee</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Department</th>
                  {['Q1','Q2','Q3','Q4'].map(q => <th key={q} className="px-4 py-2 text-center text-xs font-semibold text-gray-500">{q}</th>)}
                </tr></thead>
                <tbody className="divide-y">{heatmap.map(h => (
                  <tr key={h.name}>
                    <td className="px-4 py-2 font-semibold">{h.name}</td>
                    <td className="px-4 py-2">{h.department}</td>
                    {['q1','q2','q3','q4'].map(q => (
                      <td key={q} className="px-4 py-2 text-center">
                        {h[q] != null ? (
                          <span className={`inline-block px-3 py-1 rounded font-bold text-sm ${h[q]>=80?'bg-green-100 text-green-700':h[q]>=50?'bg-yellow-100 text-yellow-700':'bg-red-100 text-red-700'}`}>{h[q]}%</span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {tab===3 && showMgrTab && (
        <div>
          <h3 className="font-bold mb-4">Manager Effectiveness</h3>
          {mgr_eff.length === 0 ? <p className="text-gray-500">No data.</p> : (
            <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50"><tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Manager</th>
                  <th className="px-4 py-2 text-xs font-semibold text-gray-500">Dept</th>
                  <th className="px-4 py-2 text-xs font-semibold text-gray-500">Sheets</th>
                  <th className="px-4 py-2 text-xs font-semibold text-gray-500">Approved</th>
                  <th className="px-4 py-2 text-xs font-semibold text-gray-500">Check-in Comments</th>
                  <th className="px-4 py-2 text-xs font-semibold text-gray-500">Rate</th>
                </tr></thead>
                <tbody className="divide-y">{mgr_eff.map(m => {
                  const rate = m.total_sheets > 0 ? Math.round(m.approved/m.total_sheets*100) : 0;
                  return (
                    <tr key={m.manager_name}>
                      <td className="px-4 py-2 font-semibold">{m.manager_name}</td>
                      <td className="px-4 py-2 text-center">{m.department}</td>
                      <td className="px-4 py-2 text-center">{m.total_sheets}</td>
                      <td className="px-4 py-2 text-center">{m.approved}</td>
                      <td className="px-4 py-2 text-center">{m.checkin_comments}</td>
                      <td className="px-4 py-2"><div className="flex items-center gap-2"><div className="flex-1 h-2 bg-gray-200 rounded-full"><div className={`h-2 rounded-full ${rate>=80?'bg-green-500':rate>=50?'bg-yellow-500':'bg-red-500'}`} style={{width:`${rate}%`}} /></div><span className="text-xs font-semibold w-10">{rate}%</span></div></td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
