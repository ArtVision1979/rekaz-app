import { useState, useEffect } from 'react'
import { getProjects, supabase } from '../lib/supabase.js'

const SEV_COLOR = { low:'badge-blue', medium:'badge-progress', high:'badge-open', critical:'badge-open' }
const EMPTY = { project_id:'', visit_date: new Date().toISOString().split('T')[0], notes:'', severity:'low', status:'draft', engineer_name:'' }

export default function Visits() {
  const [projects, setProjects] = useState([])
  const [selectedProject, setSelectedProject] = useState(null)
  const [visits, setVisits] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editVisit, setEditVisit] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [projectSearch, setProjectSearch] = useState('')
  const [engineers, setEngineers] = useState([])

  useEffect(() => { loadProjects() }, [])
  useEffect(() => { if (selectedProject) loadVisits(selectedProject.id) }, [selectedProject])

  async function loadProjects() {
    try {
      const [p, { data: u }] = await Promise.all([
        getProjects(),
        supabase.from('users').select('*')
      ])
      setProjects(p || [])
      const saved = JSON.parse(localStorage.getItem('rekaz-engineers') || '[]')
      const userNames = (u||[]).map(u => u.full_name||u.email).filter(Boolean)
      setEngineers([...new Set([...userNames, ...saved])])
      if (p?.length) setSelectedProject(p[0])
    } catch(e) { console.error(e) } finally { setLoading(false) }
  }

  async function loadVisits(projectId) {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('site_visits')
        .select('*, construction_stages(name)')
        .eq('project_id', projectId)
        .order('visit_date', { ascending: false })
      setVisits(data || [])
    } catch(e) { console.error(e) } finally { setLoading(false) }
  }

  function openNew() {
    setEditVisit(null)
    setForm({ ...EMPTY, project_id: selectedProject?.id || '' })
    setShowModal(true)
  }

  function openEdit(v) {
    setEditVisit(v)
    setForm({ project_id: v.project_id, visit_date: v.visit_date, notes: v.notes||'', severity: v.severity, status: v.status, engineer_name: v.engineer_name||'' })
    setShowModal(true)
  }

  async function handleSave(e) {
    e.preventDefault(); setSaving(true)
    try {
      // Save engineer name
      if (form.engineer_name) {
        const saved = JSON.parse(localStorage.getItem('rekaz-engineers') || '[]')
        if (!saved.includes(form.engineer_name)) {
          saved.push(form.engineer_name)
          localStorage.setItem('rekaz-engineers', JSON.stringify(saved))
          setEngineers(prev => [...new Set([...prev, form.engineer_name])])
        }
      }
      if (editVisit) {
        await supabase.from('site_visits').update(form).eq('id', editVisit.id)
      } else {
        await supabase.from('site_visits').insert(form)
      }
      setShowModal(false)
      await loadVisits(selectedProject.id)
    } catch(e) { alert(e.message) } finally { setSaving(false) }
  }

  async function handleDelete(v) {
    if (!confirm('Delete this visit?')) return
    await supabase.from('site_visits').delete().eq('id', v.id)
    await loadVisits(selectedProject.id)
  }

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(projectSearch.toLowerCase()) ||
    (p.project_no||'').toLowerCase().includes(projectSearch.toLowerCase())
  )

  const draftCount = visits.filter(v => v.status === 'draft').length
  const approvedCount = visits.filter(v => v.status === 'approved').length

  return (
    <>
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <h3>{editVisit ? 'Edit Visit' : 'New Site Visit'}</h3>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Engineer</label>
                <input className="form-input" value={form.engineer_name}
                  onChange={e => setForm(f=>({...f, engineer_name:e.target.value}))}
                  list="engineers-list" placeholder="Type or select..." />
                <datalist id="engineers-list">
                  {engineers.map((e,i) => <option key={i} value={e}/>)}
                </datalist>
              </div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
                <div className="form-group">
                  <label className="form-label">Visit Date *</label>
                  <input type="date" className="form-input" value={form.visit_date}
                    onChange={e => setForm(f=>({...f, visit_date:e.target.value}))} required/>
                </div>
                <div className="form-group">
                  <label className="form-label">Severity</label>
                  <select className="form-input" value={form.severity} onChange={e=>setForm(f=>({...f,severity:e.target.value}))}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-input" value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
                  <option value="draft">Draft</option>
                  <option value="submitted">Submitted</option>
                  <option value="approved">Approved</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-input" value={form.notes}
                  onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Visit notes..."/>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={()=>setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Saving...':editVisit?'Save':'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="page-header">
        <div><h3>Site Visits</h3><div className="page-sub">{visits.length} visits · {draftCount} draft · {approvedCount} approved</div></div>
        <button className="btn btn-primary" onClick={openNew} disabled={!selectedProject}>+ New Visit</button>
      </div>

      <div style={{marginBottom:10}}>
        <input className="form-input" style={{maxWidth:280}}
          placeholder="Search projects..."
          value={projectSearch} onChange={e=>setProjectSearch(e.target.value)}/>
      </div>

      <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}>
        {filteredProjects.map(p=>(
          <button key={p.id}
            className={`btn ${selectedProject?.id===p.id?'btn-primary':''}`}
            style={{fontSize:12}}
            onClick={()=>setSelectedProject(p)}>
            {p.name}
          </button>
        ))}
      </div>

      {selectedProject && (
        <>
          <div className="card" style={{marginBottom:16}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12}}>
              <div>
                <div style={{fontWeight:500,fontSize:15}}>{selectedProject.name}</div>
                <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>
                  {selectedProject.project_no} · {selectedProject.location||'—'} · {selectedProject.client_name||'—'}
                </div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:16}}>
                <div style={{textAlign:'center'}}>
                  <div style={{fontSize:22,fontWeight:500,color:'#185FA5'}}>{visits.length}</div>
                  <div style={{fontSize:11,color:'var(--text-muted)'}}>Total Visits</div>
                </div>
                <div style={{textAlign:'center'}}>
                  <div style={{fontSize:22,fontWeight:500,color:'#0F6E56'}}>{approvedCount}</div>
                  <div style={{fontSize:11,color:'var(--text-muted)'}}>Approved</div>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            {loading ? <div style={{color:'var(--text-muted)',padding:16}}>Loading...</div> :
              visits.length === 0 ? (
                <div className="empty">
                  <p>No visits yet for this project.</p>
                  <button className="btn btn-primary" style={{marginTop:12}} onClick={openNew}>+ New Visit</button>
                </div>
              ) : (
                <table className="table">
                  <thead><tr>
                    <th>Date</th>
                    <th>Engineer</th>
                    <th>Notes</th>
                    <th>Severity</th>
                    <th>Status</th>
                    <th></th>
                  </tr></thead>
                  <tbody>
                    {visits.map(v=>(
                      <tr key={v.id}>
                        <td style={{fontWeight:500}}>{v.visit_date}</td>
                        <td style={{color:'var(--text-muted)',fontSize:12}}>{v.engineer_name||'—'}</td>
                        <td style={{color:'var(--text-muted)',fontSize:12,maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{v.notes||'—'}</td>
                        <td><span className={`badge ${SEV_COLOR[v.severity]||'badge-gray'}`}>{v.severity}</span></td>
                        <td><span className={`badge ${v.status==='approved'?'badge-done':v.status==='submitted'?'badge-progress':'badge-gray'}`}>{v.status}</span></td>
                        <td><div style={{display:'flex',gap:6}}>
                          <button className="btn btn-sm" onClick={()=>openEdit(v)}>Edit</button>
                          <button className="btn btn-sm" style={{color:'#A32D2D',borderColor:'#A32D2D'}} onClick={()=>handleDelete(v)}>Delete</button>
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
