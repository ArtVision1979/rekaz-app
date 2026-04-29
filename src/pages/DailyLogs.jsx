import { useState, useEffect, useRef } from 'react'
import SectionHelp from '../components/SectionHelp.jsx'
import { getProjects, supabase } from '../lib/supabase.js'
import { useEngineers } from '../hooks/useEngineers.js'

const EMPTY = { project_id:'', log_date: new Date().toISOString().split('T')[0], weather:'', workers_count:'', activities:'', issues:'', engineer_name:'' }
const WEATHER = ['Sunny','Cloudy','Partly Cloudy','Rainy','Windy','Hot','Dusty']

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

export default function DailyLogs() {
  const [projects, setProjects] = useState([])
  const [selectedProject, setSelectedProject] = useState(null)
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editLog, setEditLog] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [projectSearch, setProjectSearch] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => { loadProjects() }, [])
  useEffect(() => { if (selectedProject) loadLogs(selectedProject.id) }, [selectedProject])

  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target))
        setDropdownOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function loadProjects() {
    try {
      const p = await getProjects()
      setProjects(p || [])
      if (p?.length) setSelectedProject(p[0])
    } catch(e) { console.error(e) } finally { setLoading(false) }
  }

  async function loadLogs(projectId) {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('project_id', projectId)
        .order('log_date', { ascending: false })
      setLogs(data || [])
    } catch(e) { console.error(e) } finally { setLoading(false) }
  }

  function openNew() {
    setEditLog(null)
    setForm({ ...EMPTY, project_id: selectedProject?.id || '' })
    setShowModal(true)
  }

  function openEdit(l) {
    setEditLog(l)
    setForm({
      project_id: l.project_id,
      log_date: l.log_date,
      weather: l.weather||'',
      workers_count: l.workers_count||'',
      activities: l.activities||'',
      issues: l.issues||'',
      engineer_name: l.engineer_name||''
    })
    setShowModal(true)
  }

  async function handleSave(e) {
    e.preventDefault(); setSaving(true)
    try {
      const data = { ...form, workers_count: form.workers_count ? parseInt(form.workers_count) : null }
      if (editLog) { await supabase.from('daily_logs').update(data).eq('id', editLog.id) }
      else { await supabase.from('daily_logs').insert(data) }
      setShowModal(false)
      await loadLogs(selectedProject.id)
    } catch(e) { alert(e.message) } finally { setSaving(false) }
  }

  async function handleDelete(l) {
    if (!confirm('Delete this log?')) return
    await supabase.from('daily_logs').delete().eq('id', l.id)
    await loadLogs(selectedProject.id)
  }

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(projectSearch.toLowerCase()) ||
    (p.project_no||'').toLowerCase().includes(projectSearch.toLowerCase())
  )

  return (
    <>
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <h3>{editLog ? 'Edit Log' : 'New Daily Log'}</h3>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Engineer</label>
                <EngineerSelect value={form.engineer_name} onChange={val=>setForm(f=>({...f,engineer_name:val}))}/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div className="form-group">
                  <label className="form-label">Date *</label>
                  <input type="date" className="form-input" value={form.log_date}
                    onChange={e=>setForm(f=>({...f,log_date:e.target.value}))} required/>
                </div>
                <div className="form-group">
                  <label className="form-label">Workers Count</label>
                  <input type="number" className="form-input" value={form.workers_count}
                    onChange={e=>setForm(f=>({...f,workers_count:e.target.value}))} placeholder="0"/>
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
                <textarea className="form-input" value={form.activities}
                  onChange={e=>setForm(f=>({...f,activities:e.target.value}))} placeholder="Work done today..."/>
              </div>
              <div className="form-group">
                <label className="form-label">Issues</label>
                <textarea className="form-input" value={form.issues}
                  onChange={e=>setForm(f=>({...f,issues:e.target.value}))}
                  placeholder="Any issues or observations..."
                  style={{borderColor: form.issues ? '#A32D2D' : undefined}}/>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={()=>setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Saving...':editLog?'Save':'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="page-header">
        <SectionHelp
          title="Daily Logs — السجل اليومي"
          description="سجّل يومياً ما يحصل في الموقع — عدد العمال، الطقس، الأنشطة المنجزة، والمشاكل. هذا السجل مرجع مهم لتتبع سير العمل ويفيد في النزاعات."
          steps={['اختر المشروع', 'اضغط New Log', 'سجّل عدد العمال والطقس', 'اكتب الأنشطة والمشاكل']}
          color="#5F5E5A" bg="#F1EFE8"
        />
        <div><h3>Daily Logs</h3><div className="page-sub">{logs.length} logs</div></div>
        <button className="btn btn-primary" onClick={openNew} disabled={!selectedProject}>+ New Log</button>
      </div>

      {/* Project Dropdown */}
      <div style={{position:'relative',marginBottom:16,maxWidth:600}} ref={dropdownRef}>
        <button
          onClick={()=>setDropdownOpen(o=>!o)}
          style={{
            width:'100%', padding:'9px 14px',
            border:`0.5px solid ${dropdownOpen ? '#185FA5' : 'var(--border)'}`,
            borderRadius: dropdownOpen ? '8px 8px 0 0' : 8,
            background:'var(--bg)', color:'var(--text)',
            fontSize:13, cursor:'pointer',
            display:'flex', justifyContent:'space-between', alignItems:'center',
            textAlign:'left', transition:'border-color 0.15s'
          }}
        >
          <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1}}>
            {selectedProject ? selectedProject.name : 'اختر مشروعاً...'}
          </span>
          {selectedProject?.project_no && (
            <span style={{fontSize:11,color:'var(--text-muted)',marginRight:8,marginLeft:8,whiteSpace:'nowrap'}}>
              {selectedProject.project_no}
            </span>
          )}
          <span style={{fontSize:10,color:'var(--text-muted)',flexShrink:0}}>{dropdownOpen ? '▲' : '▼'}</span>
        </button>

        {dropdownOpen && (
          <div style={{
            position:'absolute', top:'100%', left:0, right:0,
            background:'var(--bg)',
            border:'0.5px solid #185FA5', borderTop:'none',
            borderRadius:'0 0 8px 8px',
            zIndex:100, boxShadow:'0 4px 16px rgba(0,0,0,0.1)'
          }}>
            <input
              autoFocus
              className="form-input"
              style={{
                width:'100%', borderRadius:0,
                borderLeft:'none', borderRight:'none', borderTop:'none',
                borderBottom:'0.5px solid var(--border)',
                boxSizing:'border-box', fontSize:13
              }}
              placeholder="ابحث باسم المشروع أو الرقم..."
              value={projectSearch}
              onChange={e=>setProjectSearch(e.target.value)}
            />
            <div style={{maxHeight:260,overflowY:'auto'}}>
              {filteredProjects.length === 0
                ? <div style={{padding:'10px 14px',fontSize:13,color:'var(--text-muted)'}}>لا توجد نتائج</div>
                : filteredProjects.map(p => (
                  <div
                    key={p.id}
                    onClick={()=>{setSelectedProject(p);setDropdownOpen(false);setProjectSearch('')}}
                    style={{
                      padding:'9px 14px', fontSize:13, cursor:'pointer',
                      borderBottom:'0.5px solid var(--border)',
                      background: selectedProject?.id===p.id ? '#E6F1FB' : 'transparent',
                      color: selectedProject?.id===p.id ? '#0C447C' : 'var(--text)',
                    }}
                  >
                    <div style={{fontWeight: selectedProject?.id===p.id ? 500 : 400,
                      whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                      {p.name}
                    </div>
                    {p.project_no && (
                      <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>
                        {p.project_no}{p.location ? ` · ${p.location}` : ''}
                      </div>
                    )}
                  </div>
                ))
              }
            </div>
            <div style={{padding:'6px 14px',fontSize:11,color:'var(--text-muted)',borderTop:'0.5px solid var(--border)'}}>
              {filteredProjects.length} مشروع
            </div>
          </div>
        )}
      </div>

      {selectedProject && (
        <>
          <div className="card" style={{marginBottom:16}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontWeight:500,fontSize:15}}>{selectedProject.name}</div>
                <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>
                  {selectedProject.project_no} · {selectedProject.location||'—'} · {selectedProject.client_name||'—'}
                </div>
              </div>
              <div style={{textAlign:'center'}}>
                <div style={{fontSize:22,fontWeight:500,color:'#185FA5'}}>{logs.length}</div>
                <div style={{fontSize:11,color:'var(--text-muted)'}}>Total Logs</div>
              </div>
            </div>
          </div>

          <div className="card">
            {loading ? <div style={{color:'var(--text-muted)',padding:16}}>Loading...</div> :
              logs.length === 0 ? (
                <div className="empty">
                  <p>No logs yet for this project.</p>
                  <button className="btn btn-primary" style={{marginTop:12}} onClick={openNew}>+ New Log</button>
                </div>
              ) : (
                <table className="table">
                  <thead><tr>
                    <th>Date</th>
                    <th>Engineer</th>
                    <th>Weather</th>
                    <th>Workers</th>
                    <th>Activities</th>
                    <th>Issues</th>
                    <th></th>
                  </tr></thead>
                  <tbody>
                    {logs.map(l=>(
                      <tr key={l.id}>
                        <td style={{fontWeight:500}}>{l.log_date}</td>
                        <td style={{color:'var(--text-muted)',fontSize:12}}>{l.engineer_name||'—'}</td>
                        <td style={{color:'var(--text-muted)',fontSize:12}}>{l.weather||'—'}</td>
                        <td style={{color:'var(--text-muted)',fontSize:12}}>{l.workers_count||'—'}</td>
                        <td style={{color:'var(--text-muted)',fontSize:12,maxWidth:150,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.activities||'—'}</td>
                        <td style={{color: l.issues ? '#A32D2D' : 'var(--text-muted)',fontSize:12,maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.issues||'—'}</td>
                        <td><div style={{display:'flex',gap:6}}>
                          <button className="btn btn-sm" onClick={()=>openEdit(l)}>Edit</button>
                          <button className="btn btn-sm" style={{color:'#A32D2D',borderColor:'#A32D2D'}} onClick={()=>handleDelete(l)}>Delete</button>
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
