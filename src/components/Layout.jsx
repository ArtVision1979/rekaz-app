import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'
import { signOut } from '../lib/supabase.js'

const NAV = [
  { path:'/', label:'Dashboard', icon:<svg width="16" height="16" fill="none" viewBox="0 0 16 16"><rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.2"/></svg> },
  { path:'/projects', label:'Projects', icon:<svg width="16" height="16" fill="none" viewBox="0 0 16 16"><path d="M2 3h5l1.5 2H14v8H2V3z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg> },
  { path:'/visits', label:'Site Visits', icon:<svg width="16" height="16" fill="none" viewBox="0 0 16 16"><rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M5 1v4M11 1v4M2 7h12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg> },
  { path:'/tasks', label:'Tasks', icon:<svg width="16" height="16" fill="none" viewBox="0 0 16 16"><path d="M3 8l3 3 7-7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  { path:'/milestones', label:'Milestones', icon:<svg width="16" height="16" fill="none" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2"/><path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg> },
  { path:'/daily-logs', label:'Daily Logs', icon:<svg width="16" height="16" fill="none" viewBox="0 0 16 16"><path d="M4 2h8v12H4V2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/><path d="M6 6h4M6 9h4M6 12h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg> },
  { path:'/photos', label:'Photos', icon:<svg width="16" height="16" fill="none" viewBox="0 0 16 16"><rect x="1" y="4" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M5 4l1.5-2h3L11 4" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/><circle cx="8" cy="9.5" r="2.5" stroke="currentColor" strokeWidth="1.2"/></svg> },
  { path:'/drawings', label:'Drawings', icon:<svg width="16" height="16" fill="none" viewBox="0 0 16 16"><path d="M2 12L8 2l6 10H2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/><path d="M5 12v-2h6v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg> },
  { path:'/reports', label:'Reports', icon:<svg width="16" height="16" fill="none" viewBox="0 0 16 16"><path d="M4 2h6l4 4v9H4V2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/><path d="M10 2v4h4M6 9h5M6 12h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg> },
  { path:'/schedule', label:'Schedule', icon:<svg width="16" height="16" fill="none" viewBox="0 0 16 16"><rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M5 1v4M11 1v4M2 7h12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg> },
]

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const initials = user?.email?.slice(0,2).toUpperCase()||'AR'
  const pageTitle = NAV.find(n=>n.path===location.pathname)?.label||'Rekaz'

  async function handleSignOut() { await signOut(); navigate('/login') }

  return (
    <div className="app">
      {sidebarOpen && <div onClick={()=>setSidebarOpen(false)} style={{position:'fixed',inset:0,zIndex:199}}/>}
      <div className={`sidebar ${sidebarOpen?'open':''}`}>
        <div className="sidebar-logo"><h1>Rekaz</h1><p>Site Visit Manager</p></div>
        <nav className="sidebar-nav">
          {NAV.map(item=>(
            <div key={item.path} className={`nav-item ${location.pathname===item.path?'active':''}`}
              onClick={()=>{navigate(item.path);setSidebarOpen(false)}}>
              {item.icon}{item.label}
            </div>
          ))}
          <div style={{borderTop:'0.5px solid rgba(0,0,0,0.08)',marginTop:8,paddingTop:8}}>
            <div className="nav-item" style={{color:'#A32D2D'}} onClick={handleSignOut}>
              <svg width="16" height="16" fill="none" viewBox="0 0 16 16"><path d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3M10 11l3-3-3-3M13 8H6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Sign Out
            </div>
          </div>
        </nav>
      </div>
      <div className="main">
        <div className="topbar">
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <button className="hamburger" onClick={()=>setSidebarOpen(o=>!o)}>
              <svg width="20" height="20" fill="none" viewBox="0 0 20 20"><path d="M3 5h14M3 10h14M3 15h14" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </button>
            <h2>{pageTitle}</h2>
          </div>
          <div className="topbar-user">
            <span style={{fontSize:12,color:'#888'}}>{user?.email}</span>
            <div className="avatar">{initials}</div>
          </div>
        </div>
        <div className="content"><Outlet /></div>
      </div>
    </div>
  )
}
