import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'

// ─────────────────────────────────────────────────────────────────────
//  تعيين كلمة مرور جديدة
//
//  يصل المستخدم هنا من رابط الاستعادة في بريده. Supabase يُنشئ جلسة
//  مؤقتة تلقائياً عند فتح الرابط، فيكفي استدعاء updateUser.
//
//  لم يكن في البرنامج أي مسار استعادة إطلاقاً، فكان كل نسيان يتطلب
//  فتح لوحة Supabase يدوياً — وهو ما يعطّل مهندساً في الموقع.
// ─────────────────────────────────────────────────────────────────────

export default function ResetPassword() {
  const nav = useNavigate()
  const [pw1, setPw1]       = useState('')
  const [pw2, setPw2]       = useState('')
  const [ready, setReady]   = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState('')
  const [done, setDone]     = useState(false)

  useEffect(() => {
    // الجلسة المؤقتة تصل عبر الرابط؛ ننتظر تثبيتها قبل السماح بالتغيير
    let alive = true
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return
      if (data?.session) setReady(true)
      else setErr('الرابط منتهٍ أو غير صالح. اطلب رابطاً جديداً من شاشة الدخول.')
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session && alive) { setReady(true); setErr('') }
    })
    return () => { alive = false; sub?.subscription?.unsubscribe?.() }
  }, [])

  async function save(e) {
    e.preventDefault(); setErr('')
    if (pw1.length < 8) { setErr('كلمة المرور يجب ألا تقل عن ٨ خانات'); return }
    if (pw1 !== pw2)    { setErr('الكلمتان غير متطابقتين'); return }

    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password: pw1 })
    setSaving(false)
    if (error) { setErr(error.message || 'تعذّر تغيير كلمة المرور'); return }
    setDone(true)
    setTimeout(() => nav('/'), 1800)
  }

  const field = {
    width:'100%', padding:'12px 16px', background:'rgba(255,255,255,0.06)',
    border:'1px solid rgba(255,255,255,0.12)', borderRadius:10,
    fontSize:14, color:'white', outline:'none', boxSizing:'border-box',
  }

  return (
    <div dir="rtl" style={{minHeight:'100vh',display:'flex',alignItems:'center',
      justifyContent:'center',background:'#0f1117',padding:24,
      fontFamily:"'Segoe UI', system-ui, sans-serif"}}>
      <div style={{width:'100%',maxWidth:400}}>

        <div style={{textAlign:'center',marginBottom:32}}>
          <img src="/rekaz-logo.jpg" alt="Rekaz" style={{height:44,borderRadius:8}}/>
        </div>

        <div style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',
                     borderRadius:20,padding:30}}>
          <h2 style={{color:'white',fontSize:20,fontWeight:600,marginBottom:6,textAlign:'center'}}>
            كلمة مرور جديدة
          </h2>

          {done ? (
            <p style={{color:'#7fe0c0',fontSize:14,textAlign:'center',marginTop:14,lineHeight:1.7}}>
              ✓ تم التغيير بنجاح<br/>
              <span style={{color:'rgba(255,255,255,0.4)',fontSize:12}}>جارٍ تحويلك للبرنامج…</span>
            </p>
          ) : (
            <>
              <p style={{color:'rgba(255,255,255,0.4)',fontSize:12.5,textAlign:'center',marginBottom:24}}>
                اختر كلمة مرور لا تقل عن ٨ خانات
              </p>

              <form onSubmit={save}>
                <input type="password" style={{...field,marginBottom:12}} value={pw1}
                  onChange={e=>setPw1(e.target.value)} placeholder="كلمة المرور الجديدة"
                  disabled={!ready} required/>
                <input type="password" style={{...field,marginBottom:18}} value={pw2}
                  onChange={e=>setPw2(e.target.value)} placeholder="تأكيد كلمة المرور"
                  disabled={!ready} required/>

                {err && (
                  <div style={{background:'rgba(163,45,45,0.2)',border:'1px solid rgba(163,45,45,0.4)',
                               color:'#ff8585',fontSize:12,padding:'10px 14px',borderRadius:8,
                               marginBottom:16,lineHeight:1.6}}>{err}</div>
                )}

                <button type="submit" disabled={!ready || saving}
                  style={{width:'100%',padding:13,border:'none',borderRadius:10,color:'white',
                          fontSize:14,fontWeight:600,letterSpacing:0.5,
                          cursor:(!ready||saving)?'not-allowed':'pointer',
                          background:(!ready||saving)?'rgba(24,95,165,0.45)'
                                    :'linear-gradient(135deg,#185FA5,#0C447C)'}}>
                  {saving ? 'جارٍ الحفظ…' : 'حفظ كلمة المرور'}
                </button>
              </form>
            </>
          )}
        </div>

        <div style={{textAlign:'center',marginTop:20}}>
          <a href="/login" style={{fontSize:12,color:'rgba(255,255,255,0.3)',textDecoration:'none'}}>
            ← العودة لتسجيل الدخول
          </a>
        </div>
      </div>
    </div>
  )
}
