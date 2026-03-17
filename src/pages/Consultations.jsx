import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { useEngineers } from '../hooks/useEngineers.js'

const STATUS_COLORS = { pending:'badge-gray', completed:'badge-done', cancelled:'badge-open' }
const STATUS_LABELS = { pending:'Pending', completed:'Completed', cancelled:'Cancelled' }
const EMPTY = { client_name:'', client_phone:'', topic:'', engineer_name:'', consultation_date: new Date().toISOString().split('T')[0], consultation_time:'', status:'pending', notes:'' }

function EngineerSelect({ value, onChange }) {
  const engineers = useEngineers()
  return (
    <select className="form-input" value={value} onChange={e => onChange(e.target.value)}>
      <option value="">Select engineer...</option>
      {engineers.map(e => (
        <option key={e.id} value={e.full_name || e.email}>{e.full_name || e.email}</option>
      ))}
    </select>
  )
}

export default function Consultations() {
  const [consultations, setConsultations] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const { data } = await supabase
        .from('consultations')
        .select('*')
        .order('consultation_date', { ascending: false })
      setConsultations(data || [])
    } catch(e) { console.error(e) } finally { setLoading(false) }
  }

  function openNew() {
    setEditItem(null)
    setForm(EMPTY)
    setShowModal(true)
  }

  function openEdit(item) {
    setEditItem(item)
    setForm({
      client_name: item.client_name,
      client_phone: item.client_phone || '',
      topic: item.topic,
      engineer_name: item.engineer_name || '',
      consultation_date: item.consultation_date,
      consultation_time: item.consultation_time || '',
      status: item.status,
      notes: item.notes || ''
    })
    setShowModal(true)
  }

  async function handleSave(e) {
    e.preventDefault(); setSaving(true)
    try {
      if (editItem) { await supabase.from('consultations').update(form).eq('id', editItem.id) }
      else { await supabase.from('consultations').insert(form) }
      setShowModal(false); await load()
    } catch(e) { alert(e.message) } finally { setSaving(false) }
  }

  async function handleDelete(item) {
    if (!confirm(`Delete consultation for "${item.client_name}"?`)) return
    await supabase.from('consultations').delete().eq('id', item.id)
    await load()
  }

  async function toggleStatus(item) {
    const next = { pending:'completed', completed:'cancelled', cancelled:'pending' }
    await supabase.from('consultations').update({ status: next[item.status] }).eq('id', item.id)
    setConsultations(prev => prev.map(c => c.id === item.id ? { ...c, status: next[item.status] } : c))
  }

  const filtered = consultations.filter(c => {
    const matchSearch = c.client_name.toLowerCase().includes(search.toLowerCase()) ||
      c.topic.toLowerCase().includes(search.toLowerCase()) ||
      (c.engineer_name||'').toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || c.status === filter
    return matchSearch && matchFilter
  })

  const pendingCount = consultations.filter(c => c.status === 'pending').length
  const completedCount = consultations.filter(c => c.status === 'completed').length

  return (
    <>
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <h3>{editItem ? 'Edit Consultation' : 'New Consultation'}</h3>
            <form onSubmit={handleSave}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div className="form-group">
                  <label className="form-label">Client Name * — اسم العميل</label>
                  <input className="form-input" value={form.client_name}
                    onChange={e=>setForm(f=>({...f,client_name:e.target.value}))}
                    required autoFocus placeholder="Client name..."/>
                </div>
                <div className="form-group">
                  <label className="form-label">Phone — رقم التواصل</label>
                  <input className="form-input" value={form.client_phone}
                    onChange={e=>setForm(f=>({...f,client_phone:e.target.value}))}
                    placeholder="+973 XXXX XXXX"/>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Topic * — موضوع الاستشارة</label>
                <input className="form-input" value={form.topic}
                  onChange={e=>setForm(f=>({...f,topic:e.target.value}))}
                  required placeholder="e.g. Foundation design, Extension permit..."/>
              </div>
              <div className="form-group">
                <label className="form-label">Engineer — المهندس المسؤول</label>
                <EngineerSelect value={form.engineer_name} onChange={val=>setForm(f=>({...f,engineer_name:val}))}/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div className="form-group">
                  <label className="form-label">Date — التاريخ</label>
                  <input type="date" className="form-input" value={form.consultation_date}
                    onChange={e=>setForm(f=>({...f,consultation_date:e.target.value}))}/>
                </div>
                <div className="form-group">
                  <label className="form-label">Time — الوقت</label>
                  <input type="time" className="form-input" value={form.consultation_time}
                    onChange={e=>setForm(f=>({...f,consultation_time:e.target.value}))}/>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Status — الحالة</label>
                <select className="form-input" value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
                  <option value="pending">Pending — قيد الانتظار</option>
                  <option value="completed">Completed — مكتملة</option>
                  <option value="cancelled">Cancelled — ملغاة</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Notes — ملاحظات</label>
                <textarea className="form-input" value={form.notes}
                  onChange={e=>setForm(f=>({...f,notes:e.target.value}))}
                  placeholder="Consultation notes and recommendations..."/>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={()=>setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : editItem ? 'Save' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <h3>Engineering Consultations</h3>
          <div className="page-sub">الاستشارات الهندسية · {pendingCount} pending · {completedCount} completed</div>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ New Consultation</button>
      </div>

      {/* Search & Filter */}
      <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap'}}>
        <input className="form-input" style={{flex:1,maxWidth:280}}
          placeholder="Search by client, topic, engineer..."
          value={search} onChange={e=>setSearch(e.target.value)}/>
        <div style={{display:'flex',gap:6}}>
          {['all','pending','completed','cancelled'].map(f=>(
            <button key={f} className={`btn btn-sm ${filter===f?'btn-primary':''}`}
              onClick={()=>setFilter(f)} style={{fontSize:11,textTransform:'capitalize'}}>
              {f==='all'?`All (${consultations.length})`:
               f==='pending'?`Pending (${pendingCount})`:
               f==='completed'?`Completed (${completedCount})`:
               `Cancelled`}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        {loading ? <div style={{color:'var(--text-muted)',padding:16}}>Loading...</div> :
          filtered.length === 0 ? (
            <div className="empty">
              <div style={{fontSize:48,marginBottom:12}}>💼</div>
              <p>{search ? 'No results found.' : 'No consultations yet.'}</p>
              {!search && <button className="btn btn-primary" style={{marginTop:12}} onClick={openNew}>+ New Consultation</button>}
            </div>
          ) : (
            <table className="table">
              <thead><tr>
                <th>Client — العميل</th>
                <th>Topic — الموضوع</th>
                <th>Engineer</th>
                <th>Date</th>
                <th>Status</th>
                <th></th>
              </tr></thead>
              <tbody>
                {filtered.map(c=>(
                  <tr key={c.id}>
                    <td>
                      <div style={{fontWeight:550}}>{c.client_name}</div>
                      {c.client_phone && (
                        <a href={`tel:${c.client_phone}`} style={{fontSize:11,color:'#185FA5',textDecoration:'none'}}>
                          📞 {c.client_phone}
                        </a>
                      )}
                    </td>
                    <td>
                      <div style={{fontSize:13}}>{c.topic}</div>
                      {c.notes && <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2,maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.notes}</div>}
                    </td>
                    <td style={{color:'var(--text-muted)',fontSize:12}}>{c.engineer_name||'—'}</td>
                    <td style={{color:'var(--text-muted)',fontSize:12}}>
                      {c.consultation_date}
                      {c.consultation_time && <div style={{fontSize:11}}>{c.consultation_time.slice(0,5)}</div>}
                    </td>
                    <td>
                      <span className={`badge ${STATUS_COLORS[c.status]}`}
                        style={{cursor:'pointer'}} onClick={()=>toggleStatus(c)}>
                        {STATUS_LABELS[c.status]}
                      </span>
                    </td>
                    <td>
                      <div style={{display:'flex',gap:6}}>
                        <button className="btn btn-sm" onClick={()=>openEdit(c)}>Edit</button>
                        <button className="btn btn-sm" style={{color:'#A32D2D',borderColor:'#A32D2D'}} onClick={()=>handleDelete(c)}>Delete</button>
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
  )
}
