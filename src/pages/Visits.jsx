import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import SectionHelp from '../components/SectionHelp.jsx'
import { getProjects, supabase } from '../lib/supabase.js'
import EngineerSelect from '../components/EngineerSelect.jsx'

const SEV_COLOR = { low:'badge-blue', medium:'badge-progress', high:'badge-open', critical:'badge-open' }
// التاريخ المحلي — toISOString يحوّل للتوقيت العالمي، والبحرين +3،
// فبين منتصف الليل و٣ فجراً يُسجَّل «اليوم» على أنه أمس
const localToday = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

const EMPTY = { project_id:'', project_visit_id:'', visit_date: localToday(), notes:'', severity:'low', status:'draft', engineer_id:null, engineer_name:'' }

// خيار الزيارة خارج الخطة — لا يصح إلزام الربط دائماً: الإشراف الشهري
// بلا خطة مراحل أصلاً، وقد تقع زيارة استثنائية في المرحلي أيضاً
const OFF_PLAN = '__off_plan__'

// ── Checklist Item Row ───────────────────────────────────────────────
function ChecklistItem({ item, index, result, hasNote, editingNote, onResult, onToggleNote, onSaveNote }) {
  const colors = { pass:'#0F6E56', fail:'#A32D2D', na:'#888', pending:'#aaa' }
  const bgs    = { pass:'#E1F5EE', fail:'#FCEBEB', na:'#f5f5f0', pending:'#f5f5f0' }
  return (
    <div style={{padding:'8px 0', borderBottom:'0.5px solid var(--border)'}}>
      <div style={{display:'flex', alignItems:'center', gap:10}}>
        <span style={{fontSize:11, color:'var(--text-muted)', width:20, flexShrink:0}}>{index}</span>
        <div style={{flex:1, fontSize:13}}>{item.item}</div>
        <div style={{display:'flex', gap:5, alignItems:'center'}}>
          {['pass','fail','na'].map(r => (
            <button key={r} onClick={() => onResult(item.id, item.item, r)}
              style={{padding:'3px 8px', borderRadius:20, border:'none', cursor:'pointer', fontSize:11, fontWeight:500,
                background: result===r ? bgs[r] : 'var(--bg)',
                color: result===r ? colors[r] : 'var(--text-muted)',
                outline: result===r ? `1.5px solid ${colors[r]}` : 'none'}}>
              {r==='pass' ? '✓' : r==='fail' ? '✗' : '—'}
            </button>
          ))}
          <button onClick={() => onToggleNote(item.id)}
            style={{padding:'3px 8px', borderRadius:20, border:'none', cursor:'pointer', fontSize:11,
              background: hasNote ? '#FAEEDA' : 'var(--bg)',
              color: hasNote ? '#854F0B' : 'var(--text-muted)'}}>
            💬
          </button>
        </div>
      </div>
      {hasNote && editingNote !== item.id && (
        <div style={{marginTop:6, marginRight:30, fontSize:12, color:'#854F0B', background:'#FAEEDA', borderRadius:6, padding:'4px 10px'}}>
          {hasNote}
        </div>
      )}
      {editingNote === item.id && (
        <div style={{marginTop:8, marginRight:30, display:'flex', gap:8}}>
          <input className="form-input" style={{flex:1, fontSize:12}}
            defaultValue={hasNote || ''}
            placeholder="Add note or reason..."
            autoFocus
            onKeyDown={e => {
              if (e.key === 'Enter') onSaveNote(item.id, item.item, e.target.value)
              if (e.key === 'Escape') onToggleNote(null)
            }}
            id={`note-${item.id}`}/>
          <button className="btn btn-sm btn-primary"
            onClick={() => onSaveNote(item.id, item.item, document.getElementById(`note-${item.id}`).value)}>
            Save
          </button>
        </div>
      )}
    </div>
  )
}

