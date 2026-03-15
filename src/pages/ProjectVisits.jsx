import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { requestNotificationPermission, scheduleVisitNotification, cancelNotification } from '../hooks/useNotifications.js'

const STATUS_COLORS = { pending:'badge-gray', scheduled:'badge-blue', completed:'badge-done', cancelled:'badge-open' }
const STATUS_LABELS = { pending:'Pending', scheduled:'Scheduled', completed:'Completed', cancelled:'Cancelled' }
const STATUS_NEXT = { pending:'scheduled', scheduled:'completed', completed:'pending', cancelled:'pending' }

const DEFAULT_TEMPLATES = [
  'Site Inspection',
  'Excavation & Backfill',
  'Land Demarcation & Announcement',
  'Foundation Inspection',
  'Ground Floor Beams',
  'Columns Before Pour',
  'Columns After Pour',
  'Roof Slab Inspection',
  'First Floor Beams',
  'First Floor Columns Before Pour',
  'First Floor Columns After Pour',
  'First Floor Roof Slab',
  'Finishing Inspection',
  'Final Handover'
]

export default function ProjectVisits() {
  const [projects, setProjects] = useState([])
  const [selectedProject, setSelectedProject] = useState(null)
  const [visits, setVisits] = useState([])
  const [engineers, setEngineers] = useState([])
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [editVisit, setEditVisit] = useState(null)
  const [saving, setSaving] = useState(false)
  const [notifPermission, setNotifPermission] = useState(Notification?.permission || 'default')
  const [notifIds, setNotifIds] = useState({})
  const [form, setForm] = useState({
    title: '', engineer_name: '', scheduled_date: '',
    scheduled_time: '', status: 'pending', notes: '', order_index: 0
  })
  const [newTemplate, setNewTemplate] = useState('')
  const [editTemplates, setEditTemplates] = useState([])

  useEffect(() => { loadInitial() }, [])
  useEffect(() => { if (selectedProject) loadVisits(selectedProject.id) }, [selectedProject])

  async function loadInitial() {
    try {
      const [{ data: p }, { data: u }, { data: t }] = await Promise.all([
        supabase.from('projects').select('*').order('created_at', { ascending: false }),
        supabase.from('users').select('*'),
        supabase.from('visit_templates').select('*').order('order_index')
      ])
      setProjects(p || [])
      // Build engineers list from users + saved names
      const userNames = (u || []).map(u => u.full_name || u.email).filter(Boolean)
      const savedNames = JSON.parse(localStorage.getItem('rekaz-engineers') || '[]')
      const allNames = [...new Set([...userNames, ...savedNames])]
      setEngineers(allNames)
      // Use DB templates or defaults
      const tList = t?.length ? t.map(t => t.title) : DEFAULT_TEMPLATES
      setTemplates(tList)
      setEditTemplates(tList)
      if (p?.length) setSelectedProject(p[0])
    } catch(e) { console.error(e) } finally { setLoading(false) }
  }

  async function loadVisits(projectId) {
    const { data } = await supabase
      .from('project_visits')
      .select('*')
      .eq('project_id', projectId)
      .order('order_index')
    setVisits(data || [])
    // Schedule notifications
    if (Notification?.permission === 'granted') {
      const ids = {}
      ;(data || []).forEach(v => {
        if (v.scheduled_date && v.scheduled_time && v.status === 'scheduled') {
          const id = scheduleVisitNotification({ ...v, projects: selectedProject }, 60)
          if (id) ids[v.id] = id
        }
      })
      setNotifIds(ids)
    }
  }

  function saveEngineerName(name) {
    if (!name) return
    const saved = JSON.parse(localStorage.getItem('rekaz-engineers') || '[]')
    if (!saved.includes(name)) {
      saved.push(name)
      localStorage.setItem('rekaz-engineers', JSON.stringify(saved))
      setEngineers(prev => [...new Set([...prev, name])])
    }
  }

  async function addDefaultVisits() {
    if (!selectedProject) return
    const toInsert = templates.map((title, i) => ({
      project_id: selectedProject.id,
      title, order_index: i + 1, status: 'pending'
    }))
    await supabase.from('project_visits').insert(toInsert)
    await loadVisits(selectedProject.id)
  }

  function openNew() {
    setEditVisit(null)
    setForm({ title: '', engineer_name: '', scheduled_date: '', scheduled_time: '', status: 'pending', notes: '', order_index: visits.length + 1 })
    setShowModal(true)
  }

  function openEdit(v) {
    setEditVisit(v)
    setForm({ title: v.title, engineer_name: v.engineer_name || '', scheduled_date: v.scheduled_date || '', scheduled_time: v.scheduled_time || '', status: v.status, notes: v.notes || '', order_index: v.order_index })
    setShowModal(true)
  }

  async function handleSave(e) {
    e.preventDefault(); setSaving(true)
    try {
      saveEngineerName(form.engineer_name)
      const data = { ...form, project_id: selectedProject.id }
      if (editVisit) {
        await supabase.from('project_visits').update(data).eq('id', editVisit.id)
        if (notifIds[editVisit.id]) cancelNotification(notifIds[editVisit.id])
      } else {
        await supabase.from('project_visits').insert(data)
      }
      setShowModal(false)
      await loadVisits(selectedProject.id)
    } catch(e) { alert(e.message) } finally { setSaving(false) }
  }

  async function handleDelete(v) {
    if (!confirm(`Delete "${v.title}"?`)) return
    if (notifIds[v.id]) cancelNotification(notifIds[v.id])
    await supabase.from('project_visits').delete().eq('id', v.id)
    await loadVisits(selectedProject.id)
  }

  async function toggleStatus(v) {
    await supabase.from('project_visits').update({ status: STATUS_NEXT[v.status] }).eq('id', v.id)
    await loadVisits(selectedProject.id)
  }

  async function saveTemplates() {
    // Save to DB
    await supabase.from('visit_templates').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    const toInsert = editTemplates.filter(t => t.trim()).map((title, i) => ({ title, order_index: i + 1 }))
    if (toInsert.length) await supabase.from('visit_templates').insert(toInsert)
    setTemplates(editTemplates.filter(t => t.trim()))
    setShowTemplateModal(false)
  }

  async function enableNotifications() {
    const granted = await requestNotificationPermission()
    setNotifPermission(granted ? 'granted' : 'denied')
    if (granted) await loadVisits(selectedProject?.id)
  }

  const completed = visits.filter(v => v.status === 'completed').length
  const total = visits.length
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0

  return (
    <>
      {/* Visit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <h3>{editVisit ? 'Edit Visit' : 'New Visit'}</h3>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Visit Name *</label>
                <input className="form-input" value={form.title}
                  onChange={e => setForm(f => ({...f, title: e.target.value}))}
                  required autoFocus list="visit-templates-list" placeholder="Select or type..." />
                <datalist id="visit-templates-list">
                  {templates.map((t, i) => <option key={i} value={t} />)}
                </datalist>
              </div>
              <div className="form-group">
                <label className="form-label">Engineer</label>
                <input className="form-input" value={form.engineer_name}
                  onChange={e => setForm(f => ({...f, engineer_name: e.target.value}))}
                  list="engineers-list" placeholder="Type or select engineer..." />
                <datalist id="engineers-list">
                  {engineers.map((e, i) => <option key={i} value={e} />)}
                </datalist>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input type="date" className="form-input" value={form.scheduled_date}
                    onChange={e => setForm(f => ({...f, scheduled_date: e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Time</label>
                  <input type="time" className="form-input" value={form.scheduled_time}
                    onChange={e => setForm(f => ({...f, scheduled_time: e.target.value}))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-input" value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value}))}>
                  <option value="pending">Pending</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-input" value={form.notes}
                  onChange={e => setForm(f => ({...f, notes: e.target.value}))} placeholder="Visit notes..." />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : editVisit ? 'Save' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Template Editor Modal */}
      {showTemplateModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowTemplateModal(false)}>
          <div className="modal">
            <h3>Edit Visit Templates</h3>
            <div style={{ marginBottom: 12 }}>
              {editTemplates.map((t, i) => (
                <div key={i} style={{ display:'flex', gap:8, marginBottom:6, alignItems:'center' }}>
                  <span style={{ fontSize:11, color:'var(--text-muted)', width:20 }}>{i+1}</span>
                  <input className="form-input" style={{ flex:1 }} value={t}
                    onChange={e => setEditTemplates(prev => prev.map((v,j) => j===i ? e.target.value : v))} />
                  <button className="btn btn-sm" style={{ color:'#A32D2D', borderColor:'#A32D2D', flexShrink:0 }}
                    onClick={() => setEditTemplates(prev => prev.filter((_,j) => j!==i))}>✕</button>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:8, marginBottom:16 }}>
              <input className="form-input" value={newTemplate} onChange={e => setNewTemplate(e.target.value)}
                placeholder="Add new visit type..." onKeyDown={e => { if(e.key==='Enter'){e.preventDefault();if(newTemplate.trim()){setEditTemplates(p=>[...p,newTemplate.trim()]);setNewTemplate('')}}}} />
              <button className="btn btn-primary btn-sm" onClick={() => { if(newTemplate.trim()){setEditTemplates(p=>[...p,newTemplate.trim()]);setNewTemplate('')} }}>Add</button>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setShowTemplateModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveTemplates}>Save Templates</button>
            </div>
          </div>
        </div>
      )}

      <div className="page-header">
        <div><h3>Project Visits</h3><div className="page-sub">Track visits per project</div></div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-sm" onClick={() => { setEditTemplates([...templates]); setShowTemplateModal(true) }}>
            ⚙ Templates
          </button>
          {notifPermission !== 'granted' ? (
            <button className="btn btn-sm" style={{ color:'#185FA5', borderColor:'#185FA5' }} onClick={enableNotifications}>🔔 Enable Reminders</button>
          ) : (
            <span style={{ fontSize:11, color:'#0F6E56', display:'flex', alignItems:'center', gap:4 }}>🔔 Reminders On</span>
          )}
          <button className="btn btn-primary" onClick={openNew} disabled={!selectedProject}>+ New Visit</button>
        </div>
      </div>

      {/* Project Tabs */}
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
        {projects.map(p => (
          <button key={p.id} className={`btn ${selectedProject?.id===p.id?'btn-primary':''}`}
            style={{ fontSize:12 }} onClick={() => setSelectedProject(p)}>
            {p.name}
          </button>
        ))}
      </div>

      {selectedProject && (
        <>
          <div className="card" style={{ marginBottom:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
              <div>
                <div style={{ fontWeight:500, fontSize:15 }}>{selectedProject.name}</div>
                <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>
                  {selectedProject.project_no} · {selectedProject.location||'—'} · {selectedProject.client_name||'—'}
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:22, fontWeight:500, color:'#185FA5' }}>{completed}/{total}</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)' }}>Completed</div>
                </div>
                <div style={{ width:80 }}>
                  <div className="progress-bar" style={{ height:6 }}>
                    <div className="progress-fill" style={{ width:`${progress}%` }}/>
                  </div>
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:3, textAlign:'center' }}>{progress}%</div>
                </div>
                {visits.length===0 && (
                  <button className="btn btn-sm" style={{ color:'#185FA5', borderColor:'#185FA5' }} onClick={addDefaultVisits}>
                    + Load Default Visits
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="card">
            {loading ? <div style={{ color:'var(--text-muted)', padding:16 }}>Loading...</div> :
              visits.length===0 ? (
                <div className="empty">
                  <p>No visits yet.</p>
                  <button className="btn btn-primary" style={{ marginTop:12 }} onClick={addDefaultVisits}>Load Default Visits</button>
                </div>
              ) : (
                <table className="table">
                  <thead><tr>
                    <th style={{ width:32 }}>#</th>
                    <th>Visit</th>
                    <th>Engineer</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Status</th>
                    <th></th>
                  </tr></thead>
                  <tbody>
                    {visits.map((v, i) => (
                      <tr key={v.id} style={{ opacity: v.status==='cancelled'?0.5:1 }}>
                        <td style={{ color:'var(--text-muted)', fontSize:11 }}>{i+1}</td>
                        <td>
                          <div style={{ fontWeight:500, textDecoration:v.status==='completed'?'line-through':'none', color:v.status==='completed'?'var(--text-muted)':'var(--text)' }}>
                            {notifIds[v.id] ? '🔔 ' : ''}{v.title}
                          </div>
                          {v.notes && <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>{v.notes}</div>}
                        </td>
                        <td style={{ color:'var(--text-muted)', fontSize:12 }}>{v.engineer_name||'—'}</td>
                        <td style={{ color:'var(--text-muted)', fontSize:12 }}>{v.scheduled_date||'—'}</td>
                        <td style={{ color:'var(--text-muted)', fontSize:12 }}>{v.scheduled_time?v.scheduled_time.slice(0,5):'—'}</td>
                        <td>
                          <span className={`badge ${STATUS_COLORS[v.status]}`} style={{ cursor:'pointer' }} onClick={() => toggleStatus(v)}>
                            {STATUS_LABELS[v.status]}
                          </span>
                        </td>
                        <td><div style={{ display:'flex', gap:6 }}>
                          <button className="btn btn-sm" onClick={() => openEdit(v)}>Edit</button>
                          <button className="btn btn-sm" style={{ color:'#A32D2D', borderColor:'#A32D2D' }} onClick={() => handleDelete(v)}>Delete</button>
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
