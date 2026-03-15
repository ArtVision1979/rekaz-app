// =============================================
// lib/supabase.js — ضعه في مجلد src/lib/
// =============================================
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co'       // ← غيّر هذا
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY'                        // ← غيّر هذا

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)


// =============================================
// AUTH HELPERS
// =============================================
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  await supabase.auth.signOut()
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('users').select('*').eq('id', user.id).single()
  return data
}


// =============================================
// PROJECTS
// =============================================
export async function getProjects() {
  const { data, error } = await supabase
    .from('projects')
    .select('*, project_categories(name)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getProject(id) {
  const { data, error } = await supabase
    .from('projects')
    .select('*, project_categories(name), site_visits(*), milestones(*)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createProject(project) {
  const { data, error } = await supabase.from('projects').insert(project).select().single()
  if (error) throw error
  return data
}

export async function updateProject(id, updates) {
  const { data, error } = await supabase.from('projects').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}


// =============================================
// SITE VISITS
// =============================================
export async function getVisits(projectId = null) {
  let query = supabase
    .from('site_visits')
    .select('*, projects(name, project_no), construction_stages(name), users(full_name)')
    .order('visit_date', { ascending: false })
  if (projectId) query = query.eq('project_id', projectId)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function getVisit(id) {
  const { data, error } = await supabase
    .from('site_visits')
    .select(`
      *,
      projects(name, project_no, location),
      construction_stages(name),
      users(full_name),
      visit_photos(*),
      visit_checklist_results(*, inspection_checklists(item)),
      tasks(*)
    `)
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createVisit(visit) {
  const { data, error } = await supabase.from('site_visits').insert(visit).select().single()
  if (error) throw error
  return data
}

export async function updateVisit(id, updates) {
  const { data, error } = await supabase.from('site_visits').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}


// =============================================
// TASKS
// =============================================
export async function getTasks(projectId = null) {
  let query = supabase
    .from('tasks')
    .select('*, projects(name), users(full_name)')
    .order('created_at', { ascending: false })
  if (projectId) query = query.eq('project_id', projectId)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function createTask(task) {
  const { data, error } = await supabase.from('tasks').insert(task).select().single()
  if (error) throw error
  return data
}

export async function updateTask(id, updates) {
  const { data, error } = await supabase.from('tasks').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}


// =============================================
// REPORTS
// =============================================
export async function getReports() {
  const { data, error } = await supabase
    .from('reports')
    .select('*, site_visits(visit_date), projects(name, project_no), users(full_name)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function createReport(visitId, projectId) {
  // Generate report number via RPC
  const { data: reportNo } = await supabase.rpc('generate_report_no')
  const { data, error } = await supabase
    .from('reports')
    .insert({ report_no: reportNo, visit_id: visitId, project_id: projectId })
    .select()
    .single()
  if (error) throw error
  return data
}


// =============================================
// SCHEDULE
// =============================================
export async function getSchedule(startDate, endDate) {
  const { data, error } = await supabase
    .from('schedule_visits')
    .select('*, projects(name), users(full_name)')
    .gte('scheduled_date', startDate)
    .lte('scheduled_date', endDate)
    .order('scheduled_date')
  if (error) throw error
  return data
}

export async function createScheduleVisit(visit) {
  const { data, error } = await supabase.from('schedule_visits').insert(visit).select().single()
  if (error) throw error
  return data
}


// =============================================
// PHOTOS — Upload to Supabase Storage
// =============================================
export async function uploadVisitPhoto(visitId, file, caption = '') {
  const ext = file.name.split('.').pop()
  const path = `visits/${visitId}/photos/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('projects')
    .upload(path, file)
  if (uploadError) throw uploadError

  const { data, error } = await supabase
    .from('visit_photos')
    .insert({ visit_id: visitId, file_path: path, caption })
    .select()
    .single()
  if (error) throw error
  return data
}

export function getPhotoUrl(filePath) {
  const { data } = supabase.storage.from('projects').getPublicUrl(filePath)
  return data.publicUrl
}


// =============================================
// DASHBOARD STATS
// =============================================
export async function getDashboardStats() {
  const [
    { count: totalProjects },
    { count: activeProjects },
    { count: openTasks },
    { count: criticalTasks },
    { count: reports }
  ] = await Promise.all([
    supabase.from('projects').select('*', { count: 'exact', head: true }),
    supabase.from('projects').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('tasks').select('*', { count: 'exact', head: true }).in('status', ['open','in_progress']).eq('severity', 'critical'),
    supabase.from('reports').select('*', { count: 'exact', head: true })
  ])

  return { totalProjects, activeProjects, openTasks, criticalTasks, reports }
}


// =============================================
// REALTIME — استقبال التحديثات الفورية
// =============================================
export function subscribeToVisits(callback) {
  return supabase
    .channel('site_visits')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'site_visits' }, callback)
    .subscribe()
}

export function subscribeToTasks(callback) {
  return supabase
    .channel('tasks')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, callback)
    .subscribe()
}
