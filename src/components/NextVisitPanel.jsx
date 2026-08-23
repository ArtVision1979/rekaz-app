import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase.js'
import EngineerSelect from './EngineerSelect.jsx'

// ─────────────────────────────────────────────────────────────────────
//  جدولة «الزيارة التالية»
//
//  السبب: الزيارة بلا تاريخ لا يمكن أن تتأخر — لا يوجد ما تُقاس عليه،
//  فلا تظهر في أي قائمة، فلا يلاحقها أحد. لذلك نتابع زيارة تالية
//  مؤرّخة واحدة لكل مشروع بدل تأريخ مئات الزيارات.
//
//  التسريع: أزرار مواعيد سريعة، وقائمة مهندس داخل الصف (22 من 48
//  مشروعاً بلا مهندس)، وتحديد جماعي لتطبيق موعد ومهندس على عدة
//  مشاريع دفعة واحدة.
// ─────────────────────────────────────────────────────────────────────

const LIMIT = 6
const iso = d => d.toISOString().split('T')[0]
const shift = n => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d) }

export default function NextVisitPanel() {
  const [rows, setRows]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [busy, setBusy]         = useState(null)
  const [err, setErr]           = useState('')

  const [sel, setSel]           = useState(() => new Set())
  const [bulkEng, setBulkEng]   = useState({ id: null, name: '' })
  const [bulkDate, setBulkDate] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const { data, error } = await supabase
      .from('project_next_visit').select('*').in('state', ['overdue', 'no_date'])
    if (error) { console.error('تعذّر جلب الزيارات التالية:', error.message); setErr(error.message) }
    else {
      setRows((data || []).sort((a, b) => {
        if (a.state !== b.state) return a.state === 'overdue' ? -1 : 1
        return (b.days_late || 0) - (a.days_late || 0)
      }))
    }
    setLoading(false)
  }

  // تحديث صف واحد — التاريخ و/أو المهندس
  async function apply(ids, patch) {
    if (!ids.length) return
    setErr('')
    const { error } = await supabase.from('project_visits').update(patch).in('id', ids)
    if (error) { setErr('تعذّر الحفظ: ' + error.message); return false }
    return true
  }

  async function setDate(row, value) {
    if (!value || !row.visit_id) return
    setBusy(row.visit_id)
    const ok = await apply([row.visit_id], { scheduled_date: value, status: 'scheduled' })
    setBusy(null)
    if (ok) { setRows(p => p.filter(r => r.visit_id !== row.visit_id)); dropSel(row.visit_id) }
  }

  async function setEngineer(row, { id, name }) {
    if (!row.visit_id) return
    setBusy(row.visit_id)
    const ok = await apply([row.visit_id], { engineer_id: id, engineer_name: name })
    setBusy(null)
    // الصف يبقى — تعيين المهندس لا يعني جدولته
    if (ok) setRows(p => p.map(r => r.visit_id === row.visit_id
      ? { ...r, engineer_id: id, engineer_name: name } : r))
  }

  async function applyBulk() {
    const ids = [...sel]
    if (!ids.length) return
    if (!bulkDate && !bulkEng.id) { setErr('اختر موعداً أو مهندساً أولاً'); return }

    const patch = {}
    if (bulkDate)    { patch.scheduled_date = bulkDate; patch.status = 'scheduled' }
    if (bulkEng.id)  { patch.engineer_id = bulkEng.id; patch.engineer_name = bulkEng.name }

    setBusy('bulk')
    const ok = await apply(ids, patch)
    setBusy(null)
    if (!ok) return

    if (bulkDate) setRows(p => p.filter(r => !sel.has(r.visit_id)))   // جُدولت فخرجت
    else setRows(p => p.map(r => sel.has(r.visit_id)
      ? { ...r, engineer_id: bulkEng.id, engineer_name: bulkEng.name } : r))

    setSel(new Set()); setBulkDate(''); setBulkEng({ id: null, name: '' })
  }

  function toggleSel(id) {
    setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function dropSel(id) { setSel(p => { const n = new Set(p); n.delete(id); return n }) }

  const overdue = useMemo(() => rows.filter(r => r.state === 'overdue').length, [rows])
  const noDate  = rows.length - overdue
  const shown   = expanded ? rows : rows.slice(0, LIMIT)
  const today   = iso(new Date())

  if (loading || !rows.length) return null

  const QUICK = [['اليوم', shift(0)], ['غداً', shift(1)], ['بعد أسبوع', shift(7)]]

  return (
    <div className="card" style={{marginBottom:16,border:'1px solid rgba(133,79,11,.28)',
                                   background:'var(--amber-light,#FAEEDA)'}}>
      <div className="card-head" style={{marginBottom:10}}>
        <span className="card-title" style={{color:'#854F0B'}}>🗓 الزيارة التالية — تحتاج موعداً</span>
      </div>

      <div style={{display:'flex',gap:18,flexWrap:'wrap',marginBottom:10,fontSize:13}}>
        {overdue > 0 && (
          <span><strong style={{color:'#A32D2D',fontSize:19}}>{overdue}</strong>{' '}
            <span style={{color:'#6b4a12'}}>متأخرة</span></span>
        )}
        <span><strong style={{color:'#854F0B',fontSize:19}}>{noDate}</strong>{' '}
          <span style={{color:'#6b4a12'}}>بلا موعد</span></span>
      </div>

      <div style={{fontSize:12,color:'#6b4a12',marginBottom:12,lineHeight:1.6}}>
        حدّد الموعد بزر سريع أو من التقويم. للتعديل الجماعي: ظلّل عدة مشاريع ثم طبّق عليها دفعة واحدة.
      </div>

      {err && (
        <div style={{background:'#FCEBEB',color:'#A32D2D',padding:'8px 11px',
                     borderRadius:6,fontSize:12,marginBottom:10}}>{err}</div>
      )}

      {/* شريط التعديل الجماعي */}
      {sel.size > 0 && (
        <div style={{background:'#fff',border:'1.5px solid #854F0B',borderRadius:8,
                     padding:'10px 12px',marginBottom:11,display:'flex',gap:9,
                     alignItems:'center',flexWrap:'wrap'}}>
          <strong style={{fontSize:13,color:'#854F0B'}}>{sel.size} مُحدَّد</strong>

          <div style={{minWidth:170}}>
            <EngineerSelect valueId={bulkEng.id} valueName={bulkEng.name}
              placeholder="أسند لمهندس…"
              onChange={v => setBulkEng(v)}/>
          </div>

          <input type="date" className="form-input" style={{width:150,fontSize:12.5}}
            value={bulkDate} onChange={e => setBulkDate(e.target.value)}/>

          {QUICK.map(([label, d]) => (
            <button key={label} type="button" className="btn btn-sm"
              style={{fontSize:11.5}} onClick={() => setBulkDate(d)}>{label}</button>
          ))}

          <button type="button" className="btn btn-sm btn-primary" disabled={busy === 'bulk'}
            style={{fontSize:12}} onClick={applyBulk}>
            {busy === 'bulk' ? '…' : `طبّق على ${sel.size}`}
          </button>
          <button type="button" className="btn btn-sm" style={{fontSize:11.5}}
            onClick={() => setSel(new Set())}>إلغاء التحديد</button>
        </div>
      )}

      <div style={{display:'flex',flexDirection:'column',gap:7}}>
        {shown.map(r => {
          const picked = sel.has(r.visit_id)
          return (
            <div key={r.project_id}
              style={{background: picked ? '#FFF8E8' : 'rgba(255,255,255,.75)',
                      border: picked ? '1.5px solid #854F0B' : '1.5px solid transparent',
                      borderRadius:7,padding:'9px 11px'}}>

              {/* السطر الأول: التحديد والاسم والشارات */}
              <div style={{display:'flex',alignItems:'center',gap:9,flexWrap:'wrap'}}>
                <input type="checkbox" checked={picked} style={{width:16,height:16,flexShrink:0,cursor:'pointer'}}
                  onChange={() => toggleSel(r.visit_id)}/>

                {r.state === 'overdue' ? (
                  <span style={{background:'#A32D2D',color:'#fff',fontSize:10.5,fontWeight:700,
                                padding:'2px 7px',borderRadius:11,flexShrink:0}}>
                    متأخرة {r.days_late} يوماً
                  </span>
                ) : (
                  <span style={{background:'#854F0B',color:'#fff',fontSize:10.5,fontWeight:700,
                                padding:'2px 7px',borderRadius:11,flexShrink:0}}>بلا موعد</span>
                )}

                {r.is_hold_point && (
                  <span title="نقطة توقف حرجة — لا يمكن الفحص بعد الصب"
                    style={{background:'#12497f',color:'#fff',fontSize:10.5,fontWeight:700,
                            padding:'2px 7px',borderRadius:11,flexShrink:0}}>⚠ قبل الصب</span>
                )}

                <div style={{flex:1,minWidth:170}}>
                  <div style={{fontSize:13,fontWeight:600,lineHeight:1.35}}>{r.project_name}</div>
                  <div style={{fontSize:11.5,color:'#7d6a4a'}}>{r.title_ar || r.title}</div>
                </div>
              </div>

              {/* السطر الثاني: المهندس والموعد */}
              <div style={{display:'flex',gap:7,alignItems:'center',flexWrap:'wrap',
                           marginTop:8,paddingInlineStart:25}}>
                <div style={{width:168}}>
                  <EngineerSelect valueId={r.engineer_id} valueName={r.engineer_name}
                    placeholder="بلا مهندس — اختر…"
                    onChange={v => setEngineer(r, v)}/>
                </div>

                {QUICK.map(([label, d]) => (
                  <button key={label} type="button" className="btn btn-sm"
                    disabled={busy === r.visit_id} style={{fontSize:11}}
                    onClick={() => setDate(r, d)}>{label}</button>
                ))}

                <input type="date" className="form-input"
                  style={{width:148,fontSize:12.5}}
                  min={r.state === 'overdue' ? undefined : today}
                  defaultValue={r.scheduled_date || ''}
                  disabled={busy === r.visit_id}
                  onChange={e => setDate(r, e.target.value)}/>
              </div>
            </div>
          )
        })}
      </div>

      <div style={{display:'flex',gap:8,marginTop:11,flexWrap:'wrap'}}>
        {rows.length > LIMIT && (
          <button className="btn btn-sm" onClick={() => setExpanded(v => !v)}>
            {expanded ? 'عرض أقل' : `عرض الكل (${rows.length})`}
          </button>
        )}
        {shown.length > 0 && (
          <button className="btn btn-sm" onClick={() => setSel(new Set(shown.map(r => r.visit_id)))}>
            تحديد المعروض ({shown.length})
          </button>
        )}
      </div>
    </div>
  )
}
