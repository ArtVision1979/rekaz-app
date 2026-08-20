// ─────────────────────────────────────────────────────────────────────
//  send-reminders
//
//  تُستدعى دورياً من pg_cron. تجلب التذكيرات المستحقة الآن وترسلها
//  عبر قناتين: بريد إلكتروني (Resend) وإشعار متصفح (Web Push).
//
//  التصميم متعمّد: البريد هو القناة المضمونة، والإشعار إضافة سريعة.
//  فشل إحدى القناتين لا يمنع الأخرى، والتذكير لا يُعلَّم كمُرسَل إلا
//  إذا نجحت قناة واحدة على الأقل — حتى لا يضيع التذكير بصمت.
// ─────────────────────────────────────────────────────────────────────

import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const FROM_EMAIL     = Deno.env.get('REMINDER_FROM_EMAIL') ?? 'Rekaz <onboarding@resend.dev>'
const VAPID_PUBLIC   = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
const VAPID_PRIVATE  = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
const VAPID_SUBJECT  = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:rekaz.eng.office@gmail.com'
const CRON_SECRET    = Deno.env.get('CRON_SECRET') ?? ''

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

let pushReady = false
try {
  if (VAPID_PUBLIC && VAPID_PRIVATE) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
    pushReady = true
  }
} catch (e) {
  console.error('تعذّر تهيئة Web Push:', e?.message ?? e)
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString('ar-BH', {
    timeZone: 'Asia/Bahrain',
    weekday: 'long', day: 'numeric', month: 'long',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

function emailHtml(rows: any[], name: string) {
  const items = rows.map(r => `
    <tr>
      <td style="padding:12px 14px;border-bottom:1px solid #eee;">
        <div style="font-weight:600;color:#111;font-size:15px;">${escapeHtml(r.title)}</div>
        <div style="color:#555;font-size:13px;margin-top:3px;">${escapeHtml(r.context_name)}</div>
        <div style="color:#185FA5;font-size:13px;margin-top:5px;">${fmtTime(r.scheduled_at)}</div>
      </td>
    </tr>`).join('')

  return `<!DOCTYPE html><html dir="rtl" lang="ar"><body style="margin:0;background:#f6f6f4;font-family:Tahoma,Arial,sans-serif;">
    <div style="max-width:560px;margin:24px auto;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e6e6e2;">
      <div style="background:#185FA5;padding:18px 20px;color:#fff;">
        <div style="font-size:18px;font-weight:700;">🔔 تذكير بمواعيد اليوم</div>
        <div style="font-size:13px;opacity:.9;margin-top:3px;">مكتب ركاز للهندسة</div>
      </div>
      <div style="padding:16px 20px 4px;color:#333;font-size:14px;">مرحباً ${escapeHtml(name)}، لديك المواعيد التالية قريباً:</div>
      <table style="width:100%;border-collapse:collapse;margin-top:8px;">${items}</table>
      <div style="padding:16px 20px;border-top:1px solid #eee;">
        <a href="https://rekaz-app.vercel.app/schedule"
           style="display:inline-block;background:#185FA5;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:14px;">
          فتح الجدول
        </a>
      </div>
    </div>
  </body></html>`
}

function escapeHtml(s: string) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

async function sendEmail(to: string, name: string, rows: any[]) {
  if (!RESEND_API_KEY) return false
  const subject = rows.length === 1
    ? `🔔 تذكير: ${rows[0].title}`
    : `🔔 تذكير: ${rows.length} مواعيد قادمة`
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html: emailHtml(rows, name) }),
  })
  if (!res.ok) {
    console.error('فشل إرسال البريد إلى', to, await res.text())
    return false
  }
  return true
}

async function sendPush(userId: string, rows: any[]) {
  if (!pushReady) return false
  const { data: subs } = await admin
    .from('push_subscriptions').select('*').eq('user_id', userId)
  if (!subs?.length) return false

  const first = rows[0]
  const payload = JSON.stringify({
    title: rows.length === 1 ? '🔔 تذكير موعد — ركاز' : `🔔 ${rows.length} مواعيد قادمة — ركاز`,
    body: rows.length === 1
      ? `${first.title}\n${first.context_name} — ${fmtTime(first.scheduled_at)}`
      : rows.map((r: any) => `• ${r.title}`).join('\n'),
    url: '/schedule',
  })

  let any = false
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
      )
      any = true
      await admin.from('push_subscriptions')
        .update({ last_used_at: new Date().toISOString() }).eq('id', s.id)
    } catch (e: any) {
      const code = e?.statusCode
      // 404/410 = الاشتراك لم يعد صالحاً (المستخدم ألغى الإذن أو مسح البيانات)
      if (code === 404 || code === 410) {
        await admin.from('push_subscriptions').delete().eq('id', s.id)
      } else {
        console.error('فشل إرسال إشعار:', code, e?.message ?? e)
      }
    }
  }
  return any
}

Deno.serve(async (req) => {
  // حماية بسيطة: لا يشغّلها إلا من يعرف السر
  if (CRON_SECRET) {
    const given = req.headers.get('x-cron-secret')
    if (given !== CRON_SECRET) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  const { data: due, error } = await admin.rpc('due_reminders')
  if (error) {
    console.error('تعذّر جلب التذكيرات:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }
  if (!due?.length) {
    return new Response(JSON.stringify({ ok: true, due: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // تجميع حسب المستلم — رسالة واحدة تضم كل مواعيده بدل رسالة لكل موعد
  const byRecipient = new Map<string, any[]>()
  for (const r of due) {
    const k = r.recipient_id
    if (!byRecipient.has(k)) byRecipient.set(k, [])
    byRecipient.get(k)!.push(r)
  }

  // يُعلَّم الموعد كمُرسَل فقط إذا وصل لمستلم واحد على الأقل
  const delivered = { visit: new Set<string>(), consultation: new Set<string>() }
  let emails = 0, pushes = 0

  for (const [userId, rows] of byRecipient) {
    const to   = rows[0].recipient_email
    const name = rows[0].recipient_name ?? ''

    const [okEmail, okPush] = await Promise.all([
      to ? sendEmail(to, name, rows).catch(e => { console.error(e?.message ?? e); return false }) : Promise.resolve(false),
      sendPush(userId, rows).catch(e => { console.error(e?.message ?? e); return false }),
    ])
    if (okEmail) emails++
    if (okPush)  pushes++

    if (okEmail || okPush) {
      for (const r of rows) {
        if (r.kind === 'visit' || r.kind === 'consultation') delivered[r.kind].add(r.item_id)
      }
    }
  }

  for (const kind of ['visit', 'consultation'] as const) {
    const ids = [...delivered[kind]]
    if (ids.length) await admin.rpc('mark_reminders_sent', { p_kind: kind, p_ids: ids })
  }

  const result = {
    ok: true,
    due: due.length,
    recipients: byRecipient.size,
    emails,
    pushes,
    marked: delivered.visit.size + delivered.consultation.size,
  }
  console.log('نتيجة التذكيرات:', JSON.stringify(result))
  return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } })
})
