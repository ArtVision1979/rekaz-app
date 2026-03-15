import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

const ROLES = ['admin','engineer','supervisor']
const ROLE_C = { admin:'badge-open', engineer:'badge-blue', supervisor:'badge-progress' }

export default function Users() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [form, setForm] = useState({ full_name:'', email:'', role:'engineer' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const { data } = await supabase.from('users').select('*').order('created_at')
      setUsers(data || [])
    } catch(e) { console.error(e) } finally { setLoading(false) }
  }

  function openEdit(u) {
    setEditUser(u)
    setForm({ full_name: u.full_name, email: u.email, role: u.role })
    setShowModal(true)
  }

  async function handleSave(e) {
    e.preventDefault(); setSaving(true)
    try {
      await supabase.from('users').update({ full_name: form.full_name, role: form.role }).eq('id', editUser.id)
      setShowModal(false); await load()
    } catch(e) { alert(e.message) } finally { setSaving(false) }
  }

  return (
    <>
      {showModal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowModal(false)}>
          <div className="modal">
            <h3>Edit User</h3>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input className="form-input" value={form.full_name} onChange={e=>setForm(f=>({...f,full_name:e.target.value}))} required/>
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" value={form.email} disabled style={{opacity:0.6}}/>
              </div>
              <div className="form-group">
                <label className="form-label">Role</label>
                <select className="form-input" value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}>
                  {ROLES.map(r=><option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={()=>setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Saving...':'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <div className="page-header">
        <div><h3>Users</h3><div className="page-sub">{users.length} team members</div></div>
        <div style={{fontSize:12,color:'#888'}}>Add users via Supabase Authentication</div>
      </div>
      <div className="card">
        {loading ? <div style={{color:'#888',padding:16}}>Loading...</div> :
          users.length === 0 ? <div className="empty"><p>No users yet.</p></div> : (
            <table className="table">
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th><th></th></tr></thead>
              <tbody>
                {users.map(u=>(
                  <tr key={u.id}>
                    <td>
                      <div style={{display:'flex',alignItems:'center',gap:10}}>
                        <div style={{width:32,height:32,borderRadius:'50%',background:'#E6F1FB',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:600,color:'#0C447C',flexShrink:0}}>
                          {u.full_name?.slice(0,2).toUpperCase()||u.email?.slice(0,2).toUpperCase()}
                        </div>
                        <span style={{fontWeight:500}}>{u.full_name||'—'}</span>
                      </div>
                    </td>
                    <td style={{color:'#888'}}>{u.email}</td>
                    <td><span className={`badge ${ROLE_C[u.role]||'badge-gray'}`}>{u.role}</span></td>
                    <td style={{color:'#888',fontSize:11}}>{new Date(u.created_at).toLocaleDateString()}</td>
                    <td><button className="btn btn-sm" onClick={()=>openEdit(u)}>Edit Role</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
    </>
  )
}
