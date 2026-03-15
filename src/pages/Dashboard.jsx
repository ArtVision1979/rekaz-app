import { useState, useEffect } from 'react'
import { getDashboardStats, getVisits, getTasks, supabase } from '../lib/supabase.js'
import { useNavigate } from 'react-router-dom'

export default function Dashboard() {
  const [stats, setStats] = useState({ totalProjects:0, activeProjects:0, openTasks:0, reports:0 })
  const [visits, setVisits] = useState([])
  const [tasks, setTasks] = useState([])
  const [overdue, setOverdue] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    async function load() {
      try {
        const [s, v, t, { data: od }] = await Promise.all([
          getDashboardStats(), getVisits(), getTasks(),
          supabase.from('tasks').select('*, projects(name)').lt('due_date', today).not('status', 'in', '("resolved","closed")')
        ])
        setStats(s); setVisits(v?.slice(0,4)||[]); setTasks(t?.slice(0,5)||[]); setOverdue(od||[])
      } catch(e){ console.error(e) } finally { setLoading(false) }
    }
    load()
  }, [])

  if (loading) return <div style={{color:'#888',padding:24}}>Loading...</div>

  return (
    <div>
      {overdue.length > 0 && (
        <div style={{background:'#FCEBEB',border:'0.5px solid #F09595',borderRadius:8,padding:'10px 16px',marginBottom:20,display:'flex',alignItems:'center',gap:10}}>
          <span style={{color:'#A32D2D',fontSize:13,fontWeight:500}}>⚠ {overdue.length} overdue task{overdue.length>1?'s':''}</span>
          <span style={{color:'#A32D2D',fontSize:12}}>{overdue.map(t=>t.title).join(', ')}</span>
          <button className="btn btn-sm" style={{marginLeft:'auto',color:'#A32D2D',borderColor:'#A32D2D'}} onClick={()=>navigate('/tasks')}>View Tasks</button>
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card" style={{cursor:'pointer'}} onClick={()=>navigate('/projects')}>
          <div className="stat-label">Total Projects</div>
          <div className="stat-value" style={{color:'#185FA5'}}>{stats.totalProjects}</div>
          <div className="stat-sub">{stats.activeProjects} active</div>
        </div>
        <div className="stat-card" style={{cursor:'pointer'}} onClick={()=>navigate('/tasks')}>
          <div className="stat-label">Open Tasks</div>
          <div className="stat-value" style={{color:'#A32D2D'}}>{stats.openTasks}</div>
          <div className="stat-sub">{overdue.length} overdue</div>
        </div>
        <div className="stat-card" style={{cursor:'pointer'}} onClick={()=>navigate('/visits')}>
          <div className="stat-label">Recent Visits</div>
          <div className="stat-value" style={{color:'#0F6E56'}}>{visits.length}</div>
          <div className="stat-sub">This period</div>
        </div>
        <div className="stat-card" style={{cursor:'pointer'}} onClick={()=>navigate('/reports')}>
          <div className="stat-label">Reports</div>
          <div className="stat-value">{stats.reports}</div>
          <div className="stat-sub">Generated</div>
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent Visits</span>
            <button className="btn btn-sm" onClick={()=>navigate('/visits')}>View all</button>
          </div>
          {visits.length === 0 ? <div className="empty"><p>No visits yet</p></div> :
            visits.map(v => (
              <div className="list-item" key={v.id}>
                <div className="dot" style={{background: v.severity==='high'||v.severity==='critical'?'#A32D2D':'#185FA5'}}/>
                <div className="item-info">
                  <div className="item-name">{v.projects?.name||'Project'}</div>
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
          {tasks.length === 0 ? <div className="empty"><p>No tasks yet</p></div> :
            tasks.map(t => (
              <div className="list-item" key={t.id}>
                <div style={{width:16,height:16,borderRadius:4,flexShrink:0,border:t.status==='resolved'?'none':'1.5px solid #ccc',background:t.status==='resolved'?'#185FA5':'transparent'}}/>
                <div className="item-info">
                  <div className="item-name" style={{textDecoration:t.status==='resolved'?'line-through':'none',color:t.status==='resolved'?'#888':'inherit'}}>{t.title}</div>
                  <div className="item-sub">{t.projects?.name} · Due {t.due_date||'—'}</div>
                </div>
                <span className={`badge ${t.severity==='high'||t.severity==='critical'?'badge-open':t.severity==='medium'?'badge-progress':'badge-gray'}`}>{t.severity}</span>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  )
}
