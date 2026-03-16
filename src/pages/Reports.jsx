import { useState, useEffect } from 'react'
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
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notes, setNotes] = useState('')

  useEffect(() => { loadProjects() }, [])
  useEffect(() => { if (selectedProject) loadVisits(selectedProject.id) }, [selectedProject])
  useEffect(() => { if (selectedVisit) loadVisitData(selectedVisit) }, [selectedVisit])

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
      .order('visit_date', { ascending: false })
    setVisits(data || [])
    if (data?.length) setSelectedVisit(data[0])
  }

  async function loadVisitData(visit) {
    // Load all checklist items and find best match
    const fullNotes = visit.notes?.trim() || ''
    const shortType = visit.notes?.split(' — ')[0]?.trim() || ''
    
    const { data: allItems } = await supabase.from('inspection_checklists').select('*').order('order_index')
    
    let clData = null
    if (allItems?.length) {
      const types = [...new Set(allItems.map(i => i.visit_type))]
      
      // Try: 1) exact full match, 2) exact short match, 3) partial match
      const bestMatch = 
        types.find(t => t === fullNotes) ||
        types.find(t => t === shortType) ||
        types.find(t => fullNotes.toLowerCase().includes(t.toLowerCase())) ||
        types.find(t => t.toLowerCase().includes(shortType.toLowerCase())) ||
        types.find(t => shortType.toLowerCase().includes(t.split(' — ')[0]?.toLowerCase()))
      
      if (bestMatch) {
        clData = allItems.filter(i => i.visit_type === bestMatch)
      }
    }

    const [{ data: results }, { data: ph }] = await Promise.all([
      supabase.from('visit_checklist_results').select('*').eq('visit_id', visit.id),
      supabase.from('visit_photos').select('*').eq('visit_id', visit.id)
    ])

    setChecklist(clData || [])
    setNotes(visit.notes || '')

    // Map results
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
        visit_id: selectedVisit.id,
        checklist_item_id: itemId,
        item_text: itemText,
        result
      }).select().single()
      if (data) {
        setChecklistResults(prev => ({ ...prev, [itemId]: data }))
        return
      }
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

  async function generateReport() {
    if (!selectedVisit || !selectedProject) return
    setSaving(true)
    try {
      // Save report record
      const reportNo = `SVR-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`
      await supabase.from('reports').insert({
        report_no: reportNo,
        visit_id: selectedVisit.id,
        project_id: selectedProject.id,
      })

      // Open print window
      const passCount = Object.values(checklistResults).filter(r => r.result === 'pass').length
      const failCount = Object.values(checklistResults).filter(r => r.result === 'fail').length
      const naCount = Object.values(checklistResults).filter(r => r.result === 'na').length
      const today = new Date().toLocaleDateString('en-GB')

      const photoHtml = photos.map(ph => `
        <div style="break-inside:avoid;margin-bottom:12px;">
          <img src="${getPhotoUrl(ph.file_path)}" style="width:100%;max-height:200px;object-fit:cover;border-radius:6px;border:0.5px solid #eee;"/>
          ${ph.caption ? `<div style="font-size:11px;color:#666;margin-top:4px;text-align:center;">${ph.caption}</div>` : ''}
        </div>
      `).join('')

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
              <th style="padding:7px 10px;text-align:center;width:90px;">Result — النتيجة</th>
            </tr></thead>
            <tbody>
              ${checklist.map((item, i) => {
                const r = checklistResults[item.id]?.result || 'pending'
                const itemNotes = checklistResults[item.id]?.notes || ''
                const color = r === 'pass' ? '#0F6E56' : r === 'fail' ? '#A32D2D' : r === 'na' ? '#888' : '#aaa'
                const label = r === 'pass' ? '✓ Pass' : r === 'fail' ? '✗ Fail' : r === 'na' ? '— N/A' : '○ Pending'
                const rowBg = r === 'fail' ? '#FFF5F5' : i%2===0 ? '#fafafa' : 'white'
                return `<tr style="background:${rowBg};">
                  <td style="padding:6px 10px;color:#888;">${i+1}</td>
                  <td style="padding:6px 10px;">
                    <div>${item.item}</div>
                    ${itemNotes ? `<div style="font-size:11px;color:#854F0B;background:#FAEEDA;border-radius:4px;padding:2px 8px;margin-top:4px;display:inline-block;">💬 ${itemNotes}</div>` : ''}
                  </td>
                  <td style="padding:6px 10px;text-align:center;color:${color};font-weight:600;">${label}</td>
                </tr>`
              }).join('')}
            </tbody>
          </table>
        </div>
      ` : ''

      const w = window.open('', '_blank')
      w.document.write(`<!DOCTYPE html>
        <html><head><meta charset="UTF-8"><title>Site Visit Report - ${reportNo}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; padding: 36px; color: #111; font-size: 13px; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #185FA5; padding-bottom: 16px; margin-bottom: 20px; }
          .section { border-radius: 8px; padding: 14px 18px; margin-bottom: 14px; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 32px; }
          .info-row { display: flex; flex-direction: column; gap: 2px; margin-bottom: 6px; }
          .info-label { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
          .info-value { font-size: 13px; font-weight: 500; }
          .photos-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 20px; }
          .sigs { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 30px; margin-top: 48px; }
          .sig-line { border-top: 1.5px solid #333; padding-top: 8px; margin-top: 48px; text-align: center; font-size: 12px; }
          .sig-name { font-size: 11px; color: #888; margin-top: 3px; }
          .footer { border-top: 1px solid #eee; margin-top: 28px; padding-top: 10px; text-align: center; font-size: 10px; color: #bbb; }
          .badge { display: inline-block; padding: 2px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
          @media print { body { padding: 20px; } .no-print { display: none !important; } }
        </style>
        </head><body>

        <div class="header">
          <div>
            <img src="/rekaz-logo.jpg" style="height:44px;width:auto;" onerror="this.style.display='none'"/>
            <div style="font-size:11px;color:#888;margin-top:4px;">مكتب ركاز للهندسة</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:18px;font-weight:700;color:#185FA5;">تقرير زيارة موقع</div>
            <div style="font-size:12px;color:#888;">Site Visit Report · ${reportNo}</div>
            <div style="font-size:11px;color:#aaa;margin-top:2px;">${today}</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">
          <div class="section" style="background:#f5f5f0;">
            <div style="font-size:11px;font-weight:700;color:#185FA5;text-transform:uppercase;margin-bottom:10px;">معلومات المشروع · Project</div>
            <div class="info-row"><div class="info-label">Project Name</div><div class="info-value">${selectedProject.name}</div></div>
            <div class="info-row"><div class="info-label">Project No</div><div class="info-value">${selectedProject.project_no}</div></div>
            <div class="info-row"><div class="info-label">Location</div><div class="info-value">${selectedProject.location||'—'}</div></div>
          </div>
          <div class="section" style="background:#E6F1FB;">
            <div style="font-size:11px;font-weight:700;color:#185FA5;text-transform:uppercase;margin-bottom:10px;">معلومات الزيارة · Visit</div>
            <div class="info-row"><div class="info-label">Visit Date</div><div class="info-value">${selectedVisit.visit_date}</div></div>
            <div class="info-row"><div class="info-label">Engineer</div><div class="info-value">${selectedVisit.engineer_name||'—'}</div></div>
            <div class="info-row"><div class="info-label">Visit Type</div><div class="info-value">${selectedVisit.notes?.split(' — ')[0]||'—'}</div></div>
            <div class="info-row"><div class="info-label">Severity</div><div class="info-value">${selectedVisit.severity||'—'}</div></div>
          </div>
        </div>

        ${selectedVisit.notes ? `
        <div class="section" style="background:#fafafa;border:0.5px solid #eee;margin-bottom:14px;">
          <div style="font-size:11px;font-weight:700;color:#185FA5;text-transform:uppercase;margin-bottom:8px;">الملاحظات · Notes</div>
          <div style="font-size:13px;line-height:1.6;">${selectedVisit.notes}</div>
        </div>
        ` : ''}

        ${checklistHtml}

        ${photos.length > 0 ? `
        <div style="margin-bottom:20px;">
          <div style="font-size:11px;font-weight:700;color:#185FA5;text-transform:uppercase;margin-bottom:10px;">الصور · Photos (${photos.length})</div>
          <div class="photos-grid">${photoHtml}</div>
        </div>
        ` : ''}

        <div class="sigs">
          <div><div class="sig-line">المهندس المشرف · Engineer<div class="sig-name">${selectedProject.engineer_name||'—'}</div></div></div>
          <div><div class="sig-line">المقاول · Contractor<div class="sig-name">${selectedProject.contractor_name||'—'}</div></div></div>
          <div><div class="sig-line">المالك · Client<div class="sig-name">${selectedProject.client_name||'—'}</div></div></div>
        </div>

        <div class="footer">مكتب ركاز للهندسة · Rekaz Engineering Office · البحرين · ${today} · ${reportNo}</div>

        <div class="no-print" style="position:fixed;top:12px;right:12px;display:flex;gap:8px;z-index:999;">
          <button onclick="window.print()" style="background:#185FA5;color:white;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;">🖨 Print</button>
          <button onclick="window.close()" style="background:#f5f5f0;color:#333;border:1px solid #ddd;padding:10px 20px;border-radius:8px;cursor:pointer;font-size:14px;">✕ Close</button>
        </div>
        </body></html>
      `)
      w.document.close()
      w.focus()
      setTimeout(() => { w.print() }, 800)

    } catch(e) { alert('Error: ' + e.message) } finally { setSaving(false) }
  }

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(projectSearch.toLowerCase()) ||
    (p.project_no||'').toLowerCase().includes(projectSearch.toLowerCase())
  )

  const RESULT_COLORS = { pass:'#0F6E56', fail:'#A32D2D', na:'#888', pending:'#aaa' }
  const RESULT_BG = { pass:'#E1F5EE', fail:'#FCEBEB', na:'#f5f5f0', pending:'#f5f5f0' }
  const RESULT_LABELS = { pass:'✓ Pass', fail:'✗ Fail', na:'— N/A', pending:'○' }

  return (
    <div>
      <div className="page-header">
        <div><h3>Reports</h3><div className="page-sub">Generate site visit reports</div></div>
        {selectedVisit && (
          <button className="btn btn-primary" onClick={generateReport} disabled={saving}>
            {saving ? 'Generating...' : '📄 Generate PDF Report'}
          </button>
        )}
      </div>

      <div style={{marginBottom:10}}>
        <input className="form-input" style={{maxWidth:280}} placeholder="Search projects..."
          value={projectSearch} onChange={e=>setProjectSearch(e.target.value)}/>
      </div>

      <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}>
        {filteredProjects.map(p=>(
          <button key={p.id} className={`btn ${selectedProject?.id===p.id?'btn-primary':''}`}
            style={{fontSize:12}} onClick={()=>setSelectedProject(p)}>
            {p.name}
          </button>
        ))}
      </div>

      {selectedProject && (
        <div style={{display:'grid',gridTemplateColumns:'280px 1fr',gap:16}}>

          {/* Visits List */}
          <div className="card" style={{height:'fit-content'}}>
            <div style={{fontWeight:500,fontSize:13,marginBottom:12,color:'var(--text)'}}>
              Site Visits ({visits.length})
            </div>
            {visits.length === 0 ? (
              <div style={{color:'var(--text-muted)',fontSize:12}}>No visits yet.</div>
            ) : (
              visits.map(v=>(
                <div key={v.id}
                  onClick={()=>setSelectedVisit(v)}
                  style={{
                    padding:'10px 12px',borderRadius:8,cursor:'pointer',marginBottom:6,
                    background: selectedVisit?.id===v.id ? 'var(--blue-light)' : 'var(--bg)',
                    border: selectedVisit?.id===v.id ? '1px solid #185FA540' : '1px solid transparent'
                  }}>
                  <div style={{fontWeight:500,fontSize:12,color:selectedVisit?.id===v.id?'#185FA5':'var(--text)'}}>
                    {v.visit_date}
                  </div>
                  <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>
                    {v.notes?.split(' — ')[0]||'Site Visit'}
                  </div>
                  <div style={{fontSize:11,color:'var(--text-muted)'}}>
                    {v.engineer_name||'—'}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Visit Details + Checklist */}
          {selectedVisit && (
            <div>
              <div className="card" style={{marginBottom:16}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px 24px',fontSize:13}}>
                  <div><span style={{color:'var(--text-muted)'}}>Date: </span><strong>{selectedVisit.visit_date}</strong></div>
                  <div><span style={{color:'var(--text-muted)'}}>Engineer: </span>{selectedVisit.engineer_name||'—'}</div>
                  <div><span style={{color:'var(--text-muted)'}}>Type: </span>{selectedVisit.notes?.split(' — ')[0]||'—'}</div>
                  <div><span style={{color:'var(--text-muted)'}}>Severity: </span>{selectedVisit.severity}</div>
                </div>
                {selectedVisit.notes && (
                  <div style={{marginTop:10,padding:'10px 12px',background:'var(--bg)',borderRadius:8,fontSize:12,color:'var(--text-muted)'}}>
                    {selectedVisit.notes}
                  </div>
                )}
              </div>

              {/* Checklist */}
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
                              style={{
                                padding:'3px 10px',borderRadius:20,border:'none',cursor:'pointer',
                                fontSize:11,fontWeight:500,
                                background: result===r ? RESULT_BG[r] : 'var(--bg)',
                                color: result===r ? RESULT_COLORS[r] : 'var(--text-muted)',
                                outline: result===r ? `1.5px solid ${RESULT_COLORS[r]}` : 'none'
                              }}>
                              {RESULT_LABELS[r]}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Photos */}
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
