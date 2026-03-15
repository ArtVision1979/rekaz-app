import { useState, useEffect } from 'react'
import { getProjects, supabase } from '../lib/supabase.js'

const EMPTY = { project_id:'', title:'', due_date:'', status:'pending' }
const STATUS_C = { pending:'badge-gray', in_progress:'badge-progress', completed:'badge-done', delayed:'badge-open' }

export default function Milestones() {
  const [milestones, setMilestones] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const [{ data: m }, p] = await Promise.all([
        supabase.from('milestones').select('*, projects(name)').order('due_date'),
        getProjects()
      ])
      setMilestones(m||[])
      setProjects(p||[])
    } catch(e){ console.error(e) } finally { setLoading(false) }
  }

  function openNew() { setEditItem(null); setForm(EMPTY); setShowModal(true) }

  function openEdit(m) {
    setEditItem(m)
    setForm({ project_id: m.project_id, title: m.title, due_date: m.due_date||'', status: m.status })
    setShowModal(true)
  }

  async function handleSave(e) {
    e.preventDefault(); setSaving(true)
    try {
      if (editItem) { await supabase.from('milestones').update(form).eq('id', editItem.id) }
      else { await supabase.from('milestones').insert(form) }
      setShowModal(false); await load()
    } catch(e){ alert(e.message) } finally { setSaving(false) }
  }

  async function handleDelete(m) {
    if (!confirm('Delete milestone?')) return
    await supabase.from('milestones').delete().eq('id', m.id)
    await load()
  }

  async function markDone(m) {
    await supabase.from('milestones').update({ status:'completed', completed_date: new Date().toISOString().split('T')[0] }).eq('id', m.id)
    await load()
  }

  const today = new Date().toISOString().split('T')[0]

  return (
    <>
      {showModal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowModal(false)}>
          <div className="modal">
            <h3>{editItem ? 'Edit Milestone' : 'New Milestone'}</h3>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Project *</label>
                <select className="form-input" value={form.project_id} onChange={e=>setForm(f=>({...f,project_id:e.target.value}))} required>
                  <option value="">Select project...</option>
                  {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Milestone Title *</label>
                <input className="form-input" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} required autoFocus/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div className="form-group">
                  <label className="form-label">Due Date</label>
                  <input type="date" className="form-input" value={form.due_date} onChange={e=>setForm(f=>({...f,due_date:e.target.value}))}/>
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-input" value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="delayed">Delayed</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={()=>setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Saving...':editItem?'Save':'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="page-header">
        <div><h3>Milestones</h3><div className="page-sub">{milestones.filter(m=>m.status!=='completed').length} pending · {milestones.filter(m=>m.status==='completed').length} completed</div></div>
        <button className="btn btn-primary" onClick={openNew}>+ New Milestone</button>
      </div>

      <div className="card">
        {loading ? <div style={{color:'#888',padding:16}}>Loading...</div> :
          milestones.length === 0 ? <div className="empty"><p>No milestones yet.</p></div> : (
            <table className="table">
              <thead><tr><th>Milestone</th><th>Project</th><th>Due Date</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {milestones.map(m => {
                  const overdue = m.due_date && m.due_date < today && m.status !== 'completed'
                  return (
                    <tr key={m.id}>
                      <td>
                        <div style={{fontWeight:500,textDecoration:m.status==='completed'?'line-through':'none',color:m.status==='completed'?'#888':'inherit'}}>{m.title}</div>
                        {overdue && <div style={{fontSize:11,color:'#A32D2D',marginTop:2}}>Overdue!</div>}
                      </td>
                      <td style={{color:'#888'}}>{m.projects?.name||'—'}</td>
                      <td style={{color: overdue ? '#A32D2D' : '#888'}}>{m.due_date||'—'}</td>
                      <td><span className={`badge ${STATUS_C[m.status]||'badge-gray'}`}>{m.status}</span></td>
                      <td><div style={{display:'flex',gap:6}}>
                        {m.status !== 'completed' && <button className="btn btn-sm" style={{color:'#0F6E56',borderColor:'#0F6E56'}} onClick={()=>markDone(m)}>✓ Done</button>}
                        <button className="btn btn-sm" onClick={()=>openEdit(m)}>Edit</button>
                        <button className="btn btn-sm" style={{color:'#A32D2D',borderColor:'#A32D2D'}} onClick={()=>handleDelete(m)}>Delete</button>
                      </div></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
      </div>
    </>
  )
}
