import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://YOUR_PROJECT.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_ANON_KEY'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  await supabase.auth.signOut()
}

export async function getProjects() {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function createProject(project) {
  const { data, error } = await supabase.from('projects').insert(project).select().single()
  if (error) throw error
  return data
}

export async function getVisits(projectId = null) {
  let q = supabase
    .from('site_visits')
    .select('*, projects(name, project_no), construction_stages(name), users(full_name)')
    .order('visit_date', { ascending: false })
  if (projectId) q = q.eq('project_id', projectId)
  const { data, error } = await q
  if (error) throw error
  return data
}

export async function createVisit(visit) {
  const { data, error } = await supabase.from('site_visits').insert(visit).select().single()
  if (error) throw error
  return data
}

export async function getTasks(projectId = null) {
  let q = supabase
    .from('tasks')
    .select('*, projects(name)')
    .order('created_at', { ascending: false })
  if (projectId) q = q.eq('project_id', projectId)
  const { data, error } = await q
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

export async function getReports() {
  const { data, error } = await supabase
    .from('reports')
    .select('*, projects(name, project_no), site_visits(visit_date)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getDashboardStats() {
  const [
    { count: totalProjects },
    { count: activeProjects },
    { count: openTasks },
    { count: reports }
  ] = await Promise.all([
    supabase.from('projects').select('*', { count: 'exact', head: true }),
    supabase.from('projects').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('reports').select('*', { count: 'exact', head: true })
  ])
  return { totalProjects: totalProjects || 0, activeProjects: activeProjects || 0, openTasks: openTasks || 0, reports: reports || 0 }
}

export async function uploadPhoto(bucket, path, file) {
  const { error } = await supabase.storage.from(bucket).upload(path, file)
  if (error) throw error
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}
