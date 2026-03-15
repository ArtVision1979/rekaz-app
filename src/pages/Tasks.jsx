import { useState, useEffect } from 'react'
import { getTasks, createTask, updateTask, getProjects, supabase } from '../lib/supabase.js'

const EMPTY = { title: '', project_id: '', severity: 'medium', assigned_to: '', due_date: '', status: 'open', description: '' }
const SEV = { low:'badge-blue', medium:'badge-progress', high:'badge-open', critical:'badge-open' }
const STATUS_C = { open:'badge-gray', in_progress:'badge-progress', resolved:'badge-done', closed:'badge-gray' }

export default function Tasks() {
  const [projects, setProjects] = useState([])
  const [selectedProject, setSelectedProject] = useState(null)
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editTask, setEditTask] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [projectSearch, setProjectSearch] = useState('')
  const [filter, setFilter] = useState('all')

  useEffect(() => { loadProjects() }, [])
  useEffect(() => { if (selectedProject) loadTasks(selectedProject.id) }, [selectedProject])

  async function loadProjects() {
    try {
      const p = await getProjects()
      setProjects(p || [])
      if (p?.length) setSelectedProject(p[0])
    } catch(e) { console.error(e) } finally { setLoading(false) }
  }

  async function loadTasks(projectId) {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
      setTasks(data || [])
    } catch(e) { console.error(e) } finally { setLoading(false) }
  }

  function openNew() {
    setEditTask(null)
    setForm({ ...EMPTY, project_id: selectedProject?.id || '' })
    setShowModal(true)
  }

  function openEdit(t) {
    setEditTask(t)
    setForm({ title: t.title, project_id: t.project_id, severity: t.severity, assigned_to: t.assigned_to||'', due_date: t.due_date||'', status: t.status, description: t.description||'' })
    setShowModal(true)
  }

  async function handleSave(e) {
    e.preventDefault(); setSaving(true)
    try {
      if (editTask) { await supabase.from('tasks').update(form).eq('id', editTask.id) }
      else { await createTask(form) }
      setShowModal(false)
      await loadTasks(selectedProject.id)
    } catch(e) { alert(e.message) } finally { setSaving(false) }
  }

  async function handleDelete(t) {
    if (!confirm('Delete this task?')) return
    await supabase.from('tasks').delete().eq('id', t.id)
    await loadTasks(selectedProject.id)
  }

  async function toggleStatus(task) {
    const s = task.status === 'resolved' ? 'open' : 'resolved'
    await updateTask(task.id, { status: s })
    setTasks(ts => ts.map(t => t.id === task.id ? {...t, status: s} : t))
  }

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(projectSearch.toLowerCase()) ||
    (p.project_no||'').toLowerCase().includes(projectSearch.toLowerCase())
  )

  const filteredTasks = tasks.filter(t => {
    if (filter === 'open') return t.status === 'open' || t.status === 'in_progress'
    if (filter === 'resolved') return t.status === 'resolved' || t.status === 'closed'
    return true
  })

  const openCount = tasks.filter(t => t.status === 'open' || t.status === 'in_progress').length
  const resolvedCount = tasks.filter(t => t.status === 'resolved' || t.status === 'closed').length

  return (
    <>
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <h3>{editTask ? 'Edit Task' : 'New Task'}</h3>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Task Title *</label>
                <input className="form-input" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} required autoFocus/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div className="form-group">
                  <label className="form-label">Severity</label>
                  <select className="form-input" value={form.severity} onChange={e=>setForm(f=>({...f,severity:e.target.value}))}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-input" value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
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

      <div className="page-header">
        <div><h3>Tasks</h3><div className="page-sub">{openCount} open · {resolvedCount} resolved</div></div>
        <button className="btn btn-primary" onClick={openNew} disabled={!selectedProject}>+ New Task</button>
      </div>

      {/* Project Search */}
      <div style={{marginBottom:10}}>
        <input className="form-input" style={{maxWidth:280}}
          placeholder="Search projects..."
          value={projectSearch} onChange={e=>setProjectSearch(e.target.value)}/>
      </div>

      {/* Project Tabs */}
      <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}>
        {filteredProjects.map(p=>(
          <button key={p.id}
            className={`btn ${selectedProject?.id===p.id?'btn-primary':''}`}
            style={{fontSize:12}}
            onClick={()=>setSelectedProject(p)}>
            {p.name}
            {selectedProject?.id===p.id && tasks.length>0 && (
              <span style={{marginLeft:6,background:'rgba(255,255,255,0.3)',borderRadius:10,padding:'1px 6px',fontSize:10}}>
                {openCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {selectedProject && (
        <>
          {/* Project Info + Filter */}
          <div className="card" style={{marginBottom:16}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12}}>
              <div>
                <div style={{fontWeight:500,fontSize:15}}>{selectedProject.name}</div>
                <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>
                  {selectedProject.project_no} · {selectedProject.location||'—'} · {selectedProject.client_name||'—'}
                </div>
              </div>
              <div style={{display:'flex',gap:6}}>
                {['all','open','resolved'].map(f=>(
                  <button key={f} className={`btn btn-sm ${filter===f?'btn-primary':''}`}
                    onClick={()=>setFilter(f)} style={{fontSize:11,textTransform:'capitalize'}}>
                    {f==='all'?`All (${tasks.length})`:f==='open'?`Open (${openCount})`:`Resolved (${resolvedCount})`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Tasks Table */}
          <div className="card">
            {loading ? <div style={{color:'var(--text-muted)',padding:16}}>Loading...</div> :
              filteredTasks.length === 0 ? (
                <div className="empty">
                  <p>{filter==='all'?'No tasks yet.':filter==='open'?'No open tasks.':'No resolved tasks.'}</p>
                  {filter==='all' && <button className="btn btn-primary" style={{marginTop:12}} onClick={openNew}>+ New Task</button>}
                </div>
              ) : (
                <table className="table">
                  <thead><tr>
                    <th style={{width:32}}></th>
                    <th>Task</th>
                    <th>Assigned</th>
                    <th>Due</th>
                    <th>Severity</th>
                    <th>Status</th>
                    <th></th>
                  </tr></thead>
                  <tbody>
                    {filteredTasks.map(t=>(
                      <tr key={t.id}>
                        <td>
                          <div onClick={()=>toggleStatus(t)} style={{width:16,height:16,borderRadius:4,flexShrink:0,cursor:'pointer',border:t.status==='resolved'?'none':'1.5px solid var(--border)',background:t.status==='resolved'?'#185FA5':'transparent'}}/>
                        </td>
                        <td>
                          <div style={{fontWeight:500,textDecoration:t.status==='resolved'?'line-through':'none',color:t.status==='resolved'?'var(--text-muted)':'var(--text)'}}>
                            {t.title}
                          </div>
                          {t.description && <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>{t.description}</div>}
                        </td>
                        <td style={{color:'var(--text-muted)',fontSize:12}}>{t.assigned_to||'—'}</td>
                        <td style={{color: t.due_date && t.due_date < new Date().toISOString().split('T')[0] && t.status!=='resolved' ? '#A32D2D' : 'var(--text-muted)',fontSize:12}}>{t.due_date||'—'}</td>
                        <td><span className={`badge ${SEV[t.severity]||'badge-gray'}`}>{t.severity}</span></td>
                        <td><span className={`badge ${STATUS_C[t.status]||'badge-gray'}`}>{t.status}</span></td>
                        <td><div style={{display:'flex',gap:6}}>
                          <button className="btn btn-sm" onClick={()=>openEdit(t)}>Edit</button>
                          <button className="btn btn-sm" style={{color:'#A32D2D',borderColor:'#A32D2D'}} onClick={()=>handleDelete(t)}>Delete</button>
                        </div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            }
          </div>
        </>
      )}
    </>
  )
}
