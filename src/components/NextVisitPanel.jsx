import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

// ─────────────────────────────────────────────────────────────────────
//  جدولة «الزيارة التالية»
//
//  السبب: 672 زيارة من 781 (86%) بلا تاريخ. والزيارة بلا تاريخ لا
//  يمكن أن تتأخر — لا يوجد ما تُقاس عليه، فلا تظهر في أي قائمة، فلا
//  يلاحقها أحد. هذا هو سبب إهمال الزيارات، لا تقصير المهندسين.
//
//  الفكرة: لا نطالب بتأريخ 781 زيارة — بل بزيارة تالية مؤرّخة واحدة
//  لكل مشروع. يقرأ من العرض project_next_visit الذي يحسب أول زيارة
//  مفتوحة حسب الترتيب الإنشائي.
// ─────────────────────────────────────────────────────────────────────

const LIMIT = 6

export default function NextVisitPanel() {
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [savingId, setSavingId] = useState(null)
  const [err, setErr]         = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const { data, error } = await supabase
      .from('project_next_visit')
      .select('*')
      .in('state', ['overdue', 'no_date'])
    if (error) { console.error('تعذّر جلب الزيارات التالية:', error.message); setErr(error.message) }
    else {
      // المتأخر أولاً ثم الأطول تأخيراً، يليه ما يحتاج جدولة
      const sorted = (data || []).sort((a, b) => {
        if (a.state !== b.state) return a.state === 'overdue' ? -1 : 1
        return (b.days_late || 0) - (a.days_late || 0)
      })
      setRows(sorted)
    }
    setLoading(false)
  }

  async function setDate(row, value) {
    if (!value || !row.visit_id) return
    setSavingId(row.visit_id); setErr('')
    const { error } = await supabase
      .from('project_visits')
      .update({ scheduled_date: value, status: 'scheduled' })
      .eq('id', row.visit_id)
    setSavingId(null)
    if (error) { setErr('تعذّر حفظ الموعد: ' + error.message); return }
    setRows(prev => prev.filter(r => r.visit_id !== row.visit_id))
  }

  if (loading) return null
  if (!rows.length) return null

  const overdue = rows.filter(r => r.state === 'overdue').length
  const noDate  = rows.filter(r => r.state === 'no_date').length
  const shown   = expanded ? rows : rows.slice(0, LIMIT)
  const today   = new Date().toISOString().split('T')[0]

  return (
    <div className="card" style={{marginBottom:16,border:'1px solid rgba(133,79,11,.28)',background:'var(--amber-light,#FAEEDA)'}}>
      <div className="card-head" style={{marginBottom:10}}>
        <span className="card-title" style={{color:'#854F0B'}}>🗓 الزيارة التالية — تحتاج موعداً</span>
      </div>

      <div style={{display:'flex',gap:18,flexWrap:'wrap',marginBottom:12,fontSize:13}}>
        {overdue > 0 && (
          <span><strong style={{color:'#A32D2D',fontSize:19}}>{overdue}</strong>{' '}
            <span style={{color:'#6b4a12'}}>متأخرة</span></span>
        )}
        <span><strong style={{color:'#854F0B',fontSize:19}}>{noDate}</strong>{' '}
          <span style={{color:'#6b4a12'}}>بلا موعد</span></span>
      </div>

      <div style={{fontSize:12,color:'#6b4a12',marginBottom:12,lineHeight:1.6}}>
        حدّد موعد الزيارة التالية لكل مشروع. الزيارة بلا موعد لا تظهر في أي تذكير ولا قائمة متأخرات.
      </div>

      {err && (
        <div style={{background:'#FCEBEB',color:'#A32D2D',padding:'8px 11px',borderRadius:6,fontSize:12,marginBottom:10}}>
          {err}
        </div>
      )}

      <div style={{display:'flex',flexDirection:'column',gap:7}}>
        {shown.map(r => (
          <div key={r.project_id}
            style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',
                    background:'rgba(255,255,255,.75)',borderRadius:7,padding:'9px 11px'}}>

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

            <div style={{flex:1,minWidth:190}}>
              <div style={{fontSize:13,fontWeight:600,lineHeight:1.35}}>{r.project_name}</div>
              <div style={{fontSize:11.5,color:'#7d6a4a'}}>
                {r.title_ar || r.title}
                {r.engineer_name ? ' · ' + r.engineer_name : ' · بلا مهندس'}
              </div>
            </div>

            <input
              type="date"
              className="form-input"
              style={{width:150,flexShrink:0,fontSize:12.5}}
              min={r.state === 'overdue' ? undefined : today}
              defaultValue={r.scheduled_date || ''}
              disabled={savingId === r.visit_id}
              onChange={e => setDate(r, e.target.value)}
            />
          </div>
        ))}
      </div>

      {rows.length > LIMIT && (
        <button className="btn btn-sm" style={{marginTop:11}} onClick={() => setExpanded(v => !v)}>
          {expanded ? 'عرض أقل' : `عرض الكل (${rows.length})`}
        </button>
      )}
    </div>
  )
}
