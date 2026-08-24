import { supabase } from './supabase.js'

// ─────────────────────────────────────────────────────────────────────
//  منطق الزيارة الإضافية — مشترك بين شاشتين
//
//  القرار يُتَّخذ في موضعين: شاشة زيارات المشاريع عند رؤية الملاحظات،
//  وشاشة التقارير لحظة إصدار التقرير. المنطق واحد، فلو كُتب مرتين
//  لاختلفا بعد أول تعديل ولأصدر كلٌّ منهما رقماً غير رقم الآخر.
// ─────────────────────────────────────────────────────────────────────

export const localToday = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

// ─────────────────────────────────────────────────────────────────────
//  صيغة المبلغ
//
//  الدينار البحريني ثلاث خانات عشرية (فلس)، فـ«50.000» في العرف المحلي
//  خمسون ديناراً. لكنها تُقرأ خمسين ألفاً عند من يعتاد النقطة فاصلةَ
//  آلاف — والتقرير يذهب إلى العميل، فاللبس فيه مكلف.
//
//  فإن لم تكن هناك فلوس نكتب «50» بلا أصفار، وإن كانت نكتب «37.500»،
//  ومع فاصلة الآلاف «1,250.000» فلا يبقى احتمال للالتباس.
// ─────────────────────────────────────────────────────────────────────
export const fmtFee = n => {
  const v = Number(n)
  if (!Number.isFinite(v)) return '—'
  const whole = Number.isInteger(v)
  return v.toLocaleString('en-US', {
    minimumFractionDigits: whole ? 0 : 3,
    maximumFractionDigits: 3
  })
}

/**
 * إنشاء زيارة إعادة على نفس المرحلة.
 * الزيارة الأصلية تبقى منجزة — العمل أُنجز وسُلّم تقريره.
 */
export async function createRework(parent, {
  fee, chargeable = true, waiveReason = '',
  scheduledDate, scheduledTime = '09:00',
  engineerId, engineerName, fails = 0
}) {
  const feeNum = chargeable ? Number(fee) : null
  if (chargeable && !(feeNum > 0)) throw new Error('الزيارة محسوبة — أدخل أجرها أولاً.')
  if (!chargeable && !waiveReason.trim()) throw new Error('الزيارة غير محسوبة — اذكر السبب.')

  const { data, error } = await supabase.from('project_visits').insert({
    project_id:      parent.project_id,
    title:           parent.title,
    title_ar:        parent.title_ar,
    order_index:     parent.order_index,
    is_rework:       true,
    parent_visit_id: parent.id,
    chargeable,
    fee:             feeNum,
    fee_waived_reason: chargeable ? null : waiveReason.trim(),
    engineer_id:     engineerId || parent.engineer_id || null,
    engineer_name:   engineerName || parent.engineer_name || '',
    scheduled_date:  scheduledDate || localToday(),
    scheduled_time:  scheduledTime,
    status:          'scheduled',
    notes: `إعادة على نفس المرحلة — ${fails} ملاحظة لم تُجتَز في الزيارة السابقة.`
  }).select().single()
  if (error) throw error

  await markDecision(parent.id, 'needed')
  return data
}

/**
 * تسجيل القرار على الزيارة الأم. «لا تلزم» يوجب سبباً — قيدٌ في
 * قاعدة البيانات أيضاً، فلا يمرّ إعفاء بلا تفسير من أي طريق.
 */
export async function markDecision(visitId, decision, note = '') {
  const { data: auth } = await supabase.auth.getUser()
  const patch = {
    rework_decision: decision,
    rework_decision_at: new Date().toISOString(),
    rework_decision_by: auth?.user?.id || null,
    rework_decision_note: note.trim() || null
  }
  const { error } = await supabase.from('project_visits').update(patch).eq('id', visitId)
  if (error) throw error
}

/** حفظ أجر الزيارة على المشروع فلا يُدخل مرة أخرى */
export async function saveProjectRate(projectId, fee) {
  if (!projectId || !(Number(fee) > 0)) return
  const { error } = await supabase.from('projects')
    .update({ visit_fee: Number(fee) }).eq('id', projectId)
  if (error) console.error('تعذّر حفظ أجر الزيارة على المشروع:', error.message)
}
