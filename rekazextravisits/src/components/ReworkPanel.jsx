import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import EngineerSelect from './EngineerSelect.jsx'

// ─────────────────────────────────────────────────────────────────────
//  الزيارة الإضافية بأجر
//
//  السبب: الزيارة تتمّ، ويُسجَّل رسوب، فتُنشأ مهمة متابعة — ثم لا شيء.
//  المهندس يعود إلى الموقع مرة ومرتين على نفس المرحلة بلا سجلّ ولا أجر.
//  (مشروع NC/1742/2025 وحده فيه أربع زيارات على «أسقف الدور الأرضي».)
//
//  القاعدة: الزيارة الأصلية تبقى منجزة — العمل أُنجز وسُلّم تقريره.
//  والإعادة سجلّ جديد مرتبط بها، خارج عقد الـ ١٦، وله أجره المستقل.
// ─────────────────────────────────────────────────────────────────────

const localToday = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

const fmt = n => Number(n).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })

export default function ReworkPanel({ visit, project, fails, onCreated }) {
  const [open, setOpen]   = useState(false)
  const [busy, setBusy]   = useState(false)
  const [err, setErr]     = useState('')
  const [saveRate, setSaveRate] = useState(!project?.visit_fee)
  const [f, setF] = useState({
    scheduled_date: localToday(),
    scheduled_time: '09:00',
    engineer_id:   visit.engineer_id || null,
    engineer_name: visit.engineer_name || '',
    chargeable: true,
    fee: project?.visit_fee != null ? String(project.visit_fee) : '',
    waive_reason: ''
  })

  const set = (k, v) => setF(p => ({ ...p, [k]: v }))

  async function create() {
    setErr('')
    const feeNum = parseFloat(f.fee)

    if (f.chargeable && !(feeNum > 0)) {
      setErr('الزيارة محسوبة — أدخل أجرها أولاً.'); return
    }
    if (!f.chargeable && !f.waive_reason.trim()) {
      setErr('الزيارة غير محسوبة — اذكر السبب، فهو ما يُراجَع لاحقاً.'); return
    }
    if (!f.engineer_id) { setErr('اختر المهندس.'); return }
    if (!f.scheduled_date || !f.scheduled_time) { setErr('حدّد التاريخ والوقت.'); return }

    setBusy(true)
    try {
      // ترتيبها بعد الأم مباشرة، فتظهر في مكانها الطبيعي من الخطة
      const { data: row, error } = await supabase.from('project_visits').insert({
        project_id:     visit.project_id,
        title:          visit.title,
        title_ar:       visit.title_ar,
        order_index:    visit.order_index,
        is_rework:      true,
        parent_visit_id: visit.id,
        chargeable:     f.chargeable,
        fee:            f.chargeable ? feeNum : null,
        fee_waived_reason: f.chargeable ? null : f.waive_reason.trim(),
        engineer_id:    f.engineer_id,
        engineer_name:  f.engineer_name,
        scheduled_date: f.scheduled_date,
        scheduled_time: f.scheduled_time,
        status:         'scheduled',
        notes: `إعادة على نفس المرحلة — ${fails} ملاحظة لم تُجتَز في الزيارة السابقة.`
      }).select().single()
      if (error) throw error

      // حفظ الأجر على المشروع مرة واحدة يغني عن إدخاله في كل إعادة
      if (saveRate && f.chargeable && feeNum > 0 && project?.id) {
        const { error: pErr } = await supabase.from('projects')
          .update({ visit_fee: feeNum }).eq('id', project.id)
        if (pErr) console.error('تعذّر حفظ أجر الزيارة على المشروع:', pErr.message)
      }

      setOpen(false)
      onCreated?.(row)
    } catch (e) {
      setErr('تعذّر الإنشاء: ' + (e?.message ?? e))
    } finally { setBusy(false) }
  }

  if (!open) {
    return (
      <div style={{display:'flex',alignItems:'center',gap:9,flexWrap:'wrap',
                   background:'#FCEBEB',border:'1px solid rgba(163,45,45,.25)',
                   borderRadius:7,padding:'8px 11px',marginTop:6}}>
        <span style={{fontSize:12,color:'#A32D2D',fontWeight:600}}>
          ⚠ {fails} ملاحظة لم تُجتَز
        </span>
        <span style={{fontSize:11.5,color:'#7d4a4a',flex:1,minWidth:150}}>
          العمل يحتاج إعادة فحص على نفس المرحلة.
        </span>
        <button type="button" className="btn btn-sm btn-primary" style={{fontSize:11.5}}
          onClick={() => setOpen(true)}>+ زيارة إضافية</button>
      </div>
    )
  }

  return (
    <div style={{background:'#fff',border:'1.5px solid #A32D2D',borderRadius:8,
                 padding:'12px 13px',marginTop:6}}>
      <div style={{fontSize:12.5,fontWeight:700,color:'#A32D2D',marginBottom:9}}>
        زيارة إضافية — {visit.title_ar || visit.title}
      </div>

      {err && (
        <div style={{background:'#FCEBEB',color:'#A32D2D',padding:'7px 10px',
                     borderRadius:6,fontSize:11.5,marginBottom:9}}>{err}</div>
      )}

      <div style={{display:'flex',gap:9,flexWrap:'wrap',alignItems:'flex-end',marginBottom:10}}>
        <div style={{width:170}}>
          <label style={{fontSize:11,color:'var(--text-muted)'}}>المهندس</label>
          <EngineerSelect valueId={f.engineer_id} valueName={f.engineer_name}
            placeholder="اختر…"
            onChange={v => setF(p => ({ ...p, engineer_id: v.id, engineer_name: v.name }))}/>
        </div>
        <div>
          <label style={{fontSize:11,color:'var(--text-muted)'}}>التاريخ</label>
          <input type="date" className="form-input" style={{width:150,fontSize:12.5}}
            value={f.scheduled_date} onChange={e => set('scheduled_date', e.target.value)}/>
        </div>
        <div>
          <label style={{fontSize:11,color:'var(--text-muted)'}}>الوقت</label>
          <input type="time" className="form-input" style={{width:110,fontSize:12.5}}
            value={f.scheduled_time} onChange={e => set('scheduled_time', e.target.value)}/>
        </div>
      </div>

      <label style={{display:'flex',alignItems:'center',gap:8,fontSize:12.5,marginBottom:9,cursor:'pointer'}}>
        <input type="checkbox" checked={f.chargeable} style={{width:16,height:16,cursor:'pointer'}}
          onChange={e => set('chargeable', e.target.checked)}/>
        <span style={{fontWeight:600}}>زيارة محسوبة على العميل</span>
      </label>

      {f.chargeable ? (
        <div style={{display:'flex',gap:9,alignItems:'flex-end',flexWrap:'wrap'}}>
          <div>
            <label style={{fontSize:11,color:'var(--text-muted)'}}>الأجر (د.ب)</label>
            <input type="number" step="0.001" min="0" className="form-input"
              style={{width:130,fontSize:12.5}} value={f.fee}
              placeholder={project?.visit_fee != null ? undefined : 'أدخل الأجر'}
              onChange={e => set('fee', e.target.value)}/>
          </div>
          {project?.visit_fee != null ? (
            <span style={{fontSize:11.5,color:'var(--text-muted)',paddingBottom:8}}>
              أجر هذا المشروع {fmt(project.visit_fee)} د.ب للزيارة
            </span>
          ) : (
            <label style={{display:'flex',alignItems:'center',gap:7,fontSize:11.5,
                           paddingBottom:8,cursor:'pointer',color:'var(--text-muted)'}}>
              <input type="checkbox" checked={saveRate} style={{width:14,height:14,cursor:'pointer'}}
                onChange={e => setSaveRate(e.target.checked)}/>
              احفظه أجراً لهذا المشروع فلا تُدخله مرة أخرى
            </label>
          )}
        </div>
      ) : (
        <div>
          <label style={{fontSize:11,color:'var(--text-muted)'}}>سبب عدم الاحتساب</label>
          <input className="form-input" style={{width:'100%',fontSize:12.5}}
            value={f.waive_reason} placeholder="مثلاً: الملاحظة بسيطة، أو الإعادة بسبب المكتب"
            onChange={e => set('waive_reason', e.target.value)}/>
        </div>
      )}

      <div style={{fontSize:11,color:'var(--text-muted)',marginTop:10,lineHeight:1.6}}>
        الزيارة الأصلية تبقى منجزة — العمل أُنجز وسُلّم تقريره. هذه إعادة مستقلة
        خارج زيارات العقد، ولا تدخل في حساب نسبة الإنجاز.
      </div>

      <div style={{display:'flex',gap:8,marginTop:11}}>
        <button type="button" className="btn btn-sm btn-primary" disabled={busy}
          style={{fontSize:12}} onClick={create}>
          {busy ? 'جاري…' : 'إنشاء الزيارة'}
        </button>
        <button type="button" className="btn btn-sm" style={{fontSize:12}}
          disabled={busy} onClick={() => { setOpen(false); setErr('') }}>إلغاء</button>
      </div>
    </div>
  )
}
