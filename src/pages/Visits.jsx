import { useState, useEffect } from 'react'
import { getVisits, createVisit, getProjects, supabase } from '../lib/supabase.js'

const SEV_COLOR = { low: 'badge-blue', medium: 'badge-progress', high: 'badge-open', critical: 'badge-open' }
const EMPTY = { project_id: '', visit_date: new Date().toISOString().split('T')[0], notes: '', severity: 'low', status: 'draft' }

export default function Visits() {
  const [visits, setVisits] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editVisit, setEditVisit] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const [v, p] = await Promise.all([getVisits(), getProjects()])
      setVisits(v || [])
      setProjects(p || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  function openNew() { setEditVisit(null); setForm(EMPTY); setShowModal(true) }

  function openEdit(v) {
    setEditVisit(v)
    setForm({ project_id: v.project_id, visit_date: v.visit_date, notes: v.notes || '', severity: v.severity, status: v.status })
    setShowModal(true)
  }

  async function handleSave(e) {
    e.preventDefault(); setSaving(true)
    try {
      if (editVisit) { await supabase.from('site_visits').update(form).eq('id', editVisit.id) }
      else { await createVisit(form) }
      setShowModal(false); await load()
    } catch (e) { alert(e.message) } finally { setSaving(false) }
  }

  async function handleDelete(v) {
    if (!confirm('Delete this visit?')) return
    await supabase.from('site_visits').delete().eq('id', v.id)
    await load()
  }

  return (
    <div style={{ position: 'relative' }}>
      <div className="page-header">
        <div><h3>Site Visits</h3><div className="page-sub">{visits.length} visits</div></div>
        <button className="btn btn-primary" onClick={openNew}>+ New Visit</button>
      </div>
      <div className="card">
        {loading ? <div style={{color:'#888',padding:16}}>Loading...</div> :
          visits.length === 0 ? <div className="empty"><p>No visits yet.</p></div> : (
            <table className="table">
              <thead><tr><th>Project</th><th>Date</th><th>Severity</th><th>Status</th><th>Notes</th><th></th></tr></thead>
              <tbody>
                {visits.map(v => (
                  <tr key={v.id}>
                    <td><div style={{fontWeight:500}}>{v.projects?.name||'—'}</div><div style={{fontSize:11,color:'#888'}}>{v.projects?.project_no}</div></td>
                    <td style={{color:'#888'}}>{v.visit_date}</td>
                    <td><span className={`badge ${SEV_COLOR[v.severity]||'badge-gray'}`}>{v.severity}</span></td>
                    <td><span className={`badge ${v.status==='approved'?'badge-done':v.status==='submitted'?'badge-progress':'badge-gray'}`}>{v.status}</span></td>
                    <td style={{color:'#888',maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{v.notes||'—'}</td>
                    <td><div style={{display:'flex',gap:6}}>
                      <button className="btn btn-sm" onClick={()=>openEdit(v)}>Edit</button>
                      <button className="btn btn-sm" style={{color:'#A32D2D',borderColor:'#A32D2D'}} onClick={()=>handleDelete(v)}>Delete</button>
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
            <h3>{editVisit ? 'Edit Visit' : 'New Site Visit'}</h3>
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
                  <label className="form-label">Visit Date *</label>
                  <input type="date" className="form-input" value={form.visit_date} onChange={e=>setForm(f=>({...f,visit_date:e.target.value}))} required/>
                </div>
                <div className="form-group">
                  <label className="form-label">Severity</label>
                  <select className="form-input" value={form.severity} onChange={e=>setForm(f=>({...f,severity:e.target.value}))}>
                    <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-input" value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
                  <option value="draft">Draft</option><option value="submitted">Submitted</option><option value="approved">Approved</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-input" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Visit notes..."/>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={()=>setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Saving...':editVisit?'Save':'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
