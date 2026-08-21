import { useState, useEffect } from 'react'
import { supabase, getProjects } from '../lib/supabase.js'
import { useNavigate } from 'react-router-dom'
import { createBackup, checkBackupNeeded, saveBackupDate } from '../hooks/useBackup.js'
import { useLang } from '../hooks/useSettings.js'
import { useCurrentUser } from '../hooks/useCurrentUser.js'
import NextVisitPanel from '../components/NextVisitPanel.jsx'

const TEXT = {
  en: {
    activeProjects: 'Active Projects', openTasks: 'Open Tasks',
    siteVisits: 'Site Visits', reports: 'Reports',
    total: 'total', overdue: 'overdue', thisPeriod: 'This period', generated: 'Generated',
    activeProjectsTitle: 'Active Projects', recentVisits: 'Recent Visits',
    openTasksTitle: 'Open Tasks', upcomingMilestones: 'Upcoming Milestones',
    todaysVisits: "Today's Visits", viewAll: 'View All',
    noTasks: 'No open tasks 🎉', noVisits: 'No visits yet',
    backupWarning: 'No backup in over a week',
    backupNow: 'Backup Now', backingUp: 'Backing up...',
    downloadBackup: 'Download Backup', view: 'View',
    overdueWarning: 'overdue task(s)',
  },
  ar: {
    activeProjects: 'المشاريع النشطة', openTasks: 'المهام المفتوحة',
    siteVisits: 'زيارات المواقع', reports: 'التقارير',
    total: 'إجمالي', overdue: 'متأخرة', thisPeriod: 'هذه الفترة', generated: 'منشأة',
    activeProjectsTitle: 'المشاريع النشطة', recentVisits: 'آخر الزيارات',
    openTasksTitle: 'المهام المفتوحة', upcomingMilestones: 'المراحل القادمة',
    todaysVisits: 'زيارات اليوم', viewAll: 'عرض الكل',
    noTasks: 'لا توجد مهام مفتوحة 🎉', noVisits: 'لا توجد زيارات بعد',
    backupWarning: 'لم يتم عمل نسخة احتياطية منذ أكثر من أسبوع',
    backupNow: 'نسخ الآن', backingUp: 'جاري النسخ...',
    downloadBackup: 'تحميل نسخة احتياطية', view: 'عرض',
    overdueWarning: 'مهمة متأخرة',
  }
}

