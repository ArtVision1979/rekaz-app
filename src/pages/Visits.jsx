import { useState, useEffect } from 'react'
import SectionHelp from '../components/SectionHelp.jsx'
import { getProjects, supabase } from '../lib/supabase.js'
import { useEngineers } from '../hooks/useEngineers.js'

const SEV_COLOR = { low:'badge-blue', medium:'badge-progress', high:'badge-open', critical:'badge-open' }
const EMPTY = { project_id:'', visit_date: new Date().toISOString().split('T')[0], notes:'', severity:'low', status:'draft', engineer_name:'' }

function EngineerSelect({ value, onChange }) {
  const engineers = useEngineers()
  return (
    <select className="form-input" value={value} onChange={e => onChange(e.target.value)}>
      <option value="">Select engineer...</option>
      {engineers.map(e => (
        <option key={e.id} value={e.full_name || e.email}>{e.full_name || e.email}</option>
      ))}
    </select>
  )
}

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
  const [showChecklist, setShowChecklist] = useState(null)
  const [checklist, setChecklist] = useState([])
  const [checklistResults, setChecklistResults] = useState({})
  const [checklistNotes, setChecklistNotes] = useState({})
  const [editingNote, setEditingNote] = useState(null)

  useEffect(() => { loadProjects() }, [])
  useEffect(() => { if (selectedProject) loadVisits(selectedProject.id) }, [selectedProject])

  async function loadProjects() {
    try {
      const p = await getProjects()
      setProjects(p || [])

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

  async function openChecklist(visit) {
    setShowChecklist(visit)
    const fullNotes = visit.notes?.trim() || ''
    const shortType = visit.notes?.split(' — ')[0]?.trim() || ''
    
    const { data: allItems } = await supabase.from('inspection_checklists').select('*').order('order_index')
    const { data: results } = await supabase.from('visit_checklist_results').select('*').eq('visit_id', visit.id)
    
    let clData = []
    if (allItems?.length) {
      const types = [...new Set(allItems.map(i => i.visit_type))]
      const bestMatch = 
        types.find(t => t === fullNotes) ||
        types.find(t => t === shortType) ||
        types.find(t => fullNotes.toLowerCase().includes(t.toLowerCase())) ||
        types.find(t => t.toLowerCase().includes(shortType.toLowerCase()))
      if (bestMatch) clData = allItems.filter(i => i.visit_type === bestMatch)
    }
    setChecklist(clData)
    
    const resultsMap = {}
    ;(results || []).forEach(r => { resultsMap[r.checklist_item_id] = r })
    setChecklistResults(resultsMap)
  }

  async function saveChecklistResult(itemId, itemText, result, notes) {
    if (!showChecklist) return
    const existing = checklistResults[itemId]
    const updateData = notes !== undefined ? { result, notes } : { result }
    if (existing) {
      await supabase.from('visit_checklist_results').update(updateData).eq('id', existing.id)
    } else {
      const { data } = await supabase.from('visit_checklist_results').insert({
        visit_id: showChecklist.id,
        checklist_item_id: itemId,
        item_text: itemText,
        ...updateData
      }).select().single()
      if (data) { setChecklistResults(prev => ({ ...prev, [itemId]: data })); return }
    }
    setChecklistResults(prev => ({ ...prev, [itemId]: { ...(prev[itemId]||{}), ...updateData } }))
  }

  async function saveNote(itemId, itemText, notes) {
    const result = checklistResults[itemId]?.result || 'pending'
    await saveChecklistResult(itemId, itemText, result, notes)
    setEditingNote(null)
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
                <EngineerSelect value={form.engineer_name} onChange={val=>setForm(f=>({...f,engineer_name:val}))}/>
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

      {showChecklist && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowChecklist(null)}>
          <div className="modal" style={{maxWidth:560}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <h3 style={{margin:0}}>Checklist — {showChecklist.visit_date}</h3>
              <button className="btn btn-sm" onClick={()=>setShowChecklist(null)}>Close</button>
            </div>
            <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:14}}>
              {showChecklist.notes?.split(' — ')[0]||'Site Visit'}
            </div>
            {checklist.length === 0 ? (
              <div style={{color:'var(--text-muted)',fontSize:13,padding:'16px 0'}}>No checklist available for this visit type.</div>
            ) : (
              <>
                <div style={{marginBottom:8,fontSize:12,color:'var(--text-muted)'}}>
                  ✓ {Object.values(checklistResults).filter(r=>r.result==='pass').length} Pass · 
                  ✗ {Object.values(checklistResults).filter(r=>r.result==='fail').length} Fail ·
                  — {Object.values(checklistResults).filter(r=>r.result==='na').length} N/A
                </div>
                {checklist.map((item,i)=>{
                  const result = checklistResults[item.id]?.result || 'pending'
                  const colors = {pass:'#0F6E56',fail:'#A32D2D',na:'#888',pending:'#aaa'}
                  const bgs = {pass:'#E1F5EE',fail:'#FCEBEB',na:'#f5f5f0',pending:'#f5f5f0'}
                  return (
                    <div key={item.id} style={{padding:'8px 0',borderBottom:'0.5px solid var(--border)'}}>
                      <div style={{display:'flex',alignItems:'center',gap:10}}>
                        <span style={{fontSize:11,color:'var(--text-muted)',width:20,flexShrink:0}}>{i+1}</span>
                        <div style={{flex:1,fontSize:13}}>{item.item}</div>
                        <div style={{display:'flex',gap:5,alignItems:'center'}}>
                          {['pass','fail','na'].map(r=>(
                            <button key={r} onClick={()=>saveChecklistResult(item.id,item.item,r)}
                              style={{padding:'3px 8px',borderRadius:20,border:'none',cursor:'pointer',fontSize:11,fontWeight:500,
                                background:result===r?bgs[r]:'var(--bg)',color:result===r?colors[r]:'var(--text-muted)',
                                outline:result===r?`1.5px solid ${colors[r]}`:'none'}}>
                              {r==='pass'?'✓':r==='fail'?'✗':'—'}
                            </button>
                          ))}
                          <button onClick={()=>setEditingNote(editingNote===item.id?null:item.id)}
                            style={{padding:'3px 8px',borderRadius:20,border:'none',cursor:'pointer',fontSize:11,
                              background:checklistResults[item.id]?.notes?'#FAEEDA':'var(--bg)',
                              color:checklistResults[item.id]?.notes?'#854F0B':'var(--text-muted)'}}>
                            💬
                          </button>
                        </div>
                      </div>
                      {checklistResults[item.id]?.notes && editingNote !== item.id && (
                        <div style={{marginTop:6,marginRight:30,fontSize:12,color:'#854F0B',background:'#FAEEDA',borderRadius:6,padding:'4px 10px'}}>
                          {checklistResults[item.id].notes}
                        </div>
                      )}
                      {editingNote === item.id && (
                        <div style={{marginTop:8,marginRight:30,display:'flex',gap:8}}>
                          <input className="form-input" style={{flex:1,fontSize:12}}
                            defaultValue={checklistResults[item.id]?.notes||''}
                            placeholder="Add note or reason..."
                            autoFocus
                            onKeyDown={e=>{
                              if(e.key==='Enter') saveNote(item.id,item.item,e.target.value)
                              if(e.key==='Escape') setEditingNote(null)
                            }}
                            id={`note-${item.id}`}/>
                          <button className="btn btn-sm btn-primary"
                            onClick={()=>saveNote(item.id,item.item,document.getElementById(`note-${item.id}`).value)}>
                            Save
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </>
            )}
          </div>
        </div>
      )}

      <div className="page-header">
      <SectionHelp
        title="Site Visits — تقارير زيارات الموقع"
        description="كل مرة تزور الموقع سجّل تقريراً هنا. اكتب ملاحظاتك وحدد درجة الخطورة. هذا التقرير يُرسل للعميل ويحفظ كسجل رسمي للمشروع."
        steps={['اختر المشروع', 'اضغط New Visit', 'سجّل ملاحظاتك وحدد الخطورة', 'اطبع التقرير PDF من صفحة Reports']}
        color="#0F6E56" bg="#E1F5EE"
      />
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
                          <button className="btn btn-sm" style={{color:'#185FA5',borderColor:'#185FA5'}} onClick={()=>openChecklist(v)}>☑ Check</button>
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
