import { useState, useEffect, useRef } from 'react'
import { getProjects, getVisits, supabase } from '../lib/supabase.js'

export default function Photos() {
  const [photos, setPhotos] = useState([])
  const [visits, setVisits] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ visit_id: '', caption: '' })
  const [selectedFile, setSelectedFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [filterVisit, setFilterVisit] = useState('all')
  const fileRef = useRef()

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const [{ data: ph }, v, p] = await Promise.all([
        supabase.from('visit_photos').select('*, site_visits(visit_date, projects(name))').order('created_at', { ascending: false }),
        getVisits(), getProjects()
      ])
      setPhotos(ph || [])
      setVisits(v || [])
      setProjects(p || [])
    } catch(e) { console.error(e) } finally { setLoading(false) }
  }

  function handleFileSelect(e) {
    const file = e.target.files[0]
    if (!file) return
    setSelectedFile(file)
    const reader = new FileReader()
    reader.onload = (e) => setPreview(e.target.result)
    reader.readAsDataURL(file)
  }

  async function handleUpload(e) {
    e.preventDefault()
    if (!selectedFile || !form.visit_id) return
    setUploading(true)
    try {
      const ext = selectedFile.name.split('.').pop()
      const path = `visits/${form.visit_id}/photos/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('Rekaz').upload(path, selectedFile)
      if (uploadError) throw uploadError
      const { data: { publicUrl } } = supabase.storage.from('Rekaz').getPublicUrl(path)
      await supabase.from('visit_photos').insert({ visit_id: form.visit_id, file_path: publicUrl, caption: form.caption })
      setShowModal(false)
      setSelectedFile(null)
      setPreview(null)
      setForm({ visit_id: '', caption: '' })
      await load()
    } catch(e) { alert('Upload failed: ' + e.message) } finally { setUploading(false) }
  }

  async function handleDelete(photo) {
    if (!confirm('Delete this photo?')) return
    await supabase.from('visit_photos').delete().eq('id', photo.id)
    await load()
  }

  const filtered = filterVisit === 'all' ? photos : photos.filter(p => p.visit_id === filterVisit)

  return (
    <>
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <h3>Upload Photo</h3>
            <form onSubmit={handleUpload}>
              <div className="form-group">
                <label className="form-label">Site Visit *</label>
                <select className="form-input" value={form.visit_id} onChange={e => setForm(f => ({...f, visit_id: e.target.value}))} required>
                  <option value="">Select visit...</option>
                  {visits.map(v => <option key={v.id} value={v.id}>{v.projects?.name} — {v.visit_date}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Photo *</label>
                <div
                  onClick={() => fileRef.current.click()}
                  style={{ border: '1.5px dashed rgba(0,0,0,0.2)', borderRadius: 8, padding: 20, textAlign: 'center', cursor: 'pointer', background: '#fafaf8' }}
                >
                  {preview ? (
                    <img src={preview} alt="preview" style={{ maxHeight: 180, maxWidth: '100%', borderRadius: 6, objectFit: 'cover' }} />
                  ) : (
                    <div>
                      <svg width="32" height="32" fill="none" viewBox="0 0 16 16" style={{ opacity: 0.3, margin: '0 auto 8px', display: 'block' }}>
                        <rect x="1" y="4" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
                        <circle cx="8" cy="9.5" r="2.5" stroke="currentColor" strokeWidth="1.2"/>
                      </svg>
                      <div style={{ fontSize: 13, color: '#888' }}>Click to select photo</div>
                      <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>JPG, PNG, HEIC up to 50MB</div>
                    </div>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileSelect} />
              </div>
              <div className="form-group">
                <label className="form-label">Caption</label>
                <input className="form-input" value={form.caption} onChange={e => setForm(f => ({...f, caption: e.target.value}))} placeholder="Describe what's in the photo..." />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={uploading || !selectedFile}>
                  {uploading ? 'Uploading...' : 'Upload Photo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="page-header">
        <div><h3>Photos</h3><div className="page-sub">{filtered.length} photos</div></div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Upload Photo</button>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <select className="form-input" style={{ width: 260 }} value={filterVisit} onChange={e => setFilterVisit(e.target.value)}>
          <option value="all">All Visits</option>
          {visits.map(v => <option key={v.id} value={v.id}>{v.projects?.name} — {v.visit_date}</option>)}
        </select>
      </div>

      {loading ? <div style={{ color: '#888' }}>Loading...</div> :
        filtered.length === 0 ? (
          <div className="card"><div className="empty">
            <svg width="48" height="48" fill="none" viewBox="0 0 16 16"><rect x="1" y="4" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1"/><circle cx="8" cy="9.5" r="2.5" stroke="currentColor" strokeWidth="1"/></svg>
            <p>No photos yet. Upload your first photo.</p>
          </div></div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {filtered.map(photo => (
              <div key={photo.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ position: 'relative', aspectRatio: '4/3', background: '#f5f5f0' }}>
                  <img
                    src={photo.file_path}
                    alt={photo.caption || 'Site photo'}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    onError={e => { e.target.style.display = 'none' }}
                  />
                  <button
                    onClick={() => handleDelete(photo)}
                    style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: 4, color: 'white', cursor: 'pointer', padding: '2px 6px', fontSize: 11 }}
                  >✕</button>
                </div>
                <div style={{ padding: '10px 12px' }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary)' }}>{photo.site_visits?.projects?.name || '—'}</div>
                  {photo.caption && <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{photo.caption}</div>}
                  <div style={{ fontSize: 10, color: '#aaa', marginTop: 4 }}>{photo.site_visits?.visit_date}</div>
                </div>
              </div>
            ))}
          </div>
        )
      }
    </>
  )
}
