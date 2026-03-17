import { useState, useEffect, useRef } from 'react'
import { getProjects, supabase } from '../lib/supabase.js'
import { requestNotificationPermission, scheduleAllVisits } from '../hooks/useNotifications.js'

const DAYS = ['Sat','Sun','Mon','Tue','Wed','Thu']
const COLORS = ['#185FA5','#0F6E56','#854F0B','#A32D2D','#534AB7','#1D9E75']
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
  const [notifPermission, setNotifPermission] = useState(Notification?.permission || 'default')
  const [notifBefore, setNotifBefore] = useState(60)
  const [notifIds, setNotifIds] = useState({})
  const weekDates = getWeekDates()
  const notifIdsRef = useRef({})

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const start = weekDates[0].toISOString().split('T')[0]
      const end = weekDates[5].toISOString().split('T')[0]

      const [{ data: pv }, p, { data: cons }] = await Promise.all([
        supabase.from('project_visits').select('*, projects(name)').gte('scheduled_date', start).lte('scheduled_date', end).in('status', ['pending','scheduled']).order('scheduled_time'),
        getProjects(),
        supabase.from('consultations').select('*').gte('consultation_date', start).lte('consultation_date', end).eq('status','pending').order('consultation_time')
      ])

      const merged = [
        ...(pv || []).map(v => ({
          ...v,
          scheduled_time: v.scheduled_time || '09:00',
          _label: v.title,
          _projectName: v.projects?.name || '—',
          _type: 'visit'
        })),
        ...(cons || []).map(c => ({
          ...c,
          scheduled_date: c.consultation_date,
          scheduled_time: c.consultation_time || '09:00',
          _label: c.topic,
          _projectName: '💼 ' + c.client_name,
          _type: 'consultation'
        }))
      ]

      setSchedule(merged)
      setProjects(p || [])

      if (Notification?.permission === 'granted') {
        const allForNotif = merged.map(v => ({
          ...v,
          projects: { name: v._projectName }
        }))
        const ids = scheduleAllVisits(allForNotif, notifBefore)
        notifIdsRef.current = ids
        setNotifIds(ids)
      }
    } catch(e) { console.error(e) } finally { setLoading(false) }
  }

  async function enableNotifications() {
    const granted = await requestNotificationPermission()
    setNotifPermission(granted ? 'granted' : 'denied')
    if (granted) await load()
  }

  const times = ['07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00']

  const projectColorMap = {}
  projects.forEach((p,i) => { projectColorMap[p.id] = i % COLORS.length })

  return (
    <>
      <div className="page-header">
        <div>
          <h3>Schedule</h3>
          <div className="page-sub">
            Week of {weekDates[0].toLocaleDateString('en-GB',{day:'numeric',month:'short'})} – {weekDates[5].toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}
          </div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          {notifPermission === 'granted' ? (
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span style={{fontSize:12,color:'#0F6E56'}}>🔔 Reminders On</span>
              <select className="form-input" style={{width:120,fontSize:12}} value={notifBefore}
                onChange={e=>{setNotifBefore(parseInt(e.target.value));load()}}>
                <option value={15}>15 min before</option>
                <option value={30}>30 min before</option>
                <option value={60}>1 hour before</option>
                <option value={120}>2 hours before</option>
              </select>
            </div>
          ) : (
            <button className="btn" style={{fontSize:12,color:'#185FA5',borderColor:'#185FA5'}} onClick={enableNotifications}>
              🔔 Enable Reminders
            </button>
          )}
        </div>
      </div>

      {notifPermission === 'denied' && (
        <div style={{background:'var(--amber-light)',border:'0.5px solid #EF9F27',borderRadius:8,padding:'10px 16px',marginBottom:16,fontSize:13,color:'var(--amber)'}}>
          ⚠ Notifications blocked. Enable them in browser settings.
        </div>
      )}

      <div className="card" style={{overflowX:'auto'}}>
        {loading ? <div style={{color:'var(--text-muted)',padding:16}}>Loading...</div> : (
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,minWidth:600}}>
            <thead>
              <tr>
                <th style={{width:60,padding:'8px 10px',color:'var(--text-muted)',fontWeight:400,textAlign:'left',borderBottom:'0.5px solid var(--border)'}}></th>
                {weekDates.map((d,i) => {
                  const isToday = d.toDateString() === new Date().toDateString()
                  return (
                    <th key={i} style={{padding:'8px 6px',fontWeight:500,textAlign:'center',borderBottom:'0.5px solid var(--border)',background:isToday?'var(--blue-light)':'transparent',color:isToday?'var(--blue-dark)':'inherit',borderRadius:isToday?6:0}}>
                      {DAYS[i]} {d.getDate()}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {times.map(time => (
                <tr key={time}>
                  <td style={{padding:'8px 10px',color:'var(--text-muted)',fontSize:11,borderBottom:'0.5px solid var(--border)'}}>{time}</td>
                  {weekDates.map((d,di) => {
                    const dateStr = d.toISOString().split('T')[0]
                    const items = schedule.filter(s =>
                      s.scheduled_date === dateStr &&
                      (s.scheduled_time||'09:00').slice(0,2) === time.slice(0,2)
                    )
                    return (
                      <td key={di} style={{padding:'4px 4px',borderBottom:'0.5px solid var(--border)',verticalAlign:'top',minHeight:36}}>
                        {items.map(item => {
                          const isConsultation = item._type === 'consultation'
                          const ci = isConsultation ? 2 : (projectColorMap[item.project_id] ?? 0)
                          return (
                            <div key={item.id} style={{
                              background: isConsultation ? '#FDF0DC' : BG[ci],
                              color: isConsultation ? '#854F0B' : COLORS[ci],
                              borderRadius:6, padding:'3px 7px', fontSize:11,
                              fontWeight:500, marginBottom:3,
                              borderLeft: `3px solid ${isConsultation ? '#854F0B' : COLORS[ci]}`
                            }}>
                              <div style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                                {notifIds[item.id] ? '🔔 ' : ''}{item._projectName}
                              </div>
                              <div style={{fontSize:10,opacity:0.8,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                                {item._label}
                              </div>
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
    </>
  )
}