export default function Dashboard() {
  const [projects, setProjects] = useState([])
  const [stats, setStats] = useState({ total:0, active:0, openTasks:0, overdueTasks:0, visits:0, reports:0 })
  const [recentVisits, setRecentVisits] = useState([])
  const [openTasks, setOpenTasks] = useState([])
  const [milestones, setMilestones] = useState([])
  const [todayVisits, setTodayVisits] = useState([])
  const [todayConsultations, setTodayConsultations] = useState([])
  const [myVisits, setMyVisits] = useState([])
  const [attention, setAttention] = useState({ overdue: [], noReport: 0, notSent: 0 })
  const [loading, setLoading] = useState(true)
  const [backupNeeded, setBackupNeeded] = useState(false)
  const [backing, setBacking] = useState(false)
  const navigate = useNavigate()
  const { user: me } = useCurrentUser()
  const { lang } = useLang()
  const t = TEXT[lang]
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    setBackupNeeded(checkBackupNeeded())
    load()
  }, [])

  // فجوات الإشراف — كانت غير مرئية تماماً: زيارات فات موعدها منذ
  // أشهر، وزيارات بلا تقرير، وتقارير صدرت ولم تصل العميل.
  useEffect(() => {
    let alive = true
    ;(async () => {
      const [{ data: od }, { data: sv }, { data: reps }] = await Promise.all([
        supabase.from('project_visits').select('id, title, scheduled_date, engineer_name, projects(name)')
          .eq('status','scheduled').lt('scheduled_date', today)
          .order('scheduled_date').limit(5),
        supabase.from('site_visits').select('id'),
        supabase.from('reports').select('visit_id, last_sent_at')
      ])
      if (!alive) return
      const withReport = new Set((reps||[]).map(r => r.visit_id).filter(Boolean))
      const noReport = (sv||[]).filter(v => !withReport.has(v.id)).length
      const notSent  = (reps||[]).filter(r => !r.last_sent_at).length
      setAttention({ overdue: od || [], noReport, notSent })
    })().catch(e => console.error('تعذّر حساب الفجوات:', e?.message ?? e))
    return () => { alive = false }
  }, [])

  // «زياراتي» — يعتمد على engineer_id، وهو الربط الذي صار متاحاً بعد
  // تعبئة جدول المستخدمين وإصلاح قائمة اختيار المهندس.
  useEffect(() => {
    if (!me?.id) { setMyVisits([]); return }
    let alive = true
    supabase.from('project_visits')
      .select('*, projects(name)')
      .eq('engineer_id', me.id)
      .gte('scheduled_date', today)
      .in('status', ['pending','scheduled'])
      .order('scheduled_date').order('scheduled_time')
      .limit(6)
      .then(({ data, error }) => {
        if (!alive) return
        if (error) { console.error('تعذّر جلب زياراتي:', error.message); return }
        setMyVisits(data || [])
      })
    return () => { alive = false }
  }, [me?.id])

  async function load() {
    try {
      const [p, { data: visits }, { data: tasks }, { data: ms }, { data: reports }, { data: tv }, { data: tc }] = await Promise.all([
        getProjects(),
        supabase.from('site_visits').select('*, projects(name)').order('visit_date', { ascending: false }).limit(5),
        supabase.from('tasks').select('*, projects(name)').in('status', ['open','in_progress']).order('due_date').limit(6),
        supabase.from('milestones').select('*, projects(name)').not('status','eq','completed').order('due_date').limit(4),
        supabase.from('reports').select('id'),
        supabase.from('project_visits').select('*, projects(name)').eq('scheduled_date', today).in('status', ['pending','scheduled']).order('scheduled_time'),
        supabase.from('consultations').select('*').eq('consultation_date', today).eq('status','pending').order('consultation_time')
      ])
      setProjects(p || [])
      setRecentVisits(visits || [])
      setOpenTasks(tasks || [])
      setMilestones(ms || [])
      setTodayVisits(tv || [])
      setTodayConsultations(tc || [])
      const overdue = (tasks||[]).filter(t => t.due_date && t.due_date < today)
      setStats({
        total: (p||[]).length,
        active: (p||[]).filter(x => x.status === 'active').length,
        openTasks: (tasks||[]).length,
        overdueTasks: overdue.length,
        visits: (visits||[]).length,
        reports: (reports||[]).length
      })
    } catch(e) { console.error(e) } finally { setLoading(false) }
  }

  async function handleBackup() {
    setBacking(true)
    try { await createBackup(); saveBackupDate(); setBackupNeeded(false) }
    catch(e) { alert('Backup failed: ' + e.message) }
    finally { setBacking(false) }
  }

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh',flexDirection:'column',gap:12}}>
      <div style={{width:32,height:32,border:'3px solid var(--border)',borderTopColor:'var(--blue)',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const progressColor = (p) => p >= 75 ? '#0F6E56' : p >= 40 ? '#185FA5' : '#854F0B'

  return (
    <div>
      {/* Backup warning */}
      {backupNeeded && (
        <div style={{background:'var(--amber-light)',border:'0.5px solid #EF9F27',borderRadius:10,padding:'10px 16px',marginBottom:16,display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:16}}>💾</span>
          <span style={{color:'var(--amber)',fontSize:13,fontWeight:500,flex:1}}>{t.backupWarning}</span>
          <button className="btn btn-sm" style={{color:'var(--amber)',borderColor:'var(--amber)'}} onClick={handleBackup} disabled={backing}>
            {backing ? t.backingUp : t.backupNow}
          </button>
        </div>
      )}

      {/* Overdue warning */}
      {stats.overdueTasks > 0 && (
        <div style={{background:'var(--red-light)',border:'0.5px solid #F09595',borderRadius:10,padding:'10px 16px',marginBottom:16,display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:16}}>⚠️</span>
          <span style={{color:'var(--red)',fontSize:13,fontWeight:500,flex:1}}>
            {stats.overdueTasks} {t.overdueWarning}
          </span>
          <button className="btn btn-sm" style={{color:'var(--red)',borderColor:'var(--red)'}} onClick={()=>navigate('/tasks')}>{t.view}</button>
        </div>
      )}

      {/* Stats */}
      <div className="stats-grid" style={{marginBottom:20}}>
        {[
          { label: t.activeProjects, value: stats.active, sub:`${stats.total} ${t.total}`, color:'#185FA5', icon:'🏗️', path:'/projects' },
          { label: t.openTasks, value: stats.openTasks, sub:`${stats.overdueTasks} ${t.overdue}`, color: stats.overdueTasks > 0 ? '#A32D2D' : '#0F6E56', icon:'✓', path:'/tasks' },
          { label: t.siteVisits, value: stats.visits, sub: t.thisPeriod, color:'#0F6E56', icon:'📍', path:'/visits' },
          { label: t.reports, value: stats.reports, sub: t.generated, color:'#854F0B', icon:'📄', path:'/reports' },
        ].map(s => (
          <div key={s.label} className="stat-card" onClick={()=>navigate(s.path)}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
              <div className="stat-label">{s.label}</div>
              <span style={{fontSize:18,opacity:0.6}}>{s.icon}</span>
            </div>
            <div className="stat-value" style={{color:s.color}}>{s.value}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* جدولة الزيارة التالية — يخفي نفسه إن لم يكن هناك ما يحتاج موعداً */}
      <NextVisitPanel />

      {/* فجوات الإشراف — ما يحتاج انتباهاً الآن */}
      {(attention.overdue.length > 0 || attention.noReport > 0 || attention.notSent > 0) && (
        <div className="card" style={{marginBottom:16,border:'1px solid rgba(163,45,45,.25)',background:'var(--red-light,#FCEBEB)'}}>
          <div className="card-header">
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span style={{fontSize:18}}>⚠</span>
              <span className="card-title" style={{color:'#A32D2D'}}>يحتاج انتباهك</span>
            </div>
          </div>

          <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:attention.overdue.length?14:0}}>
            {attention.noReport > 0 && (
              <div onClick={()=>navigate('/reports')} style={{cursor:'pointer',background:'var(--bg-card)',border:'0.5px solid var(--border)',borderRadius:10,padding:'12px 16px',minWidth:150}}>
                <div style={{fontSize:22,fontWeight:600,color:'#A32D2D'}}>{attention.noReport}</div>
                <div style={{fontSize:11.5,color:'var(--text-muted)'}}>زيارة بلا تقرير</div>
              </div>
            )}
            {attention.notSent > 0 && (
              <div onClick={()=>navigate('/reports')} style={{cursor:'pointer',background:'var(--bg-card)',border:'0.5px solid var(--border)',borderRadius:10,padding:'12px 16px',minWidth:150}}>
                <div style={{fontSize:22,fontWeight:600,color:'#854F0B'}}>{attention.notSent}</div>
                <div style={{fontSize:11.5,color:'var(--text-muted)'}}>تقرير لم يُرسل للعميل</div>
              </div>
            )}
            {attention.overdue.length > 0 && (
              <div onClick={()=>navigate('/project-visits')} style={{cursor:'pointer',background:'var(--bg-card)',border:'0.5px solid var(--border)',borderRadius:10,padding:'12px 16px',minWidth:150}}>
                <div style={{fontSize:22,fontWeight:600,color:'#A32D2D'}}>{attention.overdue.length}+</div>
                <div style={{fontSize:11.5,color:'var(--text-muted)'}}>زيارة فات موعدها</div>
              </div>
            )}
          </div>

          {attention.overdue.map(v=>{
            const days = Math.floor((new Date(today) - new Date(v.scheduled_date)) / 86400000)
            return (
              <div key={v.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 4px',borderTop:'0.5px solid rgba(0,0,0,.06)',fontSize:12.5}}>
                <span style={{fontWeight:600,color:'#A32D2D',minWidth:70}}>{days} يوماً</span>
                <span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  {v.title} — {v.projects?.name || '—'}
                </span>
                <span style={{fontSize:11,color:'var(--text-muted)'}}>{v.engineer_name || 'بلا مهندس'}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* زياراتي — الزيارات المسندة للمستخدم الحالي عبر engineer_id */}
      {me && myVisits.length > 0 && (
        <div className="card" style={{marginBottom:16,border:'1px solid rgba(15,110,86,0.25)',background:'var(--green-light,#E1F5EE)'}}>
          <div className="card-header">
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span style={{fontSize:18}}>👷</span>
              <span className="card-title" style={{color:'#0F6E56'}}>
                زياراتي القادمة — {me.full_name}
              </span>
            </div>
            <button className="btn btn-sm" onClick={()=>navigate('/project-visits')}>{t.viewAll}</button>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:10}}>
            {myVisits.map(v=>(
              <div key={v.id} style={{background:'var(--bg-card)',borderRadius:10,padding:'12px 14px',border:'0.5px solid var(--border)'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}}>
                  <div style={{fontWeight:550,fontSize:13,color:'var(--text)'}}>{v.title}</div>
                  <span style={{fontSize:11,fontWeight:600,color:'#0F6E56',background:'#E1F5EE',padding:'2px 8px',borderRadius:20,flexShrink:0,marginLeft:8}}>
                    {v.scheduled_date === today ? 'اليوم' : new Date(v.scheduled_date).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}
                  </span>
                </div>
                <div style={{fontSize:11,color:'var(--text-muted)'}}>{v.projects?.name || '—'}</div>
                {v.scheduled_time && <div style={{fontSize:11,color:'#0F6E56',marginTop:3}}>🕐 {v.scheduled_time.slice(0,5)}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Today's Visits */}
      {(todayVisits.length > 0 || todayConsultations.length > 0) && (
        <div className="card" style={{marginBottom:16,border:'1px solid rgba(24,95,165,0.2)',background:'var(--blue-light)'}}>
          <div className="card-header">
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span style={{fontSize:18}}>📅</span>
              <span className="card-title" style={{color:'var(--blue-dark)'}}>{t.todaysVisits} — {new Date().toLocaleDateString('en-GB')}</span>
            </div>
            <button className="btn btn-sm" onClick={()=>navigate('/project-visits')}>{t.viewAll}</button>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:10}}>
            {todayConsultations.map(c=>(
              <div key={c.id} style={{background:'var(--bg-card)',borderRadius:10,padding:'12px 14px',border:'1px solid #EF9F27'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}}>
                  <div style={{fontWeight:550,fontSize:13,color:'var(--amber)'}}>💼 {c.client_name}</div>
                  <div style={{fontSize:10,color:'var(--amber)',background:'var(--amber-light)',padding:'1px 7px',borderRadius:20,marginTop:3,display:'inline-block'}}>استشارات هندسية</div>
                  <span style={{fontSize:11,fontWeight:600,color:'var(--amber)',background:'var(--amber-light)',padding:'2px 8px',borderRadius:20,flexShrink:0,marginLeft:8}}>
                    {c.consultation_time ? c.consultation_time.slice(0,5) : 'Today'}
                  </span>
                </div>
                <div style={{fontSize:12,color:'var(--text)',marginBottom:4}}>{c.topic}</div>
                {c.engineer_name && <div style={{fontSize:11,color:'var(--text-muted)'}}>👷 {c.engineer_name}</div>}
                {c.client_phone && <div style={{fontSize:11,color:'#185FA5',marginTop:2}}>📞 {c.client_phone}</div>}
              </div>
            ))}
            {todayVisits.map(v=>(
              <div key={v.id} style={{background:'var(--bg-card)',borderRadius:10,padding:'12px 14px',border:'0.5px solid var(--border)'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}}>
                  <div style={{fontWeight:550,fontSize:13,color:'var(--text)'}}>{v.title}</div>
                  <span style={{fontSize:11,fontWeight:600,color:'#185FA5',background:'var(--blue-light)',padding:'2px 8px',borderRadius:20,flexShrink:0,marginLeft:8}}>
                    {v.scheduled_time ? v.scheduled_time.slice(0,5) : 'Today'}
                  </span>
                </div>
                {v.title_ar && <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:4}}>{v.title_ar}</div>}
                <div style={{fontSize:11,color:'var(--text-muted)'}}>🏗️ {v.projects?.name||'—'}</div>
                {v.engineer_name && <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>👷 {v.engineer_name}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Projects Overview */}
      {projects.filter(p=>p.status==='active').length > 0 && (
        <div className="card" style={{marginBottom:16}}>
          <div className="card-header">
            <span className="card-title">{t.activeProjectsTitle}</span>
            <button className="btn btn-sm" onClick={()=>navigate('/projects')}>{t.viewAll}</button>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:12}}>
            {projects.filter(p=>p.status==='active').slice(0,4).map(p=>(
              <div key={p.id} style={{background:'var(--bg)',borderRadius:10,padding:'14px 16px',cursor:'pointer',transition:'all 0.15s'}}
                onClick={()=>navigate('/project-visits')}
                onMouseEnter={e=>e.currentTarget.style.transform='translateY(-1px)'}
                onMouseLeave={e=>e.currentTarget.style.transform='translateY(0)'}>
                <div style={{fontWeight:550,fontSize:13,marginBottom:4,color:'var(--text)'}}>{p.name}</div>
                <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:10}}>{p.project_no} · {p.location||'—'}</div>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <div style={{flex:1}}>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{width:`${p.progress||0}%`,background:progressColor(p.progress||0)}}/>
                    </div>
                  </div>
                  <span style={{fontSize:11,fontWeight:600,color:progressColor(p.progress||0)}}>{p.progress||0}%</span>
                </div>
                {p.client_name && <div style={{fontSize:11,color:'var(--text-muted)',marginTop:6}}>👤 {p.client_name}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid2">
        <div className="card">
          <div className="card-header">
            <span className="card-title">{t.recentVisits}</span>
            <button className="btn btn-sm" onClick={()=>navigate('/visits')}>{t.viewAll}</button>
          </div>
          {recentVisits.length === 0 ? <div className="empty"><p>{t.noVisits}</p></div> :
            recentVisits.map(v=>(
              <div className="list-item" key={v.id}>
                <div className="dot" style={{background: v.severity==='high'||v.severity==='critical' ? '#A32D2D' : '#185FA5'}}/>
                <div className="item-info">
                  <div className="item-name">{v.projects?.name||'—'}</div>
                  <div className="item-sub">{v.notes?.split(' — ')[0]||'—'} · {v.visit_date}</div>
                </div>
                <span className={`badge ${v.status==='approved'?'badge-done':v.status==='submitted'?'badge-progress':'badge-gray'}`}>{v.status}</span>
              </div>
            ))
          }
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">{t.openTasksTitle}</span>
            <button className="btn btn-sm" onClick={()=>navigate('/tasks')}>{t.viewAll}</button>
          </div>
          {openTasks.length === 0 ? <div className="empty"><p>{t.noTasks}</p></div> :
            openTasks.map(tk=>{
              const isOverdue = tk.due_date && tk.due_date < today
              return (
                <div className="list-item" key={tk.id}>
                  <div style={{width:14,height:14,borderRadius:4,flexShrink:0,border:`1.5px solid ${isOverdue?'#A32D2D':'var(--border)'}`}}/>
                  <div className="item-info">
                    <div className="item-name" style={{color:isOverdue?'#A32D2D':'var(--text)'}}>{tk.title}</div>
                    <div className="item-sub">{tk.projects?.name} {tk.due_date && `· ${tk.due_date}`}</div>
                  </div>
                  <span className={`badge ${tk.severity==='high'||tk.severity==='critical'?'badge-open':tk.severity==='medium'?'badge-progress':'badge-gray'}`}>{tk.severity}</span>
                </div>
              )
            })
          }
        </div>
      </div>

      {milestones.length > 0 && (
        <div className="card" style={{marginTop:16}}>
          <div className="card-header">
            <span className="card-title">{t.upcomingMilestones}</span>
            <button className="btn btn-sm" onClick={()=>navigate('/milestones')}>{t.viewAll}</button>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:10}}>
            {milestones.map(m=>{
              const isOverdue = m.due_date && m.due_date < today
              return (
                <div key={m.id} style={{background:isOverdue?'var(--red-light)':'var(--bg)',borderRadius:8,padding:'12px 14px',border:`0.5px solid ${isOverdue?'#F09595':'var(--border)'}`}}>
                  <div style={{fontSize:12,fontWeight:550,color:isOverdue?'var(--red)':'var(--text)',marginBottom:2}}>{m.title}</div>
                  <div style={{fontSize:11,color:'var(--text-muted)'}}>{m.projects?.name}</div>
                  <div style={{fontSize:11,color:isOverdue?'var(--red)':'var(--text-muted)',marginTop:4}}>{m.due_date||'—'}{isOverdue && ' ⚠️'}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div style={{textAlign:'center',marginTop:20}}>
        <button className="btn btn-sm" onClick={handleBackup} disabled={backing} style={{fontSize:11,color:'var(--text-muted)'}}>
          💾 {backing ? t.backingUp : t.downloadBackup}
        </button>
      </div>
    </div>
  )
}
