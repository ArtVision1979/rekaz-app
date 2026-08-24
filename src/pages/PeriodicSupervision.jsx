import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { useCurrentUser } from '../hooks/useCurrentUser.js'
import { useNavigate } from 'react-router-dom'
import { fmtFee } from '../lib/rework.js'

// ─────────────────────────────────────────────────────────────────────
//  الإشراف الدوري — النوع الثاني
//
//  يختلف جوهرياً عن إشراف المراحل: لا قائمة زيارات ثابتة، بل عدد متفق
//  عليه شهرياً حتى انتهاء المشروع. والمهندس يُقرّ إغلاق كل شهر، فيُولّد
//  تقرير الشهر للعميل.
//
//  نسبة الإنجاز هنا زمنية (الأشهر المنقضية من مدة العقد) لا عددية،
//  لأن المنجز = الإجمالي دائماً في هذا النموذج.
// ─────────────────────────────────────────────────────────────────────

const AR_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو',
                   'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']

export default function PeriodicSupervision() {
  const { user: me } = useCurrentUser()
  const nav = useNavigate()
  const [projects, setProjects] = useState([])
  const [periods, setPeriods]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [busy, setBusy]         = useState(null)
  const [err, setErr]           = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true); setErr('')
    try {
      // يضمن وجود سجل الشهر الجاري لكل مشروع دوري نشط
      await supabase.rpc('ensure_current_supervision_period')

      const [{ data: pr, error: e1 }, { data: pe, error: e2 }] = await Promise.all([
        supabase.from('projects')
          .select('id, name, project_no, visits_per_month, supervision_start, supervision_months, supervision_ended_at, progress')
          .eq('supervision_type', 'periodic').order('name'),
        supabase.from('supervision_month_status')
          .select('*').order('year', { ascending: false }).order('month', { ascending: false })
      ])
      if (e1) throw new Error(e1.message)
      if (e2) throw new Error(e2.message)
      setProjects(pr || []); setPeriods(pe || [])
    } catch (e) {
      console.error('تعذّر تحميل الإشراف الدوري:', e?.message ?? e)
      setErr(e?.message ?? String(e))
    } finally { setLoading(false) }
  }

  async function closeMonth(period) {
    const short = period.actual_visits < period.required_visits
    const msg = short
      ? `نُفّذت ${period.actual_visits} زيارة من ${period.required_visits} المطلوبة.\nهل تُقرّ إغلاق الشهر رغم النقص؟`
      : `إغلاق ${AR_MONTHS[period.month-1]} ${period.year} — ${period.actual_visits} زيارة.\nمتابعة؟`
    if (!confirm(msg)) return

    setBusy(period.id); setErr('')
    const { error } = await supabase.from('supervision_periods')
      .update({ closed_at: new Date().toISOString(), closed_by: me?.id ?? null })
      .eq('id', period.id)
    setBusy(null)
    if (error) { setErr('تعذّر إغلاق الشهر: ' + error.message); return }
    await load()
  }

  async function reopenMonth(period) {
    if (!confirm('إعادة فتح الشهر تلغي إقرار الإغلاق. متابعة؟')) return
    setBusy(period.id)
    const { error } = await supabase.from('supervision_periods')
      .update({ closed_at: null, closed_by: null }).eq('id', period.id)
    setBusy(null)
    if (error) { setErr('تعذّر إعادة الفتح: ' + error.message); return }
    await load()
  }

  async function endSupervision(project) {
    if (!confirm(`إعلان انتهاء الإشراف على «${project.name}».\nلن تُنشأ أشهر جديدة بعد ذلك. متابعة؟`)) return
    setBusy(project.id)
    const { error } = await supabase.from('projects')
      .update({ supervision_ended_at: new Date().toISOString(), supervision_ended_by: me?.id ?? null })
      .eq('id', project.id)
    setBusy(null)
    if (error) { setErr('تعذّر إنهاء الإشراف: ' + error.message); return }
    await load()
  }

  if (loading) return <div style={{color:'var(--text-muted)'}}>جارٍ التحميل…</div>

  return (
    <>
      <div className="page-header">
        <div>
          <h3>الإشراف الدوري</h3>
          <div className="page-sub">مشاريع بعدد زيارات شهري متفق عليه — يُغلق كل شهر بإقرارك</div>
        </div>
        <button className="btn btn-primary" onClick={()=>nav('/periodic-visit')}>
          + تسجيل زيارة دورية
        </button>
      </div>

      {err && <div className="card" style={{marginBottom:16,color:'#A32D2D'}}>{err}</div>}

      {!projects.length ? (
        <div className="card"><div className="empty">
          <p>لا توجد مشاريع بإشراف دوري بعد.</p>
          <p style={{fontSize:12,marginTop:8,color:'var(--text-muted)'}}>
            لإضافة مشروع: افتح <strong>المشاريع</strong> ← تعديل أو مشروع جديد ←
            اختر من <strong>خطة الإشراف</strong> إحدى الخطتين الشهريتين
            (زيارتان أو ثلاث في الأسبوع)، وحدّد أجر الزيارة الواحدة.
          </p>
        </div></div>
      ) : projects.map(pr => {
        const mine = periods.filter(x => x.project_id === pr.id)
        const ended = !!pr.supervision_ended_at
        return (
          <div key={pr.id} className="card" style={{marginBottom:16}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',
                         gap:12,flexWrap:'wrap',marginBottom:12}}>
              <div>
                <div style={{fontSize:15,fontWeight:600}}>{pr.name}</div>
                <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>
                  {pr.project_no || '—'} · {pr.visits_per_month || 0} زيارة شهرياً
                  {pr.supervision_months
                    ? ` · مدة العقد ${pr.supervision_months} شهراً`
                    : ' · عقد مفتوح'}
                  {pr.supervision_start ? ` · بدأ ${pr.supervision_start}` : ''}
                </div>
              </div>
              {ended ? (
                <span style={{background:'#E1F5EE',color:'#0F6E56',fontSize:11.5,fontWeight:700,
                              padding:'4px 11px',borderRadius:14}}>✓ انتهى الإشراف</span>
              ) : (
                <button className="btn btn-sm" style={{color:'#0F6E56',borderColor:'#0F6E56'}}
                  disabled={busy===pr.id} onClick={()=>endSupervision(pr)}>
                  ✓ انتهى الإشراف
                </button>
              )}
            </div>

            {!mine.length ? (
              <div style={{fontSize:12.5,color:'var(--text-muted)'}}>لا أشهر مسجّلة بعد.</div>
            ) : (
              <table className="table">
                <thead><tr>
                  <th>الشهر</th><th>المطلوب</th><th>المنفّذ</th>
                  <th>زيارات إضافية</th><th>الحالة</th><th></th>
                </tr></thead>
                <tbody>
                  {mine.map(m => {
                    const short = m.actual_visits < m.required_visits
                    return (
                      <tr key={m.id}>
                        <td style={{fontWeight:600}}>{AR_MONTHS[m.month-1]} {m.year}</td>
                        <td>{m.required_visits}</td>
                        <td style={{fontWeight:700,
                             color: short ? (m.is_current_month ? '#854F0B' : '#A32D2D') : '#0F6E56'}}>
                          {m.actual_visits}
                        </td>
                        {/* الزيارات داخل العدد المتعاقد عليه مدفوعة سلفاً،
                            فالمحتسَب هو ما زاد وحده */}
                        <td>
                          {m.extra_visits > 0 ? (
                            <span style={{color:'#A32D2D',fontWeight:700}}>
                              {m.extra_visits}
                              {m.visit_fee
                                ? ` · ${fmtFee(m.extra_due)} د.ب`
                                : ' · حدّد أجر الزيارة'}
                            </span>
                          ) : (
                            <span style={{color:'var(--text-muted)'}}>—</span>
                          )}
                        </td>
                        <td>
                          {m.is_closed ? (
                            <span className="badge badge-done">
                              مغلق{m.closed_by_name ? ' — ' + m.closed_by_name : ''}
                            </span>
                          ) : m.is_current_month ? (
                            <span className="badge badge-progress">الشهر الجاري</span>
                          ) : (
                            <span className="badge badge-open">مفتوح</span>
                          )}
                        </td>
                        <td style={{textAlign:'left'}}>
                          {m.is_closed ? (
                            <button className="btn btn-sm" disabled={busy===m.id}
                              onClick={()=>reopenMonth(m)}>إعادة فتح</button>
                          ) : (
                            <button className="btn btn-sm btn-primary" disabled={busy===m.id}
                              onClick={()=>closeMonth(m)}>
                              {busy===m.id ? '…' : 'تم الانتهاء من إشراف الشهر'}
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )
      })}
    </>
  )
}
