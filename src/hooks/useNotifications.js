// ─────────────────────────────────────────────────────────────────────
//  تذكيرات المواعيد — نسخة الويب
//
//  النظام يعمل على قناتين، وكلاهما يُرسَل من الخادم لا من المتصفح:
//
//    1. بريد إلكتروني  — القناة المضمونة. تصل دائماً، على أي جهاز،
//       سواء كان البرنامج مفتوحاً أو مغلقاً.
//    2. إشعار متصفح (Web Push) — يظهر على الجهاز حتى لو كان تبويب
//       البرنامج مغلقاً، ما دام المتصفح يعمل في الخلفية.
//
//  دور هذا الملف: تسجيل اشتراك الجهاز في Web Push وحفظه في قاعدة
//  البيانات، ليتمكن الخادم من إرسال الإشعار لاحقاً. الجدولة نفسها
//  تتم في الخادم عبر pg_cron، لا هنا.
//
//  ملاحظة على النسخة السابقة: كانت تجدول التذكيرات بـ setTimeout في
//  المتصفح، وهو ما يعني أن التذكير يُلغى بمجرد إغلاق التبويب — ولأن
//  التذكير عادة قبل ساعة من زيارة صباحية، فالتبويب مغلق وقتها غالباً.
//  كما كان setTimeout ينقلب على المدد الأطول من ~24.8 يوم فيُطلق
//  التذكير فوراً بدل موعده.
// ─────────────────────────────────────────────────────────────────────

import { supabase } from '../lib/supabase.js'

// المفتاح العام لـ VAPID — عام بطبيعته وآمن في كود المتصفح.
// المفتاح الخاص يبقى في أسرار Supabase ولا يظهر هنا إطلاقاً.
const VAPID_PUBLIC_KEY =
  import.meta.env.VITE_VAPID_PUBLIC_KEY ||
  'BHVIQd6keH0UHCUlr-oso9ZYu2WYSJr93FVMKL2x9t1-XmyCCtx0n3KAbW6s1F5T7JckJTUwCMBDigEoyGB_NbA'

// ملاحظة: لا نستخدم Notification?.permission مباشرة — لو كان الكائن
// غير معرّف أصلاً فإن optional chaining لا يحمي ويُرمى ReferenceError.
function hasNotificationApi() {
  return typeof window !== 'undefined' && typeof window.Notification !== 'undefined'
}

function hasPushSupport() {
  return typeof window !== 'undefined' &&
         'serviceWorker' in navigator &&
         'PushManager' in window &&
         hasNotificationApi()
}

export function getNotificationPermission() {
  if (!hasNotificationApi()) return 'unsupported'
  return window.Notification.permission
}

export function pushSupported() {
  return hasPushSupport()
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

function keyToBase64(key) {
  return btoa(String.fromCharCode(...new Uint8Array(key)))
}

// ── طلب الإذن وتسجيل الاشتراك ────────────────────────────────────────
export async function requestNotificationPermission() {
  if (!hasNotificationApi()) return false

  let permission = window.Notification.permission
  if (permission === 'default') permission = await window.Notification.requestPermission()
  if (permission !== 'granted') return false

  // الإذن وحده لا يكفي — لا بد من تسجيل الاشتراك ليستطيع الخادم الإرسال
  await subscribeToPush()
  return true
}

export async function subscribeToPush() {
  if (!hasPushSupport()) return false
  if (window.Notification.permission !== 'granted') return false

  try {
    const reg = await navigator.serviceWorker.ready

    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
    }

    const { data: auth } = await supabase.auth.getUser()
    const userId = auth?.user?.id
    if (!userId) return false

    const { error } = await supabase.from('push_subscriptions').upsert({
      user_id: userId,
      endpoint: sub.endpoint,
      p256dh: keyToBase64(sub.getKey('p256dh')),
      auth: keyToBase64(sub.getKey('auth')),
      user_agent: navigator.userAgent.slice(0, 300),
    }, { onConflict: 'endpoint' })

    if (error) { console.error('تعذّر حفظ اشتراك الإشعارات:', error.message); return false }
    return true
  } catch (e) {
    console.error('تعذّر تسجيل الاشتراك في الإشعارات:', e?.message ?? e)
    return false
  }
}

export async function unsubscribeFromPush() {
  if (!hasPushSupport()) return
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (!sub) return
    await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
    await sub.unsubscribe()
  } catch (e) {
    console.error('تعذّر إلغاء الاشتراك:', e?.message ?? e)
  }
}

// ── تفضيل مدة التذكير (يُقرأ من الخادم عند الإرسال) ──────────────────
export async function getReminderMinutes() {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user?.id) return 60
  const { data } = await supabase.from('users')
    .select('reminder_minutes').eq('id', auth.user.id).single()
  return data?.reminder_minutes ?? 60
}

export async function setReminderMinutes(minutes) {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user?.id) return false
  const { error } = await supabase.from('users')
    .update({ reminder_minutes: minutes }).eq('id', auth.user.id)
  if (error) { console.error('تعذّر حفظ مدة التذكير:', error.message); return false }
  return true
}
