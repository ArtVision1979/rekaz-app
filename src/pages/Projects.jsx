import { useState, useEffect } from 'react'
import { getProjects, createProject, supabase } from '../lib/supabase.js'

const STATUS_COLORS = { active: 'badge-progress', completed: 'badge-done', on_hold: 'badge-gray', cancelled: 'badge-open' }
const EMPTY = { name: '', project_no: '', location: '', client_name: '', status: 'active', progress: 0 }

export default function Projects() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editProject, setEditProject] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')

  useEffect(() => { load() }, [])

  async function load() {
    try { setProjects(await getProjects()) }
    catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  function openNew() { setEditProject(null); setForm(EMPTY); setShowModal(true) }

  function openEdit(p) {
    setEditProject(p)
    setForm({ name: p.name, project_no: p.project_no, location: p.location||'', client_name: p.client_name||'', status: p.status, progress: p.progress||0 })
    setShowModal(true)
  }

  async function handleSave(e) {
    e.preventDefault(); setSaving(true)
    try {
      if (editProject) { await supabase.from('projects').update(form).eq('id', editProject.id) }
      else { await createProject(form) }
      setShowModal(false); await load()
    } catch (e) { alert(e.message) } finally { setSaving(false) }
  }

  async function handleDelete(p) {
    if (!confirm(`Delete "${p.name}"?`)) return
    await supabase.from('projects').delete().eq('id', p.id)
    await load()
  }

  const filtered = projects.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.project_no.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || p.status === filterStatus
    return matchSearch && matchStatus
  })

  return (
    <>
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <h3>{editProject ? 'Edit Project' : 'New Project'}</h3>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Project Name *</label>
                <input className="form-input" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} required autoFocus/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div className="form-group">
                  <label className="form-label">Project No *</label>
                  <input className="form-input" value={form.project_no} placeholder="RKZ-0001" onChange={e=>setForm(f=>({...f,project_no:e.target.value}))} required/>
                </div>
                <div className="form-group">
                  <label className="form-label">Location</label>
                  <input className="form-input" value={form.location} onChange={e=>setForm(f=>({...f,location:e.target.value}))}/>
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div className="form-group">
                  <label className="form-label">Client Name</label>
                  <input className="form-input" value={form.client_name} onChange={e=>setForm(f=>({...f,client_name:e.target.value}))}/>
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-input" value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
                    <option value="active">Active</option>
                    <option value="on_hold">On Hold</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Progress: {form.progress}%</label>
                <input type="range" min="0" max="100" step="5" value={form.progress} onChange={e=>setForm(f=>({...f,progress:parseInt(e.target.value)}))} style={{width:'100%'}}/>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={()=>setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Saving...':editProject?'Save Changes':'Create Project'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="page-header">
        <div><h3>Projects</h3><div className="page-sub">{filtered.length} of {projects.length} projects</div></div>
        <button className="btn btn-primary" onClick={openNew}>+ New Project</button>
      </div>

      <div style={{display:'flex',gap:10,marginBottom:16}}>
        <input className="form-input" style={{flex:1,maxWidth:280}} placeholder="Search projects..." value={search} onChange={e=>setSearch(e.target.value)}/>
        <select className="form-input" style={{width:140}} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="on_hold">On Hold</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="card">
        {loading ? <div style={{color:'#888',padding:16}}>Loading...</div> :
          filtered.length === 0 ? <div className="empty"><p>{search ? 'No results found.' : 'No projects yet.'}</p></div> : (
            <table className="table">
              <thead><tr><th>Project</th><th>Location</th><th>Client</th><th>Progress</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id}>
                    <td><div style={{fontWeight:500}}>{p.name}</div><div style={{fontSize:11,color:'#888'}}>{p.project_no}</div></td>
                    <td style={{color:'#888'}}>{p.location||'—'}</td>
                    <td style={{color:'#888'}}>{p.client_name||'—'}</td>
                    <td>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <div className="progress-bar" style={{width:60}}><div className="progress-fill" style={{width:`${p.progress||0}%`}}/></div>
                        <span style={{fontSize:11,color:'#888'}}>{p.progress||0}%</span>
                      </div>
                    </td>
                    <td><span className={`badge ${STATUS_COLORS[p.status]||'badge-gray'}`}>{p.status}</span></td>
                    <td><div style={{display:'flex',gap:6}}>
                      <button className="btn btn-sm" onClick={()=>openEdit(p)}>Edit</button>
                      <button className="btn btn-sm" style={{color:'#A32D2D',borderColor:'#A32D2D'}} onClick={()=>handleDelete(p)}>Delete</button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
    </>
  )
}
