import { useState, useEffect, useRef } from 'react'
import { getProjects, supabase, removeStorageFile } from '../lib/supabase.js'
import { useCurrentUser } from '../hooks/useCurrentUser.js'
import { createRework, markDecision, saveProjectRate, fmtFee } from '../lib/rework.js'
import { useSearchParams } from 'react-router-dom'

// ── Helper: بناء HTML الـ checklist مع فصل التوصيات (للـ PDF) ──────────
function buildChecklistHtml(cl, res) {
  if (!cl.length) return ''
  const inspItems = cl.filter(i => i.item_type !== 'recommendation')
  const recItems  = cl.filter(i => i.item_type === 'recommendation')
  const passCount = Object.values(res).filter(r => r.result === 'pass').length
  const failCount = Object.values(res).filter(r => r.result === 'fail').length
  const naCount   = Object.values(res).filter(r => r.result === 'na').length

  function rowsHtml(items, startIdx = 1) {
    return items.map((item, i) => {
      const r = res[item.id]?.result || 'pending'
      const itemNotes = res[item.id]?.notes || ''
      const color = r==='pass'?'#0F6E56':r==='fail'?'#A32D2D':r==='na'?'#888':'#aaa'
      const label = r==='pass'?'✓ Pass':r==='fail'?'✗ Fail':r==='na'?'— N/A':'○ Pending'
      const rowBg = r==='fail'?'#FFF5F5':i%2===0?'#fafafa':'white'
      return `<tr style="background:${rowBg};">
        <td style="padding:6px 10px;color:#888;">${startIdx + i}</td>
        <td style="padding:6px 10px;"><div>${item.item}</div>${itemNotes?`<div style="font-size:11px;color:#854F0B;background:#FAEEDA;border-radius:4px;padding:2px 8px;margin-top:4px;display:inline-block;">💬 ${itemNotes}</div>`:''}</td>
        <td style="padding:6px 10px;text-align:center;color:${color};font-weight:600;">${label}</td>
      </tr>`
    }).join('')
  }

  const inspHtml = inspItems.length > 0 ? `
    <div style="font-size:11px;font-weight:700;color:#185FA5;text-transform:uppercase;margin-bottom:6px;">نقاط الفحص · Inspection Items</div>
    <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:14px;">
      <thead><tr style="background:#185FA5;color:white;">
        <th style="padding:7px 10px;text-align:left;width:30px;">#</th>
        <th style="padding:7px 10px;text-align:left;">Item — البند</th>
        <th style="padding:7px 10px;text-align:center;width:90px;">Result</th>
      </tr></thead>
      <tbody>${rowsHtml(inspItems, 1)}</tbody>
    </table>` : ''

  const recHtml = recItems.length > 0 ? `
    <div style="background:#FFFBF5;border:0.5px solid #F0D9B5;border-radius:8px;padding:12px 14px;margin-top:4px;">
      <div style="font-size:11px;font-weight:700;color:#854F0B;text-transform:uppercase;margin-bottom:8px;">⚠️ توصيات ما بعد الصب · Post-Pour Recommendations</div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead><tr style="background:#F0D9B5;color:#633806;">
          <th style="padding:6px 10px;text-align:left;width:30px;">#</th>
          <th style="padding:6px 10px;text-align:left;">Recommendation — التوصية</th>
          <th style="padding:6px 10px;text-align:center;width:90px;">Status</th>
        </tr></thead>
        <tbody>${rowsHtml(recItems, 1)}</tbody>
      </table>
    </div>` : ''

  return `
    <div style="margin-bottom:20px;">
      <div style="font-size:11px;font-weight:700;color:#185FA5;text-transform:uppercase;margin-bottom:10px;display:flex;justify-content:space-between;">
        <span>Inspection Checklist — قائمة الفحص</span>
        <span style="font-weight:400;color:#666;">✓ ${passCount} Pass · ✗ ${failCount} Fail · — ${naCount} N/A</span>
      </div>
      ${inspHtml}
      ${recHtml}
    </div>`
}

// ── بند الزيارة الإضافية في تقرير العميل ──────────────────────────────
//  الغرض إثبات أن سبب الزيارة الزائدة هو ما لم يُجتَز في الموقع، لا
//  ترتيب المكتب. فيُذكر أن الزيارة تمّت، وأن الملاحظات وُجدت، وأن
//  إعادة الفحص لازمة — وبقيمتها المتفق عليها.
function buildReworkHtml(rw) {
  if (!rw) return ''
  const stage  = rw.stage_title_ar || rw.stage_title || ''
  const date   = rw.scheduled_date
    ? new Date(rw.scheduled_date).toLocaleDateString('en-GB')
    : 'يُحدَّد لاحقاً'
  const amountCell = rw.chargeable
    ? `<td dir="rtl" style="padding:7px 12px;font-weight:700;color:#A32D2D;">${fmtFee(rw.fee)} د.ب · BHD</td>`
    : `<td style="padding:7px 12px;color:#0F6E56;font-weight:600;">بلا رسوم · No charge${
        rw.fee_waived_reason ? ` — ${rw.fee_waived_reason}` : ''}</td>`

  return `
    <div style="background:#FFF5F5;border:1px solid #E8C4C4;border-radius:8px;padding:14px 18px;margin-bottom:14px;page-break-inside:avoid;break-inside:avoid;">
      <div dir="rtl" style="font-size:11px;font-weight:700;color:#A32D2D;text-transform:uppercase;margin-bottom:8px;text-align:right;">
        ⚠ زيارة إضافية مطلوبة · Additional Visit Required
      </div>
      <div dir="rtl" lang="ar" style="font-size:12.5px;line-height:1.7;margin-bottom:10px;text-align:right;">
        تمّت الزيارة وأُجري الفحص في التاريخ المذكور أعلاه، و<strong>لم تجتز
        المرحلة الفحص</strong>: وُجدت <strong>${rw.parent_fails || 0} ملاحظة</strong>
        غير مطابقة في «${stage}» (مبيّنة في قائمة الفحص أعلاه).
        يلزم على المقاول معالجتها، ثم <strong>زيارة أخرى للمهندس</strong>
        لإعادة الفحص — وهي زيارة خارج زيارات العقد.
      </div>
      <div dir="rtl" lang="ar" style="font-size:12px;line-height:1.7;margin-bottom:10px;background:#fff;border-radius:6px;padding:9px 12px;text-align:right;">
        <strong>الرسوم تُدفع مسبقاً</strong> قبل تحديد موعد الزيارة.
        <span dir="ltr" style="color:#666;">· The fee is payable in advance before the visit is scheduled.</span>
      </div>
      <table dir="rtl" style="width:100%;border-collapse:collapse;font-size:12px;background:#fff;border-radius:6px;overflow:hidden;text-align:right;">
        <tr style="background:#fafafa;">
          <td style="padding:7px 12px;font-weight:700;width:38%;">المرحلة · Stage</td>
          <td dir="rtl" style="padding:7px 12px;">${stage}</td>
        </tr>
        <tr>
          <td style="padding:7px 12px;font-weight:700;">موعد الإعادة · Date</td>
          <td dir="ltr" style="padding:7px 12px;text-align:right;">${date}</td>
        </tr>
        <tr style="background:#fafafa;">
          <td style="padding:7px 12px;font-weight:700;">المبلغ · Amount</td>
          ${amountCell}
        </tr>
      </table>
    </div>`
}