export default function Visits() {
  const [projects, setProjects] = useState([])
  const [selectedProject, setSelectedProject] = useState(null)
  const [searchParams] = useSearchParams()
  const [visits, setVisits] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editVisit, setEditVisit] = useState(null)
  const [form, setForm] = useState(EMPTY)
  // زيارات خطة المشروع — أصلٌ يُربط به سجل الزيارة
  const [planVisits, setPlanVisits] = useState([])
  const [saving, setSaving] = useState(false)
  const [projectSearch, setProjectSearch] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [showChecklist, setShowChecklist] = useState(null)
  const [checklist, setChecklist] = useState([])
  const [checklistResults, setChecklistResults] = useState({})
  const [editingNote, setEditingNote] = useState(null)
  const dropdownRef = useRef(null)

  useEffect(() => { loadProjects() }, [])
  useEffect(() => { if (selectedProject) loadVisits(selectedProject.id) }, [selectedProject])

  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target))
        setDropdownOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function loadProjects() {
    try {
      const p = await getProjects()
      setProjects(p || [])
      // القدوم من «زيارات المشاريع» بعد إنجاز زيارة: نفتح على مشروعه
      // مباشرة بدل أن يبحث عنه المهندس في قائمة 53 مشروعاً
      const wanted = searchParams.get('project')
      const match = wanted ? (p || []).find(x => x.id === wanted) : null
      if (match) setSelectedProject(match)
      else if (p?.length) setSelectedProject(p[0])
    } catch(e) { console.error(e) } finally { setLoading(false) }
  }

  async function loadVisits(projectId) {
    setLoading(true)
    try {
      const [{ data }, { data: pv }] = await Promise.all([
        supabase.from('site_visits')
          .select('*, construction_stages(name)')
          .eq('project_id', projectId)
          .order('visit_date', { ascending: false }),
        // زيارات الخطة — لربط السجل بأصله بدل تركه يتيماً
        supabase.from('project_visits')
          .select('id, title, title_ar, status, is_rework, engineer_id, engineer_name, scheduled_date, order_index')
          .eq('project_id', projectId)
          .order('order_index').order('is_rework')
      ])
      setVisits(data || [])
      setPlanVisits(pv || [])
    } catch(e) { console.error(e) } finally { setLoading(false) }
  }

  async function openChecklist(visit) {
    setShowChecklist(visit)
    const fullNotes = visit.notes?.trim() || ''
    const shortType = visit.notes?.split(' — ')[0]?.trim() || ''

    const { data: allItems } = await supabase.from('inspection_checklists').select('*').order('order_index')
    const { data: results } = await supabase.from('visit_checklist_results').select('*').eq('visit_id', visit.id)

    let clData = []
    if (allItems?.length) {
      const types = [...new Set(allItems.map(i => i.visit_type))]
      const bestMatch =
        types.find(t => t === fullNotes) ||
        types.find(t => t === shortType) ||
        types.find(t => fullNotes.toLowerCase().includes(t.toLowerCase())) ||
        types.find(t => t.toLowerCase().includes(shortType.toLowerCase()))
      if (bestMatch) clData = allItems.filter(i => i.visit_type === bestMatch)
    }
    setChecklist(clData)

    const resultsMap = {}
    ;(results || []).forEach(r => { resultsMap[r.checklist_item_id] = r })
    setChecklistResults(resultsMap)
  }

  async function saveChecklistResult(itemId, itemText, result, notes) {
    if (!showChecklist) return
    try {
      const existing = checklistResults[itemId]
      const updateData = notes !== undefined ? { result, notes } : { result }
      if (existing) {
        const { error: updErr } = await supabase.from('visit_checklist_results').update(updateData).eq('id', existing.id)
        if (updErr) throw updErr
      } else {
        const { data, error: insErr } = await supabase.from('visit_checklist_results').insert({
          visit_id: showChecklist.id,
          checklist_item_id: itemId,
          item_text: itemText,
          ...updateData
        }).select().single()
        if (insErr) throw insErr
        if (data) { setChecklistResults(prev => ({ ...prev, [itemId]: data })); return }
      }
      setChecklistResults(prev => ({ ...prev, [itemId]: { ...(prev[itemId]||{}), ...updateData } }))
    } catch(e) { alert('تعذّر الحفظ: ' + e.message) }
  }

  async function saveNote(itemId, itemText, notes) {
    const result = checklistResults[itemId]?.result || 'pending'
    await saveChecklistResult(itemId, itemText, result, notes)
    setEditingNote(null)
  }

  function openNew() {
    setEditVisit(null)
    setForm({ ...EMPTY, project_id: selectedProject?.id || '' })
    setShowModal(true)
  }

  function openEdit(v) {
    setEditVisit(v)
    setForm({ project_id: v.project_id, project_visit_id: v.project_visit_id || OFF_PLAN,
      visit_date: v.visit_date, notes: v.notes||'', severity: v.severity, status: v.status,
      engineer_id: v.engineer_id||null, engineer_name: v.engineer_name||'' })
    setShowModal(true)
  }

  // اختيار زيارة من الخطة يملأ الملاحظة والمهندس — نفس ما يفعله
  // الإنجاز من شاشة زيارات المشاريع، فيتطابق السجلّان بدل أن يفترقا
  function pickPlanVisit(id) {
    if (id === OFF_PLAN || !id) { setForm(f => ({ ...f, project_visit_id: id })); return }
    const pv = planVisits.find(x => x.id === id)
    if (!pv) { setForm(f => ({ ...f, project_visit_id: id })); return }
    const label = pv.title + (pv.title_ar ? ' — ' + pv.title_ar : '') + (pv.is_rework ? ' — زيارة إضافية' : '')
    setForm(f => ({
      ...f,
      project_visit_id: id,
      notes: f.notes?.trim() ? f.notes : label,
      engineer_id:   f.engineer_id   || pv.engineer_id   || null,
      engineer_name: f.engineer_name || pv.engineer_name || '',
      visit_date:    pv.scheduled_date || f.visit_date,
    }))
  }

  async function handleSave(e) {
    e.preventDefault(); setSaving(true)
    try {
      // «خارج الخطة» علامة في الواجهة فقط — تُحفظ null في قاعدة البيانات
      const payload = {
        ...form,
        project_visit_id: (!form.project_visit_id || form.project_visit_id === OFF_PLAN)
          ? null : form.project_visit_id
      }
      if (editVisit) {
        const { error } = await supabase.from('site_visits').update(payload).eq('id', editVisit.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('site_visits').insert(payload)
        if (error) throw error
      }
      setShowModal(false)
      await loadVisits(selectedProject.id)
    } catch(e) { alert(e.message) } finally { setSaving(false) }
  }

  // ─────────────────────────────────────────────────────────────────
  //  حذف زيارة موقع — ما يتبعها ليس متساوياً
  //
  //  المهام مرتبطة بقيد يمنع الحذف، فكانت الرسالة تظهر بالإنجليزية
  //  («violates foreign key constraint») بلا سبيل للمتابعة.
  //
  //  والتقارير أخطر: قيدها متسلسل، فكان حذف الزيارة يمحو تقرير العميل
  //  الصادر بلا أي تحذير. لذلك نُحصي التابعين ونسمّيهم قبل السؤال.
  // ─────────────────────────────────────────────────────────────────
  async function handleDelete(v) {
    try {
      const [tk, rp, cl, ph] = await Promise.all([
        supabase.from('tasks').select('id,title,status').eq('visit_id', v.id),
        supabase.from('reports').select('report_no').eq('visit_id', v.id),
        supabase.from('visit_checklist_results').select('id',{count:'exact',head:true}).eq('visit_id', v.id),
        supabase.from('visit_photos').select('id',{count:'exact',head:true}).eq('visit_id', v.id),
      ])
      const tasks   = tk.data || []
      const openTk  = tasks.filter(t => ['open','in_progress'].includes(t.status))
      const reports = rp.data || []

      const lines = ['حذف هذه الزيارة نهائياً:', '']
      if (reports.length) {
        lines.push(`⚠ سيُحذف معها ${reports.length} تقرير صادر للعميل ` +
                   `(${reports.map(r => r.report_no).join('، ')}) — ولا يمكن استرجاعه.`)
      }
      if (cl.count)  lines.push(`· ${cl.count} بند فحص`)
      if (ph.count)  lines.push(`· ${ph.count} صورة`)
      if (tasks.length) {
        lines.push(`· ${tasks.length} مهمة متابعة` +
                   (openTk.length ? ` — منها ${openTk.length} ما زالت مفتوحة` : ''))
      }
      if (!reports.length && !cl.count && !ph.count && !tasks.length) {
        lines.push('لا يتبعها شيء.')
      }
      lines.push('', 'متابعة؟')
      if (!confirm(lines.join('\n'))) return

      // المهام لا تُحذف تلقائياً مع الزيارة (قيدها مانع)، فنحذفها أولاً
      // بعد أن رآها المستخدم صراحةً — لا حذف صامت لالتزام قائم
      if (tasks.length) {
        const { error: tErr } = await supabase.from('tasks').delete().eq('visit_id', v.id)
        if (tErr) throw tErr
      }
      const { error } = await supabase.from('site_visits').delete().eq('id', v.id)
      if (error) throw error
      await loadVisits(selectedProject.id)
    } catch(e) { alert('تعذّر الحذف: ' + (e?.message ?? e)) }
  }

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(projectSearch.toLowerCase()) ||
    (p.project_no||'').toLowerCase().includes(projectSearch.toLowerCase())
  )

  const draftCount    = visits.filter(v => v.status === 'draft').length
  const approvedCount = visits.filter(v => v.status === 'approved').length

  // فصل نقاط الفحص عن التوصيات
  const inspectionItems    = checklist.filter(i => i.item_type !== 'recommendation')
  const recommendationItems = checklist.filter(i => i.item_type === 'recommendation')
  const passCount = Object.values(checklistResults).filter(r => r.result === 'pass').length
  const failCount = Object.values(checklistResults).filter(r => r.result === 'fail').length
  const naCount   = Object.values(checklistResults).filter(r => r.result === 'na').length

  return (
    <>
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <h3>{editVisit ? 'Edit Visit' : 'New Site Visit'}</h3>
            <form onSubmit={handleSave}>
              {/* ── الربط بالخطة ──
                  سجلٌّ بلا أصل لا يُعرف أي مرحلة يوثّق، ولا يُنظَّف إذا
                  تراجعت الزيارة أو حُذفت — وهو مصدر السجلات اليتيمة */}
              <div className="form-group">
                <label className="form-label">زيارة الخطة · Plan Visit *</label>
                <select className="form-input" required
                  value={form.project_visit_id || ''}
                  onChange={e => pickPlanVisit(e.target.value)}>
                  <option value="">اختر الزيارة…</option>
                  {planVisits.map(pv => {
                    const taken = visits.some(s => s.project_visit_id === pv.id && s.id !== editVisit?.id)
                    return (
                      <option key={pv.id} value={pv.id} disabled={taken}>
                        {pv.is_rework ? '↳ ' : ''}{pv.title_ar || pv.title}
                        {pv.is_rework ? ' (زيارة إضافية)' : ''}
                        {taken ? ' — لها سجل بالفعل' : ''}
                      </option>
                    )
                  })}
                  <option value={OFF_PLAN}>— زيارة خارج الخطة (دورية أو استثنائية)</option>
                </select>
                <div style={{fontSize:11,color:'var(--text-muted)',marginTop:4,lineHeight:1.6}}>
                  {form.project_visit_id === OFF_PLAN
                    ? 'لن تُربط بأي مرحلة — اخترها للإشراف الشهري أو الزيارات الاستثنائية فقط.'
                    : 'الربط يجعل السجل يُنظَّف تلقائياً عند التراجع عن الزيارة أو حذفها.'}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Engineer</label>
                <EngineerSelect valueId={form.engineer_id} valueName={form.engineer_name}
                  onChange={({id,name})=>setForm(f=>({...f,engineer_id:id,engineer_name:name}))} required/>
              </div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
                <div className="form-group">
                  <label className="form-label">Visit Date *</label>
                  <input type="date" className="form-input" value={form.visit_date}
                    onChange={e => setForm(f=>({...f, visit_date:e.target.value}))} required/>
                </div>
                <div className="form-group">
                  <label className="form-label">Severity</label>
                  <select className="form-input" value={form.severity} onChange={e=>setForm(f=>({...f,severity:e.target.value}))}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-input" value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
                  <option value="draft">Draft</option>
                  <option value="submitted">Submitted</option>
                  <option value="approved">Approved</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-input" value={form.notes}
                  onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Visit notes..."/>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={()=>setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Saving...':editVisit?'Save':'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showChecklist && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowChecklist(null)}>
          <div className="modal" style={{maxWidth:560}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <h3 style={{margin:0}}>Checklist — {showChecklist.visit_date}</h3>
              <button className="btn btn-sm" onClick={()=>setShowChecklist(null)}>Close</button>
            </div>
            <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:14}}>
              {showChecklist.notes?.split(' — ')[0]||'Site Visit'}
            </div>

            {checklist.length === 0 ? (
              <div style={{color:'var(--text-muted)',fontSize:13,padding:'16px 0'}}>No checklist available for this visit type.</div>
            ) : (
              <>
                {/* ملخص */}
                <div style={{marginBottom:12,fontSize:12,color:'var(--text-muted)'}}>
                  ✓ {passCount} Pass · ✗ {failCount} Fail · — {naCount} N/A
                </div>

                {/* نقاط الفحص */}
                {inspectionItems.length > 0 && (
                  <>
                    <div style={{fontSize:11,fontWeight:700,color:'#185FA5',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:4}}>
                      نقاط الفحص · Inspection Items
                    </div>
                    {inspectionItems.map((item, i) => (
                      <ChecklistItem
                        key={item.id}
                        item={item}
                        index={i + 1}
                        result={checklistResults[item.id]?.result || 'pending'}
                        hasNote={checklistResults[item.id]?.notes}
                        editingNote={editingNote}
                        onResult={(id, text, r) => saveChecklistResult(id, text, r)}
                        onToggleNote={(id) => setEditingNote(editingNote === id ? null : id)}
                        onSaveNote={saveNote}
                      />
                    ))}
                  </>
                )}

                {/* التوصيات */}
                {recommendationItems.length > 0 && (
                  <div style={{marginTop:16}}>
                    <div style={{
                      fontSize:11, fontWeight:700, color:'#854F0B',
                      textTransform:'uppercase', letterSpacing:'0.5px',
                      marginBottom:4, display:'flex', alignItems:'center', gap:6
                    }}>
                      <span style={{background:'#FAEEDA',borderRadius:4,padding:'2px 8px'}}>
                        ⚠️ توصيات ما بعد الصب · Recommendations
                      </span>
                    </div>
                    <div style={{background:'#FFFBF5',borderRadius:8,border:'0.5px solid #F0D9B5',padding:'0 12px',marginTop:6}}>
                      {recommendationItems.map((item, i) => (
                        <ChecklistItem
                          key={item.id}
                          item={item}
                          index={i + 1}
                          result={checklistResults[item.id]?.result || 'pending'}
                          hasNote={checklistResults[item.id]?.notes}
                          editingNote={editingNote}
                          onResult={(id, text, r) => saveChecklistResult(id, text, r)}
                          onToggleNote={(id) => setEditingNote(editingNote === id ? null : id)}
                          onSaveNote={saveNote}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <div className="page-header">
        <SectionHelp
          title="Site Visits — تقارير زيارات الموقع"
          description="كل مرة تزور الموقع سجّل تقريراً هنا. اكتب ملاحظاتك وحدد درجة الخطورة. هذا التقرير يُرسل للعميل ويحفظ كسجل رسمي للمشروع."
          steps={['اختر المشروع', 'اضغط New Visit', 'سجّل ملاحظاتك وحدد الخطورة', 'اطبع التقرير PDF من صفحة Reports']}
          color="#0F6E56" bg="#E1F5EE"
        />
        <div><h3>Site Visits</h3><div className="page-sub">{visits.length} visits · {draftCount} draft · {approvedCount} approved</div></div>
        <button className="btn btn-primary" onClick={openNew} disabled={!selectedProject}>+ New Visit</button>
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
            <input autoFocus className="form-input"
              style={{width:'100%',borderRadius:0,borderLeft:'none',borderRight:'none',borderTop:'none',borderBottom:'0.5px solid var(--border)',boxSizing:'border-box',fontSize:13}}
              placeholder="ابحث باسم المشروع أو الرقم..."
              value={projectSearch} onChange={e=>setProjectSearch(e.target.value)}
            />
            <div style={{maxHeight:260,overflowY:'auto'}}>
              {filteredProjects.length === 0
                ? <div style={{padding:'10px 14px',fontSize:13,color:'var(--text-muted)'}}>لا توجد نتائج</div>
                : filteredProjects.map(p => (
                  <div key={p.id}
                    onClick={()=>{setSelectedProject(p);setDropdownOpen(false);setProjectSearch('')}}
                    style={{padding:'9px 14px',fontSize:13,cursor:'pointer',borderBottom:'0.5px solid var(--border)',
                      background:selectedProject?.id===p.id?'#E6F1FB':'transparent',
                      color:selectedProject?.id===p.id?'#0C447C':'var(--text)'}}>
                    <div style={{fontWeight:selectedProject?.id===p.id?500:400,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.name}</div>
                    {p.project_no && <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>{p.project_no}{p.location?` · ${p.location}`:''}</div>}
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
        <>
          <div className="card" style={{marginBottom:16}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12}}>
              <div>
                <div style={{fontWeight:500,fontSize:15}}>{selectedProject.name}</div>
                <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>
                  {selectedProject.project_no} · {selectedProject.location||'—'} · {selectedProject.client_name||'—'}
                </div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:16}}>
                <div style={{textAlign:'center'}}>
                  <div style={{fontSize:22,fontWeight:500,color:'#185FA5'}}>{visits.length}</div>
                  <div style={{fontSize:11,color:'var(--text-muted)'}}>Total Visits</div>
                </div>
                <div style={{textAlign:'center'}}>
                  <div style={{fontSize:22,fontWeight:500,color:'#0F6E56'}}>{approvedCount}</div>
                  <div style={{fontSize:11,color:'var(--text-muted)'}}>Approved</div>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            {loading ? <div style={{color:'var(--text-muted)',padding:16}}>Loading...</div> :
              visits.length === 0 ? (
                <div className="empty">
                  <p>No visits yet for this project.</p>
                  <button className="btn btn-primary" style={{marginTop:12}} onClick={openNew}>+ New Visit</button>
                </div>
              ) : (
                <table className="table">
                  <thead><tr>
                    <th>Date</th>
                    <th>Engineer</th>
                    <th>Notes</th>
                    <th>Severity</th>
                    <th>Status</th>
                    <th></th>
                  </tr></thead>
                  <tbody>
                    {visits.map(v=>(
                      <tr key={v.id}>
                        <td style={{fontWeight:500}}>{v.visit_date}</td>
                        <td style={{color:'var(--text-muted)',fontSize:12}}>{v.engineer_name||'—'}</td>
                        <td style={{color:'var(--text-muted)',fontSize:12,maxWidth:220}}>
                          <div style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{v.notes||'—'}</div>
                          {/* سجلّ بلا أصل في الخطة — يظهر ليُعالَج لا ليُنسى */}
                          {!v.project_visit_id && (
                            <span title="غير مرتبط بزيارة في الخطة — لن يُنظَّف تلقائياً"
                              style={{display:'inline-block',marginTop:3,background:'#FAEEDA',color:'#854F0B',
                                      fontSize:10,fontWeight:700,padding:'1px 7px',borderRadius:10}}>
                              خارج الخطة
                            </span>
                          )}
                        </td>
                        <td><span className={`badge ${SEV_COLOR[v.severity]||'badge-gray'}`}>{v.severity}</span></td>
                        <td><span className={`badge ${v.status==='approved'?'badge-done':v.status==='submitted'?'badge-progress':'badge-gray'}`}>{v.status}</span></td>
                        <td><div style={{display:'flex',gap:6}}>
                          <button className="btn btn-sm" style={{color:'#185FA5',borderColor:'#185FA5'}} onClick={()=>openChecklist(v)}>☑ Check</button>
                          <button className="btn btn-sm" onClick={()=>openEdit(v)}>Edit</button>
                          <button className="btn btn-sm" style={{color:'#A32D2D',borderColor:'#A32D2D'}} onClick={()=>handleDelete(v)}>Delete</button>
                        </div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            }
          </div>
        </>
      )}
    </>
  )
}
