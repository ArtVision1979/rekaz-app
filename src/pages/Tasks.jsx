import { useState, useEffect } from 'react'
import { getTasks, createTask, updateTask, getProjects, supabase } from '../lib/supabase.js'

const EMPTY = { title: '', project_id: '', severity: 'medium', assigned_to: '', due_date: '', status: 'open', description: '' }

export default function Tasks() {
  const [tasks, setTasks] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editTask, setEditTask] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    try { const [t,p] = await Promise.all([getTasks(), getProjects()]); setTasks(t||[]); setProjects(p||[]) }
    catch (e) { console.error(e) } finally { setLoading(false) }
  }

  function openNew() { setEditTask(null); setForm(EMPTY); setShowModal(true) }

  function openEdit(t) {
    setEditTask(t)
    setForm({ title: t.title, project_id: t.project_id||'', severity: t.severity, assigned_to: t.assigned_to||'', due_date: t.due_date||'', status: t.status, description: t.description||'' })
    setShowModal(true)
  }

  async function handleSave(e) {
    e.preventDefault(); setSaving(true)
    try {
      if (editTask) { await supabase.from('tasks').update(form).eq('id', editTask.id) }
      else { await createTask(form) }
      setShowModal(false); await load()
    } catch (e) { alert(e.message) } finally { setSaving(false) }
  }

  async function handleDelete(t) {
    if (!confirm('Delete this task?')) return
    await supabase.from('tasks').delete().eq('id', t.id)
    await load()
  }

  async function toggleStatus(task) {
    const s = task.status === 'resolved' ? 'open' : 'resolved'
    await updateTask(task.id, { status: s })
    setTasks(ts => ts.map(t => t.id === task.id ? {...t, status: s} : t))
  }

  const SEV = { low:'badge-blue', medium:'badge-progress', high:'badge-open', critical:'badge-open' }

  return (
    <div style={{ position: 'relative' }}>
      <div className="page-header">
        <div><h3>Tasks</h3><div className="page-sub">{tasks.filter(t=>t.status==='open').length} open · {tasks.filter(t=>t.status==='resolved').length} resolved</div></div>
        <button className="btn btn-primary" onClick={openNew}>+ New Task</button>
      </div>
      <div className="card">
        {loading ? <div style={{color:'#888',padding:16}}>Loading...</div> :
          tasks.length === 0 ? <div className="empty"><p>No tasks yet.</p></div> : (
            <table className="table">
              <thead><tr><th>Task</th><th>Project</th><th>Assigned</th><th>Due</th><th>Severity</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {tasks.map(t => (
                  <tr key={t.id}>
                    <td>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <div onClick={()=>toggleStatus(t)} style={{width:16,height:16,borderRadius:4,flexShrink:0,cursor:'pointer',border:t.status==='resolved'?'none':'1.5px solid #ccc',background:t.status==='resolved'?'#185FA5':'transparent'}}/>
                        <span style={{textDecoration:t.status==='resolved'?'line-through':'none',color:t.status==='resolved'?'#888':'inherit'}}>{t.title}</span>
                      </div>
                    </td>
                    <td style={{color:'#888'}}>{t.projects?.name||'—'}</td>
                    <td style={{color:'#888'}}>{t.assigned_to||'—'}</td>
                    <td style={{color:'#888'}}>{t.due_date||'—'}</td>
                    <td><span className={`badge ${SEV[t.severity]||'badge-gray'}`}>{t.severity}</span></td>
                    <td><span className={`badge ${t.status==='resolved'?'badge-done':t.status==='in_progress'?'badge-progress':'badge-gray'}`}>{t.status}</span></td>
                    <td><div style={{display:'flex',gap:6}}>
                      <button className="btn btn-sm" onClick={()=>openEdit(t)}>Edit</button>
                      <button className="btn btn-sm" style={{color:'#A32D2D',borderColor:'#A32D2D'}} onClick={()=>handleDelete(t)}>Delete</button>
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
            <h3>{editTask ? 'Edit Task' : 'New Task'}</h3>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Task Title *</label>
                <input className="form-input" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} required/>
              </div>
              <div className="form-group">
                <label className="form-label">Project</label>
                <select className="form-input" value={form.project_id} onChange={e=>setForm(f=>({...f,project_id:e.target.value}))}>
                  <option value="">Select project...</option>
                  {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div className="form-group">
                  <label className="form-label">Severity</label>
                  <select className="form-input" value={form.severity} onChange={e=>setForm(f=>({...f,severity:e.target.value}))}>
                    <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-input" value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
                    <option value="open">Open</option><option value="in_progress">In Progress</option><option value="resolved">Resolved</option><option value="closed">Closed</option>
                  </select>
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div className="form-group">
                  <label className="form-label">Assigned To</label>
                  <input className="form-input" value={form.assigned_to} onChange={e=>setForm(f=>({...f,assigned_to:e.target.value}))} placeholder="Contractor / Engineer..."/>
                </div>
                <div className="form-group">
                  <label className="form-label">Due Date</label>
                  <input type="date" className="form-input" value={form.due_date} onChange={e=>setForm(f=>({...f,due_date:e.target.value}))}/>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-input" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Task details..."/>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={()=>setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Saving...':editTask?'Save':'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