export function Reports() {
  // تقرير الزيارة المختارة وحالة تسليمه للعميل
  const [existingReport, setExistingReport] = useState(null)
  // الزيارة الإضافية المرتبطة بمرحلة هذه الزيارة — تظهر بنداً في التقرير
  const [rework, setRework] = useState(null)
  const [parentVisit, setParentVisit] = useState(null)   // صفّ الخطة
  const [askRework, setAskRework] = useState(false)      // نافذة السؤال
  const [askedRework, setAskedRework] = useState(false)  // سُئل في هذه الجلسة
  const [rwFee, setRwFee] = useState('')
  const [rwNote, setRwNote] = useState('')
  const [rwErr, setRwErr] = useState('')
  const [sending, setSending] = useState('')
  const { user: me } = useCurrentUser()

  const [projects, setProjects] = useState([])
  const [selectedProject, setSelectedProject] = useState(null)
  const [visits, setVisits] = useState([])
  const [selectedVisit, setSelectedVisit] = useState(null)
  const [checklist, setChecklist] = useState([])
  const [checklistResults, setChecklistResults] = useState({})
  const [photos, setPhotos] = useState([])
  const [projectSearch, setProjectSearch] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [generatingFull, setGeneratingFull] = useState(false)
  const [notes, setNotes] = useState('')
  const dropdownRef = useRef(null)
  const [searchParams] = useSearchParams()

  useEffect(() => { loadProjects() }, [])
  useEffect(() => { if (selectedProject) loadVisits(selectedProject.id) }, [selectedProject])
  useEffect(() => { if (selectedVisit) loadVisitData(selectedVisit) }, [selectedVisit])

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
      // القدوم من تنبيه اللوحة يفتح على المشروع المقصود
      const wanted = searchParams.get('project')
      const match = wanted ? (p || []).find(x => x.id === wanted) : null
      if (match) setSelectedProject(match)
      else if (p?.length) setSelectedProject(p[0])
    } catch(e) { console.error(e) } finally { setLoading(false) }
  }

  async function loadVisits(projectId) {
    const { data } = await supabase
      .from('site_visits').select('*').eq('project_id', projectId)
      .order('visit_date', { ascending: true })
    setVisits(data || [])
    if (data?.length) setSelectedVisit(data[data.length - 1])
  }

  // التقرير السابق لهذه الزيارة — وجوده يمنع إنشاء نسخة مكرّرة
  async function loadReportFor(visitId) {
    if (!visitId) { setExistingReport(null); return }
    const { data, error } = await supabase.from('reports')
      .select('*').eq('visit_id', visitId)
      .order('created_at', { ascending: false }).limit(1)
    if (error) { console.error('تعذّر جلب التقرير:', error.message); return }
    setExistingReport(data?.[0] || null)
  }

  // رقم الجوال البحريني يُخزَّن بثماني خانات — واتساب يحتاج رمز الدولة
  function waNumber(raw) {
    const d = String(raw || '').replace(/\D/g, '')
    if (!d) return ''
    if (d.startsWith('973')) return d
    if (d.length === 8) return '973' + d
    return d
  }

  async function sendViaWhatsapp() {
    const rep = existingReport
    if (!rep) return alert('أصدر التقرير أولاً.')
    const phone = waNumber(selectedProject?.client_phone)
    if (!phone) return alert('لا يوجد رقم جوال للعميل في بيانات المشروع.')

    const lines = [
      `تقرير زيارة موقع — مكتب ركاز للهندسة`,
      `المشروع: ${selectedProject?.name || ''}`,
      `رقم التقرير: ${rep.report_no}`,
      rep.pdf_path ? `\nرابط التقرير:\n${rep.pdf_path}` : ''
    ].filter(Boolean).join('\n')

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(lines)}`, '_blank')

    // يُسجَّل كإرسال عبر واتساب — الفتح لا يضمن الضغط على إرسال،
    // لكنه أدق بكثير من عدم وجود أي سجل إطلاقاً
    const { error } = await supabase.from('report_deliveries').insert({
      report_id: rep.id, channel: 'whatsapp',
      recipient: '+' + phone, sent_by: me?.id ?? null
    })
    if (error) { alert('تعذّر تسجيل الإرسال: ' + error.message); return }
    await loadReportFor(selectedVisit?.id)
  }

  async function sendViaEmail() {
    const rep = existingReport
    if (!rep) return alert('أصدر التقرير أولاً.')
    const to = (selectedProject?.client_email || '').trim()
    if (!to) return alert('لا يوجد بريد إلكتروني للعميل.\nأضفه من شاشة Projects ثم أعد المحاولة.')

    setSending('email')
    try {
      const { data, error } = await supabase.functions.invoke('send-report', {
        body: { report_id: rep.id, to_email: to }
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      alert('أُرسل التقرير إلى ' + to)
      await loadReportFor(selectedVisit?.id)
    } catch(e) {
      alert('تعذّر إرسال البريد: ' + (e?.message || e))
    } finally { setSending('') }
  }

  async function loadVisitData(visit) {
    loadReportFor(visit?.id)
    const fullNotes = visit.notes?.trim() || ''
    const shortType = visit.notes?.split(' — ')[0]?.trim() || ''
    const { data: allItems } = await supabase.from('inspection_checklists').select('*').order('order_index')
    let clData = null
    if (allItems?.length) {
      const types = [...new Set(allItems.map(i => i.visit_type))]
            // Work type keywords - يشتغل مع أي عدد أدوار
      const WORK_TYPES = [
        'Columns Before Pour', 'Columns After Pour',
        'Roof Slab', 'Ground Floor Beams',
        'Foundation Inspection', 'Site Inspection',
        'Excavation & Backfill', 'Land Demarcation',
        'Finishing Inspection', 'Final Handover'
      ]
      const detectedWorkType = WORK_TYPES.find(wt =>
        shortType.toLowerCase().includes(wt.toLowerCase()) ||
        fullNotes.toLowerCase().includes(wt.toLowerCase())
      )
      const bestMatch =
        types.find(t => t === fullNotes) ||
        types.find(t => t === shortType) ||
        (detectedWorkType && types.find(t => t.toLowerCase().includes(detectedWorkType.toLowerCase()))) ||
        types.find(t => fullNotes.toLowerCase().includes(t.toLowerCase())) ||
        types.find(t => t.toLowerCase().includes(shortType.toLowerCase())) ||
        types.find(t => shortType.toLowerCase().includes(t.split(' — ')[0]?.toLowerCase()))
      if (bestMatch) clData = allItems.filter(i => i.visit_type === bestMatch)
    }
    const [{ data: results }, { data: ph }, { data: rw }] = await Promise.all([
      supabase.from('visit_checklist_results').select('*').eq('visit_id', visit.id),
      supabase.from('visit_photos').select('*').eq('visit_id', visit.id),
      // الزيارة الإضافية المرتبطة بهذه المرحلة، إن أُنشئت
      visit.project_visit_id
        ? supabase.from('project_extra_visits').select('*')
            .eq('parent_visit_id', visit.project_visit_id).maybeSingle()
        : Promise.resolve({ data: null })
    ])
    setRework(rw || null)
    setAskedRework(false); setRwNote(''); setRwErr('')

    // صفّ الخطة نفسه — عليه قرار الإعادة، ومنه أجر المشروع
    if (visit.project_visit_id) {
      const { data: pv } = await supabase.from('project_visits')
        .select('*').eq('id', visit.project_visit_id).maybeSingle()
      setParentVisit(pv || null)
    } else setParentVisit(null)
    setChecklist(clData || [])
    setNotes(visit.notes || '')
    const resultsMap = {}
    ;(results || []).forEach(r => { resultsMap[r.checklist_item_id] = r })
    setChecklistResults(resultsMap)
    setPhotos(ph || [])
  }

  async function saveChecklistResult(itemId, itemText, result) {
    if (!selectedVisit) return
    const existing = checklistResults[itemId]
    try {
      if (existing) {
        const { error: updErr } = await supabase.from('visit_checklist_results').update({ result }).eq('id', existing.id)
        if (updErr) throw updErr
      } else {
        const { data, error: insErr } = await supabase.from('visit_checklist_results').insert({
          visit_id: selectedVisit.id, checklist_item_id: itemId, item_text: itemText, result
        }).select().single()
        if (insErr) throw insErr
        if (data) { setChecklistResults(prev => ({ ...prev, [itemId]: data })); return }
      }
    } catch(e) { alert('تعذّر حفظ نتيجة الفحص: ' + e.message); return }
    setChecklistResults(prev => ({
      ...prev,
      [itemId]: { ...(prev[itemId] || { checklist_item_id: itemId, item_text: itemText }), result }
    }))
  }

  function getPhotoUrl(path) {
    const { data } = supabase.storage.from('Rekaz').getPublicUrl(path)
    return data.publicUrl
  }

  // ── Single visit report ──────────────────────────────────────────────
  // ── قرار الإعادة قبل إصدار التقرير ────────────────────────────────
  // لحظة إصدار التقرير هي لحظة الحكم على الزيارة، فهي أنسب موضع
  // للسؤال — والتقرير نفسه هو ما يُبلَّغ به العميل.
  const failNow = Object.values(checklistResults).filter(r => r.result === 'fail').length
  const needsDecision = failNow > 0 && !rework && parentVisit
    && parentVisit.rework_decision !== 'not_needed'

  // «نعم» — تُنشأ زيارة إعادة بأجر ويُدرج بندها في التقرير
  async function reworkYes() {
    const fee = parseFloat(rwFee)
    if (!(fee > 0)) { setRwErr('أدخل أجر الزيارة الإضافية.'); return }
    setRwErr(''); setSaving(true)
    try {
      await createRework(parentVisit, { fee, chargeable: true, fails: failNow })
      if (selectedProject?.visit_fee == null) await saveProjectRate(selectedProject.id, fee)
      const { data: rw } = await supabase.from('project_extra_visits')
        .select('*').eq('parent_visit_id', parentVisit.id).maybeSingle()
      setRework(rw || null)
      setAskRework(false); setAskedRework(true)
      setSaving(false)
      await generateReport(rw || null)
    } catch (e) {
      setSaving(false); setRwErr(e?.message ?? String(e))
    }
  }

  // «لا» — يُسجَّل القرار بسببه، ويصدر التقرير بلا بند إعادة
  async function reworkNo() {
    if (!rwNote.trim()) { setRwErr('اذكر سبب عدم لزوم الإعادة.'); return }
    setRwErr(''); setSaving(true)
    try {
      await markDecision(parentVisit.id, 'not_needed', rwNote)
      setParentVisit(p => ({ ...p, rework_decision:'not_needed', rework_decision_note: rwNote }))
      setAskRework(false); setAskedRework(true)
      setSaving(false)
      await generateReport(null)
    } catch (e) {
      setSaving(false); setRwErr('تعذّر الحفظ: ' + (e?.message ?? e))
    }
  }

  // القرار يُمرَّر صراحةً لا عبر الحالة: بعد إنشاء الإعادة مباشرة لم
  // تكن الحالة قد تحدّثت بعد، فيصدر التقرير بلا البند.
  //
  // الحارس أدناه ليس تزيّداً: حين كان الزر مربوطاً onClick={generateReport}
  // مرّر React حدث النقر في موضع هذا الوسيط، وكائن الحدث ليس فيه أيٌّ من
  // الحقول، فطُبع البند بـ«٠ ملاحظة» ومرحلة فارغة و«بلا رسوم».
  const isEvent = x => !!x && typeof x === 'object' && ('nativeEvent' in x || 'preventDefault' in x)

  async function generateReport(rwArg) {
    if (!selectedVisit || !selectedProject) return
    if (needsDecision && !askedRework) {
      setRwFee(selectedProject?.visit_fee != null ? String(selectedProject.visit_fee) : '')
      setRwErr(''); setAskRework(true); return
    }
    const rw = (rwArg === undefined || isEvent(rwArg)) ? rework : rwArg
    // تنبيه إذا في نقاط لم تُحدد
    const pendingCount = checklist.filter(i => !checklistResults[i.id] || checklistResults[i.id].result === 'pending').length
    if (pendingCount > 0) {
      const proceed = confirm(`⚠️ تنبيه: يوجد ${pendingCount} نقطة لم يتم تحديد نتيجتها بعد.

