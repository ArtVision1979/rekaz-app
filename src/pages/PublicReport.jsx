import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'

// ─────────────────────────────────────────────────────────────────────
//  عرض التقرير للعميل — صفحة عامة بلا تسجيل دخول
//
//  لماذا هنا لا على Supabase: تخزين Supabase ودوالّه يقدّمان أي محتوى
//  بترويسة text/plain قسراً (سياسة منصّة تمنع استضافة صفحات على نطاقهم).
//  فيرى العميل شيفرة خام وعربية مشوّهة. تحققنا من الترويسة فعلياً:
//  كلا المصدرين text/plain رغم ضبطهما على text/html.
//
//  الحل: Vercel يقدّم نطاقكم بترويسة صحيحة. نجلب ملف التقرير المخزّن
//  كنص (وهو سليم تماماً) ونعرضه داخل iframe بخاصية srcDoc، فتُعزل
//  أنماطه عن أنماط التطبيق ويعمل زر الطباعة داخله طبيعياً.
// ─────────────────────────────────────────────────────────────────────

const BASE = import.meta.env.VITE_SUPABASE_URL || ''

export default function PublicReport() {
  const { reportNo } = useParams()
  const [html, setHtml]       = useState('')
  const [state, setState]     = useState('loading')

  useEffect(() => {
    let alive = true
    ;(async () => {
      // صيغة رقم التقرير فقط — تمنع أي محاولة للوصول لمسار آخر
      if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(reportNo || '')) {
        if (alive) setState('invalid'); return
      }
      try {
        const url = `${BASE}/storage/v1/object/public/Rekaz/reports/${reportNo}.html`
        const res = await fetch(url)
        if (!res.ok) { if (alive) setState('missing'); return }
        // res.text() يفكّ الترميز UTF-8 دائماً، فتظهر العربية صحيحة
        // مهما كانت ترويسة الخادم
        const text = await res.text()
        if (!alive) return
        setHtml(text); setState('ready')
      } catch (e) {
        console.error('تعذّر جلب التقرير:', e?.message ?? e)
        if (alive) setState('error')
      }
    })()
    return () => { alive = false }
  }, [reportNo])

  const Shell = ({ children }) => (
    <div style={{fontFamily:'Arial,sans-serif',padding:'56px 24px',textAlign:'center',
                 color:'#444',direction:'rtl'}}>
      {children}
      <div style={{marginTop:26,fontSize:12,color:'#aaa'}}>مكتب ركاز للاستشارات الهندسية</div>
    </div>
  )

  if (state === 'loading') return <Shell><div style={{color:'#888'}}>جارٍ فتح التقرير…</div></Shell>
  if (state === 'invalid') return <Shell><h3>رقم تقرير غير صالح</h3></Shell>
  if (state === 'missing') return (
    <Shell>
      <h3>التقرير غير متاح</h3>
      <p style={{fontSize:14,color:'#888',marginTop:8}}>
        تعذّر العثور على التقرير {reportNo}. تواصل مع المكتب.
      </p>
    </Shell>
  )
  if (state === 'error') return (
    <Shell><h3>تعذّر فتح التقرير</h3>
      <p style={{fontSize:14,color:'#888',marginTop:8}}>حاول مرة أخرى بعد قليل.</p>
    </Shell>
  )

  return (
    <iframe
      srcDoc={html}
      title={`تقرير ${reportNo}`}
      style={{position:'fixed',inset:0,width:'100%',height:'100%',border:'none'}}
    />
  )
}
