import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

// ─────────────────────────────────────────────────────────────────────
//  قائمة المهندسين لاختيار المسؤول عن الزيارة أو السجل.
//
//  ترجع المهندسين فقط (is_engineer)، لا كل المستخدمين — فبعض الحسابات
//  إدارية ولا يصح إسناد زيارات موقع إليها.
//
//  ملاحظة: هذه القائمة كانت فارغة تماماً حتى ٢٠ أغسطس ٢٠٢٦، لأن جدول
//  users لم يكن مرتبطاً بـ auth.users فبقي بلا صفوف. لذلك كان اختيار
//  المهندس مستحيلاً وبقيت مئات الزيارات بلا إسناد.
// ─────────────────────────────────────────────────────────────────────

export function useEngineers() {
  const [engineers, setEngineers] = useState([])

  useEffect(() => {
    let alive = true

    async function load() {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, role')
        .eq('is_engineer', true)
        .order('full_name')

      if (!alive) return
      if (error) { console.error('تعذّر جلب قائمة المهندسين:', error.message); return }
      setEngineers(data || [])
    }

    load()
    return () => { alive = false }
  }, [])

  return engineers
}
