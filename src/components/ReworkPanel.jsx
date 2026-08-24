import { useState } from 'react'
import EngineerSelect from './EngineerSelect.jsx'
import { createRework, markDecision, saveProjectRate, localToday, fmtFee } from '../lib/rework.js'

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

export default function ReworkPanel({ visit, project, fails, onCreated }) {
  const [open, setOpen]   = useState(false)
  const [busy, setBusy]   = useState(false)
  const [err, setErr]     = useState('')
  // صرف التنبيه قرارٌ يُسجَّل بسببه، لا إخفاء صامت
  const [waiving, setWaiving] = useState(false)
  const [waiveNote, setWaiveNote] = useState('')
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
    if (!f.engineer_id) { setErr('اختر المهندس.'); return }
    if (!f.scheduled_date || !f.scheduled_time) { setErr('حدّد التاريخ والوقت.'); return }

    setBusy(true)
    try {
      const row = await createRework(visit, {
        fee: feeNum,
        chargeable: f.chargeable,
        waiveReason: f.waive_reason,
        scheduledDate: f.scheduled_date,
        scheduledTime: f.scheduled_time,
        engineerId: f.engineer_id,
        engineerName: f.engineer_name,
        fails
      })
      // حفظ الأجر على المشروع مرة واحدة يغني عن إدخاله في كل إعادة
      if (saveRate && f.chargeable && feeNum > 0) await saveProjectRate(project?.id, feeNum)
      setOpen(false)
      onCreated?.(row)
    } catch (e) {
      setErr(e?.message ?? String(e))
    } finally { setBusy(false) }
  }

  async function waive() {
    if (!waiveNote.trim()) { setErr('اذكر سبب عدم لزوم الإعادة — هو ما يُراجَع لاحقاً.'); return }
    setBusy(true); setErr('')
    try {
      await markDecision(visit.id, 'not_needed', waiveNote)
      setWaiving(false)
      onCreated?.(null)
    } catch (e) {
      setErr('تعذّر الحفظ: ' + (e?.message ?? e))
    } finally { setBusy(false) }
  }

  if (!open) {
    return (
      <div style={{background:'#FCEBEB',border:'1px solid rgba(163,45,45,.25)',
                   borderRadius:7,padding:'8px 11px',marginTop:6}}>
        <div style={{display:'flex',alignItems:'center',gap:9,flexWrap:'wrap'}}>
          <span style={{fontSize:12,color:'#A32D2D',fontWeight:600}}>
            ⚠ {fails} ملاحظة لم تُجتَز
          </span>
          <span style={{fontSize:11.5,color:'#7d4a4a',flex:1,minWidth:150}}>
            العمل يحتاج إعادة فحص على نفس المرحلة.
          </span>
          <button type="button" className="btn btn-sm btn-primary" style={{fontSize:11.5}}
            onClick={() => { setOpen(true); setWaiving(false) }}>+ زيارة إضافية</button>
          <button type="button" className="btn btn-sm" style={{fontSize:11.5}}
            onClick={() => { setWaiving(w => !w); setErr('') }}>لا تلزم إعادة</button>
        </div>

        {waiving && (
          <div style={{marginTop:9,paddingTop:9,borderTop:'1px solid rgba(163,45,45,.18)'}}>
            <div style={{fontSize:11.5,color:'#7d4a4a',marginBottom:6}}>
              لماذا لا تلزم إعادة؟ يُسجَّل السبب باسمك وتاريخه.
            </div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              <input className="form-input" style={{flex:1,minWidth:190,fontSize:12.5}}
                value={waiveNote} autoFocus
                placeholder="مثلاً: عولجت في الموقع · ملاحظة شكلية · تُراجَع في الزيارة التالية"
                onChange={e => setWaiveNote(e.target.value)}/>
              <button type="button" className="btn btn-sm btn-primary" style={{fontSize:12}}
                disabled={busy} onClick={waive}>{busy ? '…' : 'تأكيد'}</button>
              <button type="button" className="btn btn-sm" style={{fontSize:12}}
                disabled={busy} onClick={() => { setWaiving(false); setErr('') }}>إلغاء</button>
            </div>
            {err && <div style={{color:'#A32D2D',fontSize:11.5,marginTop:6,fontWeight:600}}>{err}</div>}
          </div>
        )}
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
              أجر هذا المشروع {fmtFee(project.visit_fee)} د.ب للزيارة
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