هل تريد المتابعة وطباعة التقرير؟`)
      if (!proceed) return
    }
    setSaving(true)
    try {
      // إعادة إصدار التقرير لنفس الزيارة تُحدّث السجل القائم بدل إنشاء
      // نسخة جديدة. الإصدار المتكرر أنتج ١٢٢ سجلاً لـ٧٨ زيارة فقط،
      // و٢١ زيارة صار لها أكثر من تقرير بلا سبب.
      const reportNo = existingReport?.report_no
        || `SVR-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`
      const today = new Date().toLocaleDateString('en-GB')
      const photoHtml = photos.map(ph => `
        <div style="break-inside:avoid;margin-bottom:12px;">
          <img src="${getPhotoUrl(ph.file_path)}" style="width:100%;max-height:200px;object-fit:cover;border-radius:6px;border:0.5px solid #eee;"/>
          ${ph.caption ? `<div style="font-size:11px;color:#666;margin-top:4px;text-align:center;">${ph.caption}</div>` : ''}
        </div>`).join('')
      const checklistHtml = buildChecklistHtml(checklist, checklistResults)
      const html = buildSingleHtml({ reportNo, today, project: selectedProject, visit: selectedVisit, checklistHtml, photoHtml, photos, rw })

      // أرشفة نسخة ثابتة من التقرير في التخزين وربطها بالسجل، حتى
      // يمكن فتح التقرير لاحقاً كما صدر. سابقاً كان عمود pdf_path
      // يبقى فارغاً دائماً فلا يمكن استرجاع أي تقرير بعد طباعته.
      const archiveUrl = await archiveReport(reportNo, html)

      const { data: auth } = await supabase.auth.getUser()

      if (existingReport) {
        const { error: updErr } = await supabase.from('reports')
          .update({ pdf_path: archiveUrl, generated_by: auth?.user?.id ?? null })
          .eq('id', existingReport.id)
        if (updErr) throw updErr
      } else {
        const { error: insErr } = await supabase.from('reports').insert({
          report_no: reportNo,
          visit_id: selectedVisit.id,
          project_id: selectedProject.id,
          pdf_path: archiveUrl,
          generated_by: auth?.user?.id ?? null
        })
        if (insErr) {
          if (archiveUrl) await removeStorageFile(archiveUrl)
          throw insErr
        }
      }
      await loadReportFor(selectedVisit.id)

      const w = window.open('', '_blank')
      if (!w) { alert('تعذّر فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة لهذا الموقع ثم أعد المحاولة.'); return }
      w.document.write(html)
      w.document.close(); w.focus()
      setTimeout(() => { w.print() }, 800)
    } catch(e) { alert('Error: ' + e.message) } finally { setSaving(false) }
  }

  // أرشفة التقرير في التخزين. اختيارية — لو فشلت لا نمنع إصدار
  // التقرير، فالطباعة أهم من الأرشفة.
  async function archiveReport(reportNo, html) {
    try {
      const path = `reports/${reportNo}.html`
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
      const { error } = await supabase.storage.from('Rekaz')
        .upload(path, blob, { contentType: 'text/html;charset=utf-8', upsert: true })
      if (error) throw error

      // لا نُرجع رابط التخزين المباشر: تخزين Supabase يقدّم ملفات .html
      // بترويسة نص عادي، فيراها العميل شيفرة خام والعربية مشوّهة.
      // الدالة report تقرأ الملف نفسه وتعيده بترويسة text/html صحيحة.
      // الرابط يشير لنطاق التطبيق على Vercel لا لـ Supabase: تخزين
      // Supabase ودوالّه يفرضان ترويسة text/plain، فيرى العميل شيفرة
      // خام وعربية مشوّهة. تحققنا من الترويسة فعلياً في الحالتين.
      return `${window.location.origin}/r/${encodeURIComponent(reportNo)}`
    } catch(e) {
      console.error('تعذّرت أرشفة التقرير:', e?.message || e)
      return null
    }
  }

  // ── Full project report ──────────────────────────────────────────────
  async function generateFullReport() {
    if (!selectedProject || visits.length === 0) return
    setGeneratingFull(true)
    try {
      const today = new Date().toLocaleDateString('en-GB')
      const reportNo = `PR-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`
      const { data: allItems } = await supabase.from('inspection_checklists').select('*').order('order_index')
      const types = allItems?.length ? [...new Set(allItems.map(i => i.visit_type))] : []

      const visitsData = await Promise.all(visits.map(async (v) => {
        const fullNotes = v.notes?.trim() || ''
        const shortType = v.notes?.split(' — ')[0]?.trim() || ''
        const WORK_TYPES = [
          'Columns Before Pour', 'Columns After Pour',
          'Roof Slab', 'Ground Floor Beams',
          'Foundation Inspection', 'Site Inspection',
          'Excavation & Backfill', 'Land Demarcation',
          'Finishing Inspection', 'Final Handover'
        ]
        const detectedWorkType = WORK_TYPES.find(wt =>
          shortType.toLowerCase().includes(wt.toLowerCase()) ||
          fullNotes.toLowerCase().includes(wt.toLowerCase())
        )
        const bestMatch = allItems?.length ? (
          types.find(t => t === fullNotes) ||
          types.find(t => t === shortType) ||
          (detectedWorkType && types.find(t => t.toLowerCase().includes(detectedWorkType.toLowerCase()))) ||
          types.find(t => fullNotes.toLowerCase().includes(t.toLowerCase())) ||
          types.find(t => t.toLowerCase().includes(shortType.toLowerCase()))
        ) : null
        const clData = bestMatch ? allItems.filter(i => i.visit_type === bestMatch) : []
        const [{ data: results }, { data: ph }] = await Promise.all([
          supabase.from('visit_checklist_results').select('*').eq('visit_id', v.id),
          supabase.from('visit_photos').select('*').eq('visit_id', v.id)
        ])
        const resultsMap = {}
        ;(results || []).forEach(r => { resultsMap[r.checklist_item_id] = r })
        return { visit: v, checklist: clData, results: resultsMap, photos: ph || [] }
      }))

      const visitsHtml = visitsData.map(({ visit: v, checklist: cl, results: res, photos: ph }, idx) => {
        const statusColor = v.status === 'approved' ? '#0F6E56' : v.status === 'submitted' ? '#185FA5' : '#888'

        // فصل الفحص والتوصيات في الـ Full Report
        const inspItems = cl.filter(i => i.item_type !== 'recommendation')
        const recItems  = cl.filter(i => i.item_type === 'recommendation')
        const passCount = Object.values(res).filter(r => r.result === 'pass').length
        const failCount = Object.values(res).filter(r => r.result === 'fail').length
        const naCount   = Object.values(res).filter(r => r.result === 'na').length

        function miniRows(items) {
          return items.map((item, i) => {
            const r = res[item.id]?.result || 'pending'
            const itemNotes = res[item.id]?.notes || ''
            const color = r==='pass'?'#0F6E56':r==='fail'?'#A32D2D':r==='na'?'#888':'#aaa'
            const label = r==='pass'?'✓':r==='fail'?'✗':r==='na'?'—':'○'
            const rowBg = r==='fail'?'#FFF5F5':i%2===0?'#fafafa':'white'
            return `<tr style="background:${rowBg};">
              <td style="padding:4px 8px;color:#888;">${i+1}</td>
              <td style="padding:4px 8px;">${item.item}${itemNotes?`<span style="font-size:10px;color:#854F0B;margin-right:6px;"> 💬 ${itemNotes}</span>`:''}</td>
              <td style="padding:4px 8px;text-align:center;color:${color};font-weight:600;">${label}</td>
            </tr>`
          }).join('')
        }

        const clHtml = cl.length > 0 ? `
          ${inspItems.length > 0 ? `
            <div style="font-size:10px;font-weight:700;color:#185FA5;text-transform:uppercase;margin:10px 0 4px;">نقاط الفحص</div>
            <table style="width:100%;border-collapse:collapse;font-size:11px;">
              <thead><tr style="background:#185FA5;color:white;">
                <th style="padding:5px 8px;text-align:left;width:24px;">#</th>
                <th style="padding:5px 8px;text-align:left;">Item</th>
                <th style="padding:5px 8px;text-align:center;width:50px;">Result</th>
              </tr></thead>
              <tbody>${miniRows(inspItems)}</tbody>
            </table>
            <div style="font-size:10px;color:#666;margin-top:4px;">✓ ${passCount} Pass · ✗ ${failCount} Fail · — ${naCount} N/A</div>
          ` : ''}
          ${recItems.length > 0 ? `
            <div style="background:#FFFBF5;border:0.5px solid #F0D9B5;border-radius:6px;padding:8px 10px;margin-top:8px;">
              <div style="font-size:10px;font-weight:700;color:#854F0B;margin-bottom:6px;">⚠️ توصيات ما بعد الصب</div>
              <table style="width:100%;border-collapse:collapse;font-size:11px;">
                <tbody>${miniRows(recItems)}</tbody>
              </table>
            </div>
          ` : ''}
        ` : '<div style="font-size:11px;color:#aaa;margin-top:8px;">No checklist for this visit type.</div>'

        const phHtml = ph.length > 0 ? `
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:10px;">
            ${ph.map(p => `<img src="${getPhotoUrl(p.file_path)}" style="width:100%;height:80px;object-fit:cover;border-radius:4px;"/>`).join('')}
          </div>` : ''

        return `
          <div style="break-inside:avoid;border:0.5px solid #ddd;border-radius:8px;padding:16px;margin-bottom:16px;background:white;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
              <div>
                <div style="font-size:13px;font-weight:700;color:#185FA5;">${idx+1}. ${v.notes?.split(' — ')[0] || 'Site Visit'}</div>
                ${v.notes?.includes(' — ') ? `<div style="font-size:11px;color:#888;">${v.notes.split(' — ')[1]||''}</div>` : ''}
              </div>
              <div style="text-align:right;">
                <div style="font-size:12px;font-weight:500;">${v.visit_date}</div>
                <div style="font-size:11px;color:${statusColor};margin-top:2px;">${v.status}</div>
              </div>
            </div>
            ${v.engineer_name ? `<div style="font-size:11px;color:#666;margin-bottom:8px;">👷 ${v.engineer_name}</div>` : ''}
            ${clHtml}
            ${phHtml}
          </div>`
      }).join('')

      const completedCount = visits.filter(v => v.status === 'approved' || v.status === 'completed').length
      const pct = visits.length ? Math.round(completedCount / visits.length * 100) : 0

      const w = window.open('', '_blank')
      if (!w) { alert('تعذّر فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة لهذا الموقع ثم أعد المحاولة.'); return }
      w.document.write(`<!DOCTYPE html>
        <html><head><meta charset="UTF-8"><title>Project Report - ${selectedProject.name}</title>
        <style>* {box-sizing:border-box;margin:0;padding:0;} body {font-family:Arial,sans-serif;padding:36px;color:#111;font-size:13px;} @media print {body {padding:20px;} .no-print {display:none !important;}}</style>
        </head><body>
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #185FA5;padding-bottom:16px;margin-bottom:20px;">
          <div><img src="/rekaz-logo.jpg" style="height:44px;width:auto;" onerror="this.style.display='none'"/><div style="font-size:11px;color:#888;margin-top:4px;">مكتب ركاز للهندسة</div></div>
          <div style="text-align:right;">
            <div style="font-size:18px;font-weight:700;color:#185FA5;">تقرير المشروع الشامل</div>
            <div style="font-size:12px;color:#888;">Full Project Report · ${reportNo}</div>
            <div style="font-size:11px;color:#aaa;margin-top:2px;">${today}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px;">
          <div style="background:#f5f5f0;border-radius:8px;padding:14px;">
            <div style="font-size:11px;font-weight:700;color:#185FA5;text-transform:uppercase;margin-bottom:10px;">معلومات المشروع</div>
            <div style="margin-bottom:6px;"><div style="font-size:10px;color:#888;">Project Name</div><div style="font-weight:500;">${selectedProject.name}</div></div>
            <div style="margin-bottom:6px;"><div style="font-size:10px;color:#888;">Project No</div><div style="font-weight:500;">${selectedProject.project_no||'—'}</div></div>
            <div style="margin-bottom:6px;"><div style="font-size:10px;color:#888;">Location</div><div style="font-weight:500;">${selectedProject.location||'—'}</div></div>
            <div><div style="font-size:10px;color:#888;">Client</div><div style="font-weight:500;">${selectedProject.client_name||'—'}</div></div>
          </div>
          <div style="background:#E6F1FB;border-radius:8px;padding:14px;">
            <div style="font-size:11px;font-weight:700;color:#185FA5;text-transform:uppercase;margin-bottom:10px;">ملخص الزيارات</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:8px;">
              <div style="text-align:center;background:white;border-radius:6px;padding:10px;"><div style="font-size:22px;font-weight:700;color:#185FA5;">${visits.length}</div><div style="font-size:10px;color:#888;">Total Visits</div></div>
              <div style="text-align:center;background:white;border-radius:6px;padding:10px;"><div style="font-size:22px;font-weight:700;color:#0F6E56;">${completedCount}</div><div style="font-size:10px;color:#888;">Completed</div></div>
            </div>
            <div style="margin-top:12px;">
              <div style="height:6px;background:#ddd;border-radius:3px;overflow:hidden;"><div style="height:100%;background:#185FA5;width:${pct}%;border-radius:3px;"></div></div>
              <div style="font-size:10px;color:#888;margin-top:4px;text-align:center;">${pct}% Complete</div>
            </div>
          </div>
        </div>
        <div style="font-size:12px;font-weight:700;color:#185FA5;text-transform:uppercase;margin-bottom:12px;border-bottom:1px solid #eee;padding-bottom:8px;">
          تفاصيل الزيارات · Site Visits (${visits.length})
        </div>
        ${visitsHtml}
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:30px;margin-top:48px;">
          <div style="text-align:center;"><div style="border-top:1.5px solid #333;padding-top:8px;margin-top:48px;font-size:12px;">المهندس المشرف · Engineer<div style="font-size:11px;color:#888;margin-top:3px;">${selectedProject.engineer_name||'—'}</div></div></div>
          <div style="text-align:center;"><div style="border-top:1.5px solid #333;padding-top:8px;margin-top:48px;font-size:12px;">المقاول · Contractor<div style="font-size:11px;color:#888;margin-top:3px;">${selectedProject.contractor_name||'—'}</div></div></div>
          <div style="text-align:center;"><div style="border-top:1.5px solid #333;padding-top:8px;margin-top:48px;font-size:12px;">المالك · Client<div style="font-size:11px;color:#888;margin-top:3px;">${selectedProject.client_name||'—'}</div></div></div>
        </div>
        <div style="border-top:1px solid #eee;margin-top:28px;padding-top:10px;text-align:center;font-size:10px;color:#bbb;">مكتب ركاز للهندسة · Rekaz Engineering Office · 📞 17666882 · 📱 32277704 · ${today}</div>
        <div class="no-print" style="position:fixed;top:12px;right:12px;display:flex;gap:8px;z-index:999;">
          <button onclick="window.print()" style="background:#185FA5;color:white;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;">🖨 Print</button>
          <button onclick="window.close()" style="background:#f5f5f0;color:#333;border:1px solid #ddd;padding:10px 20px;border-radius:8px;cursor:pointer;font-size:14px;">✕ Close</button>
        </div>
        </body></html>`)
      w.document.close(); w.focus()
      setTimeout(() => { w.print() }, 1000)
    } catch(e) { alert('Error: ' + e.message) } finally { setGeneratingFull(false) }
  }

  function buildSingleHtml({ reportNo, today, project, visit, checklistHtml, photoHtml, photos, rw }) {
    return `<!DOCTYPE html>
      <html><head><meta charset="UTF-8"><title>Site Visit Report - ${reportNo}</title>
      <style>* {box-sizing:border-box;margin:0;padding:0;} body {font-family:Arial,sans-serif;padding:36px;color:#111;font-size:13px;} .info-row {display:flex;flex-direction:column;gap:2px;margin-bottom:6px;} .info-label {font-size:10px;color:#888;text-transform:uppercase;} .info-value {font-size:13px;font-weight:500;} @media print {body {padding:20px;} .no-print {display:none !important;}}</style>
      </head><body>
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #185FA5;padding-bottom:16px;margin-bottom:20px;">
        <div><img src="/rekaz-logo.jpg" style="height:44px;width:auto;" onerror="this.style.display='none'"/><div style="font-size:11px;color:#888;margin-top:4px;">مكتب ركاز للهندسة</div></div>
        <div style="text-align:right;"><div style="font-size:18px;font-weight:700;color:#185FA5;">تقرير زيارة موقع</div><div style="font-size:12px;color:#888;">Site Visit Report · ${reportNo}</div><div style="font-size:11px;color:#aaa;margin-top:2px;">${today}</div></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">
        <div style="background:#f5f5f0;border-radius:8px;padding:14px 18px;">
          <div style="font-size:11px;font-weight:700;color:#185FA5;text-transform:uppercase;margin-bottom:10px;">معلومات المشروع · Project</div>
          <div class="info-row"><div class="info-label">Project Name</div><div class="info-value">${project.name}</div></div>
          <div class="info-row"><div class="info-label">Project No</div><div class="info-value">${project.project_no}</div></div>
          <div class="info-row"><div class="info-label">Location</div><div class="info-value">${project.location||'—'}</div></div>
        </div>
        <div style="background:#E6F1FB;border-radius:8px;padding:14px 18px;">
          <div style="font-size:11px;font-weight:700;color:#185FA5;text-transform:uppercase;margin-bottom:10px;">معلومات الزيارة · Visit</div>
          <div class="info-row"><div class="info-label">Visit Date</div><div class="info-value">${visit.visit_date}</div></div>
          <div class="info-row"><div class="info-label">Engineer</div><div class="info-value">${visit.engineer_name||'—'}</div></div>
          <div class="info-row"><div class="info-label">Visit Type</div><div class="info-value">${visit.notes?.split(' — ')[0]||'—'}</div></div>
          <div class="info-row"><div class="info-label">Severity</div><div class="info-value">${visit.severity||'—'}</div></div>
        </div>
      </div>
      ${visit.notes?`<div style="background:#fafafa;border:0.5px solid #eee;border-radius:8px;padding:14px 18px;margin-bottom:14px;"><div style="font-size:11px;font-weight:700;color:#185FA5;text-transform:uppercase;margin-bottom:8px;">الملاحظات · Notes</div><div style="font-size:13px;line-height:1.6;">${visit.notes}</div></div>`:''}
      ${checklistHtml}
      ${buildReworkHtml(rw)}
      ${photos.length>0?`<div style="margin-bottom:20px;"><div style="font-size:11px;font-weight:700;color:#185FA5;text-transform:uppercase;margin-bottom:10px;">الصور · Photos (${photos.length})</div><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">${photoHtml}</div></div>`:''}
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:30px;margin-top:48px;">
        <div style="text-align:center;"><div style="border-top:1.5px solid #333;padding-top:8px;margin-top:48px;font-size:12px;">المهندس المشرف · Engineer<div style="font-size:11px;color:#888;margin-top:3px;">${project.engineer_name||'—'}</div></div></div>
        <div style="text-align:center;"><div style="border-top:1.5px solid #333;padding-top:8px;margin-top:48px;font-size:12px;">المقاول · Contractor<div style="font-size:11px;color:#888;margin-top:3px;">${project.contractor_name||'—'}</div></div></div>
        <div style="text-align:center;"><div style="border-top:1.5px solid #333;padding-top:8px;margin-top:48px;font-size:12px;">المالك · Client<div style="font-size:11px;color:#888;margin-top:3px;">${project.client_name||'—'}</div></div></div>
      </div>
      <div style="border-top:1px solid #eee;margin-top:28px;padding-top:10px;text-align:center;font-size:10px;color:#bbb;">مكتب ركاز للهندسة · Rekaz Engineering Office · 📞 17666882 · 📱 32277704 · 📷 rekaz.engineeringbh · ${today}</div>
      <div class="no-print" style="position:fixed;top:12px;right:12px;display:flex;gap:8px;z-index:999;">
        <button onclick="window.print()" style="background:#185FA5;color:white;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;">🖨 Print</button>
        <button onclick="window.close()" style="background:#f5f5f0;color:#333;border:1px solid #ddd;padding:10px 20px;border-radius:8px;cursor:pointer;font-size:14px;">✕ Close</button>
      </div>
      </body></html>`
  }

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(projectSearch.toLowerCase()) ||
    (p.project_no||'').toLowerCase().includes(projectSearch.toLowerCase())
  )

  const RESULT_COLORS = { pass:'#0F6E56', fail:'#A32D2D', na:'#888', pending:'#aaa' }
  const RESULT_BG     = { pass:'#E1F5EE', fail:'#FCEBEB', na:'#f5f5f0', pending:'#f5f5f0' }
  const RESULT_LABELS = { pass:'✓ Pass', fail:'✗ Fail', na:'— N/A', pending:'○' }

  // فصل نقاط الفحص عن التوصيات في الـ UI
  const inspectionItems     = checklist.filter(i => i.item_type !== 'recommendation')
  const recommendationItems = checklist.filter(i => i.item_type === 'recommendation')

  return (
    <div>
      <div className="page-header">
        <div><h3>Reports</h3><div className="page-sub">Generate site visit reports</div></div>
        <div style={{display:'flex',gap:8}}>
          {visits.length > 0 && (
            <button className="btn btn-sm" style={{color:'#0F6E56',borderColor:'#0F6E56'}}
              onClick={generateFullReport} disabled={generatingFull}>
              {generatingFull ? 'Generating...' : '📋 Full Project Report'}
            </button>
          )}
          {selectedVisit && (
            <button className="btn btn-primary" onClick={() => generateReport()} disabled={saving}>
              {saving ? 'Generating...' : existingReport ? '📄 إعادة إصدار التقرير' : '📄 Generate PDF Report'}
            </button>
          )}
        </div>
      </div>

      {/* حالة تسليم التقرير للعميل — السؤال الذي لم يكن البرنامج يجيب عليه */}
      {selectedVisit && (
        <div className="card" style={{marginBottom:16,
          border:`1px solid ${existingReport?.last_sent_at ? 'rgba(15,110,86,.3)' : existingReport ? 'rgba(133,79,11,.35)' : 'var(--border)'}`,
          background: existingReport?.last_sent_at ? 'var(--green-light,#E1F5EE)' : existingReport ? 'var(--amber-light)' : 'var(--bg-card)'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12}}>
            <div>
              {!existingReport ? (
                <>
                  <div style={{fontSize:13,fontWeight:600}}>لم يصدر تقرير لهذه الزيارة بعد</div>
                  <div style={{fontSize:11.5,color:'var(--text-muted)',marginTop:2}}>
                    أصدر التقرير أولاً ثم أرسله للعميل
                  </div>
                </>
              ) : existingReport.last_sent_at ? (
                <>
                  <div style={{fontSize:13,fontWeight:600,color:'#0F6E56'}}>
                    ✓ أُرسل للعميل — {existingReport.last_sent_via === 'email' ? 'بريد إلكتروني' : 'واتساب'}
                  </div>
                  <div style={{fontSize:11.5,color:'var(--text-muted)',marginTop:2}}>
                    {existingReport.report_no} · {new Date(existingReport.last_sent_at).toLocaleString('en-GB')}
                  </div>
                </>
              ) : (
                <>
                  <div style={{fontSize:13,fontWeight:600,color:'var(--amber)'}}>
                    ⚠ التقرير صدر ولم يُرسل للعميل
                  </div>
                  <div style={{fontSize:11.5,color:'var(--text-muted)',marginTop:2}}>
                    {existingReport.report_no} · صدر في {new Date(existingReport.created_at).toLocaleDateString('en-GB')}
                  </div>
                </>
              )}
            </div>

            {existingReport && (
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                <button className="btn btn-sm" style={{color:'#0F6E56',borderColor:'#0F6E56'}}
                  onClick={sendViaWhatsapp}>واتساب</button>
                <button className="btn btn-sm" style={{color:'#185FA5',borderColor:'#185FA5'}}
                  onClick={sendViaEmail} disabled={sending==='email'}>
                  {sending==='email' ? 'جارٍ الإرسال…' : 'بريد'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Project Dropdown */}
      <div style={{position:'relative',marginBottom:16,maxWidth:600}} ref={dropdownRef}>
        <button onClick={()=>setDropdownOpen(o=>!o)}
          style={{width:'100%',padding:'9px 14px',border:`0.5px solid ${dropdownOpen?'#185FA5':'var(--border)'}`,borderRadius:dropdownOpen?'8px 8px 0 0':8,background:'var(--bg)',color:'var(--text)',fontSize:13,cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center',textAlign:'left',transition:'border-color 0.15s'}}>
          <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1}}>
            {selectedProject ? selectedProject.name : 'اختر مشروعاً...'}
          </span>
          {selectedProject?.project_no && <span style={{fontSize:11,color:'var(--text-muted)',marginRight:8,marginLeft:8,whiteSpace:'nowrap'}}>{selectedProject.project_no}</span>}
          <span style={{fontSize:10,color:'var(--text-muted)',flexShrink:0}}>{dropdownOpen?'▲':'▼'}</span>
        </button>
        {dropdownOpen && (
          <div style={{position:'absolute',top:'100%',left:0,right:0,background:'var(--bg)',border:'0.5px solid #185FA5',borderTop:'none',borderRadius:'0 0 8px 8px',zIndex:100,boxShadow:'0 4px 16px rgba(0,0,0,0.1)'}}>
            <input autoFocus className="form-input"
              style={{width:'100%',borderRadius:0,borderLeft:'none',borderRight:'none',borderTop:'none',borderBottom:'0.5px solid var(--border)',boxSizing:'border-box',fontSize:13}}
              placeholder="ابحث باسم المشروع أو الرقم..."
              value={projectSearch} onChange={e=>setProjectSearch(e.target.value)}/>
            <div style={{maxHeight:260,overflowY:'auto'}}>
              {filteredProjects.length===0
                ? <div style={{padding:'10px 14px',fontSize:13,color:'var(--text-muted)'}}>لا توجد نتائج</div>
                : filteredProjects.map(p=>(
                  <div key={p.id} onClick={()=>{setSelectedProject(p);setDropdownOpen(false);setProjectSearch('')}}
                    style={{padding:'9px 14px',fontSize:13,cursor:'pointer',borderBottom:'0.5px solid var(--border)',background:selectedProject?.id===p.id?'#E6F1FB':'transparent',color:selectedProject?.id===p.id?'#0C447C':'var(--text)'}}>
                    <div style={{fontWeight:selectedProject?.id===p.id?500:400,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.name}</div>
                    {p.project_no&&<div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>{p.project_no}{p.location?` · ${p.location}`:''}</div>}
                  </div>
                ))
              }
            </div>
            <div style={{padding:'6px 14px',fontSize:11,color:'var(--text-muted)',borderTop:'0.5px solid var(--border)'}}>{filteredProjects.length} مشروع</div>
          </div>
        )}
      </div>

      {selectedProject && (
        <div style={{display:'grid',gridTemplateColumns:'280px 1fr',gap:16}}>
          <div className="card" style={{height:'fit-content'}}>
            <div style={{fontWeight:500,fontSize:13,marginBottom:12,color:'var(--text)'}}>Site Visits ({visits.length})</div>
            {visits.length===0 ? <div style={{color:'var(--text-muted)',fontSize:12}}>No visits yet.</div> :
              visits.map(v=>(
                <div key={v.id} onClick={()=>setSelectedVisit(v)}
                  style={{padding:'10px 12px',borderRadius:8,cursor:'pointer',marginBottom:6,background:selectedVisit?.id===v.id?'var(--blue-light)':'var(--bg)',border:selectedVisit?.id===v.id?'1px solid #185FA540':'1px solid transparent'}}>
                  <div style={{fontWeight:500,fontSize:12,color:selectedVisit?.id===v.id?'#185FA5':'var(--text)'}}>{v.visit_date}</div>
                  <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>{v.notes?.split(' — ')[0]||'Site Visit'}</div>
                  <div style={{fontSize:11,color:'var(--text-muted)'}}>{v.engineer_name||'—'}</div>
                </div>
              ))
            }
          </div>

          {selectedVisit && (
            <div>
              <div className="card" style={{marginBottom:16}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px 24px',fontSize:13}}>
                  <div><span style={{color:'var(--text-muted)'}}>Date: </span><strong>{selectedVisit.visit_date}</strong></div>
                  <div><span style={{color:'var(--text-muted)'}}>Engineer: </span>{selectedVisit.engineer_name||'—'}</div>
                  <div><span style={{color:'var(--text-muted)'}}>Type: </span>{selectedVisit.notes?.split(' — ')[0]||'—'}</div>
                  <div><span style={{color:'var(--text-muted)'}}>Severity: </span>{selectedVisit.severity}</div>
                </div>
                {selectedVisit.notes && <div style={{marginTop:10,padding:'10px 12px',background:'var(--bg)',borderRadius:8,fontSize:12,color:'var(--text-muted)'}}>{selectedVisit.notes}</div>}
              </div>

              {checklist.length > 0 && (
                <div className="card" style={{marginBottom:16}}>
                  <div style={{fontWeight:500,fontSize:13,marginBottom:12}}>
                    Inspection Checklist — قائمة الفحص
                    <span style={{fontSize:11,color:'var(--text-muted)',marginRight:8,fontWeight:400}}>
                      {Object.values(checklistResults).filter(r=>r.result==='pass').length} Pass ·
                      {Object.values(checklistResults).filter(r=>r.result==='fail').length} Fail
                    </span>
                  </div>

                  {/* نقاط الفحص */}
                  {inspectionItems.length > 0 && (
                    <>
                      <div style={{fontSize:11,fontWeight:700,color:'#185FA5',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:4}}>
                        نقاط الفحص · Inspection Items
                      </div>
                      {inspectionItems.map((item,i)=>{
                        const result = checklistResults[item.id]?.result || 'pending'
                        return (
                          <div key={item.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:'0.5px solid var(--border)'}}>
                            <span style={{fontSize:11,color:'var(--text-muted)',width:20,flexShrink:0}}>{i+1}</span>
                            <div style={{flex:1,fontSize:13}}>{item.item}</div>
                            <div style={{display:'flex',gap:6}}>
                              {['pass','fail','na'].map(r=>(
                                <button key={r} onClick={()=>saveChecklistResult(item.id,item.item,r)}
                                  style={{padding:'3px 10px',borderRadius:20,border:'none',cursor:'pointer',fontSize:11,fontWeight:500,
                                    background:result===r?RESULT_BG[r]:'var(--bg)',
                                    color:result===r?RESULT_COLORS[r]:'var(--text-muted)',
                                    outline:result===r?`1.5px solid ${RESULT_COLORS[r]}`:'none'}}>
                                  {RESULT_LABELS[r]}
                                </button>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </>
                  )}

                  {/* التوصيات */}
                  {recommendationItems.length > 0 && (
                    <div style={{marginTop:16,background:'#FFFBF5',borderRadius:8,border:'0.5px solid #F0D9B5',padding:'10px 14px'}}>
                      <div style={{fontSize:11,fontWeight:700,color:'#854F0B',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:8}}>
                        ⚠️ توصيات ما بعد الصب · Post-Pour Recommendations
                      </div>
                      {recommendationItems.map((item,i)=>{
                        const result = checklistResults[item.id]?.result || 'pending'
                        return (
                          <div key={item.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:'0.5px solid #F0D9B5'}}>
                            <span style={{fontSize:11,color:'#854F0B',width:20,flexShrink:0}}>{i+1}</span>
                            <div style={{flex:1,fontSize:13}}>{item.item}</div>
                            <div style={{display:'flex',gap:6}}>
                              {['pass','fail','na'].map(r=>(
                                <button key={r} onClick={()=>saveChecklistResult(item.id,item.item,r)}
                                  style={{padding:'3px 10px',borderRadius:20,border:'none',cursor:'pointer',fontSize:11,fontWeight:500,
                                    background:result===r?RESULT_BG[r]:'var(--bg)',
                                    color:result===r?RESULT_COLORS[r]:'var(--text-muted)',
                                    outline:result===r?`1.5px solid ${RESULT_COLORS[r]}`:'none'}}>
                                  {RESULT_LABELS[r]}
                                </button>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {photos.length > 0 && (
                <div className="card">
                  <div style={{fontWeight:500,fontSize:13,marginBottom:12}}>Photos ({photos.length})</div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
                    {photos.map(ph=>(
                      <img key={ph.id} src={getPhotoUrl(ph.file_path)}
                        style={{width:'100%',height:100,objectFit:'cover',borderRadius:6,cursor:'pointer'}}
                        onClick={()=>window.open(getPhotoUrl(ph.file_path),'_blank')}/>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── قرار الإعادة قبل إصدار التقرير ── */}
      {askRework && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setAskRework(false)}>
          <div className="modal" style={{maxWidth:520}}>
            <h3 style={{color:'#A32D2D'}}>هل يحتاج الموقع زيارة إعادة؟</h3>

            <div style={{background:'#FCEBEB',border:'1px solid rgba(163,45,45,.25)',
                         borderRadius:7,padding:'10px 12px',fontSize:12.5,
                         lineHeight:1.7,marginBottom:14}}>
              هذه الزيارة فيها <strong>{failNow} ملاحظة</strong> لم تُجتَز
              في مرحلة «{parentVisit?.title_ar || parentVisit?.title || '—'}».
              قرارك يُدرَج في التقرير الذي يصل العميل.
            </div>

            {rwErr && (
              <div style={{background:'#FCEBEB',color:'#A32D2D',padding:'8px 11px',
                           borderRadius:6,fontSize:12,marginBottom:12,fontWeight:600}}>{rwErr}</div>
            )}

            {/* نعم */}
            <div style={{border:'1.5px solid #A32D2D',borderRadius:8,padding:'12px 13px',marginBottom:11}}>
              <div style={{fontSize:13,fontWeight:700,color:'#A32D2D',marginBottom:8}}>
                نعم — تلزم زيارة إضافية بأجر
              </div>
              <div style={{display:'flex',gap:9,alignItems:'flex-end',flexWrap:'wrap'}}>
                <div>
                  <label style={{fontSize:11,color:'var(--text-muted)'}}>الأجر (د.ب)</label>
                  <input type="number" step="0.001" min="0" className="form-input"
                    style={{width:140,fontSize:12.5}} value={rwFee}
                    placeholder="مثال: 37.500"
                    onChange={e=>setRwFee(e.target.value)}/>
                </div>
                <button type="button" className="btn btn-sm btn-primary" disabled={saving}
                  style={{fontSize:12.5}} onClick={reworkYes}>
                  {saving ? '…' : 'أنشئ الزيارة وأصدر التقرير'}
                </button>
              </div>
              <div style={{fontSize:11,color:'var(--text-muted)',marginTop:8,lineHeight:1.6}}>
                يظهر في التقرير أن الزيارة تمّت ووُجدت ملاحظات، وأن إعادة الفحص
                لازمة بهذا الأجر <strong>يُدفع مسبقاً</strong> قبل تحديد الموعد.
              </div>
            </div>

            {/* لا */}
            <div style={{border:'1px solid var(--border)',borderRadius:8,padding:'12px 13px'}}>
              <div style={{fontSize:13,fontWeight:700,marginBottom:8}}>لا — لا تلزم إعادة</div>
              <input className="form-input" style={{width:'100%',fontSize:12.5}}
                value={rwNote}
                placeholder="السبب — مثلاً: عولجت في الموقع · تُراجَع في الزيارة التالية"
                onChange={e=>setRwNote(e.target.value)}/>
              <button type="button" className="btn btn-sm" disabled={saving}
                style={{fontSize:12.5,marginTop:9}} onClick={reworkNo}>
                {saving ? '…' : 'سجّل السبب وأصدر التقرير'}
              </button>
              <div style={{fontSize:11,color:'var(--text-muted)',marginTop:8,lineHeight:1.6}}>
                يُسجَّل السبب باسمك وتاريخه، ولا يظهر في تقرير العميل.
              </div>
            </div>

            <div style={{marginTop:14,textAlign:'left'}}>
              <button type="button" className="btn btn-sm" disabled={saving}
                onClick={()=>setAskRework(false)}>إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Reports
