import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { useNavigate } from 'react-router-dom'

const STATUS_COLORS = {
  pending: 'badge-gray',
  scheduled: 'badge-blue',
  completed: 'badge-done',
  cancelled: 'badge-open'
}

const STATUS_LABELS = {
  pending: 'لم تبدأ',
  scheduled: 'مجدولة',
  completed: 'منجزة',
  cancelled: 'ملغاة'
}

export default function ProjectVisits() {
  const [projects, setProjects] = useState([])
  const [selectedProject, setSelectedProject] = useState(null)
  const [visits, setVisits] = useState([])
  const [users, setUsers] = useState([])
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editVisit, setEditVisit] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: '', engineer_id: '', scheduled_date: '',
    scheduled_time: '', status: 'pending', notes: '', order_index: 0
  })

  useEffect(() => { loadInitial() }, [])
  useEffect(() => { if (selectedProject) loadVisits(selectedProject.id) }, [selectedProject])

  async function loadInitial() {
    try {
      const [{ data: p }, { data: u }, { data: t }] = await Promise.all([
        supabase.from('projects').select('*').order('created_at', { ascending: false }),
        supabase.from('users').select('*'),
        supabase.from('visit_templates').select('*').order('order_index')
      ])
      setProjects(p || [])
      setUsers(u || [])
      setTemplates(t || [])
      if (p?.length) setSelectedProject(p[0])
    } catch(e) { console.error(e) } finally { setLoading(false) }
  }

  async function loadVisits(projectId) {
    const { data } = await supabase
      .from('project_visits')
      .select('*, users(full_name)')
      .eq('project_id', projectId)
      .order('order_index')
    setVisits(data || [])
  }

  async function addDefaultVisits() {
    if (!selectedProject) return
    const toInsert = templates.map(t => ({
      project_id: selectedProject.id,
      title: t.title,
      order_index: t.order_index,
      status: 'pending'
    }))
    await supabase.from('project_visits').insert(toInsert)
    await loadVisits(selectedProject.id)
  }

  function openNew() {
    setEditVisit(null)
    setForm({ title: '', engineer_id: '', scheduled_date: '', scheduled_time: '', status: 'pending', notes: '', order_index: visits.length + 1 })
    setShowModal(true)
  }

  function openEdit(v) {
    setEditVisit(v)
    setForm({
      title: v.title, engineer_id: v.engineer_id || '',
      scheduled_date: v.scheduled_date || '', scheduled_time: v.scheduled_time || '',
      status: v.status, notes: v.notes || '', order_index: v.order_index
    })
    setShowModal(true)
  }

  async function handleSave(e) {
    e.preventDefault(); setSaving(true)
    try {
      const data = { ...form, project_id: selectedProject.id, engineer_id: form.engineer_id || null }
      if (editVisit) { await supabase.from('project_visits').update(data).eq('id', editVisit.id) }
      else { await supabase.from('project_visits').insert(data) }
      setShowModal(false)
      await loadVisits(selectedProject.id)
    } catch(e) { alert(e.message) } finally { setSaving(false) }
  }

  async function handleDelete(v) {
    if (!confirm(`حذف "${v.title}"؟`)) return
    await supabase.from('project_visits').delete().eq('id', v.id)
    await loadVisits(selectedProject.id)
  }

  async function toggleStatus(v) {
    const next = { pending: 'scheduled', scheduled: 'completed', completed: 'pending', cancelled: 'pending' }
    await supabase.from('project_visits').update({ status: next[v.status] }).eq('id', v.id)
    await loadVisits(selectedProject.id)
  }

  const completed = visits.filter(v => v.status === 'completed').length
  const total = visits.length
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0

  return (
    <>
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <h3>{editVisit ? 'تعديل الزيارة' : 'زيارة جديدة'}</h3>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">اسم الزيارة *</label>
                <input className="form-input" value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} required autoFocus
                  list="visit-templates-list" placeholder="اختر أو اكتب..." />
                <datalist id="visit-templates-list">
                  {templates.map(t => <option key={t.id} value={t.title} />)}
                </datalist>
              </div>
              <div className="form-group">
                <label className="form-label">المهندس المسؤول</label>
                <select className="form-input" value={form.engineer_id} onChange={e => setForm(f => ({...f, engineer_id: e.target.value}))}>
                  <option value="">اختر مهندس...</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">التاريخ</label>
                  <input type="date" className="form-input" value={form.scheduled_date} onChange={e => setForm(f => ({...f, scheduled_date: e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">الوقت</label>
                  <input type="time" className="form-input" value={form.scheduled_time} onChange={e => setForm(f => ({...f, scheduled_time: e.target.value}))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">الحالة</label>
                <select className="form-input" value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value}))}>
                  <option value="pending">لم تبدأ</option>
                  <option value="scheduled">مجدولة</option>
                  <option value="completed">منجزة</option>
                  <option value="cancelled">ملغاة</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">ملاحظات</label>
                <textarea className="form-input" value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} placeholder="ملاحظات الزيارة..." />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => setShowModal(false)}>إلغاء</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'جاري الحفظ...' : editVisit ? 'حفظ' : 'إنشاء'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="page-header">
        <div><h3>زيارات المشاريع</h3><div className="page-sub">تتبع زيارات كل مشروع</div></div>
        <button className="btn btn-primary" onClick={openNew} disabled={!selectedProject}>+ زيارة جديدة</button>
      </div>

      {/* Project selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {projects.map(p => (
          <button key={p.id} className={`btn ${selectedProject?.id === p.id ? 'btn-primary' : ''}`}
            style={{ fontSize: 12 }} onClick={() => setSelectedProject(p)}>
            {p.name}
          </button>
        ))}
      </div>

      {selectedProject && (
        <>
          {/* Project header */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 500, fontSize: 15 }}>{selectedProject.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {selectedProject.project_no} · {selectedProject.location || '—'} · {selectedProject.client_name || '—'}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 500, color: '#185FA5' }}>{completed}/{total}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>زيارة منجزة</div>
                </div>
                <div style={{ width: 80 }}>
                  <div className="progress-bar" style={{ height: 6 }}>
                    <div className="progress-fill" style={{ width: `${progress}%` }} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, textAlign: 'center' }}>{progress}%</div>
                </div>
                {visits.length === 0 && (
                  <button className="btn btn-sm" style={{ color: '#185FA5', borderColor: '#185FA5' }} onClick={addDefaultVisits}>
                    + إضافة القائمة الافتراضية
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Visits list */}
          <div className="card">
            {loading ? <div style={{ color: 'var(--text-muted)', padding: 16 }}>جاري التحميل...</div> :
              visits.length === 0 ? (
                <div className="empty">
                  <p>لا توجد زيارات بعد.</p>
                  <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={addDefaultVisits}>إضافة القائمة الافتراضية</button>
                </div>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: 32 }}>#</th>
                      <th>الزيارة</th>
                      <th>المهندس</th>
                      <th>التاريخ</th>
                      <th>الوقت</th>
                      <th>الحالة</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visits.map((v, i) => (
                      <tr key={v.id} style={{ opacity: v.status === 'cancelled' ? 0.5 : 1 }}>
                        <td style={{ color: 'var(--text-muted)', fontSize: 11 }}>{i + 1}</td>
                        <td>
                          <div style={{ fontWeight: 500, textDecoration: v.status === 'completed' ? 'line-through' : 'none', color: v.status === 'completed' ? 'var(--text-muted)' : 'var(--text)' }}>
                            {v.title}
                          </div>
                          {v.notes && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{v.notes}</div>}
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{v.users?.full_name || '—'}</td>
                        <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{v.scheduled_date || '—'}</td>
                        <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{v.scheduled_time ? v.scheduled_time.slice(0,5) : '—'}</td>
                        <td>
                          <span className={`badge ${STATUS_COLORS[v.status]}`} style={{ cursor: 'pointer' }} onClick={() => toggleStatus(v)}>
                            {STATUS_LABELS[v.status]}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-sm" onClick={() => openEdit(v)}>تعديل</button>
                            <button className="btn btn-sm" style={{ color: '#A32D2D', borderColor: '#A32D2D' }} onClick={() => handleDelete(v)}>حذف</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            }
          </div>
        </>
      )}
    </>
  )
}
