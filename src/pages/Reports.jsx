import { useState, useEffect, useRef } from 'react'
import { getProjects, supabase } from '../lib/supabase.js'

export function Reports() {
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
      if (p?.length) setSelectedProject(p[0])
    } catch(e) { console.error(e) } finally { setLoading(false) }
  }

  async function loadVisits(projectId) {
    const { data } = await supabase
      .from('site_visits')
      .select('*')
      .eq('project_id', projectId)
      .order('visit_date', { ascending: true })
    setVisits(data || [])
    if (data?.length) setSelectedVisit(data[data.length - 1])
  }

  async function loadVisitData(visit) {
    const fullNotes = visit.notes?.trim() || ''
    const shortType = visit.notes?.split(' — ')[0]?.trim() || ''
    const { data: allItems } = await supabase.from('inspection_checklists').select('*').order('order_index')
    let clData = null
    if (allItems?.length) {
      const types = [...new Set(allItems.map(i => i.visit_type))]
      const bestMatch =
        types.find(t => t === fullNotes) ||
        types.find(t => t === shortType) ||
        types.find(t => fullNotes.toLowerCase().includes(t.toLowerCase())) ||
        types.find(t => t.toLowerCase().includes(shortType.toLowerCase())) ||
        types.find(t => shortType.toLowerCase().includes(t.split(' — ')[0]?.toLowerCase()))
      if (bestMatch) clData = allItems.filter(i => i.visit_type === bestMatch)
    }
    const [{ data: results }, { data: ph }] = await Promise.all([
      supabase.from('visit_checklist_results').select('*').eq('visit_id', visit.id),
      supabase.from('visit_photos').select('*').eq('visit_id', visit.id)
    ])
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
    if (existing) {
      await supabase.from('visit_checklist_results').update({ result }).eq('id', existing.id)
    } else {
      const { data } = await supabase.from('visit_checklist_results').insert({
        visit_id: selectedVisit.id, checklist_item_id: itemId, item_text: itemText, result
      }).select().single()
      if (data) { setChecklistResults(prev => ({ ...prev, [itemId]: data })); return }
    }
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
  async function generateReport() {
    if (!selectedVisit || !selectedProject) return
    setSaving(true)
    try {
      const reportNo = `SVR-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`
      await supabase.from('reports').insert({ report_no: reportNo, visit_id: selectedVisit.id, project_id: selectedProject.id })
      const passCount = Object.values(checklistResults).filter(r => r.result === 'pass').length
      const failCount = Object.values(checklistResults).filter(r => r.result === 'fail').length
      const naCount   = Object.values(checklistResults).filter(r => r.result === 'na').length
      const today = new Date().toLocaleDateString('en-GB')
      const photoHtml = photos.map(ph => `
        <div style="break-inside:avoid;margin-bottom:12px;">
          <img src="${getPhotoUrl(ph.file_path)}" style="width:100%;max-height:200px;object-fit:cover;border-radius:6px;border:0.5px solid #eee;"/>
          ${ph.caption ? `<div style="font-size:11px;color:#666;margin-top:4px;text-align:center;">${ph.caption}</div>` : ''}
        </div>`).join('')
      const checklistHtml = checklist.length > 0 ? `
        <div style="margin-bottom:20px;">
          <div style="font-size:11px;font-weight:700;color:#185FA5;text-transform:uppercase;margin-bottom:10px;display:flex;justify-content:space-between;">
            <span>Inspection Checklist — قائمة الفحص</span>
            <span style="font-weight:400;color:#666;">✓ ${passCount} Pass · ✗ ${failCount} Fail · — ${naCount} N/A</span>
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <thead><tr style="background:#185FA5;color:white;">
              <th style="padding:7px 10px;text-align:left;width:30px;">#</th>
              <th style="padding:7px 10px;text-align:left;">Item — البند</th>
              <th style="padding:7px 10px;text-align:center;width:90px;">Result</th>
            </tr></thead>
            <tbody>
              ${checklist.map((item, i) => {
                const r = checklistResults[item.id]?.result || 'pending'
                const itemNotes = checklistResults[item.id]?.notes || ''
                const color = r==='pass'?'#0F6E56':r==='fail'?'#A32D2D':r==='na'?'#888':'#aaa'
                const label = r==='pass'?'✓ Pass':r==='fail'?'✗ Fail':r==='na'?'— N/A':'○ Pending'
                const rowBg = r==='fail'?'#FFF5F5':i%2===0?'#fafafa':'white'
                return `<tr style="background:${rowBg};">
                  <td style="padding:6px 10px;color:#888;">${i+1}</td>
                  <td style="padding:6px 10px;"><div>${item.item}</div>${itemNotes?`<div style="font-size:11px;color:#854F0B;background:#FAEEDA;border-radius:4px;padding:2px 8px;margin-top:4px;display:inline-block;">💬 ${itemNotes}</div>`:''}</td>
                  <td style="padding:6px 10px;text-align:center;color:${color};font-weight:600;">${label}</td>
                </tr>`
              }).join('')}
            </tbody>
          </table>
        </div>` : ''
      const w = window.open('', '_blank')
      w.document.write(buildSingleHtml({ reportNo, today, project: selectedProject, visit: selectedVisit, checklistHtml, photoHtml, photos }))
      w.document.close(); w.focus()
      setTimeout(() => { w.print() }, 800)
    } catch(e) { alert('Error: ' + e.message) } finally { setSaving(false) }
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
        const bestMatch = allItems?.length ? (
          types.find(t => t === fullNotes) ||
          types.find(t => t === shortType) ||
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
        const passCount = Object.values(res).filter(r => r.result === 'pass').length
        const failCount = Object.values(res).filter(r => r.result === 'fail').length
        const naCount   = Object.values(res).filter(r => r.result === 'na').length
        const statusColor = v.status === 'approved' ? '#0F6E56' : v.status === 'submitted' ? '#185FA5' : '#888'
        const clHtml = cl.length > 0 ? `
          <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:10px;">
            <thead><tr style="background:#185FA5;color:white;">
              <th style="padding:5px 8px;text-align:left;width:24px;">#</th>
              <th style="padding:5px 8px;text-align:left;">Item</th>
              <th style="padding:5px 8px;text-align:center;width:80px;">Result</th>
            </tr></thead>
            <tbody>
              ${cl.map((item, i) => {
                const r = res[item.id]?.result || 'pending'
                const itemNotes = res[item.id]?.notes || ''
                const color = r==='pass'?'#0F6E56':r==='fail'?'#A32D2D':r==='na'?'#888':'#aaa'
                const label = r==='pass'?'✓ Pass':r==='fail'?'✗ Fail':r==='na'?'— N/A':'○'
                const rowBg = r==='fail'?'#FFF5F5':i%2===0?'#fafafa':'white'
                return `<tr style="background:${rowBg};">
                  <td style="padding:4px 8px;color:#888;">${i+1}</td>
                  <td style="padding:4px 8px;">${item.item}${itemNotes?`<span style="margin-right:8px;font-size:10px;color:#854F0B;"> 💬 ${itemNotes}</span>`:''}</td>
                  <td style="padding:4px 8px;text-align:center;color:${color};font-weight:600;">${label}</td>
                </tr>`
              }).join('')}
            </tbody>
          </table>
          <div style="font-size:10px;color:#666;margin-top:6px;">✓ ${passCount} Pass · ✗ ${failCount} Fail · — ${naCount} N/A</div>
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
      w.document.write(`<!DOCTYPE html>
        <html><head><meta charset="UTF-8"><title>Project Report - ${selectedProject.name}</title>
        <style>
          * { box-sizing:border-box; margin:0; padding:0; }
          body { font-family:Arial,sans-serif; padding:36px; color:#111; font-size:13px; }
          @media print { body { padding:20px; } .no-print { display:none !important; } }
        </style></head><body>
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
              <div style="text-align:center;background:white;border-radius:6px;padding:10px;">
                <div style="font-size:22px;font-weight:700;color:#185FA5;">${visits.length}</div>
                <div style="font-size:10px;color:#888;">Total Visits</div>
              </div>
              <div style="text-align:center;background:white;border-radius:6px;padding:10px;">
                <div style="font-size:22px;font-weight:700;color:#0F6E56;">${completedCount}</div>
                <div style="font-size:10px;color:#888;">Completed</div>
              </div>
            </div>
            <div style="margin-top:12px;">
              <div style="height:6px;background:#ddd;border-radius:3px;overflow:hidden;">
                <div style="height:100%;background:#185FA5;width:${pct}%;border-radius:3px;"></div>
              </div>
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
        <div style="border-top:1px solid #eee;margin-top:28px;padding-top:10px;text-align:center;font-size:10px;color:#bbb;">
          مكتب ركاز للهندسة · Rekaz Engineering Office · 📞 17666882 · 📱 32277704 · ${today}
        </div>
        <div class="no-print" style="position:fixed;top:12px;right:12px;display:flex;gap:8px;z-index:999;">
          <button onclick="window.print()" style="background:#185FA5;color:white;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;">🖨 Print</button>
          <button onclick="window.close()" style="background:#f5f5f0;color:#333;border:1px solid #ddd;padding:10px 20px;border-radius:8px;cursor:pointer;font-size:14px;">✕ Close</button>
        </div>
        </body></html>`)
      w.document.close(); w.focus()
      setTimeout(() => { w.print() }, 1000)
    } catch(e) { alert('Error: ' + e.message) } finally { setGeneratingFull(false) }
  }

  function buildSingleHtml({ reportNo, today, project, visit, checklistHtml, photoHtml, photos }) {
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
            <button className="btn btn-primary" onClick={generateReport} disabled={saving}>
              {saving ? 'Generating...' : '📄 Generate PDF Report'}
            </button>
          )}
        </div>
      </div>

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
                  {checklist.map((item,i)=>{
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
    </div>
  )
}

export default Reports
