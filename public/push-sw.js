// معالج إشعارات Web Push.
// يُدمج داخل Service Worker الذي يولّده vite-plugin-pwa عبر importScripts،
// حتى نبقى على استراتيجية generateSW بدون تعقيد.
//
// هذا هو الجزء الذي يجعل التذكير يصل حتى لو كان تبويب البرنامج مغلقاً:
// المتصفح يوقظ الـ Service Worker عند وصول الإشعار من الخادم.

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { title: 'ركاز', body: event.data ? event.data.text() : '' }
  }

  const title = payload.title || '🔔 تذكير — ركاز'
  const options = {
    body: payload.body || '',
    icon: '/logo192.png',
    badge: '/logo192.png',
    dir: 'rtl',
    lang: 'ar',
    tag: payload.tag || 'rekaz-reminder',
    renotify: true,
    requireInteraction: true,
    data: { url: payload.url || '/schedule' },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/schedule'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      // لو البرنامج مفتوح في تبويب، ننتقل إليه بدل فتح تبويب جديد
      for (const client of list) {
        if ('focus' in client) {
          if ('navigate' in client) client.navigate(target)
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target)
    })
  )
})
