import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase, removeStorageFile } from '../lib/supabase.js'
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

const localToday = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export default function PeriodicVisit() {
  const nav = useNavigate()
  const { user: me } = useCurrentUser()

  const [projects, setProjects] = useState([])
  const [vocab, setVocab]       = useState([])
  // القدوم من شاشة الإشراف الدوري: المشروع والشهر محدّدان مسبقاً،
  // فلا يعيد المهندس اختيارهما ولا يقع في شهر غير الذي قصده
  const [sp] = useSearchParams()
  //  ?visit=<id> يفتح زيارةً قائمة للتعديل بدل إنشاء واحدة جديدة.
  //  كان زرّ «تعديل» في الإشراف الدوري يرمي المهندس على قائمة زيارات
  //  المشروع كلها فيبحث عن زيارته بين أربع عشرة — والشاشة تعرف أيّها
  //  قصد. والتعديل يجب أن يقع حيث كُتبت الزيارة: هنا، بموضوعها
  //  وملاحظاتها وصورها، لا في نافذةٍ تغيّر التاريخ والحالة فقط.
  const editId = sp.get('visit') || ''
  const [loadingVisit, setLoadingVisit] = useState(!!editId)
  const [removed, setRemoved] = useState([])   // بنود حُذفت — تُنفَّذ عند الحفظ
  const [form, setForm] = useState({
    project_id: sp.get('project') || '',
    visit_date: sp.get('date') || localToday(),
    engineer_id: null, engineer_name: '', notes: '', summary: '',
  })
  const [obs, setObs]     = useState([])
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr]     = useState('')
  // موضوع الزيارة: المراحل الرئيسية ثابتة، وما جدّ يُضاف بنفس الطريقة
  const [stages, setStages]   = useState([])
  const [prior, setPrior]     = useState([])   // زيارات المشروع السابقة بالتاريخ
  const [subjOther, setOther] = useState(false)
  const fileRefs = useRef({})

  useEffect(() => { loadRefs() }, [])
  useEffect(() => { if (editId) loadVisit(editId) }, [editId])
  useEffect(() => {
    //  في وضع التعديل صاحب الزيارة هو من سجّلها، لا من يفتحها الآن
    if (me && !form.engineer_id && !editId) {
      setForm(f => ({ ...f, engineer_id: me.id, engineer_name: me.full_name || me.email }))
    }
  }, [me, editId])

  //  تحميل زيارةٍ قائمة: بياناتها وبنودها وصورها.
  //  الصور المرفوعة سلفاً تُعرض برابطها العام مباشرةً — لا يُعاد لفّه.
  async function loadVisit(id) {
    setLoadingVisit(true)
    try {
      const [{ data: v, error: vErr }, { data: rs }, { data: ph }] = await Promise.all([
        supabase.from('site_visits').select('*').eq('id', id).single(),
        supabase.from('visit_checklist_results').select('*').eq('visit_id', id)
          .is('checklist_item_id', null).order('created_at'),
        supabase.from('visit_photos').select('*').eq('visit_id', id),
      ])
      if (vErr) throw vErr

      setForm({
        project_id: v.project_id, visit_date: v.visit_date,
        engineer_id: v.engineer_id, engineer_name: v.engineer_name || '',
        notes: v.notes || '', summary: v.summary || '',
      })
      //  الصورة تُربط ببندها عبر التعليق — هكذا كُتبت عند الحفظ
      const byCaption = {}
      ;(ph || []).forEach(p => { if (p.caption && !byCaption[p.caption]) byCaption[p.caption] = p })
      setObs((rs || []).map((r, i) => {
        const pic = byCaption[r.item_text]
        return {
          key: `db-${r.id}`, id: r.id, task_id: r.task_id,
          item_text: r.item_text, result: r.result, notes: r.notes || '',
          file: null, preview: pic?.file_path || r.photo_path || null,
          photoId: pic?.id || null, photoUrl: pic?.file_path || r.photo_path || null,
        }
      }))
      //  موضوعٌ محفوظ خارج قائمة المراحل: يُفتح حقل الكتابة الحرّة
      setOther(false)
    } catch (e) {
      setErr('تعذّر فتح الزيارة: ' + (e?.message ?? e))
    } finally { setLoadingVisit(false) }
  }

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

  // المراحل الرئيسية من القوالب — ثابتة لا تتغيّر بتغيّر المشروع،
  // ويُضاف إليها ما سبق أن كتبه المهندس في زيارة دورية بنفس المنهج
  async function loadStages(projectId) {
    const [{ data: tpl }, { data: used }] = await Promise.all([
      supabase.from('visit_templates').select('title, title_ar, order_index').order('order_index'),
      supabase.from('site_visits').select('notes, visit_date')
        .eq('project_id', projectId).order('visit_date', { ascending: false })
    ])
    const seen = new Set()
    const list = []
    ;(tpl || []).forEach(t => {
      const label = t.title_ar || t.title
      if (label && !seen.has(label)) { seen.add(label); list.push({ label, kind: 'قياسية' }) }
    })
    ;(used || []).forEach(v => {
      const n = (v.notes || '').trim()
      if (n && n !== 'زيارة دورية' && !seen.has(n)) { seen.add(n); list.push({ label: n, kind: 'سابقة' }) }
    })
    setStages(list)
    setPrior(used || [])
  }

  useEffect(() => {
    if (form.project_id) loadStages(form.project_id)
    else { setStages([]); setPrior([]) }
  }, [form.project_id])

  //  موضوعٌ محفوظ لا يطابق أياً من خيارات القائمة سيظهر فارغاً في
  //  الـ select ويضيع عند الحفظ. فيُفتح له حقل الكتابة الحرّة.
  useEffect(() => {
    if (!form.notes || !stages.length) return
    if (!stages.some(x => x.label === form.notes)) setOther(true)
  }, [stages, form.notes])

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
      const severity = obs.some(o => o.result === 'fail') ? 'medium' : 'low'
      const head = {
        project_id: form.project_id,
        visit_date: form.visit_date,
        engineer_id: form.engineer_id,
        engineer_name: form.engineer_name,
        notes: form.notes || 'زيارة دورية',
        summary: form.summary || null,
        severity,
      }

      // ١) الزيارة نفسها
      let visit
      if (editId) {
        const { data, error } = await supabase.from('site_visits')
          .update(head).eq('id', editId).select().single()
        if (error) throw error
        visit = data
      } else {
        const { data, error } = await supabase.from('site_visits')
          .insert({ ...head, status: 'submitted' }).select().single()
        if (error) throw error
        visit = data
      }

      //  رفع صورةٍ جديدة لبند — تُستبدل بها القديمة إن وُجدت
      async function uploadFor(o, seq) {
        const ext  = o.file.name.split('.').pop()
        const path = `visits/${visit.id}/${Date.now()}-${seq}.${ext}`
        const { error: upErr } = await supabase.storage.from('Rekaz').upload(path, o.file)
        if (upErr) throw new Error('تعذّر رفع الصورة: ' + upErr.message)
        const url = supabase.storage.from('Rekaz').getPublicUrl(path).data.publicUrl
        if (o.photoId) {
          await supabase.from('visit_photos')
            .update({ file_path: url, caption: o.item_text }).eq('id', o.photoId)
          if (o.photoUrl) await removeStorageFile(o.photoUrl)
        } else {
          const { error: phErr } = await supabase.from('visit_photos').insert({
            visit_id: visit.id, file_path: url, caption: o.item_text,
          })
          if (phErr) throw phErr
        }
        return url
      }

      // ٢) البنود المحذوفة — تُحذف نتيجتها وصورتها وملفّها،
      //    وتُغلق مهمة المتابعة المفتوحة لأن سببها زال
      for (const r of removed) {
        if (r.task_id) {
          await supabase.from('tasks').delete().eq('id', r.task_id).in('status', ['open'])
        }
        if (r.photoId) await supabase.from('visit_photos').delete().eq('id', r.photoId)
        if (r.photoUrl) await removeStorageFile(r.photoUrl)
        const { error: dErr } = await supabase.from('visit_checklist_results')
          .delete().eq('id', r.id)
        if (dErr) throw dErr
      }

      // ٣) البنود — القديم يُحدَّث في مكانه والجديد يُدرج.
      //    التحديث لا الحذف‑ثمّ‑الإدراج: القادح يغلق مهمة البند إن
      //    أصبح سليماً ولا يكرّرها إن بقي راسباً، وهذا يضيع لو حُذف.
      const fresh = []
      let seq = 0
      for (const o of obs) {
        let photo_path = o.photoUrl || null
        if (o.file) photo_path = await uploadFor(o, seq++)

        if (o.id) {
          const { error } = await supabase.from('visit_checklist_results').update({
            item_text: o.item_text, result: o.result,
            notes: o.notes || null, photo_path,
          }).eq('id', o.id)
          if (error) throw error
        } else {
          fresh.push({
            visit_id: visit.id,
            checklist_item_id: null,   // ملاحظة حرة لا تنتمي لقائمة مرحلة
            item_text: o.item_text,
            result: o.result,
            notes: o.notes || null,
            photo_path,
          })
        }
      }
      if (fresh.length) {
        const { error: rErr } = await supabase.from('visit_checklist_results').insert(fresh)
        if (rErr) throw rErr
      }

      const flagged = obs.filter(o => o.result === 'fail').length
      alert((editId ? 'حُفظت التعديلات' : 'حُفظت الزيارة') + ` — ${obs.length} ملاحظة` +
            (flagged ? `\n${flagged} ملاحظة لها مهمة متابعة مفتوحة.` : ''))
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
          <h3>{editId ? 'تعديل زيارة دورية' : 'تسجيل زيارة دورية'}</h3>
          <div className="page-sub">
            {editId ? `زيارة ${form.visit_date}${form.engineer_name ? ' · ' + form.engineer_name : ''}`
                    : 'سجّل ما رأيته فعلاً — لا قائمة ثابتة'}
          </div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button type="button" className="btn"
            onClick={()=>nav('/periodic-supervision')}>رجوع</button>
          <button type="submit" className="btn btn-primary" disabled={saving || loadingVisit}>
            {saving ? 'جارٍ الحفظ…' : editId ? 'حفظ التعديلات' : 'حفظ الزيارة'}
          </button>
        </div>
      </div>

      {err && <div className="card" style={{marginBottom:14,color:'#A32D2D'}}>{err}</div>}

      <div className="card" style={{marginBottom:14}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:12}}>
          <div className="form-group">
            <label className="form-label">المشروع *</label>
            {/* المشروع لا يُنقل بعد التسجيل — تقاريره ومهامه معلّقة به */}
            <select className="form-input" required value={form.project_id} disabled={!!editId}
              onChange={e=>setForm(f=>({...f,project_id:e.target.value}))}>
              <option value="">— اختر —</option>
              {projects.map(p=>(<option key={p.id} value={p.id}>{p.name}</option>))}
              {editId && !projects.some(p=>p.id===form.project_id) && (
                <option value={form.project_id}>المشروع الحالي</option>
              )}
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

      {/* ── موضوع الزيارة ──
          المراحل الرئيسية ثابتة في القائمة، فالمشروع الشهري يمرّ بنفس
          مراحل البناء. وما جدّ يكتبه المهندس ويُحفظ، فيظهر لمن بعده
          بنفس المنهج بدل أن يُعاد اختراع الصياغة كل مرة. */}
      <div className="card" style={{marginBottom:14}}>
        <label className="form-label">موضوع الزيارة *</label>
        {!subjOther ? (
          <select className="form-input" value={form.notes}
            onChange={e => {
              if (e.target.value === '__other__') { setOther(true); setForm(f=>({...f,notes:''})) }
              else setForm(f => ({ ...f, notes: e.target.value }))
            }}>
            <option value="">— اختر المرحلة —</option>
            <optgroup label="المراحل الرئيسية">
              {stages.filter(x=>x.kind==='قياسية').map(x=>(
                <option key={x.label} value={x.label}>{x.label}</option>
              ))}
            </optgroup>
            {stages.some(x=>x.kind==='سابقة') && (
              <optgroup label="سبق استعمالها في هذا المشروع">
                {stages.filter(x=>x.kind==='سابقة').map(x=>(
                  <option key={x.label} value={x.label}>{x.label}</option>
                ))}
              </optgroup>
            )}
            <option value="__other__">✎ موضوع آخر — أكتبه…</option>
          </select>
        ) : (
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            <input className="form-input" style={{flex:1,minWidth:220}} autoFocus
              value={form.notes} placeholder="اكتب موضوع الزيارة…"
              onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/>
            <button type="button" className="btn btn-sm"
              onClick={()=>{ setOther(false); setForm(f=>({...f,notes:''})) }}>رجوع للقائمة</button>
          </div>
        )}
        <div style={{fontSize:11,color:'var(--text-muted)',marginTop:5,lineHeight:1.6}}>
          يظهر في التقرير عنواناً للزيارة. وما تكتبه جديداً يُضاف للقائمة تلقائياً.
        </div>

        {/* الزيارات السابقة مرتّبة بالتاريخ — ليرى المهندس أين وصل */}
        {prior.length > 0 && (
          <div style={{marginTop:12,paddingTop:11,borderTop:'1px solid var(--border)'}}>
            <div style={{fontSize:11.5,color:'var(--text-muted)',marginBottom:7}}>
              آخر زيارات هذا المشروع:
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:4,maxHeight:150,overflowY:'auto'}}>
              {prior.slice(0,8).map((v,i)=>(
                <div key={i} style={{display:'flex',gap:10,alignItems:'center',fontSize:11.5}}>
                  <span style={{fontVariantNumeric:'tabular-nums',color:'var(--text-muted)',
                                minWidth:82}}>{v.visit_date}</span>
                  <span style={{flex:1,minWidth:0,overflow:'hidden',
                                textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{v.notes || '—'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
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
                onClick={()=>{
                  //  بندٌ محفوظ سلفاً: حذفه يمسّ نتيجته وصورته ومهمته،
                  //  فلا يُنفَّذ إلا عند الحفظ وبعد إقرارٍ صريح
                  if (o.id && !confirm(
                    `حذف «${o.item_text}» من الزيارة؟\n\n` +
                    'تُحذف الملاحظة وصورتها' +
                    (o.task_id ? '، وتُلغى مهمة المتابعة المفتوحة عنها' : '') +
                    ' عند حفظ التعديلات.')) return
                  if (o.id) setRemoved(p => [...p, o])
                  setObs(p=>p.filter(x=>x.key!==o.key))
                }}>✕</button>
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
        <label className="form-label">ملاحظات عامة إضافية</label>
        <textarea className="form-input" rows="3" value={form.summary}
          placeholder="الحالة العامة، تقدّم العمل، أي شيء لا يخص بنداً بعينه…"
          onChange={e=>setForm(f=>({...f,summary:e.target.value}))}/>
      </div>
    </form>
  )
}
