import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

// ─────────────────────────────────────────────────────────────────────
//  أنظمة الإنشاء (بوست تنشن / أر سي سي سلاب / بريكاست)
//
//  لكل نظام تسلسل زيارات خاص به، لأن الفرق إنشائي حقيقي:
//  في الصبّ الموقعي تُصبّ الجسور مع السقف فتكفي زيارة واحدة،
//  أما في البريكاست فتُصبّ الجسور أولاً وتُفحص قبل تركيب البلاطات،
//  ثم تأتي زيارة التركيب ثم زيارة طبقة التغطية.
//
//  ملاحظة: جدول project_categories يحوي نوعين مختلفين من التصنيف،
//  يميّزهما عمود kind. هنا نقرأ أنظمة الإنشاء وحدها.
// ─────────────────────────────────────────────────────────────────────

export function useConstructionSystems() {
  const [systems, setSystems] = useState([])

  useEffect(() => {
    let alive = true

    async function load() {
      const { data, error } = await supabase
        .from('project_categories')
        .select('id, name, name_ar, order_index')
        .eq('kind', 'construction_system')
        .order('order_index')

      if (!alive) return
      if (error) { console.error('تعذّر جلب أنظمة الإنشاء:', error.message); return }
      setSystems(data || [])
    }

    load()
    return () => { alive = false }
  }, [])

  return systems
}
