import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

// ─────────────────────────────────────────────────────────────────────
//  التقرير الدوري — ما جرى في المكتب خلال فترة
//
//  لم يكن في البرنامج أي تقرير يتجاوز العنصر الواحد: تُطبع بطاقة
//  مشروع، أو تقرير زيارة، أو قائمة زيارات مشروع واحد. ولمعرفة ما جرى
//  في المكتب ككل لم يكن هناك سبيل إلا فتح المشاريع واحداً واحداً.
//
//  مصادر التواريخ هنا مختارة بعناية:
//    • site_visits.visit_date  — تاريخ الزيارة الفعلي، نظيف
//    • reports.created_at      — لحظة إصدار التقرير
//    • project_visits.completed_at — عمود مخصص أُضيف لهذا الغرض،
//      ولا نعتمد على updated_at لأنه يتغيّر مع أي تعديل عابر.
// ─────────────────────────────────────────────────────────────────────

// التاريخ المحلي — toISOString يحوّل للتوقيت العالمي، والبحرين +3،
// فبين منتصف الليل و3 فجراً يُحسب «اليوم» على أنه أمس
const iso = d =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`

function presetRange(kind) {
  const now = new Date()
  const to = new Date(now)
  const from = new Date(now)
  if (kind === 'week') from.setDate(now.getDate() - 6)
  else if (kind === 'month') from.setDate(now.getDate() - 29)
  else if (kind === 'quarter') from.setDate(now.getDate() - 89)
  return { from: iso(from), to: iso(to) }
}

export default function PeriodReport() {
  const [preset, setPreset] = useState('week')
  const [range, setRange]   = useState(presetRange('week'))
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr]       = useState('')

  useEffect(() => { load() }, [range.from, range.to])

  function choosePreset(k) {
    setPreset(k)
    if (k !== 'custom') setRange(presetRange(k))
  }

  async function load() {
    setLoading(true); setErr('')
    try {
      const { from, to } = range
      const [visits, reports, completed, findings, overdue, stale] = await Promise.all([
        supabase.from('site_visits')
          .select('id, visit_date, engineer_id, engineer_name, notes, projects(name, project_no)')
          .gte('visit_date', from).lte('visit_date', to)
          .order('visit_date', { ascending: false }),

        supabase.from('reports')
          .select('id, report_no, created_at, last_sent_at, projects(name)')
          .gte('created_at', from).lte('created_at', to + 'T23:59:59'),

        supabase.from('project_visits')
          .select('id, title, title_ar, completed_at, engineer_name, projects(name)')
          .gte('completed_at', from).lte('completed_at', to + 'T23:59:59'),

        supabase.from('visit_checklist_results')
          .select('id, item_text, result, visit_id')
          .eq('result', 'fail'),

        supabase.from('project_next_visit').select('*').eq('state', 'overdue'),

        supabase.from('project_next_visit').select('*').eq('state', 'no_date'),
      ])

      const firstErr = [visits, reports, completed, findings, overdue, stale].find(r => r.error)
      if (firstErr) throw new Error(firstErr.error.message)

      setData({
        visits: visits.data || [],
        reports: reports.data || [],
        completed: completed.data || [],
        findings: findings.data || [],
        overdue: overdue.data || [],
        stale: stale.data || [],
      })
    } catch (e) {
      console.error('تعذّر بناء التقرير:', e?.message ?? e)
      setErr(e?.message ?? String(e))
    } finally { setLoading(false) }
  }

  function byEngineer() {
    const m = {}
    ;(data?.visits || []).forEach(v => {
      const k = v.engineer_name || 'بلا مهندس'
      m[k] = m[k] || { visits: 0, projects: new Set() }
      m[k].visits++
      if (v.projects?.name) m[k].projects.add(v.projects.name)
    })
    return Object.entries(m)
      .map(([name, s]) => ({ name, visits: s.visits, projects: s.projects.size }))
      .sort((a, b) => b.visits - a.visits)
  }

  function byProject() {
    const m = {}
    ;(data?.visits || []).forEach(v => {
      const k = v.projects?.name || '—'
      m[k] = m[k] || { visits: 0, last: null, no: v.projects?.project_no }
      m[k].visits++
      if (!m[k].last || v.visit_date > m[k].last) m[k].last = v.visit_date
    })
    return Object.entries(m)
      .map(([name, s]) => ({ name, ...s }))
      .sort((a, b) => b.visits - a.visits)
  }

  function print() {
    const w = window.open('', '_blank')
    if (!w) { alert('المتصفح منع فتح نافذة الطباعة'); return }
    const eng = byEngineer(), proj = byProject()
    const sent = (data?.reports || []).filter(r => r.last_sent_at).length
    w.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
      <title>تقرير الفترة ${range.from} — ${range.to}</title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:Arial,sans-serif;padding:34px;color:#111;font-size:12.5px;line-height:1.6}
        h1{font-size:20px;margin-bottom:2px}
        .per{color:#666;font-size:12px;margin-bottom:18px}
        h2{font-size:14px;margin:20px 0 7px;padding-bottom:4px;border-bottom:1.5px solid #185FA5;color:#185FA5}
        table{width:100%;border-collapse:collapse;margin-bottom:6px}
        th{text-align:right;font-size:10.5px;color:#666;padding:6px 7px;border-bottom:1px solid #ccc;font-weight:600}
        td{padding:6px 7px;border-bottom:1px solid #eee}
        .tiles{display:flex;gap:9px;flex-wrap:wrap;margin-bottom:6px}
        .tile{border:1px solid #ddd;border-radius:7px;padding:9px 14px;min-width:104px}
        .tile b{font-size:19px;display:block}
        .tile span{font-size:10.5px;color:#666}
        .warn{color:#A32D2D;font-weight:700}
        @media print{body{padding:16px}.no-print{display:none!important}}
      </style></head><body>
      <h1>ركاز للاستشارات الهندسية — تقرير الفترة</h1>
      <div class="per">من ${range.from} إلى ${range.to}</div>

      <h2>الملخص</h2>
      <div class="tiles">
        <div class="tile"><b>${data.visits.length}</b><span>زيارة موقع</span></div>
        <div class="tile"><b>${data.completed.length}</b><span>زيارة أُنجزت</span></div>
        <div class="tile"><b>${data.reports.length}</b><span>تقرير صدر</span></div>
        <div class="tile"><b>${sent}</b><span>تقرير سُلّم للعميل</span></div>
        <div class="tile"><b>${proj.length}</b><span>مشروع به نشاط</span></div>
      </div>

      <h2>حسب المهندس</h2>
      <table><thead><tr><th>المهندس</th><th>زيارات</th><th>مشاريع</th></tr></thead><tbody>
      ${eng.length ? eng.map(e => `<tr><td>${e.name}</td><td>${e.visits}</td><td>${e.projects}</td></tr>`).join('')
                   : '<tr><td colspan="3">لا نشاط في الفترة</td></tr>'}
      </tbody></table>

      <h2>حسب المشروع</h2>
      <table><thead><tr><th>المشروع</th><th>زيارات</th><th>آخر زيارة</th></tr></thead><tbody>
      ${proj.length ? proj.map(p => `<tr><td>${p.name}</td><td>${p.visits}</td><td>${p.last || '—'}</td></tr>`).join('')
                    : '<tr><td colspan="3">لا نشاط في الفترة</td></tr>'}
      </tbody></table>

      <h2>يحتاج انتباه الإدارة</h2>
      <div class="tiles">
        <div class="tile"><b class="warn">${data.overdue.length}</b><span>زيارة تالية متأخرة</span></div>
        <div class="tile"><b class="warn">${data.stale.length}</b><span>مشروع بلا موعد تالٍ</span></div>
        <div class="tile"><b class="warn">${data.findings.length}</b><span>ملاحظة مفتوحة</span></div>
      </div>
      ${data.overdue.length ? `<table><thead><tr><th>المشروع</th><th>الزيارة</th><th>التأخير</th><th>المهندس</th></tr></thead><tbody>
        ${data.overdue.slice(0,15).map(o=>`<tr><td>${o.project_name}</td><td>${o.title_ar||o.title}</td><td class="warn">${o.days_late} يوماً</td><td>${o.engineer_name||'—'}</td></tr>`).join('')}
      </tbody></table>`:''}

      <div style="margin-top:26px;padding-top:9px;border-top:1px solid #ddd;color:#888;font-size:10.5px">
        أُنشئ في ${new Date().toLocaleString('ar-BH')}
      </div>
      <div class="no-print" style="margin-top:20px;text-align:center">
        <button onclick="window.print()" style="background:#185FA5;color:#fff;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600">🖨 طباعة / PDF</button>
      </div>
      </body></html>`)
    w.document.close()
  }

  const eng = byEngineer(), proj = byProject()
  const sent = (data?.reports || []).filter(r => r.last_sent_at).length

  return (
    <>
      <div className="page-header">
        <div>
          <h3>التقرير الدوري</h3>
          <div className="page-sub">ما جرى في المكتب خلال فترة تختارها</div>
        </div>
        {data && !loading && (
          <button className="btn btn-primary" onClick={print}>🖨 طباعة / PDF</button>
        )}
      </div>

      <div className="card" style={{marginBottom:16}}>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
          {[['week','هذا الأسبوع'],['month','هذا الشهر'],['quarter','آخر 3 أشهر'],['custom','مخصص']].map(([k,label])=>(
            <button key={k} className={`btn btn-sm ${preset===k?'btn-primary':''}`} onClick={()=>choosePreset(k)}>{label}</button>
          ))}
          {preset === 'custom' && (
            <>
              <input type="date" className="form-input" style={{width:150}} value={range.from}
                onChange={e=>setRange(r=>({...r,from:e.target.value}))}/>
              <span style={{color:'var(--text-muted)'}}>إلى</span>
              <input type="date" className="form-input" style={{width:150}} value={range.to}
                onChange={e=>setRange(r=>({...r,to:e.target.value}))}/>
            </>
          )}
        </div>
        <div style={{fontSize:12,color:'var(--text-muted)',marginTop:9}}>
          من {range.from} إلى {range.to}
        </div>
      </div>

      {err && <div className="card" style={{marginBottom:16,color:'#A32D2D'}}>تعذّر بناء التقرير: {err}</div>}
      {loading ? <div style={{color:'var(--text-muted)'}}>جارٍ الحساب…</div> : data && (
        <>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:12,marginBottom:16}}>
            {[['زيارة موقع',data.visits.length,'#0F6E56'],
              ['زيارة أُنجزت',data.completed.length,'#185FA5'],
              ['تقرير صدر',data.reports.length,'#185FA5'],
              ['سُلّم للعميل',sent,'#0F6E56'],
              ['مشروع نشط',proj.length,'#854F0B']].map(([l,v,c])=>(
              <div key={l} className="card" style={{padding:'14px 16px'}}>
                <div style={{fontSize:26,fontWeight:700,color:c}}>{v}</div>
                <div style={{fontSize:12,color:'var(--text-muted)'}}>{l}</div>
              </div>
            ))}
          </div>

          <div className="card" style={{marginBottom:16}}>
            <div className="card-head" style={{marginBottom:8}}><span className="card-title">حسب المهندس</span></div>
            {eng.length ? (
              <table className="table"><thead><tr><th>المهندس</th><th>زيارات</th><th>مشاريع</th></tr></thead>
                <tbody>{eng.map(e=>(<tr key={e.name}><td>{e.name}</td><td>{e.visits}</td><td>{e.projects}</td></tr>))}</tbody>
              </table>
            ) : <div className="empty"><p>لا نشاط مسجّل في هذه الفترة</p></div>}
          </div>

          <div className="card" style={{marginBottom:16}}>
            <div className="card-head" style={{marginBottom:8}}><span className="card-title">حسب المشروع</span></div>
            {proj.length ? (
              <table className="table"><thead><tr><th>المشروع</th><th>زيارات</th><th>آخر زيارة</th></tr></thead>
                <tbody>{proj.map(p=>(<tr key={p.name}><td>{p.name}</td><td>{p.visits}</td><td>{p.last||'—'}</td></tr>))}</tbody>
              </table>
            ) : <div className="empty"><p>لا نشاط مسجّل في هذه الفترة</p></div>}
          </div>

          <div className="card" style={{border:'1px solid rgba(163,45,45,.25)'}}>
            <div className="card-head" style={{marginBottom:8}}>
              <span className="card-title" style={{color:'#A32D2D'}}>يحتاج انتباه الإدارة</span>
            </div>
            <div style={{display:'flex',gap:22,flexWrap:'wrap',fontSize:13}}>
              <span><strong style={{fontSize:20,color:'#A32D2D'}}>{data.overdue.length}</strong> زيارة تالية متأخرة</span>
              <span><strong style={{fontSize:20,color:'#854F0B'}}>{data.stale.length}</strong> مشروع بلا موعد تالٍ</span>
              <span><strong style={{fontSize:20,color:'#A32D2D'}}>{data.findings.length}</strong> ملاحظة مفتوحة</span>
            </div>
            <div style={{fontSize:11.5,color:'var(--text-muted)',marginTop:9}}>
              هذه الأرقام لحظية ولا تتبع الفترة المختارة — هي وضع المكتب الآن.
            </div>
          </div>
        </>
      )}
    </>
  )
}
