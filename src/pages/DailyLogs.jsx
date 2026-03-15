import { useState, useEffect } from 'react'
import { getProjects, supabase } from '../lib/supabase.js'

const EMPTY = { project_id:'', log_date: new Date().toISOString().split('T')[0], weather:'', workers_count:'', activities:'', issues:'' }

export default function DailyLogs() {
  const [logs, setLogs] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editLog, setEditLog] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const [{ data: l }, p] = await Promise.all([
        supabase.from('daily_logs').select('*, projects(name)').order('log_date', { ascending: false }),
        getProjects()
      ])
      setLogs(l || [])
      setProjects(p || [])
    } catch(e){ console.error(e) } finally { setLoading(false) }
  }

  function openNew() { setEditLog(null); setForm(EMPTY); setShowModal(true) }

  function openEdit(l) {
    setEditLog(l)
    setForm({ project_id: l.project_id, log_date: l.log_date, weather: l.weather||'', workers_count: l.workers_count||'', activities: l.activities||'', issues: l.issues||'' })
    setShowModal(true)
  }

  async function handleSave(e) {
    e.preventDefault(); setSaving(true)
    try {
      const data = { ...form, workers_count: form.workers_count ? parseInt(form.workers_count) : null }
      if (editLog) { await supabase.from('daily_logs').update(data).eq('id', editLog.id) }
      else { await supabase.from('daily_logs').insert(data) }
      setShowModal(false); await load()
    } catch(e){ alert(e.message) } finally { setSaving(false) }
  }

  async function handleDelete(l) {
    if (!confirm('Delete this log?')) return
    await supabase.from('daily_logs').delete().eq('id', l.id)
    await load()
  }

  const WEATHER = ['Sunny','Cloudy','Partly Cloudy','Rainy','Windy','Hot','Dusty']

  return (
    <div style={{ position: 'relative' }}>
      <div className="page-header">
        <div><h3>Daily Logs</h3><div className="page-sub">{logs.length} logs</div></div>
        <button className="btn btn-primary" onClick={openNew}>+ New Log</button>
      </div>
      <div className="card">
        {loading ? <div style={{color:'#888',padding:16}}>Loading...</div> :
          logs.length === 0 ? <div className="empty"><p>No daily logs yet.</p></div> : (
            <table className="table">
              <thead><tr><th>Project</th><th>Date</th><th>Weather</th><th>Workers</th><th>Activities</th><th>Issues</th><th></th></tr></thead>
              <tbody>
                {logs.map(l => (
                  <tr key={l.id}>
                    <td style={{fontWeight:500}}>{l.projects?.name||'—'}</td>
                    <td style={{color:'#888'}}>{l.log_date}</td>
                    <td style={{color:'#888'}}>{l.weather||'—'}</td>
                    <td style={{color:'#888'}}>{l.workers_count||'—'}</td>
                    <td style={{color:'#888',maxWidth:150,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.activities||'—'}</td>
                    <td style={{color: l.issues ? '#A32D2D' : '#888',maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.issues||'—'}</td>
                    <td><div style={{display:'flex',gap:6}}>
                      <button className="btn btn-sm" onClick={()=>openEdit(l)}>Edit</button>
                      <button className="btn btn-sm" style={{color:'#A32D2D',borderColor:'#A32D2D'}} onClick={()=>handleDelete(l)}>Delete</button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>{editLog ? 'Edit Log' : 'New Daily Log'}</h3>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Project *</label>
                <select className="form-input" value={form.project_id} onChange={e=>setForm(f=>({...f,project_id:e.target.value}))} required>
                  <option value="">Select project...</option>
                  {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div className="form-group">
                  <label className="form-label">Date *</label>
                  <input type="date" className="form-input" value={form.log_date} onChange={e=>setForm(f=>({...f,log_date:e.target.value}))} required/>
                </div>
                <div className="form-group">
                  <label className="form-label">Workers Count</label>
                  <input type="number" className="form-input" value={form.workers_count} onChange={e=>setForm(f=>({...f,workers_count:e.target.value}))} placeholder="0"/>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Weather</label>
                <select className="form-input" value={form.weather} onChange={e=>setForm(f=>({...f,weather:e.target.value}))}>
                  <option value="">Select...</option>
                  {WEATHER.map(w=><option key={w} value={w}>{w}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Activities</label>
                <textarea className="form-input" value={form.activities} onChange={e=>setForm(f=>({...f,activities:e.target.value}))} placeholder="Work done today..."/>
              </div>
              <div className="form-group">
                <label className="form-label">Issues</label>
                <textarea className="form-input" value={form.issues} onChange={e=>setForm(f=>({...f,issues:e.target.value}))} placeholder="Any issues or observations..." style={{borderColor: form.issues ? '#A32D2D' : undefined}}/>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={()=>setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Saving...':editLog?'Save':'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
