import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'
import { signOut } from '../lib/supabase.js'
import { useTheme, useLang, T } from '../hooks/useSettings.js'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { theme, toggleTheme } = useTheme()
  const { lang, toggleLang } = useLang()
  const t = T[lang]

  const NAV = [
    { path:'/', label: t.dashboard, icon:<svg width="16" height="16" fill="none" viewBox="0 0 16 16"><rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.2"/></svg> },
    { path:'/projects', label: t.projects, icon:<svg width="16" height="16" fill="none" viewBox="0 0 16 16"><path d="M2 3h5l1.5 2H14v8H2V3z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg> },
    { path:'/visits', label: t.siteVisits, icon:<svg width="16" height="16" fill="none" viewBox="0 0 16 16"><rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M5 1v4M11 1v4M2 7h12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg> },
    { path:'/tasks', label: t.tasks, icon:<svg width="16" height="16" fill="none" viewBox="0 0 16 16"><path d="M3 8l3 3 7-7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg> },
    { path:'/milestones', label: t.milestones, icon:<svg width="16" height="16" fill="none" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2"/><path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg> },
    { path:'/daily-logs', label: t.dailyLogs, icon:<svg width="16" height="16" fill="none" viewBox="0 0 16 16"><path d="M4 2h8v12H4V2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/><path d="M6 6h4M6 9h4M6 12h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg> },
    { path:'/photos', label: t.photos, icon:<svg width="16" height="16" fill="none" viewBox="0 0 16 16"><rect x="1" y="4" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M5 4l1.5-2h3L11 4" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/><circle cx="8" cy="9.5" r="2.5" stroke="currentColor" strokeWidth="1.2"/></svg> },
    { path:'/drawings', label: t.drawings, icon:<svg width="16" height="16" fill="none" viewBox="0 0 16 16"><path d="M2 12L6 4l4 6 2-3 3 5H2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg> },
    { path:'/reports', label: t.reports, icon:<svg width="16" height="16" fill="none" viewBox="0 0 16 16"><path d="M4 2h6l4 4v9H4V2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/><path d="M10 2v4h4M6 9h5M6 12h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg> },
    { path:'/schedule', label: t.schedule, icon:<svg width="16" height="16" fill="none" viewBox="0 0 16 16"><rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M5 1v4M11 1v4M2 7h12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg> },
    { path:'/users', label: t.users, icon:<svg width="16" height="16" fill="none" viewBox="0 0 16 16"><circle cx="6" cy="5" r="3" stroke="currentColor" strokeWidth="1.2"/><path d="M1 14c0-3 2-5 5-5s5 2 5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><path d="M11 7l1.5 1.5L15 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  ]

  const initials = user?.email?.slice(0,2).toUpperCase()||'AR'
  const pageTitle = NAV.find(n=>n.path===location.pathname)?.label||'Rekaz'

  async function handleSignOut() { await signOut(); navigate('/login') }

  return (
    <div className="app">
      {sidebarOpen && <div onClick={()=>setSidebarOpen(false)} style={{position:'fixed',inset:0,zIndex:199}}/>}
      <div className={`sidebar ${sidebarOpen?'open':''}`}>
        <div className="sidebar-logo">
          <img src="/rekaz-logo.jpg" alt="Rekaz" style={{width:'100%',maxWidth:140,height:'auto',borderRadius:6,display:'block'}}/>
          <p>{t.siteVisitManager}</p>
        </div>
        <nav className="sidebar-nav">
          {NAV.map(item=>(
            <div key={item.path} className={`nav-item ${location.pathname===item.path?'active':''}`}
              onClick={()=>{navigate(item.path);setSidebarOpen(false)}}>
              {item.icon}{item.label}
            </div>
          ))}
          <div style={{borderTop:'0.5px solid var(--border)',marginTop:8,paddingTop:8}}>
            <div className="nav-item" style={{color:'#A32D2D'}} onClick={handleSignOut}>
              <svg width="16" height="16" fill="none" viewBox="0 0 16 16"><path d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3M10 11l3-3-3-3M13 8H6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              {t.signOut}
            </div>
          </div>
        </nav>
      </div>
      <div className="main">
        <div className="topbar">
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <button className="hamburger" onClick={()=>setSidebarOpen(o=>!o)}>
              <svg width="20" height="20" fill="none" viewBox="0 0 20 20"><path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </button>
            <h2>{pageTitle}</h2>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <button className="lang-toggle" onClick={toggleLang}>
              {lang === 'en' ? 'ع' : 'EN'}
            </button>
            <button className="theme-toggle" onClick={toggleTheme}>
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
            <span style={{fontSize:12,color:'var(--text-muted)'}}>{user?.email}</span>
            <div className="avatar">{initials}</div>
          </div>
        </div>
        <div className="content"><Outlet /></div>
      </div>
    </div>
  )
}
