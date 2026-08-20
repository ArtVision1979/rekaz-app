import { useEngineers } from '../hooks/useEngineers.js'

// ─────────────────────────────────────────────────────────────────────
//  اختيار المهندس — نسخة موحّدة
//
//  كانت هذه القائمة مكرّرة في أربعة ملفات، وكلها تحفظ الاسم النصي فقط:
//      <option value={e.full_name}>   ← المعرّف معروف لكنه يُهمَل
//  فيبقى engineer_id فارغاً ولا يوجد ربط حقيقي بالمستخدم، ولذلك لم
//  يكن ممكناً فلترة «زياراتي» ولا توجيه التذكيرات لأحد.
//
//  هذه النسخة تُرجع الاثنين معاً: المعرّف للربط، والاسم للعرض
//  والتقارير المطبوعة التي تعتمد على النص.
//
//  الصفوف القديمة: إن كان الاسم المحفوظ لا يطابق أي مستخدم (مثل اسم
//  مهندس سابق)، يُعرض كخيار معطّل بدل أن يختفي بصمت ويُمحى عند الحفظ.
// ─────────────────────────────────────────────────────────────────────

const LEGACY = '__legacy__'

export default function EngineerSelect({
  valueId,
  valueName,
  onChange,
  required = false,
  placeholder = 'Select engineer...',
  style,
}) {
  const engineers = useEngineers()

  const matched =
    engineers.find(e => e.id === valueId) ||
    engineers.find(e => (e.full_name || e.email) === valueName)

  const hasLegacy = !matched && !!valueName
  const selectValue = matched ? matched.id : (hasLegacy ? LEGACY : '')

  function handleChange(e) {
    const v = e.target.value
    if (v === LEGACY) return
    const u = engineers.find(x => x.id === v)
    onChange({ id: u ? u.id : null, name: u ? (u.full_name || u.email) : '' })
  }

  return (
    <select
      className="form-input"
      style={style}
      value={selectValue}
      onChange={handleChange}
      required={required}
    >
      <option value="">{placeholder}</option>
      {hasLegacy && (
        <option value={LEGACY}>{valueName} — غير مرتبط بحساب</option>
      )}
      {engineers.map(e => (
        <option key={e.id} value={e.id}>
          {e.full_name || e.email}
        </option>
      ))}
    </select>
  )
}
