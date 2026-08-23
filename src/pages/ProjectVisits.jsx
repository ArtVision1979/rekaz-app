import React from 'react'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase.js'
import EngineerSelect from '../components/EngineerSelect.jsx'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useConstructionSystems } from '../hooks/useConstructionSystems.js'

const STATUS_COLORS = { pending:'badge-gray', scheduled:'badge-blue', completed:'badge-done', cancelled:'badge-open' }
const STATUS_LABELS = { pending:'Pending', scheduled:'Scheduled', completed:'Completed', cancelled:'Cancelled' }
const STATUS_NEXT = { pending:'scheduled', scheduled:'completed', completed:'pending', cancelled:'pending' }
// «منجزة» نهاية الدورة — الرجوع منها يتطلب تأكيداً صريحاً (انظر toggleStatus)
const STATUS_PRINT_COLOR = { pending:'#888', scheduled:'#185FA5', completed:'#0F6E56', cancelled:'#A32D2D' }

export default function ProjectVisits() {
  const [projects, setProjects] = useState([])
  const [selectedProject, setSelectedProject] = useState(null)
  const [visits, setVisits] = useState([])
  const [templates, setTemplates] = useState([])
  // نظام الإنشاء الذي تُعرض قوالبه وتُحرَّر (افتراضياً نظام المشروع المختار)
  const [templateSystemId, setTemplateSystemId] = useState('')
  const systems = useConstructionSystems()
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [editVisit, setEditVisit] = useState(null)
  const [saving, setSaving] = useState(false)
  const [projectSearch, setProjectSearch] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [newTemplateName, setNewTemplateName] = useState('')
  const nav = useNavigate()
  const [searchParams] = useSearchParams()
  // شريط الإتمام: لا تُعلَّم زيارة «منجزة» بلا مهندس وتاريخ ووقت،
  // فبدل المنع نفتح شريطاً يستوفيها في مكانه
  const [completing, setCompleting] = useState(null)   // visit id
  const [cForm, setCForm] = useState({ engineer_id:null, engineer_name:'', scheduled_date:'', scheduled_time:'' })
  const [cErr, setCErr] = useState('')
  const [form, setForm] = useState({
    title:'', title_ar:'', engineer_id:null, engineer_name:'',
    scheduled_date:'', scheduled_time:'',
    status:'pending', notes:''
  })
  const dropdownRef = useRef(null)

  useEffect(() => { loadInitial() }, [])
  useEffect(() => { if (selectedProject) loadVisits(selectedProject.id) }, [selectedProject])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target))
        setDropdownOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function loadInitial() {
    try {
      const { data: p } = await supabase.from('projects').select('*').order('created_at', { ascending: false })
      setProjects(p || [])
      // القدوم من تنبيه اللوحة يجب أن يفتح على المشروع المقصود لا على الأول
      const wanted = searchParams.get('project')
      const match = wanted ? (p || []).find(x => x.id === wanted) : null
      if (match) setSelectedProject(match)
      else if (p?.length) setSelectedProject(p[0])
    } catch(e) { console.error(e) } finally { setLoading(false) }
  }

  // القوالب تُقرأ لنظام إنشاء واحد فقط، لا كلها دفعة واحدة
  async function loadTemplates(systemId) {
    if (!systemId) { setTemplates([]); return }
    const { data, error } = await supabase
      .from('visit_templates').select('*')
      .eq('category_id', systemId).order('order_index')
    if (error) { console.error('تعذّر جلب القوالب:', error.message); return }
    setTemplates(data || [])
  }

  // نظام المشروع المختار هو المصدر الافتراضي للقوالب
  useEffect(() => {
    const sysId = selectedProject?.category_id || ''
    setTemplateSystemId(sysId)
  }, [selectedProject?.id, selectedProject?.category_id])

  useEffect(() => { loadTemplates(templateSystemId) }, [templateSystemId])

  const currentSystem = systems.find(s => s.id === templateSystemId)

  async function loadVisits(projectId) {
    const { data } = await supabase
      .from('project_visits')
      .select('*')
      .eq('project_id', projectId)
      .order('order_index')
    setVisits(data || [])
  }

  async function loadDefaultVisits() {
    if (!selectedProject) return
    if (!selectedProject.category_id)
      return alert('لم يُحدَّد نظام الإنشاء لهذا المشروع.\nافتح شاشة Projects وحدّد النظام (بوست تنشن / أر سي سي سلاب / بريكاست) أولاً، لأن تسلسل الزيارات يختلف بينها.')
    if (templates.length === 0) return alert('لا توجد قوالب لهذا النظام.')
    setSaving(true)
    try {
      const toInsert = templates.map((t, i) => ({
        project_id: selectedProject.id,
        title: t.title,
        title_ar: t.title_ar || '',
        order_index: t.order_index || i + 1,
        status: 'pending'
      }))
      const { error } = await supabase.from('project_visits').insert(toInsert)
      if (error) throw error
      await loadVisits(selectedProject.id)
    } catch(e) { alert('Error: ' + e.message) } finally { setSaving(false) }
  }

  async function resetToDefault() {
    if (!selectedProject) return
    if (!confirm('Delete all current visits and reload defaults?')) return
    setSaving(true)
    try {
      const { error: delErr } = await supabase.from('project_visits').delete().eq('project_id', selectedProject.id)
      if (delErr) throw delErr
      const toInsert = templates.map((t, i) => ({
        project_id: selectedProject.id,
        title: t.title,
        title_ar: t.title_ar || '',
        order_index: t.order_index || i + 1,
        status: 'pending'
      }))
      if (toInsert.length) {
        const { error: insErr } = await supabase.from('project_visits').insert(toInsert)
        if (insErr) throw insErr
      }
      await loadVisits(selectedProject.id)
    } catch(e) { alert('Error: ' + e.message) } finally { setSaving(false) }
  }

  async function deleteAllVisits() {
    if (!selectedProject) return
    if (!confirm('Delete ALL visits?')) return
    try {
      const { error } = await supabase.from('project_visits').delete().eq('project_id', selectedProject.id)
      if (error) throw error
      setVisits([])
    } catch(e) { alert('تعذّر الحفظ: ' + e.message) }
  }

  function openNew() {
    setEditVisit(null)
    setForm({ title:'', title_ar:'', engineer_id:null, engineer_name:'', scheduled_date:'', scheduled_time:'', status:'pending', notes:'' })
    setShowModal(true)
  }

  function openEdit(v) {
    setEditVisit(v)
    setForm({
      title: v.title, title_ar: v.title_ar||'',
      engineer_id: v.engineer_id||null,
      engineer_name: v.engineer_name||'',
      scheduled_date: v.scheduled_date||'',
      scheduled_time: v.scheduled_time||'',
      status: v.status, notes: v.notes||''
    })
    setShowModal(true)
  }

  async function handleSave(e) {
    e.preventDefault(); setSaving(true)
    try {
      const data = { ...form, project_id: selectedProject.id }

      // نفس قاعدة شريط الإتمام — وإلا بقي هذا طريقاً ملتفّاً حولها
      if (data.status === 'completed') {
        const missing = []
        if (!data.engineer_id)    missing.push('المهندس')
        if (!data.scheduled_date) missing.push('التاريخ')
        if (!data.scheduled_time) missing.push('الوقت')
        if (missing.length) {
          alert('لا يمكن تعليم الزيارة «منجزة» بدون: ' + missing.join(' و'))
          setSaving(false)
          return
        }
      }
      const becameCompleted = data.status === 'completed' && editVisit?.status !== 'completed'
      if (editVisit) { const { error } = await supabase.from('project_visits').update(data).eq('id', editVisit.id); if (error) throw error }
      else { const { error } = await supabase.from('project_visits').insert(data); if (error) throw error }
      setShowModal(false)
      await loadVisits(selectedProject.id)
      // كان التعديل لا يُنشئ سجل الزيارة ولا ينقل للتقرير، بعكس النقر
      if (becameCompleted) {
        await onCompleted({ ...data, id: editVisit?.id, project_id: selectedProject.id })
      }
    } catch(e) { alert(e.message) } finally { setSaving(false) }
  }

  async function handleDelete(v) {
    if (!confirm('Delete this visit?')) return
    try {
      const { error } = await supabase.from('project_visits').delete().eq('id', v.id)
      if (error) throw error
      await loadVisits(selectedProject.id)
    } catch(e) { alert('تعذّر الحفظ: ' + e.message) }
  }

  // إنجاز الزيارة: يُنشئ سجل زيارة الموقع ثم يعرض الانتقال لكتابة
  // التقرير. مشترك بين النقر على الحالة ونموذج التعديل، فكان السلوكان
  // مختلفين: النقر يُنشئ السجل والتعديل لا يفعل.
  async function confirmComplete(v) {
    setCErr('')
    if (!cForm.engineer_id)    { setCErr('اختر المهندس'); return }
    if (!cForm.scheduled_date) { setCErr('حدّد التاريخ'); return }
    if (!cForm.scheduled_time) { setCErr('حدّد الوقت'); return }

    try {
      const patch = {
        status: 'completed',
        engineer_id:   cForm.engineer_id,
        engineer_name: cForm.engineer_name,
        scheduled_date: cForm.scheduled_date,
        scheduled_time: cForm.scheduled_time,
      }
      const { error } = await supabase.from('project_visits').update(patch).eq('id', v.id)
      if (error) throw error

      setVisits(prev => prev.map(pv => pv.id === v.id ? { ...pv, ...patch } : pv))
      setCompleting(null)
      await onCompleted({ ...v, ...patch })
    } catch(e) {
      setCErr('تعذّر الحفظ: ' + (e?.message ?? e))
    }
  }

  async function onCompleted(v) {
    const today = new Date().toISOString().split('T')[0]
    const visitDate = v.scheduled_date || today
    const label = v.title + (v.title_ar ? ' — ' + v.title_ar : '')

    const { data: existing } = await supabase.from('site_visits')
      .select('id').eq('project_id', v.project_id)
      .eq('visit_date', visitDate).eq('notes', label).maybeSingle()

    if (!existing) {
      const { error } = await supabase.from('site_visits').insert({
        project_id: v.project_id,
        visit_date: visitDate,
        engineer_id: v.engineer_id || null,
        engineer_name: v.engineer_name || '',
        notes: label,
        severity: 'low',
        status: 'submitted'
      })
      if (error) throw error
    }

    // بدل أن يبحث المهندس عن المشروع في شاشة زيارات المواقع
    if (confirm('تم إنجاز الزيارة وأُنشئ سجلها.\n\nهل تفتح زيارات المواقع الآن لتحديد نقاط الفحص وكتابة التقرير؟')) {
      nav(`/visits?project=${v.project_id}`)
    }
  }

  async function toggleStatus(v) {
    try {
      // الرجوع من «منجزة» يمسح الإنجاز — لا يصح أن يقع بنقرة عابرة
      if (v.status === 'completed') {
        if (!confirm('هذه الزيارة منجزة.\nهل تريد إعادتها إلى «معلّقة»؟')) return
      }

      const nextStatus = STATUS_NEXT[v.status]

      // الإنجاز يحتاج مهندساً وتاريخاً ووقتاً — نفتح الشريط مُعبّأً
      // بأفضل تخمين بدل أن نحفظ سجلاً ناقصاً
      if (nextStatus === 'completed') {
        const now = new Date()
        setCForm({
          engineer_id:   v.engineer_id   || null,
          engineer_name: v.engineer_name || '',
          scheduled_date: v.scheduled_date || now.toISOString().split('T')[0],
          scheduled_time: (v.scheduled_time || now.toTimeString().slice(0,5)).slice(0,5),
        })
        setCErr('')
        setCompleting(v.id)
        return
      }

      const { error: updErr } = await supabase.from('project_visits')
        .update({ status: nextStatus }).eq('id', v.id)
      if (updErr) throw updErr
      setVisits(prev => prev.map(pv => pv.id === v.id ? { ...pv, status: nextStatus } : pv))
    } catch(e) { alert('تعذّر الحفظ: ' + e.message) }
  }


  async function saveTemplates() {
    try {
      // مهم: الحذف مقصور على نظام الإنشاء المعروض. كان يحذف كل
      // القوالب في كل الأنظمة، فتضيع المجموعات الأخرى بضغطة واحدة.
      if (!templateSystemId) { alert('اختر نظام الإنشاء أولاً.'); setSaving(false); return }
      const { error: delErr } = await supabase.from('visit_templates').delete().eq('category_id', templateSystemId)
      if (delErr) throw delErr
      const toInsert = templates.filter(t => t.title?.trim()).map((t, i) => ({
        title: t.title, title_ar: t.title_ar||'', order_index: i+1,
        is_default: true, category_id: templateSystemId
      }))
      if (toInsert.length) {
        const { error: insErr } = await supabase.from('visit_templates').insert(toInsert)
        if (insErr) throw insErr
      }
      setShowTemplateModal(false)
      await loadTemplates(templateSystemId)
    } catch(e) { alert('تعذّر الحفظ: ' + e.message) }
  }

  function printVisits() {
    const printContent = document.getElementById('visits-print')
    if (!printContent) return
    const w = window.open('', '_blank')
    w.document.write(`
      <html><head><title>Project Visits - ${selectedProject?.name}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 40px; color: #000; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th { background: #185FA5; color: white; padding: 8px 10px; text-align: left; }
        td { padding: 7px 10px; border-bottom: 0.5px solid #eee; }
        tr:nth-child(even) { background: #fafafa; }
        img { height: 48px; width: auto; }
        .header { display: flex; justify-content: space-between; border-bottom: 3px solid #185FA5; padding-bottom: 16px; margin-bottom: 20px; }
        .info { background: #f5f5f0; border-radius: 8px; padding: 12px; margin-bottom: 16px; font-size: 12px; }
        .sigs { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 50px; }
        .sig { text-align: center; }
        .sig-line { border-top: 1.5px solid #333; padding-top: 8px; margin-top: 40px; font-size: 12px; }
        .footer { border-top: 1px solid #ddd; margin-top: 32px; padding-top: 12px; text-align: center; font-size: 10px; color: #aaa; }
        .no-print { position: fixed; top: 12px; right: 12px; display: flex; gap: 8px; z-index: 999; }
        @media print { .no-print { display: none !important; } }
      </style>
      </head><body>
      <div class="no-print">
        <button onclick="window.print()" style="background:#185FA5;color:white;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;">🖨 Print</button>
        <button onclick="window.close()" style="background:#f5f5f0;color:#333;border:1px solid #ddd;padding:10px 20px;border-radius:8px;cursor:pointer;font-size:14px;">✕ Close</button>
      </div>
      <div style="height:56px;"></div>
      ${printContent.innerHTML}</body></html>
    `)
    w.document.close()
    w.focus()
    setTimeout(() => { w.print(); w.close() }, 500)
  }

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(projectSearch.toLowerCase()) ||
    (p.project_no||'').toLowerCase().includes(projectSearch.toLowerCase())
  )

  const completed = visits.filter(v => v.status === 'completed').length
  const total = visits.length
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0

  return (
    <div>
      <style>{`@media print { body > * { display:none!important; } #visits-print { display:block!important; position:fixed; top:0; left:0; width:100%; } } #visits-print { display:none; }`}</style>

      {selectedProject && visits.length > 0 && (
        <div id="visits-print">
          <div style={{fontFamily:'Arial,sans-serif',maxWidth:800,margin:'0 auto',padding:40,color:'#000'}}>
            <div style={{display:'flex',justifyContent:'space-between',borderBottom:'3px solid #185FA5',paddingBottom:16,marginBottom:20}}>
              <div>
                <img src="/rekaz-logo.jpg" alt="Rekaz" style={{height:48,width:'auto'}}/>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontSize:18,fontWeight:700,color:'#185FA5'}}>قائمة زيارات المشروع</div>
                <div style={{fontSize:12,color:'#888'}}>{new Date().toLocaleDateString('en-GB')}</div>
              </div>
            </div>
            <div style={{background:'#f5f5f0',borderRadius:8,padding:12,marginBottom:16,fontSize:12}}>
              <div><strong>{selectedProject.name}</strong> · {selectedProject.project_no}</div>
              <div style={{color:'#666',marginTop:4}}>Client: {selectedProject.client_name||'—'} · Engineer: {selectedProject.engineer_name||'—'}</div>
              <div style={{color:'#666'}}>Completed: {completed}/{total}</div>
            </div>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead>
                <tr style={{background:'#185FA5',color:'white'}}>
                  <th style={{padding:'7px 10px',textAlign:'left',width:30}}>#</th>
                  <th style={{padding:'7px 10px',textAlign:'left'}}>Visit</th>
                  <th style={{padding:'7px 10px',textAlign:'left'}}>Engineer</th>
                  <th style={{padding:'7px 10px',textAlign:'left'}}>Date</th>
                  <th style={{padding:'7px 10px',textAlign:'center',width:90}}>Status</th>
                </tr>
              </thead>
              <tbody>
                {visits.map((v,i) => (
                  <tr key={v.id} style={{background:i%2===0?'#fafafa':'white'}}>
                    <td style={{padding:'6px 10px',color:'#888'}}>{i+1}</td>
                    <td style={{padding:'6px 10px'}}>
                      <div style={{fontWeight:500}}>{v.title}</div>
                      {v.title_ar && <div style={{fontSize:11,color:'#666'}}>{v.title_ar}</div>}
                    </td>
                    <td style={{padding:'6px 10px',color:'#666'}}>{v.engineer_name||'—'}</td>
                    <td style={{padding:'6px 10px',color:'#666'}}>{v.scheduled_date||'—'}</td>
                    <td style={{padding:'6px 10px',textAlign:'center',color:STATUS_PRINT_COLOR[v.status],fontWeight:500}}>{STATUS_LABELS[v.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:40,marginTop:50}}>
              <div style={{textAlign:'center'}}><div style={{borderTop:'1.5px solid #333',paddingTop:8,marginTop:40}}><div style={{fontSize:12}}>Client — {selectedProject.client_name||'—'}</div></div></div>
              <div style={{textAlign:'center'}}><div style={{borderTop:'1.5px solid #333',paddingTop:8,marginTop:40}}><div style={{fontSize:12}}>Engineer — {selectedProject.engineer_name||'—'}</div></div></div>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <h3>{editVisit ? 'Edit Visit' : 'New Visit'}</h3>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Visit Name (English) *</label>
                <input className="form-input" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} required autoFocus list="vtlist"/>
                <datalist id="vtlist">{templates.map((t,i)=><option key={i} value={t.title}/>)}</datalist>
              </div>
              <div className="form-group">
                <label className="form-label">الاسم بالعربي</label>
                <input className="form-input" value={form.title_ar} onChange={e=>setForm(f=>({...f,title_ar:e.target.value}))} placeholder="معاينة الموقع"/>
              </div>
              <div className="form-group">
                <label className="form-label">Engineer *</label>
                <EngineerSelect valueId={form.engineer_id} valueName={form.engineer_name}
                  onChange={({id,name})=>setForm(f=>({...f,engineer_id:id,engineer_name:name}))} required/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input type="date" className="form-input" value={form.scheduled_date} onChange={e=>setForm(f=>({...f,scheduled_date:e.target.value}))}/>
                </div>
                <div className="form-group">
                  <label className="form-label">Time</label>
                  <input type="time" className="form-input" value={form.scheduled_time} onChange={e=>setForm(f=>({...f,scheduled_time:e.target.value}))}/>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-input" value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
                  <option value="pending">Pending</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-input" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={()=>setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Saving...':editVisit?'Save':'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTemplateModal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowTemplateModal(false)}>
          <div className="modal">
            <h3>Edit Visit Templates</h3>
            {/* لكل نظام إنشاء تسلسل زيارات مستقل — التعديل هنا يمس
                النظام المختار وحده ولا يمس الأنظمة الأخرى */}
            <div className="form-group">
              <label className="form-label">نظام الإنشاء · Construction System</label>
              <select className="form-input" value={templateSystemId}
                onChange={e=>setTemplateSystemId(e.target.value)}>
                <option value="">— اختر النظام —</option>
                {systems.map(s=>(
                  <option key={s.id} value={s.id}>{s.name_ar ? `${s.name_ar} · ${s.name}` : s.name}</option>
                ))}
              </select>
              <div style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>
                {templateSystemId
                  ? `${templates.length} زيارة في هذا القالب`
                  : 'اختر نظاماً لعرض قوالبه'}
              </div>
            </div>
            <div style={{marginBottom:12}}>
              {templates.map((t,i)=>(
                <div key={i} style={{display:'flex',gap:6,marginBottom:6,alignItems:'center'}}>
                  <span style={{fontSize:11,color:'var(--text-muted)',width:20,flexShrink:0}}>{i+1}</span>
                  <input className="form-input" style={{flex:1}} value={t.title} onChange={e=>setTemplates(prev=>prev.map((v,j)=>j===i?{...v,title:e.target.value}:v))} placeholder="English"/>
                  <input className="form-input" style={{flex:1}} value={t.title_ar||''} onChange={e=>setTemplates(prev=>prev.map((v,j)=>j===i?{...v,title_ar:e.target.value}:v))} placeholder="العربي"/>
                  <button className="btn btn-sm" style={{color:'#A32D2D',borderColor:'#A32D2D',flexShrink:0}} onClick={()=>setTemplates(prev=>prev.filter((_,j)=>j!==i))}>✕</button>
                </div>
              ))}
            </div>
            <div style={{display:'flex',gap:8,marginBottom:16}}>
              <input className="form-input" value={newTemplateName} onChange={e=>setNewTemplateName(e.target.value)} placeholder="New visit type..."/>
              <button className="btn btn-primary btn-sm" onClick={()=>{if(newTemplateName.trim()){setTemplates(p=>[...p,{title:newTemplateName.trim(),title_ar:''}]);setNewTemplateName('')}}}>Add</button>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={()=>setShowTemplateModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveTemplates}>Save</button>
            </div>
          </div>
        </div>
      )}

      <div className="page-header">
        <div><h3>Project Visits</h3><div className="page-sub">Track visits per project</div></div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          {visits.length > 0 && <button className="btn btn-sm" style={{color:'#185FA5',borderColor:'#185FA5'}} onClick={printVisits}>🖨 Print</button>}
          <button className="btn btn-sm" onClick={()=>setShowTemplateModal(true)}>⚙ Templates</button>
          <button className="btn btn-primary" onClick={openNew} disabled={!selectedProject}>+ New Visit</button>
        </div>
      </div>

      {/* Project Dropdown */}
      <div style={{position:'relative',marginBottom:16,maxWidth:600}} ref={dropdownRef}>
        <button
          onClick={()=>setDropdownOpen(o=>!o)}
          style={{
            width:'100%', padding:'9px 14px',
            border:`0.5px solid ${dropdownOpen ? '#185FA5' : 'var(--border)'}`,
            borderRadius: dropdownOpen ? '8px 8px 0 0' : 8,
            background:'var(--bg)', color:'var(--text)',
            fontSize:13, cursor:'pointer',
            display:'flex', justifyContent:'space-between', alignItems:'center',
            textAlign:'left', transition:'border-color 0.15s'
          }}
        >
          <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1}}>
            {selectedProject ? selectedProject.name : 'اختر مشروعاً...'}
          </span>
          {selectedProject?.project_no && (
            <span style={{fontSize:11,color:'var(--text-muted)',marginRight:8,marginLeft:8,whiteSpace:'nowrap'}}>
              {selectedProject.project_no}
            </span>
          )}
          <span style={{fontSize:10,color:'var(--text-muted)',flexShrink:0}}>{dropdownOpen ? '▲' : '▼'}</span>
        </button>

        {dropdownOpen && (
          <div style={{
            position:'absolute', top:'100%', left:0, right:0,
            background:'var(--bg)',
            border:'0.5px solid #185FA5', borderTop:'none',
            borderRadius:'0 0 8px 8px',
            zIndex:100, boxShadow:'0 4px 16px rgba(0,0,0,0.1)'
          }}>
            <input
              autoFocus
              className="form-input"
              style={{
                width:'100%', borderRadius:0,
                borderLeft:'none', borderRight:'none', borderTop:'none',
                borderBottom:'0.5px solid var(--border)',
                boxSizing:'border-box', fontSize:13
              }}
              placeholder="ابحث باسم المشروع أو الرقم..."
              value={projectSearch}
              onChange={e=>setProjectSearch(e.target.value)}
            />
            <div style={{maxHeight:260,overflowY:'auto'}}>
              {filteredProjects.length === 0
                ? <div style={{padding:'10px 14px',fontSize:13,color:'var(--text-muted)'}}>لا توجد نتائج</div>
                : filteredProjects.map(p => (
                  <div
                    key={p.id}
                    onClick={()=>{setSelectedProject(p);setDropdownOpen(false);setProjectSearch('')}}
                    style={{
                      padding:'9px 14px', fontSize:13, cursor:'pointer',
                      borderBottom:'0.5px solid var(--border)',
                      background: selectedProject?.id===p.id ? '#E6F1FB' : 'transparent',
                      color: selectedProject?.id===p.id ? '#0C447C' : 'var(--text)',
                    }}
                  >
                    <div style={{fontWeight: selectedProject?.id===p.id ? 500 : 400,
                      whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                      {p.name}
                    </div>
                    {p.project_no && (
                      <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>
                        {p.project_no}{p.location ? ` · ${p.location}` : ''}
                      </div>
                    )}
                  </div>
                ))
              }
            </div>
            <div style={{padding:'6px 14px',fontSize:11,color:'var(--text-muted)',borderTop:'0.5px solid var(--border)'}}>
              {filteredProjects.length} مشروع
            </div>
          </div>
        )}
      </div>

      {selectedProject && (
        <div>
          <div className="card" style={{marginBottom:16}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12}}>
              <div>
                <div style={{fontWeight:500,fontSize:15}}>{selectedProject.name}</div>
                <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>
                  {selectedProject.project_no} · {selectedProject.location||'—'} · {selectedProject.client_name||'—'}
                </div>
                {/* نظام الإنشاء يحدد تسلسل الزيارات، فإظهاره هنا يمنع
                    تحميل القالب الخطأ على المشروع */}
                <div style={{marginTop:6}}>
                  {currentSystem ? (
                    <span style={{fontSize:11,fontWeight:600,color:'#0F6E56',background:'#E1F5EE',padding:'3px 10px',borderRadius:20}}>
                      🏗 {currentSystem.name_ar || currentSystem.name}
                    </span>
                  ) : (
                    <span style={{fontSize:11,fontWeight:600,color:'#854F0B',background:'var(--amber-light)',padding:'3px 10px',borderRadius:20}}>
                      ⚠ لم يُحدَّد نظام الإنشاء — حدّده من شاشة Projects
                    </span>
                  )}
                </div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <div style={{textAlign:'center'}}>
                  <div style={{fontSize:22,fontWeight:500,color:'#185FA5'}}>{completed}/{total}</div>
                  <div style={{fontSize:11,color:'var(--text-muted)'}}>Completed</div>
                </div>
                <div style={{width:70}}>
                  <div className="progress-bar" style={{height:6}}><div className="progress-fill" style={{width:`${progress}%`}}/></div>
                  <div style={{fontSize:11,color:'var(--text-muted)',marginTop:3,textAlign:'center'}}>{progress}%</div>
                </div>
                <div style={{display:'flex',gap:6}}>
                  {total===0 && <button className="btn btn-sm" style={{color:'#185FA5',borderColor:'#185FA5'}} onClick={loadDefaultVisits} disabled={saving}>{saving?'Loading...':'+ Load Default'}</button>}
                  {total>0 && <button className="btn btn-sm" style={{color:'#854F0B',borderColor:'#854F0B'}} onClick={resetToDefault} disabled={saving}>↺ Reset</button>}
                  {total>0 && <button className="btn btn-sm" style={{color:'#A32D2D',borderColor:'#A32D2D'}} onClick={deleteAllVisits}>🗑 Delete All</button>}
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            {loading ? <div style={{color:'var(--text-muted)',padding:16}}>Loading...</div> :
              visits.length===0 ? (
                <div className="empty">
                  <p>No visits yet.</p>
                  <button className="btn btn-primary" style={{marginTop:12}} onClick={loadDefaultVisits} disabled={saving}>{saving?'Loading...':'Load Default Visits'}</button>
                </div>
              ) : (
                <table className="table">
                  <thead><tr>
                    <th style={{width:32}}>#</th>
                    <th>Visit</th>
                    <th>Engineer</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Status</th>
                    <th></th>
                  </tr></thead>
                  <tbody>
                    {visits.map((v,i)=>(
                      <React.Fragment key={v.id}>
                      <tr style={{opacity:v.status==='cancelled'?0.5:1}}>
                        <td style={{color:'var(--text-muted)',fontSize:11}}>{i+1}</td>
                        <td>
                          <div style={{fontWeight:500,textDecoration:v.status==='completed'?'line-through':'none',color:v.status==='completed'?'var(--text-muted)':'var(--text)'}}>{v.title}</div>
                          {v.title_ar && <div style={{fontSize:11,color:'var(--text-muted)',marginTop:1}}>{v.title_ar}</div>}
                          {v.notes && <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2,fontStyle:'italic'}}>{v.notes}</div>}
                        </td>
                        <td style={{color:'var(--text-muted)',fontSize:12}}>{v.engineer_name||'—'}</td>
                        <td style={{color:'var(--text-muted)',fontSize:12}}>{v.scheduled_date||'—'}</td>
                        <td style={{color:'var(--text-muted)',fontSize:12}}>{v.scheduled_time?v.scheduled_time.slice(0,5):'—'}</td>
                        <td><span className={`badge ${STATUS_COLORS[v.status]}`} style={{cursor:'pointer'}} onClick={()=>toggleStatus(v)}>{STATUS_LABELS[v.status]}</span></td>
                        <td><div style={{display:'flex',gap:6}}>
                          <button className="btn btn-sm" onClick={()=>openEdit(v)}>Edit</button>
                          <button className="btn btn-sm" style={{color:'#A32D2D',borderColor:'#A32D2D'}} onClick={()=>handleDelete(v)}>Delete</button>
                        </div></td>
                      </tr>

                      {/* شريط الإتمام — يستوفي المهندس والتاريخ والوقت قبل
                          تعليم الزيارة منجزة */}
                      {completing === v.id && (
                        <tr>
                          <td colSpan={7} style={{background:'#E1F5EE',padding:'12px 14px'}}>
                            <div style={{display:'flex',gap:9,alignItems:'center',flexWrap:'wrap'}}>
                              <span style={{fontSize:12.5,fontWeight:600,color:'#0F6E56'}}>
                                إتمام الزيارة —
                              </span>
                              <div style={{width:186}}>
                                <EngineerSelect valueId={cForm.engineer_id} valueName={cForm.engineer_name}
                                  placeholder="اختر المهندس *"
                                  onChange={({id,name})=>setCForm(f=>({...f,engineer_id:id,engineer_name:name}))}/>
                              </div>
                              <input type="date" className="form-input" style={{width:150,fontSize:12.5}}
                                value={cForm.scheduled_date}
                                onChange={e=>setCForm(f=>({...f,scheduled_date:e.target.value}))}/>
                              <input type="time" className="form-input" style={{width:118,fontSize:12.5}}
                                value={cForm.scheduled_time}
                                onChange={e=>setCForm(f=>({...f,scheduled_time:e.target.value}))}/>

                              <button type="button" className="btn btn-sm btn-primary" style={{fontSize:12}}
                                onClick={()=>confirmComplete(v)}>✓ تأكيد الإنجاز</button>
                              <button type="button" className="btn btn-sm" style={{fontSize:12}}
                                onClick={()=>{setCompleting(null);setCErr('')}}>إلغاء</button>

                              {cErr && (
                                <span style={{color:'#A32D2D',fontSize:12,fontWeight:600}}>{cErr}</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              )
            }
          </div>
        </div>
      )}
    </div>
  )
}
