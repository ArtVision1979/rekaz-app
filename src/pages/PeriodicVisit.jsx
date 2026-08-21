import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useCurrentUser } from '../hooks/useCurrentUser.js'
import EngineerSelect from '../components/EngineerSelect.jsx'

// ─────────────────────────────────────────────────────────────────────
//  تسجيل زيارة دورية
//
//  الزيارة الدورية لا قائمة فحص ثابتة لها — المهندس يأتي ليرى كيف
//  تسير الأمور، فيسجّل ما رآه فعلاً ذلك اليوم لا ما تفرضه قائمة.
//
//  التصميم: صندوق بحث فوق 113 بنداً من مفرداتكم نفسها، مرتّبة بكثرة
//  الاستخدام (فما يُستخدم كثيراً يظهر أولاً)، مع إمكانية كتابة بند
//  جديد. كل ملاحظة: سليم أو ملاحظة، ونص، وصورة.
//
//  وتُحفظ في نفس جدول نتائج الفحص، فترث تلقائياً حلقة المتابعة:
//  أي بند يُسجَّل «ملاحظة» يفتح مهمة متابعة مسندة للمهندس.
// ─────────────────────────────────────────────────────────────────────

export default function PeriodicVisit() {
  const nav = useNavigate()
  const { user: me } = useCurrentUser()

  const [projects, setProjects] = useState([])
  const [vocab, setVocab]       = useState([])
  const [form, setForm] = useState({
    project_id: '', visit_date: new Date().toISOString().split('T')[0],
    engineer_id: null, engineer_name: '', notes: '',
  })
  const [obs, setObs]     = useState([])
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr]     = useState('')
  const fileRefs = useRef({})

  useEffect(() => { loadRefs() }, [])
  useEffect(() => {
    if (me && !form.engineer_id) {
      setForm(f => ({ ...f, engineer_id: me.id, engineer_name: me.full_name || me.email }))
    }
  }, [me])

  async function loadRefs() {
    const [{ data: pr, error: e1 }, { data: vo, error: e2 }] = await Promise.all([
      supabase.from('projects')
        .select('id, name, project_no')
        .eq('supervision_type', 'periodic').eq('status', 'active')
        .is('supervision_ended_at', null).order('name'),
      supabase.from('observation_vocabulary').select('item, uses').limit(400),
    ])
    if (e1) console.error('تعذّر جلب المشاريع:', e1.message)
    if (e2) console.error('تعذّر جلب المفردات:', e2.message)
    setProjects(pr || []); setVocab(vo || [])
  }

  function addObs(text) {
    const t = (text || '').trim()
    if (!t) return
    if (obs.some(o => o.item_text === t)) { setQuery(''); return }
    setObs(prev => [...prev, { key: `${Date.now()}-${prev.length}`, item_text: t, result: 'pass', notes: '', file: null, preview: null }])
    setQuery('')
  }

  function patchObs(key, patch) {
    setObs(prev => prev.map(o => o.key === key ? { ...o, ...patch } : o))
  }

  function pickPhoto(key, file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = e => patchObs(key, { file, preview: e.target.result })
    reader.readAsDataURL(file)
  }

  async function save(e) {
    e.preventDefault()
    if (!form.project_id) { setErr('اختر المشروع'); return }
    if (!obs.length)      { setErr('أضف ملاحظة واحدة على الأقل'); return }
    setSaving(true); setErr('')

    try {
      // ١) الزيارة نفسها
      const { data: visit, error: vErr } = await supabase.from('site_visits').insert({
        project_id: form.project_id,
        visit_date: form.visit_date,
        engineer_id: form.engineer_id,
        engineer_name: form.engineer_name,
        notes: form.notes || 'زيارة دورية',
        severity: obs.some(o => o.result === 'fail') ? 'medium' : 'low',
        status: 'submitted',
      }).select().single()
      if (vErr) throw vErr

      // ٢) الصور — تُرفع تحت مسار الزيارة
      const rows = []
      for (const o of obs) {
        let photo_path = null
        if (o.file) {
          const ext  = o.file.name.split('.').pop()
          const path = `visits/${visit.id}/${Date.now()}-${rows.length}.${ext}`
          const { error: upErr } = await supabase.storage.from('Rekaz').upload(path, o.file)
          if (upErr) throw new Error('تعذّر رفع الصورة: ' + upErr.message)
          photo_path = supabase.storage.from('Rekaz').getPublicUrl(path).data.publicUrl

          const { error: phErr } = await supabase.from('visit_photos').insert({
            visit_id: visit.id, file_path: photo_path, caption: o.item_text,
          })
          if (phErr) throw phErr
        }
        rows.push({
          visit_id: visit.id,
          checklist_item_id: null,   // ملاحظة حرة لا تنتمي لقائمة مرحلة
          item_text: o.item_text,
          result: o.result,
          notes: o.notes || null,
          photo_path,
        })
      }

      // ٣) الملاحظات — «fail» منها يفتح مهمة متابعة تلقائياً
      const { error: rErr } = await supabase.from('visit_checklist_results').insert(rows)
      if (rErr) throw rErr

      const flagged = obs.filter(o => o.result === 'fail').length
      alert(`حُفظت الزيارة — ${obs.length} ملاحظة` +
            (flagged ? `\nفُتحت ${flagged} مهمة متابعة تلقائياً.` : ''))
      nav('/periodic-supervision')
    } catch (e2) {
      console.error('تعذّر حفظ الزيارة:', e2?.message ?? e2)
      setErr(e2?.message ?? String(e2))
    } finally { setSaving(false) }
  }

  const chosen = new Set(obs.map(o => o.item_text))
  const q = query.trim().toLowerCase()
  const suggestions = (q
    ? vocab.filter(v => v.item.toLowerCase().includes(q))
    : vocab.slice(0, 8)
  ).filter(v => !chosen.has(v.item)).slice(0, 10)

  const exactExists = vocab.some(v => v.item.toLowerCase() === q)

  return (
    <form onSubmit={save}>
      <div className="page-header">
        <div>
          <h3>تسجيل زيارة دورية</h3>
          <div className="page-sub">سجّل ما رأيته فعلاً — لا قائمة ثابتة</div>
        </div>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'جارٍ الحفظ…' : 'حفظ الزيارة'}
        </button>
      </div>

      {err && <div className="card" style={{marginBottom:14,color:'#A32D2D'}}>{err}</div>}

      <div className="card" style={{marginBottom:14}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:12}}>
          <div className="form-group">
            <label className="form-label">المشروع *</label>
            <select className="form-input" required value={form.project_id}
              onChange={e=>setForm(f=>({...f,project_id:e.target.value}))}>
              <option value="">— اختر —</option>
              {projects.map(p=>(<option key={p.id} value={p.id}>{p.name}</option>))}
            </select>
            {!projects.length && (
              <div style={{fontSize:11.5,color:'#854F0B',marginTop:5}}>
                لا مشاريع دورية نشطة. حدّد نوع الإشراف «دوري» في شاشة المشاريع أولاً.
              </div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">التاريخ *</label>
            <input type="date" className="form-input" required value={form.visit_date}
              onChange={e=>setForm(f=>({...f,visit_date:e.target.value}))}/>
          </div>
          <div className="form-group">
            <label className="form-label">المهندس *</label>
            <EngineerSelect valueId={form.engineer_id} valueName={form.engineer_name} required
              onChange={({id,name})=>setForm(f=>({...f,engineer_id:id,engineer_name:name}))}/>
          </div>
        </div>
      </div>

      {/* الاختيار الذكي */}
      <div className="card" style={{marginBottom:14}}>
        <label className="form-label">ماذا لاحظت اليوم؟</label>
        <input className="form-input" value={query} placeholder="اكتب للبحث، أو اكتب بنداً جديداً…"
          onChange={e=>setQuery(e.target.value)}
          onKeyDown={e=>{ if(e.key==='Enter'){ e.preventDefault(); addObs(query) } }}/>

        {(suggestions.length > 0 || (q && !exactExists)) && (
          <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:9}}>
            {suggestions.map(s=>(
              <button key={s.item} type="button" className="btn btn-sm"
                onClick={()=>addObs(s.item)}
                style={{fontSize:11.5,textAlign:'right',maxWidth:'100%'}}>
                {s.item}{s.uses > 0 && <span style={{opacity:.5,marginInlineStart:5}}>· {s.uses}</span>}
              </button>
            ))}
            {q && !exactExists && (
              <button type="button" className="btn btn-sm btn-primary" style={{fontSize:11.5}}
                onClick={()=>addObs(query)}>+ إضافة «{query}»</button>
            )}
          </div>
        )}
        <div style={{fontSize:11.5,color:'var(--text-muted)',marginTop:8}}>
          الأكثر استخداماً يظهر أولاً. اضغط Enter لإضافة بند غير موجود.
        </div>
      </div>

      {/* الملاحظات المضافة */}
      {obs.map(o=>(
        <div key={o.key} className="card" style={{marginBottom:10,
          borderInlineStart:`3px solid ${o.result==='fail'?'#A32D2D':'#0F6E56'}`}}>
          <div style={{display:'flex',alignItems:'flex-start',gap:10,flexWrap:'wrap'}}>
            <div style={{flex:1,minWidth:190,fontSize:13.5,fontWeight:600}}>{o.item_text}</div>
            <div style={{display:'flex',gap:5,flexShrink:0}}>
              <button type="button" className={`btn btn-sm ${o.result==='pass'?'btn-primary':''}`}
                onClick={()=>patchObs(o.key,{result:'pass'})} style={{fontSize:11.5}}>✓ سليم</button>
              <button type="button" className="btn btn-sm"
                onClick={()=>patchObs(o.key,{result:'fail'})} style={{fontSize:11.5,
                  ...(o.result==='fail'?{background:'#A32D2D',color:'#fff',borderColor:'#A32D2D'}:{})}}>⚠ ملاحظة</button>
              <button type="button" className="btn btn-sm" style={{fontSize:11.5}}
                onClick={()=>fileRefs.current[o.key]?.click()}>
                {o.preview ? '✓ صورة' : '📷 صورة'}
              </button>
              <button type="button" className="btn btn-sm" style={{fontSize:11.5,color:'#A32D2D'}}
                onClick={()=>setObs(p=>p.filter(x=>x.key!==o.key))}>✕</button>
            </div>
          </div>

          <input type="file" accept="image/*" capture="environment" style={{display:'none'}}
            ref={el=>{ fileRefs.current[o.key] = el }}
            onChange={e=>pickPhoto(o.key, e.target.files[0])}/>

          <input className="form-input" style={{marginTop:8,fontSize:12.5}}
            value={o.notes} placeholder={o.result==='fail'?'وصف الملاحظة والمطلوب…':'ملاحظة اختيارية…'}
            onChange={e=>patchObs(o.key,{notes:e.target.value})}/>

          {o.preview && (
            <img src={o.preview} alt="" style={{marginTop:8,maxHeight:150,borderRadius:7,display:'block'}}/>
          )}

          {o.result==='fail' && (
            <div style={{fontSize:11.5,color:'#A32D2D',marginTop:7}}>
              ستُفتح مهمة متابعة تلقائياً عند الحفظ.
            </div>
          )}
        </div>
      ))}

      <div className="card">
        <label className="form-label">ملاحظات عامة على الزيارة</label>
        <textarea className="form-input" rows="3" value={form.notes}
          placeholder="الحالة العامة، تقدّم العمل، أي شيء لا يخص بنداً بعينه…"
          onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/>
      </div>
    </form>
  )
}
