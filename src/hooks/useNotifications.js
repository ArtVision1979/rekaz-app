export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const permission = await Notification.requestPermission()
  return permission === 'granted'
}

export function scheduleVisitNotification(visit, minutesBefore = 60) {
  if (Notification.permission !== 'granted') return null
  const visitTime = new Date(`${visit.scheduled_date}T${visit.scheduled_time || '09:00'}`)
  const notifyTime = new Date(visitTime.getTime() - minutesBefore * 60 * 1000)
  const now = new Date()
  const delay = notifyTime.getTime() - now.getTime()
  if (delay < 0) return null
  const timeoutId = setTimeout(() => {
    const n = new Notification('🔔 تذكير زيارة موقع — ركاز', {
      body: `${visit.projects?.name || 'زيارة موقع'} — ${visit.scheduled_time || '09:00'}\nبعد ${minutesBefore} دقيقة`,
      icon: '/logo192.png',
      badge: '/logo192.png',
      tag: `visit-${visit.id}`,
      requireInteraction: true,
    })
    n.onclick = () => { window.focus(); n.close() }
  }, delay)
  return timeoutId
}

export function cancelNotification(timeoutId) {
  if (timeoutId) clearTimeout(timeoutId)
}

export function scheduleAllVisits(visits, minutesBefore = 60) {
  const ids = {}
  visits.forEach(v => {
    const id = scheduleVisitNotification(v, minutesBefore)
    if (id) ids[v.id] = id
  })
  return ids
}
