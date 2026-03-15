import { useState, useEffect } from 'react'
import { getDashboardStats, getVisits, getTasks, supabase } from '../lib/supabase.js'
import { useNavigate } from 'react-router-dom'

export default function Dashboard() {
  const [stats, setStats] = useState({ totalProjects:0, activeProjects:0, openTasks:0, reports:0 })
  const [visits, setVisits] = useState([])
  const [tasks, setTasks] = useState([])
  const [overdue, setOverdue] = useState([])
  const [milestones, setMilestones] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    async function load() {
      try {
        const [s, v, t, { data: od }, { data: ms }] = await Promise.all([
          getDashboardStats(), getVisits(), getTasks(),
          supabase.from('tasks').select('*, projects(name)').lt('due_date', today).not('status','in','("resolved","closed")'),
          supabase.from('milestones').select('*, projects(name)').not('status','eq','completed').order('due_date').limit(4)
        ])
        setStats(s); setVisits(v?.slice(0,4)||[]); setTasks(t?.filter(t=>t.status==='open').slice(0,5)||[])
        setOverdue(od||[]); setMilestones(ms||[])
      } catch(e){ console.error(e) } finally { setLoading(false) }
    }
    load()
  }, [])

  if (loading) return <div style={{color:'#888',padding:24,fontSize:13}}>Loading dashboard...</div>

  return (
    <div>
      {overdue.length > 0 && (
        <div style={{background:'#FCEBEB',border:'0.5px solid #F09595',borderRadius:8,padding:'10px 16px',marginBottom:16,display:'flex',alignItems:'center',gap:10}}>
          <span style={{color:'#A32D2D',fontSize:13,fontWeight:500}}>⚠ {overdue.length} overdue task{overdue.length>1?'s':''}</span>
          <span style={{color:'#A32D2D',fontSize:12,flex:1}}>{overdue.map(t=>t.title).slice(0,3).join(' · ')}</span>
          <button className="btn btn-sm" style={{color:'#A32D2D',borderColor:'#A32D2D'}} onClick={()=>navigate('/tasks')}>View</button>
        </div>
      )}

      <div className="stats-grid">
        {[
          {label:'Total Projects', value:stats.totalProjects, sub:`${stats.activeProjects} active`, color:'#185FA5', path:'/projects'},
          {label:'Open Tasks', value:stats.openTasks, sub:`${overdue.length} overdue`, color:'#A32D2D', path:'/tasks'},
          {label:'Site Visits', value:visits.length, sub:'Recorded', color:'#0F6E56', path:'/visits'},
          {label:'Reports', value:stats.reports, sub:'Generated', color:'#333', path:'/reports'},
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
            <span className="card-title">Recent Visits</span>
            <button className="btn btn-sm" onClick={()=>navigate('/visits')}>View all</button>
          </div>
          {visits.length===0 ? <div className="empty"><p>No visits yet</p></div> :
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
            <span className="card-title">Open Tasks</span>
            <button className="btn btn-sm" onClick={()=>navigate('/tasks')}>View all</button>
          </div>
          {tasks.length===0 ? <div className="empty"><p>No open tasks</p></div> :
            tasks.map(t=>(
              <div className="list-item" key={t.id}>
                <div style={{width:14,height:14,borderRadius:3,flexShrink:0,border:'1.5px solid #ccc'}}/>
                <div className="item-info">
                  <div className="item-name">{t.title}</div>
                  <div className="item-sub">{t.projects?.name} · Due {t.due_date||'—'}</div>
                </div>
                <span className={`badge ${t.severity==='high'||t.severity==='critical'?'badge-open':t.severity==='medium'?'badge-progress':'badge-gray'}`}>{t.severity}</span>
              </div>
            ))
          }
        </div>
      </div>

      {milestones.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Upcoming Milestones</span>
            <button className="btn btn-sm" onClick={()=>navigate('/milestones')}>View all</button>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:10}}>
            {milestones.map(m=>{
              const overdue = m.due_date && m.due_date < today
              return (
                <div key={m.id} style={{background:overdue?'#FCEBEB':'#f5f5f0',borderRadius:8,padding:'12px 14px'}}>
                  <div style={{fontSize:12,fontWeight:500,color:overdue?'#A32D2D':'#333'}}>{m.title}</div>
                  <div style={{fontSize:11,color:'#888',marginTop:3}}>{m.projects?.name}</div>
                  <div style={{fontSize:11,color:overdue?'#A32D2D':'#888',marginTop:2}}>Due: {m.due_date||'—'}</div>
                  <span className={`badge ${m.status==='in_progress'?'badge-progress':'badge-gray'}`} style={{marginTop:6,display:'inline-block'}}>{m.status}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
