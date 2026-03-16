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
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #1a1a1a; font-size: 13px; background: white; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 28px; padding-bottom: 20px; border-bottom: 3px solid #185FA5; }
        .header-right { text-align: right; }
        .header-title { font-size: 22px; font-weight: 700; color: #185FA5; }
        .header-no { font-size: 11px; color: #185FA5; background: #E8F1FB; padding: 3px 10px; border-radius: 20px; display: inline-block; margin-top: 6px; }
        .section-bar { font-size: 11px; font-weight: 700; color: white; padding: 8px 14px; text-transform: uppercase; letter-spacing: 1px; border-radius: 6px 6px 0 0; margin-bottom: 0; }
        .info-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .info-table td { padding: 10px 14px; border: 0.5px solid #e8e8e8; font-size: 13px; vertical-align: middle; }
        .info-table .label { background: #f8f8f6; color: #555; font-weight: 600; font-size: 11px; width: 38%; }
        .info-table .value { color: #1a1a1a; font-weight: 500; }
        .progress-bar { height: 8px; background: #e8e8e8; border-radius: 4px; overflow: hidden; }
        .progress-fill { height: 100%; background: linear-gradient(90deg, #185FA5, #4a9eff); border-radius: 4px; }
        .people-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 20px; }
        .person-card { border: 0.5px solid #e8e8e8; border-radius: 8px; overflow: hidden; }
        .person-role { font-size: 10px; color: white; padding: 6px 14px; display: block; font-weight: 700; letter-spacing: 0.5px; }
        .person-name { font-size: 14px; font-weight: 700; color: #1a1a1a; padding: 10px 14px 4px; }
        .person-phone { font-size: 12px; color: #666; padding: 0 14px 12px; }
        table.visits { width: 100%; border-collapse: collapse; font-size: 12px; }
        table.visits th { background: #185FA5; color: white; padding: 9px 12px; text-align: left; font-weight: 600; font-size: 11px; }
        table.visits td { padding: 8px 12px; border-bottom: 0.5px solid #eee; vertical-align: middle; }
        table.visits tr:nth-child(even) td { background: #fafafa; }
        .sigs { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 40px; margin-top: 52px; }
        .sig-line { border-top: 1.5px solid #333; padding-top: 10px; margin-top: 52px; text-align: center; }
        .sig-role { font-size: 11px; font-weight: 700; color: #1a1a1a; }
        .sig-name { font-size: 11px; color: #888; margin-top: 3px; }
        .footer { border-top: 1px solid #eee; margin-top: 28px; padding-top: 10px; display: flex; justify-content: space-between; font-size: 10px; color: #bbb; }
      </style></head><body>

      <div class="header">
        <div>
          <img src="/rekaz-logo.jpg" style="height:50px;width:auto;border-radius:6px;" onerror="this.style.display='none'"/>
          <div style="font-size:11px;color:#888;margin-top:6px;">مكتب ركاز للهندسة · Rekaz Engineering Office</div>
        </div>
        <div class="header-right">
          <div class="header-title">بطاقة المشروع · Project Card</div>
          <div class="header-no">${p?.project_no||'—'} · ${today}</div>
        </div>
      </div>

      <div class="section-bar" style="background:#185FA5;">معلومات المشروع · Project Information</div>
      <table class="info-table">
        <tr><td class="label">اسم المشروع · Project Name</td><td class="value" style="font-size:15px;font-weight:700;">${p?.name||'—'}</td></tr>
        <tr><td class="label">الموقع · Location</td><td class="value">${p?.location||'—'}</td></tr>
        <tr><td class="label">تاريخ بداية الإشراف · Start Date</td><td class="value">${p?.supervision_start||'—'}</td></tr>
        <tr><td class="label">الحالة · Status</td><td class="value"><span style="background:${p?.status==='active'?'#E1F5EE':'#f5f5f0'};color:${p?.status==='active'?'#0F6E56':'#666'};padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;">${p?.status==='active'?'نشط · Active':p?.status==='completed'?'منتهي · Completed':p?.status==='on_hold'?'متوقف · On Hold':'ملغي · Cancelled'}</span></td></tr>
        <tr><td class="label">نسبة الإنجاز · Progress</td><td class="value"><div style="display:flex;align-items:center;gap:12px;"><div style="flex:1;"><div class="progress-bar"><div class="progress-fill" style="width:${p?.progress||0}%"></div></div></div><span style="font-weight:700;color:#185FA5;">${p?.progress||0}%</span></div></td></tr>
      </table>

      <div class="section-bar" style="background:#0F6E56;margin-bottom:12px;">أطراف المشروع · Project Parties</div>
      <div class="people-grid">
        <div class="person-card">
          <div class="person-role" style="background:#185FA5;">المالك · Client</div>
          <div class="person-name">${p?.client_name||'—'}</div>
          <div class="person-phone">${p?.client_phone||'—'}</div>
        </div>
        <div class="person-card">
          <div class="person-role" style="background:#0F6E56;">المهندس المشرف · Engineer</div>
          <div class="person-name">${p?.engineer_name||'—'}</div>
          <div class="person-phone">${p?.engineer_phone||'—'}</div>
        </div>
        <div class="person-card">
          <div class="person-role" style="background:#854F0B;">المقاول · Contractor</div>
          <div class="person-name">${p?.contractor_name||'—'}</div>
          <div class="person-phone">${p?.contractor_phone||'—'}</div>
        </div>
      </div>

      ${pvList.length > 0 ? `
      <div class="section-bar" style="background:#185FA5;margin-bottom:0;">قائمة الزيارات · Visits List — ${completedCount}/${pvList.length} مكتملة</div>
      <table class="visits">
        <thead><tr>
          <th style="width:32px">#</th>
          <th>الزيارة · Visit</th>
          <th>المهندس · Engineer</th>
          <th>التاريخ · Date</th>
          <th style="width:100px;text-align:center;">الحالة · Status</th>
        </tr></thead>
        <tbody>
          ${pvList.map((v,i) => `
            <tr>
              <td style="color:#888;">${i+1}</td>
              <td><div style="font-weight:600;${v.status==='completed'?'text-decoration:line-through;color:#888;':''}">${v.title}</div>${v.title_ar?`<div style="font-size:11px;color:#666;">${v.title_ar}</div>`:''}</td>
              <td style="color:#555;">${v.engineer_name||'—'}</td>
              <td style="color:#555;">${v.scheduled_date||'—'}</td>
              <td style="text-align:center;color:${STATUS_C[v.status]||'#888'};font-weight:700;font-size:11px;">${STATUS_L[v.status]||v.status}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ` : ''}

      <div class="sigs">
        <div class="sig"><div class="sig-line"><div class="sig-role">توقيع المالك · Client</div><div class="sig-name">${p?.client_name||'—'}</div></div></div>
        <div class="sig"><div class="sig-line"><div class="sig-role">توقيع المقاول · Contractor</div><div class="sig-name">${p?.contractor_name||'—'}</div></div></div>
        <div class="sig"><div class="sig-line"><div class="sig-role">توقيع المهندس · Engineer</div><div class="sig-name">${p?.engineer_name||'—'}</div></div></div>
      </div>

      <div style="position:fixed;top:12px;right:12px;z-index:999;display:flex;gap:8px;" class="no-print">
        <button onclick="window.print()" style="background:#185FA5;color:white;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;">🖨 Print / PDF</button>
        <button onclick="window.close()" style="background:#f5f5f0;color:#333;border:1px solid #ddd;padding:10px 20px;border-radius:8px;cursor:pointer;font-size:14px;">✕ Close</button>
      </div>
      <div style="height:56px;" class="no-print"></div>

      <div class="footer">
        <span>مكتب ركاز للهندسة · Rekaz Engineering Office · البحرين · Bahrain</span>
        <span>📞 17666882 · 📱 32277704 · 📷 rekaz.engineeringbh</span>
      </div>

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
                  <label className="form-label">Status — الحالة</label>
                  <select className="form-input" value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
                    <option value="active">Active — نشط</option>
                    <option value="on_hold">On Hold — متوقف</option>
                    <option value="completed">Completed — منتهي</option>
                    <option value="cancelled">Cancelled — ملغي</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Supervision Start — تاريخ بداية الإشراف</label>
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

      {/* Project Card - Full Page on Mobile */}
      {showCard && (
        <div style={{position:'fixed',inset:0,background:'var(--bg-card)',zIndex:1000,overflowY:'auto'}}>
          {/* Sticky header */}
          <div style={{position:'sticky',top:0,background:'var(--bg-card)',borderBottom:'0.5px solid var(--border)',padding:'12px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',zIndex:10}}>
            <button className="btn btn-sm" onClick={()=>setShowCard(null)} style={{display:'flex',alignItems:'center',gap:6}}>
              ← Back
            </button>
            <span style={{fontSize:13,fontWeight:550,color:'var(--text)'}}>{showCard.name}</span>
            <button className="btn btn-primary btn-sm" onClick={printCard}>🖨 Print</button>
          </div>

          {/* Card content */}
          <div style={{padding:16,maxWidth:640,margin:'0 auto'}}>
            {/* Project info */}
            <div style={{background:'var(--bg)',borderRadius:10,padding:14,marginBottom:12}}>
              <div style={{fontSize:11,fontWeight:600,color:'#185FA5',marginBottom:10,textTransform:'uppercase'}}>معلومات المشروع</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px 16px',fontSize:13}}>
                <div><div style={{fontSize:10,color:'var(--text-muted)'}}>اسم المشروع</div><div style={{fontWeight:550}}>{showCard.name}</div></div>
                <div><div style={{fontSize:10,color:'var(--text-muted)'}}>رقم المشروع</div><div style={{fontWeight:550}}>{showCard.project_no}</div></div>
                <div><div style={{fontSize:10,color:'var(--text-muted)'}}>الموقع</div><div>{showCard.location||'—'}</div></div>
                <div><div style={{fontSize:10,color:'var(--text-muted)'}}>بداية الإشراف</div><div>{showCard.supervision_start||'—'}</div></div>
              </div>
              <div style={{marginTop:10}}>
                <div style={{fontSize:10,color:'var(--text-muted)',marginBottom:4}}>نسبة الإنجاز</div>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <div className="progress-bar" style={{flex:1,height:8}}>
                    <div className="progress-fill" style={{width:`${showCard.progress||0}%`}}/>
                  </div>
                  <span style={{fontSize:12,fontWeight:600,color:'#185FA5'}}>{showCard.progress||0}%</span>
                </div>
              </div>
            </div>

            {/* People */}
            <div style={{display:'grid',gridTemplateColumns:'1fr',gap:10,marginBottom:12}}>
              {[
                {label:'المالك · Client', name:showCard.client_name, phone:showCard.client_phone, color:'#185FA5', bg:'#E6F1FB'},
                {label:'المهندس المشرف · Engineer', name:showCard.engineer_name, phone:showCard.engineer_phone, color:'#0F6E56', bg:'#E1F5EE'},
                {label:'المقاول · Contractor', name:showCard.contractor_name, phone:showCard.contractor_phone, color:'#854F0B', bg:'#FDF0DC'},
              ].map(p=>(
                <div key={p.label} style={{background:p.bg,borderRadius:10,padding:12,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div>
                    <div style={{fontSize:10,fontWeight:600,color:p.color,marginBottom:4,textTransform:'uppercase'}}>{p.label}</div>
                    <div style={{fontSize:14,fontWeight:600,color:'var(--text)'}}>{p.name||'—'}</div>
                  </div>
                  {p.phone && (
                    <a href={`tel:${p.phone}`} style={{fontSize:13,color:p.color,fontWeight:500,textDecoration:'none',background:'white',padding:'6px 12px',borderRadius:20}}>
                      📞 {p.phone}
                    </a>
                  )}
                </div>
              ))}
            </div>

            {/* Visits */}
            {projectVisits.length > 0 && (
              <div>
                <div style={{fontSize:11,fontWeight:600,color:'var(--text-muted)',marginBottom:10,textTransform:'uppercase'}}>
                  الزيارات ({projectVisits.filter(v=>v.status==='completed').length}/{projectVisits.length} مكتملة)
                </div>
                {projectVisits.map((v,i)=>(
                  <div key={v.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0',borderBottom:'0.5px solid var(--border)'}}>
                    <span style={{fontSize:11,color:'var(--text-muted)',width:24,flexShrink:0,textAlign:'center'}}>{i+1}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:500,textDecoration:v.status==='completed'?'line-through':'none',color:v.status==='completed'?'var(--text-muted)':'var(--text)'}}>{v.title}</div>
                      {v.title_ar&&<div style={{fontSize:11,color:'var(--text-muted)'}}>{v.title_ar}</div>}
                      {v.engineer_name&&<div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>👷 {v.engineer_name}</div>}
                    </div>
                    <div style={{textAlign:'right',flexShrink:0}}>
                      <div style={{fontSize:11,color:'var(--text-muted)'}}>{v.scheduled_date||'—'}</div>
                      <span style={{fontSize:10,color:STATUS_C2[v.status],fontWeight:600}}>{STATUS_LABELS[v.status]||v.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Print button at bottom */}
            <div style={{marginTop:24,marginBottom:32}}>
              <button className="btn btn-primary" style={{width:'100%',padding:14,fontSize:15}} onClick={printCard}>
                🖨 Print / Save as PDF
              </button>
              <button className="btn" style={{width:'100%',padding:12,fontSize:14,marginTop:8}} onClick={()=>setShowCard(null)}>
                ← Back to Projects
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
