import { useState, useEffect } from 'react'
import { getProjects, createProject, supabase } from '../lib/supabase.js'

const STATUS_COLORS = { active:'badge-progress', completed:'badge-done', on_hold:'badge-gray', cancelled:'badge-open' }
const EMPTY = { name:'', project_no:'', location:'', client_name:'', client_phone:'', engineer_name:'', engineer_phone:'', supervision_start:'', status:'active', progress:0 }

export default function Projects() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showCard, setShowCard] = useState(null)
  const [editProject, setEditProject] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [projectVisits, setProjectVisits] = useState([])

  useEffect(() => { load() }, [])

  async function load() {
    try { setProjects(await getProjects()) }
    catch(e) { console.error(e) }
    finally { setLoading(false) }
  }

  async function loadProjectCard(project) {
    const { data: visits } = await supabase
      .from('project_visits')
      .select('*')
      .eq('project_id', project.id)
      .order('order_index')
    setProjectVisits(visits || [])
    setShowCard(project)
  }

  function openNew() { setEditProject(null); setForm(EMPTY); setShowModal(true) }

  function openEdit(p) {
    setEditProject(p)
    setForm({
      name: p.name, project_no: p.project_no, location: p.location||'',
      client_name: p.client_name||'', client_phone: p.client_phone||'',
      engineer_name: p.engineer_name||'', engineer_phone: p.engineer_phone||'',
      supervision_start: p.supervision_start||'', status: p.status, progress: p.progress||0
    })
    setShowModal(true)
  }

  async function handleSave(e) {
    e.preventDefault(); setSaving(true)
    try {
      if (editProject) { await supabase.from('projects').update(form).eq('id', editProject.id) }
      else { await createProject(form) }
      setShowModal(false); await load()
    } catch(e) { alert(e.message) } finally { setSaving(false) }
  }

  async function handleDelete(p) {
    if (!confirm(`Delete "${p.name}"?`)) return
    await supabase.from('projects').delete().eq('id', p.id)
    await load()
  }

  function printCard() {
    window.print()
  }

  const filtered = projects.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || (p.project_no||'').toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || p.status === filterStatus
    return matchSearch && matchStatus
  })

  const STATUS_LABELS = { pending:'Pending', scheduled:'Scheduled', completed:'Completed', cancelled:'Cancelled' }
  const STATUS_C2 = { pending:'#888', scheduled:'#185FA5', completed:'#0F6E56', cancelled:'#A32D2D' }

  return (
    <>
      <style>{`
        @media print {
          body > * { display: none !important; }
          #project-card-print { display: block !important; }
        }
        #project-card-print { display: none; }
      `}</style>

      {/* Project Card Print */}
      {showCard && (
        <div id="project-card-print">
          <div style={{ fontFamily:'Arial,sans-serif', maxWidth:800, margin:'0 auto', padding:40, color:'#000' }}>
            {/* Header */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', borderBottom:'3px solid #185FA5', paddingBottom:20, marginBottom:24 }}>
              <div>
                <img src="/rekaz-logo.jpg" alt="Rekaz" style={{ height:50, width:'auto' }} />
                <div style={{ fontSize:12, color:'#666', marginTop:4 }}>مكتب ركاز للهندسة</div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:20, fontWeight:700, color:'#185FA5' }}>بطاقة المشروع</div>
                <div style={{ fontSize:13, color:'#333', marginTop:4 }}>Project Card</div>
                <div style={{ fontSize:11, color:'#888', marginTop:2 }}>{new Date().toLocaleDateString('en-GB')}</div>
              </div>
            </div>

            {/* Project Info */}
            <div style={{ background:'#f5f5f0', borderRadius:8, padding:16, marginBottom:20 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#185FA5', marginBottom:12, textTransform:'uppercase' }}>معلومات المشروع</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px 24px' }}>
                {[
                  ['اسم المشروع', showCard.name],
                  ['رقم المشروع', showCard.project_no],
                  ['الموقع', showCard.location||'—'],
                  ['الحالة', showCard.status],
                  ['تاريخ بداية الإشراف', showCard.supervision_start||'—'],
                  ['نسبة الإنجاز', `${showCard.progress||0}%`],
                ].map(([label, value]) => (
                  <div key={label} style={{ display:'flex', gap:8 }}>
                    <span style={{ color:'#666', fontSize:12, minWidth:120 }}>{label}:</span>
                    <span style={{ fontSize:12, fontWeight:500 }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Client Info */}
            <div style={{ background:'#E6F1FB', borderRadius:8, padding:16, marginBottom:20 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#185FA5', marginBottom:12, textTransform:'uppercase' }}>معلومات المالك</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px 24px' }}>
                {[
                  ['اسم المالك', showCard.client_name||'—'],
                  ['رقم التواصل', showCard.client_phone||'—'],
                ].map(([label, value]) => (
                  <div key={label} style={{ display:'flex', gap:8 }}>
                    <span style={{ color:'#555', fontSize:12, minWidth:120 }}>{label}:</span>
                    <span style={{ fontSize:12, fontWeight:500 }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Engineer Info */}
            <div style={{ background:'#E1F5EE', borderRadius:8, padding:16, marginBottom:20 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#0F6E56', marginBottom:12, textTransform:'uppercase' }}>معلومات المهندس المشرف</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px 24px' }}>
                {[
                  ['اسم المهندس', showCard.engineer_name||'—'],
                  ['رقم التواصل', showCard.engineer_phone||'—'],
                ].map(([label, value]) => (
                  <div key={label} style={{ display:'flex', gap:8 }}>
                    <span style={{ color:'#555', fontSize:12, minWidth:120 }}>{label}:</span>
                    <span style={{ fontSize:12, fontWeight:500 }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Visits List */}
            {projectVisits.length > 0 && (
              <div style={{ marginBottom:24 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#185FA5', marginBottom:12, textTransform:'uppercase' }}>
                  قائمة الزيارات ({projectVisits.filter(v=>v.status==='completed').length}/{projectVisits.length} منجزة)
                </div>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                  <thead>
                    <tr style={{ background:'#185FA5', color:'white' }}>
                      <th style={{ padding:'7px 10px', textAlign:'right', width:30 }}>#</th>
                      <th style={{ padding:'7px 10px', textAlign:'right' }}>الزيارة</th>
                      <th style={{ padding:'7px 10px', textAlign:'right' }}>المهندس</th>
                      <th style={{ padding:'7px 10px', textAlign:'right' }}>التاريخ</th>
                      <th style={{ padding:'7px 10px', textAlign:'center', width:80 }}>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectVisits.map((v, i) => (
                      <tr key={v.id} style={{ background: i%2===0 ? '#fafafa' : 'white' }}>
                        <td style={{ padding:'6px 10px', textAlign:'right', color:'#888' }}>{i+1}</td>
                        <td style={{ padding:'6px 10px', textAlign:'right' }}>
                          <div>{v.title}</div>
                          {v.title_ar && <div style={{ fontSize:11, color:'#666' }}>{v.title_ar}</div>}
                        </td>
                        <td style={{ padding:'6px 10px', textAlign:'right', color:'#666' }}>{v.engineer_name||'—'}</td>
                        <td style={{ padding:'6px 10px', textAlign:'right', color:'#666' }}>{v.scheduled_date||'—'}</td>
                        <td style={{ padding:'6px 10px', textAlign:'center' }}>
                          <span style={{ color: STATUS_C2[v.status], fontWeight:500, fontSize:11 }}>
                            {STATUS_LABELS[v.status]||v.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Signatures */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:40, marginTop:50 }}>
              <div style={{ textAlign:'center' }}>
                <div style={{ borderTop:'1.5px solid #333', paddingTop:8, marginTop:40 }}>
                  <div style={{ fontSize:12 }}>توقيع المالك</div>
                  <div style={{ fontSize:11, color:'#888', marginTop:2 }}>{showCard.client_name||'—'}</div>
                </div>
              </div>
              <div style={{ textAlign:'center' }}>
                <div style={{ borderTop:'1.5px solid #333', paddingTop:8, marginTop:40 }}>
                  <div style={{ fontSize:12 }}>توقيع المهندس المشرف</div>
                  <div style={{ fontSize:11, color:'#888', marginTop:2 }}>{showCard.engineer_name||'—'}</div>
                </div>
              </div>
            </div>

            <div style={{ borderTop:'1px solid #ddd', marginTop:32, paddingTop:12, textAlign:'center', fontSize:10, color:'#aaa' }}>
              مكتب ركاز للهندسة · البحرين · {new Date().toLocaleDateString('en-GB')}
            </div>
          </div>
        </div>
      )}

      {/* Edit/New Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowModal(false)}>
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

              <div style={{borderTop:'0.5px solid var(--border)',margin:'12px 0',paddingTop:12}}>
                <div style={{fontSize:12,fontWeight:500,color:'var(--text-muted)',marginBottom:10}}>Client Info — معلومات المالك</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                  <div className="form-group">
                    <label className="form-label">Client Name — اسم المالك</label>
                    <input className="form-input" value={form.client_name} onChange={e=>setForm(f=>({...f,client_name:e.target.value}))}/>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Client Phone — رقم التواصل</label>
                    <input className="form-input" value={form.client_phone} onChange={e=>setForm(f=>({...f,client_phone:e.target.value}))} placeholder="+973 XXXX XXXX"/>
                  </div>
                </div>
              </div>

              <div style={{borderTop:'0.5px solid var(--border)',margin:'12px 0',paddingTop:12}}>
                <div style={{fontSize:12,fontWeight:500,color:'var(--text-muted)',marginBottom:10}}>Engineer Info — معلومات المهندس</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                  <div className="form-group">
                    <label className="form-label">Engineer Name — اسم المهندس</label>
                    <input className="form-input" value={form.engineer_name} onChange={e=>setForm(f=>({...f,engineer_name:e.target.value}))}/>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Engineer Phone — رقم التواصل</label>
                    <input className="form-input" value={form.engineer_phone} onChange={e=>setForm(f=>({...f,engineer_phone:e.target.value}))} placeholder="+973 XXXX XXXX"/>
                  </div>
                </div>
              </div>

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-input" value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
                    <option value="active">Active</option>
                    <option value="on_hold">On Hold</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Supervision Start — بداية الإشراف</label>
                  <input type="date" className="form-input" value={form.supervision_start} onChange={e=>setForm(f=>({...f,supervision_start:e.target.value}))}/>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Progress: {form.progress}%</label>
                <input type="range" min="0" max="100" step="5" value={form.progress} onChange={e=>setForm(f=>({...f,progress:parseInt(e.target.value)}))} style={{width:'100%'}}/>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn" onClick={()=>setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Saving...':editProject?'Save':'Create'}</button>
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
        {loading ? <div style={{color:'var(--text-muted)',padding:16}}>Loading...</div> :
          filtered.length === 0 ? <div className="empty"><p>No projects yet.</p></div> : (
            <table className="table">
              <thead><tr>
                <th>Project</th><th>Client</th><th>Engineer</th><th>Progress</th><th>Status</th><th></th>
              </tr></thead>
              <tbody>
                {filtered.map(p=>(
                  <tr key={p.id}>
                    <td>
                      <div style={{fontWeight:500}}>{p.name}</div>
                      <div style={{fontSize:11,color:'var(--text-muted)'}}>{p.project_no} · {p.location||'—'}</div>
                    </td>
                    <td>
                      <div style={{fontSize:13}}>{p.client_name||'—'}</div>
                      {p.client_phone && <div style={{fontSize:11,color:'var(--text-muted)'}}>{p.client_phone}</div>}
                    </td>
                    <td>
                      <div style={{fontSize:13}}>{p.engineer_name||'—'}</div>
                      {p.engineer_phone && <div style={{fontSize:11,color:'var(--text-muted)'}}>{p.engineer_phone}</div>}
                    </td>
                    <td>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <div className="progress-bar" style={{width:60}}><div className="progress-fill" style={{width:`${p.progress||0}%`}}/></div>
                        <span style={{fontSize:11,color:'var(--text-muted)'}}>{p.progress||0}%</span>
                      </div>
                    </td>
                    <td><span className={`badge ${STATUS_COLORS[p.status]||'badge-gray'}`}>{p.status}</span></td>
                    <td>
                      <div style={{display:'flex',gap:6}}>
                        <button className="btn btn-sm" style={{color:'#185FA5',borderColor:'#185FA5'}} onClick={()=>loadProjectCard(p)}>📄 Card</button>
                        <button className="btn btn-sm" onClick={()=>openEdit(p)}>Edit</button>
                        <button className="btn btn-sm" style={{color:'#A32D2D',borderColor:'#A32D2D'}} onClick={()=>handleDelete(p)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        }
      </div>

      {/* Project Card Modal */}
      {showCard && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowCard(null)}>
          <div className="modal" style={{maxWidth:640}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <h3 style={{margin:0}}>Project Card — {showCard.name}</h3>
              <div style={{display:'flex',gap:8}}>
                <button className="btn btn-primary btn-sm" onClick={printCard}>🖨 Print / PDF</button>
                <button className="btn btn-sm" onClick={()=>setShowCard(null)}>Close</button>
              </div>
            </div>

            <div style={{background:'#f5f5f0',borderRadius:8,padding:14,marginBottom:12}}>
              <div style={{fontSize:11,fontWeight:500,color:'#185FA5',marginBottom:8}}>PROJECT INFO</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px 16px',fontSize:13}}>
                <div><span style={{color:'var(--text-muted)'}}>Name: </span>{showCard.name}</div>
                <div><span style={{color:'var(--text-muted)'}}>No: </span>{showCard.project_no}</div>
                <div><span style={{color:'var(--text-muted)'}}>Location: </span>{showCard.location||'—'}</div>
                <div><span style={{color:'var(--text-muted)'}}>Start: </span>{showCard.supervision_start||'—'}</div>
              </div>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
              <div style={{background:'#E6F1FB',borderRadius:8,padding:12}}>
                <div style={{fontSize:11,fontWeight:500,color:'#185FA5',marginBottom:6}}>CLIENT — المالك</div>
                <div style={{fontSize:13,fontWeight:500}}>{showCard.client_name||'—'}</div>
                <div style={{fontSize:12,color:'#555'}}>{showCard.client_phone||'—'}</div>
              </div>
              <div style={{background:'#E1F5EE',borderRadius:8,padding:12}}>
                <div style={{fontSize:11,fontWeight:500,color:'#0F6E56',marginBottom:6}}>ENGINEER — المهندس</div>
                <div style={{fontSize:13,fontWeight:500}}>{showCard.engineer_name||'—'}</div>
                <div style={{fontSize:12,color:'#555'}}>{showCard.engineer_phone||'—'}</div>
              </div>
            </div>

            {projectVisits.length > 0 && (
              <div>
                <div style={{fontSize:11,fontWeight:500,color:'var(--text-muted)',marginBottom:8}}>
                  VISITS — الزيارات ({projectVisits.filter(v=>v.status==='completed').length}/{projectVisits.length} completed)
                </div>
                <div style={{maxHeight:220,overflowY:'auto'}}>
                  {projectVisits.map((v,i)=>(
                    <div key={v.id} style={{display:'flex',alignItems:'center',gap:10,padding:'6px 0',borderBottom:'0.5px solid var(--border)'}}>
                      <span style={{fontSize:11,color:'var(--text-muted)',width:20,flexShrink:0}}>{i+1}</span>
                      <div style={{flex:1}}>
                        <div style={{fontSize:12,fontWeight:500,textDecoration:v.status==='completed'?'line-through':'none'}}>{v.title}</div>
                        {v.title_ar&&<div style={{fontSize:11,color:'var(--text-muted)'}}>{v.title_ar}</div>}
                      </div>
                      <div style={{fontSize:11,color:'var(--text-muted)'}}>{v.engineer_name||'—'}</div>
                      <div style={{fontSize:11,color:'var(--text-muted)'}}>{v.scheduled_date||'—'}</div>
                      <span style={{fontSize:10,color:STATUS_C2[v.status],fontWeight:500}}>{STATUS_LABELS[v.status]||v.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
