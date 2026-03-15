import { useState, useEffect } from 'react'
import { getDashboardStats, getVisits, getTasks, supabase } from '../lib/supabase.js'
import { useNavigate } from 'react-router-dom'
import { useLang, T } from '../hooks/useSettings.js'
import { createBackup, checkBackupNeeded, saveBackupDate } from '../hooks/useBackup.js'

export default function Dashboard() {
  const [stats, setStats] = useState({ totalProjects:0, activeProjects:0, openTasks:0, reports:0 })
  const [visits, setVisits] = useState([])
  const [tasks, setTasks] = useState([])
  const [overdue, setOverdue] = useState([])
  const [milestones, setMilestones] = useState([])
  const [loading, setLoading] = useState(true)
  const [backupNeeded, setBackupNeeded] = useState(false)
  const [backing, setBacking] = useState(false)
  const navigate = useNavigate()
  const { lang } = useLang()
  const t = T[lang]
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    setBackupNeeded(checkBackupNeeded())
    async function load() {
      try {
        const [s, v, tk, { data: od }, { data: ms }] = await Promise.all([
          getDashboardStats(), getVisits(), getTasks(),
          supabase.from('tasks').select('*, projects(name)').lt('due_date', today).not('status','in','("resolved","closed")'),
          supabase.from('milestones').select('*, projects(name)').not('status','eq','completed').order('due_date').limit(4)
        ])
        setStats(s); setVisits(v?.slice(0,4)||[]); setTasks(tk?.filter(t=>t.status==='open').slice(0,5)||[])
        setOverdue(od||[]); setMilestones(ms||[])
      } catch(e){ console.error(e) } finally { setLoading(false) }
    }
    load()
  }, [])

  async function handleBackup() {
    setBacking(true)
    try {
      await createBackup()
      saveBackupDate()
      setBackupNeeded(false)
    } catch(e) { alert('Backup failed: ' + e.message) }
    finally { setBacking(false) }
  }

  if (loading) return <div style={{color:'var(--text-muted)',padding:24,fontSize:13}}>{t.loading}</div>

  return (
    <div>
      {backupNeeded && (
        <div style={{background:'var(--amber-light)',border:'0.5px solid #EF9F27',borderRadius:8,padding:'10px 16px',marginBottom:16,display:'flex',alignItems:'center',gap:10}}>
          <span style={{color:'var(--amber)',fontSize:13,fontWeight:500}}>💾 {lang==='ar'?'لم يتم عمل نسخة احتياطية منذ أكثر من أسبوع':'No backup in over a week'}</span>
          <button className="btn btn-sm" style={{marginLeft:'auto',color:'var(--amber)',borderColor:'var(--amber)'}} onClick={handleBackup} disabled={backing}>
            {backing ? (lang==='ar'?'جاري النسخ...':'Backing up...') : (lang==='ar'?'نسخ احتياطي الآن':'Backup Now')}
          </button>
        </div>
      )}

      {overdue.length > 0 && (
        <div style={{background:'var(--red-light)',border:'0.5px solid #F09595',borderRadius:8,padding:'10px 16px',marginBottom:16,display:'flex',alignItems:'center',gap:10}}>
          <span style={{color:'var(--red)',fontSize:13,fontWeight:500}}>⚠ {overdue.length} {lang==='ar'?'مهمة متأخرة':'overdue task'}{overdue.length>1&&lang==='en'?'s':''}</span>
          <span style={{color:'var(--red)',fontSize:12,flex:1}}>{overdue.map(t=>t.title).slice(0,3).join(' · ')}</span>
          <button className="btn btn-sm" style={{color:'var(--red)',borderColor:'var(--red)'}} onClick={()=>navigate('/tasks')}>{lang==='ar'?'عرض':'View'}</button>
        </div>
      )}

      <div className="stats-grid">
        {[
          {label: t.totalProjects, value: stats.totalProjects, sub: `${stats.activeProjects} ${t.active}`, color:'#185FA5', path:'/projects'},
          {label: t.openTasks, value: stats.openTasks, sub: `${overdue.length} ${t.overdue}`, color:'#A32D2D', path:'/tasks'},
          {label: t.siteVisitsLabel, value: visits.length, sub: t.recorded, color:'#0F6E56', path:'/visits'},
          {label: t.reportsLabel, value: stats.reports, sub: t.generated, color:'var(--text)', path:'/reports'},
        ].map(s=>(
          <div key={s.label} className="stat-card" style={{cursor:'pointer'}} onClick={()=>navigate(s.path)}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{color:s.color}}>{s.value}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid2" style={{marginBottom:16}}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">{t.recentVisits}</span>
            <button className="btn btn-sm" onClick={()=>navigate('/visits')}>{t.viewAll}</button>
          </div>
          {visits.length===0 ? <div className="empty"><p>{t.noData}</p></div> :
            visits.map(v=>(
              <div className="list-item" key={v.id}>
                <div className="dot" style={{background:v.severity==='high'||v.severity==='critical'?'#A32D2D':'#185FA5'}}/>
                <div className="item-info">
                  <div className="item-name">{v.projects?.name||'—'}</div>
                  <div className="item-sub">{v.construction_stages?.name||'—'} · {v.visit_date}</div>
                </div>
                <span className={`badge ${v.status==='approved'?'badge-done':v.status==='submitted'?'badge-progress':'badge-gray'}`}>{v.status}</span>
              </div>
            ))
          }
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">{t.openTasks}</span>
            <button className="btn btn-sm" onClick={()=>navigate('/tasks')}>{t.viewAll}</button>
          </div>
          {tasks.length===0 ? <div className="empty"><p>{t.noData}</p></div> :
            tasks.map(tk=>(
              <div className="list-item" key={tk.id}>
                <div style={{width:14,height:14,borderRadius:3,flexShrink:0,border:'1.5px solid var(--border)'}}/>
                <div className="item-info">
                  <div className="item-name">{tk.title}</div>
                  <div className="item-sub">{tk.projects?.name} · {t.dueDate} {tk.due_date||'—'}</div>
                </div>
                <span className={`badge ${tk.severity==='high'||tk.severity==='critical'?'badge-open':tk.severity==='medium'?'badge-progress':'badge-gray'}`}>{tk.severity}</span>
              </div>
            ))
          }
        </div>
      </div>

      {milestones.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">{t.upcomingMilestones}</span>
            <button className="btn btn-sm" onClick={()=>navigate('/milestones')}>{t.viewAll}</button>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:10}}>
            {milestones.map(m=>{
              const isOverdue = m.due_date && m.due_date < today
              return (
                <div key={m.id} style={{background:isOverdue?'var(--red-light)':'var(--bg)',borderRadius:8,padding:'12px 14px'}}>
                  <div style={{fontSize:12,fontWeight:500,color:isOverdue?'var(--red)':'var(--text)'}}>{m.title}</div>
                  <div style={{fontSize:11,color:'var(--text-muted)',marginTop:3}}>{m.projects?.name}</div>
                  <div style={{fontSize:11,color:isOverdue?'var(--red)':'var(--text-muted)',marginTop:2}}>{t.dueDate}: {m.due_date||'—'}</div>
                  <span className={`badge ${m.status==='in_progress'?'badge-progress':'badge-gray'}`} style={{marginTop:6,display:'inline-block'}}>{m.status}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div style={{textAlign:'center',marginTop:20}}>
        <button className="btn btn-sm" onClick={handleBackup} disabled={backing} style={{fontSize:11,color:'var(--text-muted)'}}>
          💾 {backing ? (lang==='ar'?'جاري النسخ...':'Backing up...') : (lang==='ar'?'نسخة احتياطية':'Download Backup')}
        </button>
      </div>
    </div>
  )
}
