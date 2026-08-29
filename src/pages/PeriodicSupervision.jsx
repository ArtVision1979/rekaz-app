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
  // الشهر المفتوح وزياراته — كان الصف نهاية الطريق: رقمٌ بلا سبيل
  // لرؤية ما وراءه ولا لتعديله ولا للإضافة إليه
  const [openMonth, setOpenMonth] = useState(null)
  const [monthVisits, setMonthVisits] = useState([])
  const [loadingVisits, setLoadingVisits] = useState(false)
  // قائمة مشاريع أولاً، ثم تفاصيل مشروع واحد. فتح كل المشاريع دفعةً
  // واحدة يعمل مع مشروع أو اثنين، ويصير فوضى مع عشرين.
  const [openProject, setOpenProject] = useState(null)

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

  async function toggleMonth(m) {
    if (openMonth === m.id) { setOpenMonth(null); setMonthVisits([]); return }
    setOpenMonth(m.id); setLoadingVisits(true); setMonthVisits([])
    const from = `${m.year}-${String(m.month).padStart(2,'0')}-01`
    const to   = new Date(m.year, m.month, 0)   // آخر يوم في الشهر
    const toStr = `${m.year}-${String(m.month).padStart(2,'0')}-${String(to.getDate()).padStart(2,'0')}`
    const { data, error } = await supabase.from('site_visits')
      .select('*, visit_checklist_results(id, result)')
      .eq('project_id', m.project_id)
      .gte('visit_date', from).lte('visit_date', toStr)
      .order('visit_date')
    if (error) setErr('تعذّر جلب زيارات الشهر: ' + error.message)
    else setMonthVisits(data || [])
    setLoadingVisits(false)
  }

  // إضافة زيارة داخل هذا الشهر تحديداً — لا في تاريخ اليوم
  function addVisitTo(m) {
    const today = new Date()
    const inMonth = today.getFullYear() === m.year && today.getMonth() + 1 === m.month
    const last = new Date(m.year, m.month, 0).getDate()
    const day = inMonth ? today.getDate() : last
    const date = `${m.year}-${String(m.month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    nav(`/periodic-visit?project=${m.project_id}&date=${date}`)
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
      ) : !openProject ? (
        /* ── فهرس المشاريع ── */
        <div style={{display:'flex',flexDirection:'column',gap:9}}>
          {projects.map(pr => {
            const mine = periods.filter(x => x.project_id === pr.id)
            const now  = mine.find(x => x.is_current_month)
            const short = now && now.actual_visits < now.required_visits
            const ended = !!pr.supervision_ended_at
            const due = mine.reduce((s2, x) => s2 + Number(x.extra_due || 0), 0)
            return (
              <div key={pr.id} className="card"
                onClick={()=>{ setOpenProject(pr.id); setOpenMonth(null); setMonthVisits([]) }}
                style={{cursor:'pointer',display:'flex',alignItems:'center',
                        gap:14,flexWrap:'wrap'}}>
                <div style={{flex:1,minWidth:210}}>
                  <div style={{fontSize:14,fontWeight:600}}>{pr.name}</div>
                  <div style={{fontSize:11.5,color:'var(--text-muted)',marginTop:2}}>
                    {pr.project_no || '—'} · {pr.visits_per_month || 0} زيارة شهرياً
                    {pr.supervision_months
                      ? ` · ${pr.supervision_months} شهراً`
                      : ' · عقد مفتوح'}
                  </div>
                </div>

                {ended ? (
                  <span style={{background:'#E1F5EE',color:'#0F6E56',fontSize:11,fontWeight:700,
                                padding:'3px 10px',borderRadius:12}}>✓ انتهى</span>
                ) : now ? (
                  <div style={{textAlign:'center',minWidth:78}}>
                    <div style={{fontSize:17,fontWeight:700,fontVariantNumeric:'tabular-nums',
                                 color: short ? '#854F0B' : '#0F6E56'}}>
                      {now.actual_visits}/{now.required_visits}
                    </div>
                    <div style={{fontSize:10,color:'var(--text-muted)'}}>
                      {AR_MONTHS[now.month-1]}
                    </div>
                  </div>
                ) : (
                  <span style={{fontSize:11.5,color:'var(--text-muted)'}}>لا شهر جارٍ</span>
                )}

                {due > 0 && (
                  <span style={{background:'#FCEBEB',color:'#A32D2D',fontSize:11,fontWeight:700,
                                padding:'3px 10px',borderRadius:12}}>
                    مستحق {fmtFee(due)} د.ب
                  </span>
                )}

                <span style={{fontSize:11.5,color:'var(--text-muted)'}}>
                  {mine.length} شهر ‹
                </span>
              </div>
            )
          })}
        </div>
      ) : projects.filter(p => p.id === openProject).map(pr => {
        const mine = periods.filter(x => x.project_id === pr.id)
        const ended = !!pr.supervision_ended_at
        return (
          <div key={pr.id} className="card" style={{marginBottom:16}}>
            <button className="btn btn-sm" style={{marginBottom:12,fontSize:12}}
              onClick={()=>{ setOpenProject(null); setOpenMonth(null); setMonthVisits([]) }}>
              › كل المشاريع
            </button>
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
                  {mine.flatMap(m => {
                    const short = m.actual_visits < m.required_visits
                    return [(
                      <tr key={m.id} onClick={()=>toggleMonth(m)}
                        title="اضغط لعرض زيارات هذا الشهر"
                        style={{cursor:'pointer',
                                background: openMonth===m.id ? 'var(--bg)' : undefined}}>
                        <td style={{fontWeight:600,display:'flex',alignItems:'center',gap:7}}>
                          <span style={{fontSize:9,opacity:.55,width:9,display:'inline-block'}}>
                            {openMonth===m.id ? '▲' : '▼'}
                          </span>
                          {AR_MONTHS[m.month-1]} {m.year}
                        </td>
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
                              onClick={e=>{ e.stopPropagation(); reopenMonth(m) }}>إعادة فتح</button>
                          ) : (
                            <button className="btn btn-sm btn-primary" disabled={busy===m.id}
                              onClick={e=>{ e.stopPropagation(); closeMonth(m) }}>
                              {busy===m.id ? '…' : 'تم الانتهاء من إشراف الشهر'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ), openMonth === m.id && (
                      <tr key={m.id + '-open'} onClick={e=>e.stopPropagation()}>
                        <td colSpan={6} style={{background:'var(--bg)',padding:'12px 14px'}}>
                          {loadingVisits ? (
                            <div style={{fontSize:12.5,color:'var(--text-muted)'}}>جارٍ التحميل…</div>
                          ) : (
                            <>
                              <div style={{display:'flex',alignItems:'center',gap:10,
                                           flexWrap:'wrap',marginBottom:monthVisits.length?10:0}}>
                                <strong style={{fontSize:12.5}}>
                                  زيارات {AR_MONTHS[m.month-1]} {m.year}
                                </strong>
                                <span style={{fontSize:11.5,color:'var(--text-muted)'}}>
                                  {monthVisits.length} من {m.required_visits}
                                </span>
                                <button className="btn btn-sm btn-primary" style={{fontSize:11.5}}
                                  onClick={()=>addVisitTo(m)}>+ زيارة في هذا الشهر</button>
                              </div>

                              {!monthVisits.length ? (
                                <div style={{fontSize:12.5,color:'var(--text-muted)'}}>
                                  لا زيارات مسجّلة في هذا الشهر.
                                </div>
                              ) : (
                                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                                  {monthVisits.map(v => {
                                    const res = v.visit_checklist_results || []
                                    const fails = res.filter(r => r.result === 'fail').length
                                    return (
                                      <div key={v.id}
                                        style={{display:'flex',gap:11,alignItems:'center',flexWrap:'wrap',
                                                background:'var(--bg-card,#fff)',border:'1px solid var(--border)',
                                                borderRadius:7,padding:'8px 11px'}}>
                                        <span style={{fontSize:12,fontWeight:700,
                                                      fontVariantNumeric:'tabular-nums',minWidth:88}}>
                                          {v.visit_date}
                                        </span>
                                        <span style={{fontSize:11.5,color:'var(--text-muted)',minWidth:100}}>
                                          {v.engineer_name || '—'}
                                        </span>
                                        <span style={{fontSize:11.5,flex:1,minWidth:130,
                                                      overflow:'hidden',textOverflow:'ellipsis',
                                                      whiteSpace:'nowrap'}}>
                                          {v.notes || '—'}
                                        </span>
                                        <span style={{fontSize:11,fontWeight:700,
                                                      color: fails ? '#A32D2D' : 'var(--text-muted)'}}>
                                          {res.length} ملاحظة{fails ? ` · ${fails} راسبة` : ''}
                                        </span>
                                        <button className="btn btn-sm" style={{fontSize:11}}
                                          onClick={()=>nav(`/visits?project=${m.project_id}`)}>تعديل</button>
                                        <button className="btn btn-sm" style={{fontSize:11}}
                                          onClick={()=>nav(`/reports?project=${m.project_id}`)}>التقرير</button>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                    )].filter(Boolean)
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
