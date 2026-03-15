import { useState, useEffect } from 'react'
import { getProjects, supabase } from '../lib/supabase.js'

const DAYS = ['Sat','Sun','Mon','Tue','Wed','Thu']
const COLORS = ['#185FA5','#0F6E56','#854F0B','#A32D2D','#534AB7','#0F6E56']
const BG = ['#E6F1FB','#E1F5EE','#FAEEDA','#FCEBEB','#EEEDFE','#E1F5EE']

function getWeekDates() {
  const today = new Date()
  const day = today.getDay()
  const diff = day === 6 ? 0 : day + 1
  const sat = new Date(today); sat.setDate(today.getDate() - diff)
  return Array.from({length:6}, (_,i) => { const d = new Date(sat); d.setDate(sat.getDate()+i); return d })
}

export default function Schedule() {
  const [schedule, setSchedule] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState({ project_id:'', scheduled_date:'', scheduled_time:'09:00', notes:'' })
  const [saving, setSaving] = useState(false)
  const weekDates = getWeekDates()

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const start = weekDates[0].toISOString().split('T')[0]
      const end = weekDates[5].toISOString().split('T')[0]
      const [{ data: s }, p] = await Promise.all([
        supabase.from('schedule_visits').select('*, projects(name)').gte('scheduled_date', start).lte('scheduled_date', end).order('scheduled_time'),
        getProjects()
      ])
      setSchedule(s || [])
      setProjects(p || [])
    } catch(e){ console.error(e) } finally { setLoading(false) }
  }

  function openNew() { setEditItem(null); setForm({ project_id:'', scheduled_date: weekDates[0].toISOString().split('T')[0], scheduled_time:'09:00', notes:'' }); setShowModal(true) }

  function openEdit(item) {
    setEditItem(item)
    setForm({ project_id: item.project_id, scheduled_date: item.scheduled_date, scheduled_time: item.scheduled_time||'09:00', notes: item.notes||'' })
    setShowModal(true)
  }

  async function handleSave(e) {
    e.preventDefault(); setSaving(true)
    try {
      if (editItem) { await supabase.from('schedule_visits').update(form).eq('id', editItem.id) }
      else { await supabase.from('schedule_visits').insert(form) }
      setShowModal(false); await load()
    } catch(e){ alert(e.message) } finally { setSaving(false) }
  }

  async function handleDelete(item) {
    if (!confirm('Delete this scheduled visit?')) return
    await supabase.from('schedule_visits').delete().eq('id', item.id)
    await load()
  }

  const times = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00']
  const projectColorMap = {}
  projects.forEach((p,i) => { projectColorMap[p.id] = i % COLORS.length })

  return (
    <div style={{ position: 'relative' }}>
      <div className="page-header">
        <div><h3>Schedule</h3><div className="page-sub">Week of {weekDates[0].toLocaleDateString('en-GB',{day:'numeric',month:'short'})} – {weekDates[5].toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</div></div>
        <button className="btn btn-primary" onClick={openNew}>+ Add Visit</button>
      </div>

      <div className="card" style={{overflowX:'auto'}}>
        {loading ? <div style={{color:'#888',padding:16}}>Loading...</div> : (
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,minWidth:600}}>
            <thead>
              <tr>
                <th style={{width:60,padding:'8px 10px',color:'#888',fontWeight:400,textAlign:'left',borderBottom:'0.5px solid rgba(0,0,0,0.08)'}}></th>
                {weekDates.map((d,i) => {
                  const isToday = d.toDateString() === new Date().toDateString()
                  return (
                    <th key={i} style={{padding:'8px 6px',fontWeight:500,textAlign:'center',borderBottom:'0.5px solid rgba(0,0,0,0.08)',background:isToday?'#E6F1FB':'transparent',color:isToday?'#0C447C':'inherit',borderRadius:isToday?6:0}}>
                      {DAYS[i]} {d.getDate()}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {times.map(time => (
                <tr key={time}>
                  <td style={{padding:'8px 10px',color:'#888',fontSize:11,borderBottom:'0.5px solid rgba(0,0,0,0.05)'}}>{time}</td>
                  {weekDates.map((d,di) => {
                    const dateStr = d.toISOString().split('T')[0]
                    const items = schedule.filter(s => s.scheduled_date === dateStr && (s.scheduled_time||'').startsWith(time))
                    return (
                      <td key={di} style={{padding:'4px 4px',borderBottom:'0.5px solid rgba(0,0,0,0.05)',verticalAlign:'top',minHeight:36}}>
                        {items.map(item => {
                          const ci = projectColorMap[item.project_id] ?? 0
                          return (
                            <div key={item.id} style={{background:BG[ci],color:COLORS[ci],borderRadius:6,padding:'3px 7px',fontSize:11,fontWeight:500,marginBottom:3,cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center',gap:4}} onClick={()=>openEdit(item)}>
                              <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.projects?.name||'Visit'}</span>
                              <span onClick={e=>{e.stopPropagation();handleDelete(item)}} style={{opacity:0.5,fontSize:10,cursor:'pointer'}}>✕</span>
                            </div>
                          )
                        })}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>{editItem ? 'Edit Scheduled Visit' : 'Add Scheduled Visit'}</h3>
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
                  <label className="form-label">Date *</label>
                  <input type="date" className="form-input" value={form.scheduled_date} onChange={e=>setForm(f=>({...f,scheduled_date:e.target.value}))} required/>
                </div>
                <div className="form-group">
                  <label className="form-label">Time</label>
                  <input type="time" className="form-input" value={form.scheduled_time} onChange={e=>setForm(f=>({...f,scheduled_time:e.target.value}))}/>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <input className="form-input" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Optional notes..."/>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={()=>setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Saving...':editItem?'Save':'Add'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
