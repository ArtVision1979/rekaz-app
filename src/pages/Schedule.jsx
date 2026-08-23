import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useEngineers } from '../hooks/useEngineers.js'
import { useLang, T } from '../hooks/useSettings.js'
import {
  requestNotificationPermission, getNotificationPermission, pushSupported,
  subscribeToPush, getReminderMinutes, setReminderMinutes
} from '../hooks/useNotifications.js'

// التاريخ المحلي — toISOString يحوّل للتوقيت العالمي، والبحرين +3،
// فمنتصف الليل محلياً يصير اليوم السابق عالمياً وتنزاح الأعمدة يوماً
const localDate = d =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`

const DAYS = {
  en: ['Sat','Sun','Mon','Tue','Wed','Thu'],
  ar: ['السبت','الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس']
}

// ─────────────────────────────────────────────────────────────────────
//  اللون يدلّ على المهندس، لا على المشروع.
//
//  كان اللون مرتبطاً بترتيب المشروع، و٥٣ مشروعاً على ٦ ألوان يعني أن
//  كل لون يتقاسمه تسعة مشاريع — فلا يدلّ على شيء. أما المهندسون فأربعة،
//  فيصير لكل واحد لون خاص ويُقرأ «مَن في الموقع» من نظرة واحدة.
// ─────────────────────────────────────────────────────────────────────
const COLORS  = ['#185FA5','#0F6E56','#534AB7','#A32D2D','#1D9E75','#B0700B']
const BG      = ['#E6F1FB','#E1F5EE','#EEEDFE','#FCEBEB','#E1F5EE','#FAEEDA']
const UNKNOWN = { fg:'#5b5b5b', bg:'#EFEFEF' }   // زيارة بلا مهندس معروف
const CONSULT = { fg:'#854F0B', bg:'#FDF0DC' }   // استشارة — ليست زيارة موقع

const VIEW_KEY = 'rekaz.schedule.view'
const hhmm = t => (t || '09:00').slice(0,5)

function getWeekDates(offset = 0) {
  const today = new Date()
  const day = today.getDay()
  const diff = day === 6 ? 0 : day + 1
  const sat = new Date(today); sat.setDate(today.getDate() - diff + offset * 7)
  return Array.from({length:6}, (_,i) => { const d = new Date(sat); d.setDate(sat.getDate()+i); return d })
}

export default function Schedule() {
  const nav = useNavigate()
  const { lang } = useLang()
  const t = T[lang]
  const ar = lang === 'ar'
  // ar-u-nu-latn: أسماء شهور عربية بأرقام لاتينية — بقية البرنامج
  // يستخدم الأرقام اللاتينية، فلا نخلط ٢٤ مع 24 في الشاشة نفسها
  const LOC = ar ? 'ar-u-nu-latn' : 'en-GB'
  const days = DAYS[lang] || DAYS.en

  const engineers = useEngineers()
  const [schedule, setSchedule] = useState([])
  const [loading, setLoading] = useState(true)
  const [week, setWeek] = useState(0)
  // العرض الافتراضي قائمة: أسبوع نموذجي فيه ٢-٣ زيارات، والشبكة
  // تعرض ٩٦ خانة فارغة حولها. المستخدم يبدّل ويُحفظ اختياره.
  const [view, setView] = useState(() => {
    try { return localStorage.getItem(VIEW_KEY) || 'agenda' } catch { return 'agenda' }
  })
  // ملاحظة: لا نقرأ Notification.permission مباشرة — لو كان الكائن غير
  // معرّف (بعض الـ WebView على أندرويد) يُرمى ReferenceError وتنهار الصفحة.
  const [notifPermission, setNotifPermission] = useState(getNotificationPermission())
  const [notifBefore, setNotifBefore] = useState(60)

  const weekDates = useMemo(() => getWeekDates(week), [week])

  function switchView(v) {
    setView(v)
    try { localStorage.setItem(VIEW_KEY, v) } catch { /* وضع التصفح الخاص */ }
  }

  useEffect(() => { load() }, [week])

  // مدة التذكير محفوظة في الخادم لأنه هو من يرسل، لا المتصفح
  useEffect(() => {
    getReminderMinutes().then(setNotifBefore).catch(() => {})
    // لو سبق أن مُنح الإذن، نتأكد أن اشتراك هذا الجهاز مسجّل
    if (getNotificationPermission() === 'granted') subscribeToPush().catch(() => {})
  }, [])

  async function changeReminderMinutes(minutes) {
    setNotifBefore(minutes)
    const ok = await setReminderMinutes(minutes)
    if (!ok) alert(t.schReminderSaveFailed)
  }

  async function load() {
    setLoading(true)
    try {
      // نفس خطأ التوقيت: toISOString يزيح النافذة يوماً، فتُجلب
      // من الجمعة إلى الأربعاء ولا تظهر زيارات الخميس إطلاقاً
      const dates = getWeekDates(week)
      const start = localDate(dates[0])
      const end   = localDate(dates[5])

      // لم نعد نجلب كل المشاريع: اللون صار للمهندس، واسم المشروع يأتي
      // مع الزيارة نفسها — فسقط استعلام كامل من كل تنقّل بين الأسابيع
      const [{ data: pv }, { data: cons }] = await Promise.all([
        supabase.from('project_visits').select('*, projects(name)').gte('scheduled_date', start).lte('scheduled_date', end).in('status', ['pending','scheduled']).order('scheduled_time'),
        supabase.from('consultations').select('*').gte('consultation_date', start).lte('consultation_date', end).eq('status','pending').order('consultation_time')
      ])

      const merged = [
        ...(pv || []).map(v => ({
          ...v,
          scheduled_time: v.scheduled_time || '09:00',
          // العنوان يُختار وقت العرض لا وقت الجلب — وإلا بقي بلغة
          // كانت مفعّلة ساعة التحميل ولم يتغيّر مع زرّ اللغة
          _label: v.title, _labelAr: v.title_ar,
          _projectName: v.projects?.name || '—',
          _type: 'visit'
        })),
        ...(cons || []).map(c => ({
          ...c,
          scheduled_date: c.consultation_date,
          scheduled_time: c.consultation_time || '09:00',
          _label: c.topic, _labelAr: null,
          _projectName: '💼 ' + c.client_name,
          _type: 'consultation'
        }))
      ]

      setSchedule(merged)

      // لا جدولة في المتصفح — الخادم يتولّى الإرسال عبر pg_cron،
      // فيصل التذكير بريداً وإشعاراً حتى لو كان البرنامج مغلقاً.
    } catch(e) { console.error(e) } finally { setLoading(false) }
  }

  async function enableNotifications() {
    const granted = await requestNotificationPermission()
    setNotifPermission(granted ? 'granted' : 'denied')
    if (granted) await load()
  }

  function open(item) {
    if (item._type === 'consultation') nav('/consultations')
    else if (item.project_id) nav(`/project-visits?project=${item.project_id}`)
  }

  // النطاق الافتراضي 07–20، لكنه يتمدّد ليشمل أي زيارة خارجه —
  // زيارة الساعة 22:30 كانت تختفي تماماً بلا أي إشارة
  const hoursInData = schedule
    .map(s2 => parseInt(hhmm(s2.scheduled_time).slice(0,2), 10))
    .filter(h => Number.isFinite(h))
  const startH = Math.min(7,  ...(hoursInData.length ? hoursInData : [7]))
  const endH   = Math.max(20, ...(hoursInData.length ? hoursInData : [20]))
  const times = Array.from({ length: endH - startH + 1 },
    (_, i) => String(startH + i).padStart(2,'0') + ':00')

  // خريطة ثابتة: المهندس ← لون. الترتيب من قائمة المهندسين (مرتّبة
  // بالاسم) لا من بيانات هذا الأسبوع، حتى لا يتغيّر لون المهندس كلما
  // تنقّلت بين الأسابيع.
  const engColor = useMemo(() => {
    const m = {}
    engineers.forEach((e,i) => {
      const c = { fg: COLORS[i % COLORS.length], bg: BG[i % BG.length] }
      m[e.id] = c
      if (e.full_name) m[e.full_name] = c
      if (e.email)     m[e.email]     = c
    })
    return m
  }, [engineers])

  const colorOf = item => {
    if (item._type === 'consultation') return CONSULT
    return engColor[item.engineer_id] || engColor[item.engineer_name] || UNKNOWN
  }

  // حضور كل مهندس هذا الأسبوع — يصلح دليلاً للألوان ومؤشراً للتوزيع
  const legend = useMemo(() => {
    const counts = {}
    schedule.filter(s => s._type === 'visit').forEach(s => {
      const k = s.engineer_name || '—'
      counts[k] = (counts[k] || 0) + 1
    })
    return Object.entries(counts)
      .map(([name, n]) => ({ name, n, c: engColor[name] || UNKNOWN }))
      .sort((a,b) => b.n - a.n)
  }, [schedule, engColor])

  const byDay = weekDates.map((d, i) => ({
    date: d,
    index: i,
    dateStr: localDate(d),
    items: schedule
      .filter(s => s.scheduled_date === localDate(d))
      .sort((a,b) => hhmm(a.scheduled_time).localeCompare(hhmm(b.scheduled_time)))
  }))

  const total    = schedule.length
  const todayStr = localDate(new Date())
  const plural   = n => n === 1 ? t.schVisit : t.schVisits

  const weekLabel = `${weekDates[0].toLocaleDateString(LOC,{day:'numeric',month:'short'})} – ${weekDates[5].toLocaleDateString(LOC,{day:'numeric',month:'short',year:'numeric'})}`

  const ell = { overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }
  const labelOf = item => (ar && item._labelAr) ? item._labelAr : item._label

  function Block({ item }) {
    const c = colorOf(item)
    const who = item.engineer_name || t.schUnassigned
    return (
      <div onClick={() => open(item)} title={`${item._projectName} — ${labelOf(item)} — ${who}`}
        style={{
          background: c.bg, color: c.fg,
          borderRadius:6, padding:'4px 8px', fontSize:11,
          fontWeight:500, marginBottom:3, cursor:'pointer',
          borderInlineStart: `3px solid ${c.fg}`
        }}>
        <div style={ell}>
          {notifPermission === 'granted' ? '🔔 ' : ''}
          <span style={{opacity:.75,fontVariantNumeric:'tabular-nums'}}>{hhmm(item.scheduled_time)} </span>
          {item._projectName}
        </div>
        <div style={{fontSize:10,opacity:0.8,...ell}}>{labelOf(item)}</div>
        <div style={{fontSize:10,fontWeight:700,marginTop:1,
                     color: item.engineer_name ? 'inherit' : '#A32D2D', ...ell}}>
          👷 {who}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h3>{t.schedule}</h3>
          <div className="page-sub">
            {t.schWeekOf} {weekLabel}
            {' · '}
            <span style={{color: total ? 'inherit' : 'var(--text-muted)'}}>
              {total} {plural(total)}
            </span>
          </div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          {/* تنقّل بين الأسابيع */}
          <div style={{display:'flex',gap:4,alignItems:'center'}}>
            <button className="btn btn-sm" style={{fontSize:12}} onClick={()=>setWeek(w=>w-1)}>{t.schPrev}</button>
            {week !== 0 && (
              <button className="btn btn-sm" style={{fontSize:12}} onClick={()=>setWeek(0)}>{t.schThisWeek}</button>
            )}
            <button className="btn btn-sm" style={{fontSize:12}} onClick={()=>setWeek(w=>w+1)}>{t.schNext}</button>
          </div>

          {/* تبديل العرض */}
          <div style={{display:'flex',border:'1px solid var(--border)',borderRadius:7,overflow:'hidden'}}>
            {[['agenda',t.schViewList],['grid',t.schViewGrid]].map(([v,label]) => (
              <button key={v} onClick={()=>switchView(v)}
                style={{border:'none',padding:'5px 12px',fontSize:12,cursor:'pointer',
                        background: view===v ? 'var(--blue-light,#E6F1FB)' : 'transparent',
                        color: view===v ? 'var(--blue-dark,#12497f)' : 'var(--text-muted)',
                        fontWeight: view===v ? 600 : 400}}>{label}</button>
            ))}
          </div>

          {notifPermission === 'unsupported' ? (
            <span style={{fontSize:12,color:'var(--text-muted)'}}>{t.schNotifUnsupported}</span>
          ) : notifPermission === 'granted' ? (
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span style={{fontSize:12,color:'#0F6E56'}}>🔔 {t.schRemindersOn}</span>
              <select className="form-input" style={{width:ar?130:120,fontSize:12}} value={notifBefore}
                onChange={e=>changeReminderMinutes(parseInt(e.target.value))}>
                <option value={15}>{t.schBefore15}</option>
                <option value={30}>{t.schBefore30}</option>
                <option value={60}>{t.schBefore60}</option>
                <option value={120}>{t.schBefore120}</option>
              </select>
            </div>
          ) : (
            <button className="btn" style={{fontSize:12,color:'#185FA5',borderColor:'#185FA5'}} onClick={enableNotifications}>
              🔔 {t.schEnableReminders}
            </button>
          )}
        </div>
      </div>

      {notifPermission === 'denied' && (
        <div style={{background:'var(--amber-light)',border:'0.5px solid #EF9F27',borderRadius:8,padding:'10px 16px',marginBottom:16,fontSize:13,color:'var(--amber)'}}>
          ⚠ {t.schNotifBlocked}
        </div>
      )}

      {notifPermission === 'granted' && !pushSupported() && (
        <div style={{background:'var(--amber-light)',border:'0.5px solid #EF9F27',borderRadius:8,padding:'10px 16px',marginBottom:16,fontSize:13,color:'var(--amber)'}}>
          ⚠ {t.schPushUnsupported}
        </div>
      )}

      {/* دليل الألوان — لون لكل مهندس، والعدد حِمله هذا الأسبوع */}
      {!loading && legend.length > 0 && (
        <div style={{display:'flex',gap:14,flexWrap:'wrap',alignItems:'center',
                     marginBottom:12,fontSize:12}}>
          {legend.map(l => (
            <span key={l.name} style={{display:'flex',alignItems:'center',gap:6}}>
              <span style={{width:11,height:11,borderRadius:3,background:l.c.fg,flexShrink:0}}/>
              <span style={{color:'var(--text-muted)'}}>
                {l.name === '—' ? t.schUnassigned : l.name}
                {' '}<strong style={{color:l.c.fg}}>{l.n}</strong>
              </span>
            </span>
          ))}
        </div>
      )}

      {loading ? (
        <div className="card"><div style={{color:'var(--text-muted)',padding:16}}>{t.loading}</div></div>
      ) : view === 'agenda' ? (
        /* ── عرض القائمة: أيام فيها زيارات فقط ── */
        <div className="card">
          {total === 0 ? (
            <div style={{color:'var(--text-muted)',padding:'26px 16px',textAlign:'center',fontSize:13}}>
              {t.schNoVisits}
            </div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              {byDay.filter(d => d.items.length).map(d => {
                const isToday = d.dateStr === todayStr
                return (
                  <div key={d.dateStr}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:7,
                                 paddingBottom:6,borderBottom:'0.5px solid var(--border)'}}>
                      <span style={{fontWeight:600,fontSize:13.5,
                                    color: isToday ? 'var(--blue-dark,#12497f)' : 'inherit'}}>
                        {days[d.index]} {d.date.getDate()}{' '}
                        {d.date.toLocaleDateString(LOC,{month:'short'})}
                      </span>
                      {isToday && (
                        <span style={{background:'var(--blue-light,#E6F1FB)',color:'var(--blue-dark,#12497f)',
                                      fontSize:10.5,fontWeight:700,padding:'2px 7px',borderRadius:11}}>{t.schToday}</span>
                      )}
                      <span style={{fontSize:11.5,color:'var(--text-muted)'}}>
                        {d.items.length} {plural(d.items.length)}
                      </span>
                    </div>

                    <div style={{display:'flex',flexDirection:'column',gap:6}}>
                      {d.items.map(item => {
                        const c = colorOf(item)
                        return (
                          <div key={item.id} onClick={() => open(item)} title={t.schOpenProject}
                            style={{display:'flex',gap:11,alignItems:'flex-start',cursor:'pointer',
                                    background: c.bg, borderRadius:7, padding:'9px 11px',
                                    borderInlineStart:`3px solid ${c.fg}`}}>
                            <span style={{fontSize:13,fontWeight:700,color:c.fg,
                                          fontVariantNumeric:'tabular-nums',flexShrink:0,minWidth:44}}>
                              {hhmm(item.scheduled_time)}
                            </span>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:12.5,fontWeight:600,color:c.fg,lineHeight:1.35}}>
                                {item._projectName}
                              </div>
                              <div style={{fontSize:11.5,color:'var(--text-muted)',marginTop:2}}>
                                {labelOf(item)}
                              </div>
                            </div>
                            <span style={{fontSize:11.5,fontWeight:700,flexShrink:0,
                                          display:'flex',alignItems:'center',gap:5,
                                          color: item.engineer_name ? c.fg : '#A32D2D'}}>
                              👷 {item.engineer_name || t.schUnassigned}
                              {notifPermission === 'granted' && <span title={t.schReminderSet}>🔔</span>}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        /* ── عرض الشبكة: أعمدة متساوية بـ table-layout: fixed ── */
        <div className="card" style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,
                         minWidth:760,tableLayout:'fixed'}}>
            <colgroup>
              <col style={{width:56}} />
              {weekDates.map((_,i) => <col key={i} style={{width:`${(100/6).toFixed(4)}%`}} />)}
            </colgroup>
            <thead>
              <tr>
                <th style={{padding:'8px 10px',color:'var(--text-muted)',fontWeight:400,borderBottom:'0.5px solid var(--border)'}}></th>
                {weekDates.map((d,i) => {
                  const isToday = localDate(d) === todayStr
                  return (
                    <th key={i} style={{padding:'8px 6px',fontWeight:500,textAlign:'center',borderBottom:'0.5px solid var(--border)',background:isToday?'var(--blue-light)':'transparent',color:isToday?'var(--blue-dark)':'inherit',borderRadius:isToday?6:0}}>
                      {days[i]} {d.getDate()}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {times.map(time => (
                <tr key={time}>
                  <td style={{padding:'8px 10px',color:'var(--text-muted)',fontSize:11,borderBottom:'0.5px solid var(--border)',fontVariantNumeric:'tabular-nums'}}>{time}</td>
                  {weekDates.map((d,di) => {
                    const dateStr = localDate(d)
                    const items = schedule.filter(s =>
                      s.scheduled_date === dateStr &&
                      hhmm(s.scheduled_time).slice(0,2) === time.slice(0,2)
                    )
                    return (
                      <td key={di} style={{padding:'4px',borderBottom:'0.5px solid var(--border)',verticalAlign:'top',height:36}}>
                        {items.map(item => <Block key={item.id} item={item} />)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
