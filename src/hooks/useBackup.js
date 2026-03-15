import { supabase } from '../lib/supabase.js'

export async function createBackup() {
  const tables = ['projects', 'site_visits', 'tasks', 'milestones', 'daily_logs', 'schedule_visits', 'reports']
  const backup = { date: new Date().toISOString(), data: {} }

  for (const table of tables) {
    const { data } = await supabase.from(table).select('*')
    backup.data[table] = data || []
  }

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `rekaz-backup-${new Date().toISOString().split('T')[0]}.json`
  a.click()
  URL.revokeObjectURL(url)
  return backup
}

export async function getLastBackupDate() {
  return localStorage.getItem('rekaz-last-backup') || null
}

export function saveBackupDate() {
  localStorage.setItem('rekaz-last-backup', new Date().toISOString())
}

export function checkBackupNeeded() {
  const last = localStorage.getItem('rekaz-last-backup')
  if (!last) return true
  const daysSince = (Date.now() - new Date(last).getTime()) / (1000 * 60 * 60 * 24)
  return daysSince > 7
}
