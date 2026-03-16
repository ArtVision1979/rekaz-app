import { useState, useEffect } from 'react'
import { getProjects, createProject, supabase } from '../lib/supabase.js'

const STATUS_COLORS = { active:'badge-progress', completed:'badge-done', on_hold:'badge-gray', cancelled:'badge-open' }
const EMPTY = { name:'', project_no:'', location:'', client_name:'', client_phone:'', engineer_name:'', engineer_phone:'', contractor_name:'', contractor_phone:'', supervision_start:'', status:'active', progress:0 }

export default function Projects() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showCard, setShowCard] = useState(null)
  const [editProject, setEditProject] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [projectVisits, setProjectVisits] = useState([])

  useEffect(() => { load() }, [])

  async function load() {
    try { setProjects(await getProjects()) }
    catch(e) { console.error(e) }
    finally { setLoading(false) }
  }

  async function loadProjectCard(project) {
    const { data: visits } = await supabase
      .from('project_visits')
      .select('*')
      .eq('project_id', project.id)
      .order('order_index')
    setProjectVisits(visits || [])
    setShowCard(project)
  }

  function openNew() { setEditProject(null); setForm(EMPTY); setShowModal(true) }

  function openEdit(p) {
    setEditProject(p)
    setForm({
      name: p.name, project_no: p.project_no, location: p.location||'',
      client_name: p.client_name||'', client_phone: p.client_phone||'',
      engineer_name: p.engineer_name||'', engineer_phone: p.engineer_phone||'',
      contractor_name: p.contractor_name||'', contractor_phone: p.contractor_phone||'',
      supervision_start: p.supervision_start||'', status: p.status, progress: p.progress||0
    })
    setShowModal(true)
  }

  async function handleSave(e) {
    e.preventDefault(); setSaving(true)
    try {
      if (editProject) { await supabase.from('projects').update(form).eq('id', editProject.id) }
      else { await createProject(form) }
      setShowModal(false); await load()
    } catch(e) { alert(e.message) } finally { setSaving(false) }
  }

  async function handleDelete(p) {
    if (!confirm(`Delete "${p.name}"?\nThis will delete all related visits, tasks, and data.`)) return
    try {
      // Delete all related data first
      await supabase.from('project_visits').delete().eq('project_id', p.id)
      await supabase.from('site_visits').delete().eq('project_id', p.id)
      await supabase.from('tasks').delete().eq('project_id', p.id)
      await supabase.from('milestones').delete().eq('project_id', p.id)
      await supabase.from('daily_logs').delete().eq('project_id', p.id)
      await supabase.from('drawings').delete().eq('project_id', p.id)
      await supabase.from('schedule_visits').delete().eq('project_id', p.id)
      await supabase.from('reports').delete().eq('project_id', p.id)
      // Finally delete the project
      await supabase.from('projects').delete().eq('id', p.id)
      await load()
    } catch(e) { alert('Error: ' + e.message) }
  }

  function printCard() {
    const printContent = document.getElementById('project-card-print')
    if (!printContent) return
    const w = window.open('', '_blank')
    const p = showCard
    const pvList = projectVisits
    const today = new Date().toLocaleDateString('en-GB')
    const STATUS_C = { pending:'#888', scheduled:'#185FA5', completed:'#0F6E56', cancelled:'#A32D2D' }
    const STATUS_L = { pending:'Pending', scheduled:'Scheduled', completed:'Completed', cancelled:'Cancelled' }
    const completedCount = pvList.filter(v=>v.status==='completed').length

    w.document.write(`<!DOCTYPE html>
      <html><head><meta charset="UTF-8"><title>Project Card - ${p?.name}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; padding: 36px; color: #111; font-size: 13px; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #185FA5; padding-bottom: 16px; margin-bottom: 20px; }
        .header-title { font-size: 20px; font-weight: 700; color: #185FA5; }
        .header-sub { font-size: 12px; color: #888; margin-top: 4px; }
        .section { border-radius: 8px; padding: 14px 18px; margin-bottom: 14px; }
        .section-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
        .section-icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; }
        .section-title { font-size: 13px; font-weight: 700; }
        .section-subtitle { font-size: 11px; color: #888; margin-top: 1px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 32px; }
        .info-row { display: flex; flex-direction: column; gap: 2px; }
        .info-label { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
        .info-value { font-size: 13px; font-weight: 500; color: #111; }
        .progress-bar { height: 6px; background: #e0e0e0; border-radius: 3px; margin-top: 4px; }
        .progress-fill { height: 100%; background: #185FA5; border-radius: 3px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 4px; }
        th { background: #185FA5; color: white; padding: 8px 12px; text-align: left; font-weight: 600; }
        td { padding: 7px 12px; border-bottom: 0.5px solid #eee; vertical-align: middle; }
        tr:nth-child(even) td { background: #fafafa; }
        .status-badge { font-size: 11px; font-weight: 600; }
        .sigs { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; margin-top: 48px; }
        .sig-line { border-top: 1.5px solid #333; padding-top: 8px; margin-top: 48px; text-align: center; font-size: 12px; }
        .sig-name { font-size: 11px; color: #888; margin-top: 3px; }
        .footer { border-top: 1px solid #eee; margin-top: 28px; padding-top: 10px; text-align: center; font-size: 10px; color: #bbb; }
      </style>
      </head><body>

      <div class="header">
        <div>
          <img src="/rekaz-logo.jpg" style="height:44px;width:auto;" onerror="this.style.display='none'"/>
          <div style="font-size:11px;color:#888;margin-top:4px;">مكتب ركاز للهندسة</div>
        </div>
        <div style="text-align:right;">
          <div class="header-title">بطاقة المشروع</div>
          <div class="header-sub">Project Card · ${today}</div>
        </div>
      </div>

      <div class="section" style="background:#f5f5f0;">
        <div class="section-header">
          <div class="section-icon" style="background:#e0e8f5;">🏗️</div>
          <div>
            <div class="section-title">معلومات المشروع</div>
            <div class="section-subtitle">Project Information</div>
          </div>
        </div>
        <div class="info-grid">
          <div class="info-row"><div class="info-label">اسم المشروع · Project Name</div><div class="info-value">${p?.name||'—'}</div></div>
          <div class="info-row"><div class="info-label">رقم المشروع · Project No</div><div class="info-value">${p?.project_no||'—'}</div></div>
          <div class="info-row"><div class="info-label">الموقع · Location</div><div class="info-value">${p?.location||'—'}</div></div>
          <div class="info-row"><div class="info-label">تاريخ بداية الإشراف · Start Date</div><div class="info-value">${p?.supervision_start||'—'}</div></div>
          <div class="info-row"><div class="info-label">الحالة · Status</div><div class="info-value">${p?.status||'—'}</div></div>
          <div class="info-row">
            <div class="info-label">نسبة الإنجاز · Progress</div>
            <div class="info-value">${p?.progress||0}%</div>
            <div class="progress-bar"><div class="progress-fill" style="width:${p?.progress||0}%"></div></div>
          </div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">
        <div class="section" style="background:#E6F1FB;">
          <div class="section-header">
            <div class="section-icon" style="background:#c8dff5;">👤</div>
            <div>
              <div class="section-title">معلومات المالك</div>
              <div class="section-subtitle">Client Information</div>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <div class="info-row"><div class="info-label">الاسم · Name</div><div class="info-value">${p?.client_name||'—'}</div></div>
            <div class="info-row"><div class="info-label">رقم التواصل · Phone</div><div class="info-value">${p?.client_phone||'—'}</div></div>
          </div>
        </div>
        <div class="section" style="background:#E1F5EE;">
          <div class="section-header">
            <div class="section-icon" style="background:#b8e8d8;">👷</div>
            <div>
              <div class="section-title">المهندس المشرف</div>
              <div class="section-subtitle">Supervising Engineer</div>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <div class="info-row"><div class="info-label">الاسم · Name</div><div class="info-value">${p?.engineer_name||'—'}</div></div>
            <div class="info-row"><div class="info-label">رقم التواصل · Phone</div><div class="info-value">${p?.engineer_phone||'—'}</div></div>
          </div>
        </div>
      </div>

      <div class="section" style="background:#FFF3E0;margin-bottom:14px;">
        <div class="section-header">
          <div class="section-icon" style="background:#FFE0B2;">🔨</div>
          <div>
            <div class="section-title">معلومات المقاول</div>
            <div class="section-subtitle">Contractor Information</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 32px;">
          <div class="info-row"><div class="info-label">الاسم · Name</div><div class="info-value">${p?.contractor_name||'—'}</div></div>
          <div class="info-row"><div class="info-label">رقم التواصل · Phone</div><div class="info-value">${p?.contractor_phone||'—'}</div></div>
        </div>
      </div>

      ${pvList.length > 0 ? `
      <div class="section" style="background:#fafafa;border:0.5px solid #eee;">
        <div class="section-header">
          <div class="section-icon" style="background:#e0e8f5;">📋</div>
          <div>
            <div class="section-title">قائمة الزيارات — Visits List</div>
            <div class="section-subtitle">${completedCount} / ${pvList.length} مكتملة · completed</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width:32px">#</th>
              <th>الزيارة · Visit</th>
              <th>المهندس · Engineer</th>
              <th>التاريخ · Date</th>
              <th style="width:90px;text-align:center;">الحالة · Status</th>
            </tr>
          </thead>
          <tbody>
            ${pvList.map((v,i) => `
              <tr>
                <td style="color:#888;">${i+1}</td>
                <td>
                  <div style="font-weight:500;${v.status==='completed'?'text-decoration:line-through;color:#888;':''}">${v.title}</div>
                  ${v.title_ar ? `<div style="font-size:11px;color:#666;">${v.title_ar}</div>` : ''}
                </td>
                <td style="color:#666;">${v.engineer_name||'—'}</td>
                <td style="color:#666;">${v.scheduled_date||'—'}</td>
                <td style="text-align:center;color:${STATUS_C[v.status]||'#888'};font-weight:600;font-size:11px;">${STATUS_L[v.status]||v.status}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ` : ''}

      <div class="sigs" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:30px;margin-top:48px;">
        <div><div class="sig-line">توقيع المالك · Client<div class="sig-name">${p?.client_name||'—'}</div></div></div>
        <div><div class="sig-line">توقيع المقاول · Contractor<div class="sig-name">${p?.contractor_name||'—'}</div></div></div>
        <div><div class="sig-line">توقيع المهندس · Engineer<div class="sig-name">${p?.engineer_name||'—'}</div></div></div>
      </div>

      <div class="footer">مكتب ركاز للهندسة · Rekaz Engineering Office · البحرين · Bahrain · ${today}</div>

      </body></html>
    `)
    w.document.close()
    w.focus()
    setTimeout(() => { w.print(); w.close() }, 500)
  }

  const filtered = projects.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || (p.project_no||'').toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || p.status === filterStatus
    return matchSearch && matchStatus
  })

  const STATUS_LABELS = { pending:'Pending', scheduled:'Scheduled', completed:'Completed', cancelled:'Cancelled' }
  const STATUS_C2 = { pending:'#888', scheduled:'#185FA5', completed:'#0F6E56', cancelled:'#A32D2D' }

  return (
    <>
      <style>{`
        @media print {
          body > * { display: none !important; }
          #project-card-print { display: block !important; }
        }
        #project-card-print { display: none; }
      `}</style>

      {/* Project Card Print */}
      {showCard && (
        <div id="project-card-print">
          <div style={{ fontFamily:'Arial,sans-serif', maxWidth:800, margin:'0 auto', padding:40, color:'#000' }}>
            {/* Header */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', borderBottom:'3px solid #185FA5', paddingBottom:20, marginBottom:24 }}>
              <div>
                <img src="/rekaz-logo.jpg" alt="Rekaz" style={{ height:50, width:'auto' }} />
                <div style={{ fontSize:12, color:'#666', marginTop:4 }}>مكتب ركاز للهندسة</div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:20, fontWeight:700, color:'#185FA5' }}>بطاقة المشروع</div>
                <div style={{ fontSize:13, color:'#333', marginTop:4 }}>Project Card</div>
                <div style={{ fontSize:11, color:'#888', marginTop:2 }}>{new Date().toLocaleDateString('en-GB')}</div>
              </div>
            </div>

            {/* Project Info */}
            <div style={{ background:'#f5f5f0', borderRadius:8, padding:16, marginBottom:20 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#185FA5', marginBottom:12, textTransform:'uppercase' }}>معلومات المشروع</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px 24px' }}>
                {[
                  ['اسم المشروع', showCard.name],
                  ['رقم المشروع', showCard.project_no],
                  ['الموقع', showCard.location||'—'],
                  ['الحالة', showCard.status],
                  ['تاريخ بداية الإشراف', showCard.supervision_start||'—'],
                  ['نسبة الإنجاز', `${showCard.progress||0}%`],
                ].map(([label, value]) => (
                  <div key={label} style={{ display:'flex', gap:8 }}>
                    <span style={{ color:'#666', fontSize:12, minWidth:120 }}>{label}:</span>
                    <span style={{ fontSize:12, fontWeight:500 }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Client Info */}
            <div style={{ background:'#E6F1FB', borderRadius:8, padding:16, marginBottom:20 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#185FA5', marginBottom:12, textTransform:'uppercase' }}>معلومات المالك</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px 24px' }}>
                {[
                  ['اسم المالك', showCard.client_name||'—'],
                  ['رقم التواصل', showCard.client_phone||'—'],
                ].map(([label, value]) => (
                  <div key={label} style={{ display:'flex', gap:8 }}>
                    <span style={{ color:'#555', fontSize:12, minWidth:120 }}>{label}:</span>
                    <span style={{ fontSize:12, fontWeight:500 }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Engineer Info */}
            <div style={{ background:'#E1F5EE', borderRadius:8, padding:16, marginBottom:20 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#0F6E56', marginBottom:12, textTransform:'uppercase' }}>معلومات المهندس المشرف</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px 24px' }}>
                {[
                  ['اسم المهندس', showCard.engineer_name||'—'],
                  ['رقم التواصل', showCard.engineer_phone||'—'],
                ].map(([label, value]) => (
                  <div key={label} style={{ display:'flex', gap:8 }}>
                    <span style={{ color:'#555', fontSize:12, minWidth:120 }}>{label}:</span>
                    <span style={{ fontSize:12, fontWeight:500 }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Visits List */}
            {projectVisits.length > 0 && (
              <div style={{ marginBottom:24 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#185FA5', marginBottom:12, textTransform:'uppercase' }}>
                  قائمة الزيارات ({projectVisits.filter(v=>v.status==='completed').length}/{projectVisits.length} منجزة)
                </div>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                  <thead>
                    <tr style={{ background:'#185FA5', color:'white' }}>
                      <th style={{ padding:'7px 10px', textAlign:'right', width:30 }}>#</th>
                      <th style={{ padding:'7px 10px', textAlign:'right' }}>الزيارة</th>
                      <th style={{ padding:'7px 10px', textAlign:'right' }}>المهندس</th>
                      <th style={{ padding:'7px 10px', textAlign:'right' }}>التاريخ</th>
                      <th style={{ padding:'7px 10px', textAlign:'center', width:80 }}>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectVisits.map((v, i) => (
                      <tr key={v.id} style={{ background: i%2===0 ? '#fafafa' : 'white' }}>
                        <td style={{ padding:'6px 10px', textAlign:'right', color:'#888' }}>{i+1}</td>
                        <td style={{ padding:'6px 10px', textAlign:'right' }}>
                          <div>{v.title}</div>
                          {v.title_ar && <div style={{ fontSize:11, color:'#666' }}>{v.title_ar}</div>}
                        </td>
                        <td style={{ padding:'6px 10px', textAlign:'right', color:'#666' }}>{v.engineer_name||'—'}</td>
                        <td style={{ padding:'6px 10px', textAlign:'right', color:'#666' }}>{v.scheduled_date||'—'}</td>
                        <td style={{ padding:'6px 10px', textAlign:'center' }}>
                          <span style={{ color: STATUS_C2[v.status], fontWeight:500, fontSize:11 }}>
                            {STATUS_LABELS[v.status]||v.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Signatures */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:40, marginTop:50 }}>
              <div style={{ textAlign:'center' }}>
                <div style={{ borderTop:'1.5px solid #333', paddingTop:8, marginTop:40 }}>
                  <div style={{ fontSize:12 }}>توقيع المالك</div>
                  <div style={{ fontSize:11, color:'#888', marginTop:2 }}>{showCard.client_name||'—'}</div>
                </div>
              </div>
              <div style={{ textAlign:'center' }}>
                <div style={{ borderTop:'1.5px solid #333', paddingTop:8, marginTop:40 }}>
                  <div style={{ fontSize:12 }}>توقيع المهندس المشرف</div>
                  <div style={{ fontSize:11, color:'#888', marginTop:2 }}>{showCard.engineer_name||'—'}</div>
                </div>
              </div>
            </div>

            <div style={{ borderTop:'1px solid #ddd', marginTop:32, paddingTop:12, textAlign:'center', fontSize:10, color:'#aaa' }}>
              مكتب ركاز للهندسة · البحرين · {new Date().toLocaleDateString('en-GB')}
            </div>
          </div>
        </div>
      )}

      {/* Edit/New Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowModal(false)}>
          <div className="modal">
            <h3>{editProject ? 'Edit Project' : 'New Project'}</h3>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Project Name * — اسم المشروع</label>
                <input className="form-input" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} required autoFocus/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div className="form-group">
                  <label className="form-label">Project No * — رقم المشروع</label>
                  <input className="form-input" value={form.project_no} placeholder="RKZ-0001" onChange={e=>setForm(f=>({...f,project_no:e.target.value}))} required/>
                </div>
                <div className="form-group">
                  <label className="form-label">Location — موقع المشروع</label>
                  <input className="form-input" value={form.location} onChange={e=>setForm(f=>({...f,location:e.target.value}))}/>
                </div>
              </div>

              <div style={{borderTop:'0.5px solid var(--border)',margin:'12px 0',paddingTop:12}}>
                
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                  <div className="form-group">
                    <label className="form-label">Client Name — اسم المالك</label>
                    <input className="form-input" value={form.client_name} onChange={e=>setForm(f=>({...f,client_name:e.target.value}))}/>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Client Phone — رقم التواصل</label>
                    <input className="form-input" value={form.client_phone} onChange={e=>setForm(f=>({...f,client_phone:e.target.value}))} placeholder="+973 XXXX XXXX"/>
                  </div>
                </div>
              </div>

              <div style={{borderTop:'0.5px solid var(--border)',margin:'12px 0',paddingTop:12}}>
                
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                  <div className="form-group">
                    <label className="form-label">Engineer Name — اسم المهندس</label>
                    <input className="form-input" value={form.engineer_name} onChange={e=>setForm(f=>({...f,engineer_name:e.target.value}))}/>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Engineer Phone — رقم التواصل</label>
                    <input className="form-input" value={form.engineer_phone} onChange={e=>setForm(f=>({...f,engineer_phone:e.target.value}))} placeholder="+973 XXXX XXXX"/>
                  </div>
                </div>
              </div>

              <div style={{borderTop:'0.5px solid var(--border)',margin:'12px 0',paddingTop:12}}>
                
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                  <div className="form-group">
                    <label className="form-label">Contractor Name — اسم المقاول</label>
                    <input className="form-input" value={form.contractor_name} onChange={e=>setForm(f=>({...f,contractor_name:e.target.value}))}/>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Contractor Phone — رقم التواصل</label>
                    <input className="form-input" value={form.contractor_phone} onChange={e=>setForm(f=>({...f,contractor_phone:e.target.value}))} placeholder="+973 XXXX XXXX"/>
                  </div>
                </div>
              </div>

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-input" value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
                    <option value="active">Active</option>
                    <option value="on_hold">On Hold</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Supervision Start — بداية الإشراف</label>
                  <input type="date" className="form-input" value={form.supervision_start} onChange={e=>setForm(f=>({...f,supervision_start:e.target.value}))}/>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Progress: {form.progress}%</label>
                <input type="range" min="0" max="100" step="5" value={form.progress} onChange={e=>setForm(f=>({...f,progress:parseInt(e.target.value)}))} style={{width:'100%'}}/>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn" onClick={()=>setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Saving...':editProject?'Save':'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="page-header">
        <div><h3>Projects</h3><div className="page-sub">{filtered.length} of {projects.length} projects</div></div>
        <button className="btn btn-primary" onClick={openNew}>+ New Project</button>
      </div>

      <div style={{display:'flex',gap:10,marginBottom:16}}>
        <input className="form-input" style={{flex:1,maxWidth:280}} placeholder="Search projects..." value={search} onChange={e=>setSearch(e.target.value)}/>
        <select className="form-input" style={{width:140}} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="on_hold">On Hold</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="card">
        {loading ? <div style={{color:'var(--text-muted)',padding:16}}>Loading...</div> :
          filtered.length === 0 ? <div className="empty"><p>No projects yet.</p></div> : (
            <table className="table">
              <thead><tr>
                <th>Project</th><th>Client</th><th>Engineer</th><th>Contractor</th><th>Progress</th><th>Status</th><th></th>
              </tr></thead>
              <tbody>
                {filtered.map(p=>(
                  <tr key={p.id}>
                    <td>
                      <div style={{fontWeight:500}}>{p.name}</div>
                      <div style={{fontSize:11,color:'var(--text-muted)'}}>{p.project_no} · {p.location||'—'}</div>
                    </td>
                    <td>
                      <div style={{fontSize:13}}>{p.client_name||'—'}</div>
                      {p.client_phone && <div style={{fontSize:11,color:'var(--text-muted)'}}>{p.client_phone}</div>}
                    </td>
                    <td>
                      <div style={{fontSize:13}}>{p.engineer_name||'—'}</div>
                      {p.engineer_phone && <div style={{fontSize:11,color:'var(--text-muted)'}}>{p.engineer_phone}</div>}
                    </td>
                    <td>
                      <div style={{fontSize:13}}>{p.contractor_name||'—'}</div>
                      {p.contractor_phone && <div style={{fontSize:11,color:'var(--text-muted)'}}>{p.contractor_phone}</div>}
                    </td>
                    <td>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <div className="progress-bar" style={{width:60}}><div className="progress-fill" style={{width:`${p.progress||0}%`}}/></div>
                        <span style={{fontSize:11,color:'var(--text-muted)'}}>{p.progress||0}%</span>
                      </div>
                    </td>
                    <td><span className={`badge ${STATUS_COLORS[p.status]||'badge-gray'}`}>{p.status}</span></td>
                    <td>
                      <div style={{display:'flex',gap:6}}>
                        <button className="btn btn-sm" style={{color:'#185FA5',borderColor:'#185FA5'}} onClick={()=>loadProjectCard(p)}>📄 Card</button>
                        <button className="btn btn-sm" onClick={()=>openEdit(p)}>Edit</button>
                        <button className="btn btn-sm" style={{color:'#A32D2D',borderColor:'#A32D2D'}} onClick={()=>handleDelete(p)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        }
      </div>

      {/* Project Card Modal */}
      {showCard && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowCard(null)}>
          <div className="modal" style={{maxWidth:640}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <h3 style={{margin:0}}>Project Card — {showCard.name}</h3>
              <div style={{display:'flex',gap:8}}>
                <button className="btn btn-primary btn-sm" onClick={printCard}>🖨 Print / PDF</button>
                <button className="btn btn-sm" onClick={()=>setShowCard(null)}>Close</button>
              </div>
            </div>

            <div style={{background:'#f5f5f0',borderRadius:8,padding:14,marginBottom:12}}>
              <div style={{fontSize:11,fontWeight:500,color:'#185FA5',marginBottom:8}}>PROJECT INFO</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px 16px',fontSize:13}}>
                <div><span style={{color:'var(--text-muted)'}}>Name: </span>{showCard.name}</div>
                <div><span style={{color:'var(--text-muted)'}}>No: </span>{showCard.project_no}</div>
                <div><span style={{color:'var(--text-muted)'}}>Location: </span>{showCard.location||'—'}</div>
                <div><span style={{color:'var(--text-muted)'}}>Start: </span>{showCard.supervision_start||'—'}</div>
              </div>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
              <div style={{background:'#E6F1FB',borderRadius:8,padding:12}}>
                <div style={{fontSize:11,fontWeight:500,color:'#185FA5',marginBottom:6}}>CLIENT — المالك</div>
                <div style={{fontSize:13,fontWeight:500}}>{showCard.client_name||'—'}</div>
                <div style={{fontSize:12,color:'#555'}}>{showCard.client_phone||'—'}</div>
              </div>
              <div style={{background:'#E1F5EE',borderRadius:8,padding:12}}>
                <div style={{fontSize:11,fontWeight:500,color:'#0F6E56',marginBottom:6}}>ENGINEER — المهندس</div>
                <div style={{fontSize:13,fontWeight:500}}>{showCard.engineer_name||'—'}</div>
                <div style={{fontSize:12,color:'#555'}}>{showCard.engineer_phone||'—'}</div>
              </div>
            </div>

            {projectVisits.length > 0 && (
              <div>
                <div style={{fontSize:11,fontWeight:500,color:'var(--text-muted)',marginBottom:8}}>
                  VISITS — الزيارات ({projectVisits.filter(v=>v.status==='completed').length}/{projectVisits.length} completed)
                </div>
                <div style={{maxHeight:220,overflowY:'auto'}}>
                  {projectVisits.map((v,i)=>(
                    <div key={v.id} style={{display:'flex',alignItems:'center',gap:10,padding:'6px 0',borderBottom:'0.5px solid var(--border)'}}>
                      <span style={{fontSize:11,color:'var(--text-muted)',width:20,flexShrink:0}}>{i+1}</span>
                      <div style={{flex:1}}>
                        <div style={{fontSize:12,fontWeight:500,textDecoration:v.status==='completed'?'line-through':'none'}}>{v.title}</div>
                        {v.title_ar&&<div style={{fontSize:11,color:'var(--text-muted)'}}>{v.title_ar}</div>}
                      </div>
                      <div style={{fontSize:11,color:'var(--text-muted)'}}>{v.engineer_name||'—'}</div>
                      <div style={{fontSize:11,color:'var(--text-muted)'}}>{v.scheduled_date||'—'}</div>
                      <span style={{fontSize:10,color:STATUS_C2[v.status],fontWeight:500}}>{STATUS_LABELS[v.status]||v.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
