import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

// ─────────────────────────────────────────────────────────────────────
//  سلة المحذوفات — «كنترول زد»
//
//  السبب: كل خطأ حذف كان يحتاج استرجاعاً من نسخة احتياطية بيد شخص آخر.
//  الآن مُشغّل في قاعدة البيانات ينسخ كل صف قبل حذفه، فيصير التراجع
//  زرّاً لا طلباً.
//
//  الحذف يُلتقط من كل طريق — الواجهة، وأمر SQL مباشر، والحذف المتسلسل
//  الذي يُسقط التقارير ونتائج الفحص مع الزيارة. وتُعاد الدفعة كاملة
//  بمعرّفاتها الأصلية، فتعود الروابط كما كانت لا نسخاً جديدة منها.
// ─────────────────────────────────────────────────────────────────────

const KINDS = [
  ['projects',  'مشروع',      'مشاريع'],
  ['visits',    'زيارة خطة',  'زيارات خطة'],
  ['records',   'سجل زيارة',  'سجلات زيارة'],
  ['reports',   'تقرير',      'تقارير'],
  ['tasks',     'مهمة',       'مهام'],
  ['checklist', 'بند فحص',    'بنود فحص'],
  ['photos',    'صورة',       'صور'],
  ['templates', 'قالب زيارة', 'قوالب زيارة'],
]

const fmtWhen = iso => {
  const d = new Date(iso)
  const mins = Math.round((Date.now() - d.getTime()) / 60000)
  if (mins < 1)  return 'الآن'
  if (mins < 60) return `قبل ${mins} دقيقة`
  const hrs = Math.round(mins / 60)
  if (hrs < 24)  return `قبل ${hrs} ساعة`
  const days = Math.round(hrs / 24)
  if (days < 30) return `قبل ${days} يوماً`
  return d.toLocaleDateString('en-GB')
}

export default function Trash() {
  const [rows, setRows]     = useState([])
  const [loading, setLoad]  = useState(true)
  const [busy, setBusy]     = useState(null)
  const [err, setErr]       = useState('')
  const [done, setDone]     = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoad(true); setErr('')
    const { data, error } = await supabase
      .from('deleted_batches').select('*').limit(200)
    if (error) setErr('تعذّر فتح السلة: ' + error.message)
    else setRows(data || [])
    setLoad(false)
  }

  async function restore(b) {
    const what = KINDS.map(([k, one, many]) =>
      b[k] ? `${b[k]} ${b[k] === 1 ? one : many}` : null).filter(Boolean).join(' · ')
    if (!confirm(`استرجاع «${b.label}»؟\n\nسيعود: ${what}\n\nبمعرّفاتها الأصلية وروابطها كما كانت.`)) return

    setBusy(b.txid); setErr(''); setDone('')
    const { data, error } = await supabase.rpc('restore_deleted_batch', { p_txid: b.txid })
    setBusy(null)
    if (error) { setErr('تعذّر الاسترجاع: ' + error.message); return }
    const n = (data || []).reduce((s, r) => s + r.restored, 0)
    setDone(`أُعيد ${n} عنصراً من «${b.label}».`)
    await load()
  }

  if (loading) return <div style={{color:'var(--text-muted)'}}>جارٍ التحميل…</div>

  return (
    <>
      <div className="page-header">
        <div>
          <h3>سلة المحذوفات</h3>
          <div className="page-sub">
            كل ما حُذف خلال الستين يوماً الماضية — قابل للاسترجاع بضغطة
          </div>
        </div>
        <button className="btn btn-sm" onClick={load}>تحديث</button>
      </div>

      {err && (
        <div className="card" style={{marginBottom:14,color:'#A32D2D',fontWeight:600}}>{err}</div>
      )}
      {done && (
        <div className="card" style={{marginBottom:14,color:'#0F6E56',fontWeight:600,
                                      background:'var(--green-light,#E1F5EE)'}}>✓ {done}</div>
      )}

      {!rows.length ? (
        <div className="card"><div className="empty">
          <p>السلة فارغة.</p>
          <p style={{fontSize:12,marginTop:8,color:'var(--text-muted)'}}>
            أي حذف من الآن فصاعداً يظهر هنا — الزيارات والتقارير والمهام
            والمشاريع — ويمكن التراجع عنه.
          </p>
        </div></div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {rows.map(b => {
            const parts = KINDS
              .map(([k, one, many]) => b[k] ? { n: b[k], label: b[k] === 1 ? one : many } : null)
              .filter(Boolean)
            return (
              <div key={b.txid} className="card"
                style={{display:'flex',alignItems:'flex-start',gap:14,flexWrap:'wrap'}}>

                <div style={{flex:1,minWidth:220}}>
                  <div style={{fontSize:13.5,fontWeight:600,lineHeight:1.4}}>{b.label}</div>
                  {b.project_name && (
                    <div style={{fontSize:11.5,color:'var(--text-muted)',marginTop:2}}>
                      {b.project_name}
                    </div>
                  )}

                  <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:8}}>
                    {parts.map(p => (
                      <span key={p.label}
                        style={{fontSize:10.5,fontWeight:700,padding:'2px 8px',borderRadius:11,
                                background: p.label.includes('تقرير') ? '#FCEBEB' : 'var(--bg)',
                                color:      p.label.includes('تقرير') ? '#A32D2D' : 'var(--text-muted)',
                                border:'1px solid var(--border)'}}>
                        {p.n} {p.label}
                      </span>
                    ))}
                  </div>

                  <div style={{fontSize:11,color:'var(--text-muted)',marginTop:8}}>
                    {fmtWhen(b.deleted_at)}
                    {b.deleted_by_name ? ` · ${b.deleted_by_name}` : ''}
                  </div>
                </div>

                <button className="btn btn-sm btn-primary" disabled={busy === b.txid}
                  style={{fontSize:12.5,flexShrink:0}} onClick={() => restore(b)}>
                  {busy === b.txid ? '…' : '↺ استرجاع'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
