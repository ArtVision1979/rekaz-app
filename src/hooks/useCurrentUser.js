import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

// ─────────────────────────────────────────────────────────────────────
//  ملف المستخدم الحالي من جدول users (وليس من Auth فقط).
//  يُستخدم في فلاتر «مهامي» و«زياراتي» وفي تسجيل من أنشأ السجل.
//
//  ملاحظة: هذا صار ممكناً بعد ربط auth.users بجدول public.users —
//  قبل ذلك كان الجدول فارغاً فلا وجود لملف شخصي لأي مستخدم.
// ─────────────────────────────────────────────────────────────────────

export function useCurrentUser() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true

    async function load() {
      try {
        const { data: auth } = await supabase.auth.getUser()
        const id = auth?.user?.id
        if (!id) { if (alive) { setUser(null); setLoading(false) } return }

        const { data, error } = await supabase
          .from('users')
          .select('id, full_name, email, role')
          .eq('id', id)
          .single()

        if (!alive) return
        if (error) { console.error('تعذّر جلب ملف المستخدم:', error.message); setUser(null) }
        else setUser(data)
      } catch (e) {
        if (alive) console.error('تعذّر جلب ملف المستخدم:', e?.message ?? e)
      } finally {
        if (alive) setLoading(false)
      }
    }

    load()
    return () => { alive = false }
  }, [])

  return { user, loading, isAdmin: user?.role === 'admin' }
}
