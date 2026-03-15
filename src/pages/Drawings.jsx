import { useState, useEffect, useRef } from 'react'
import { getProjects, supabase } from '../lib/supabase.js'

export default function Drawings() {
  const [drawings, setDrawings] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ project_id: '', title: '', drawing_no: '', version: 'R0' })
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef()

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const [{ data: d }, p] = await Promise.all([
        supabase.from('drawings').select('*, projects(name)').order('created_at', { ascending: false }),
        getProjects()
      ])
      setDrawings(d || [])
      setProjects(p || [])
    } catch(e) { console.error(e) } finally { setLoading(false) }
  }

  async function handleUpload(e) {
    e.preventDefault()
    if (!selectedFile || !form.project_id) return
    setUploading(true)
    try {
      const ext = selectedFile.name.split('.').pop()
      const path = `drawings/${form.project_id}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('Rekaz').upload(path, selectedFile)
      if (uploadError) throw uploadError
      const { data: { publicUrl } } = supabase.storage.from('Rekaz').getPublicUrl(path)
      await supabase.from('drawings').insert({ ...form, file_path: publicUrl })
      setShowModal(false)
      setSelectedFile(null)
      setForm({ project_id: '', title: '', drawing_no: '', version: 'R0' })
      await load()
    } catch(e) { alert('Upload failed: ' + e.message) } finally { setUploading(false) }
  }

  async function handleDelete(d) {
    if (!confirm(`Delete "${d.title}"?`)) return
    await supabase.from('drawings').delete().eq('id', d.id)
    await load()
  }

  function getFileIcon(path) {
    const ext = path?.split('.').pop()?.toLowerCase()
    if (ext === 'pdf') return '📄'
    if (['dwg','dxf'].includes(ext)) return '📐'
    if (['jpg','jpeg','png'].includes(ext)) return '🖼'
    return '📁'
  }

  return (
    <>
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <h3>Upload Drawing</h3>
            <form onSubmit={handleUpload}>
              <div className="form-group">
                <label className="form-label">Project *</label>
                <select className="form-input" value={form.project_id} onChange={e => setForm(f => ({...f, project_id: e.target.value}))} required>
                  <option value="">Select project...</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Drawing Title *</label>
                <input className="form-input" value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} placeholder="e.g. Ground Floor Plan" required autoFocus />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Drawing No</label>
                  <input className="form-input" value={form.drawing_no} onChange={e => setForm(f => ({...f, drawing_no: e.target.value}))} placeholder="DWG-001" />
                </div>
                <div className="form-group">
                  <label className="form-label">Version</label>
                  <select className="form-input" value={form.version} onChange={e => setForm(f => ({...f, version: e.target.value}))}>
                    {['R0','R1','R2','R3','IFC','Approved'].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">File *</label>
                <div onClick={() => fileRef.current.click()} style={{ border: '1.5px dashed rgba(0,0,0,0.2)', borderRadius: 8, padding: 20, textAlign: 'center', cursor: 'pointer', background: '#fafaf8' }}>
                  {selectedFile ? (
                    <div style={{ fontSize: 13 }}>
                      <div style={{ fontSize: 24 }}>{getFileIcon(selectedFile.name)}</div>
                      <div style={{ fontWeight: 500, marginTop: 6 }}>{selectedFile.name}</div>
                      <div style={{ color: '#888', fontSize: 11 }}>{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 24 }}>📐</div>
                      <div style={{ fontSize: 13, color: '#888', marginTop: 6 }}>Click to select file</div>
                      <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>PDF, DWG, DXF, PNG, JPG</div>
                    </div>
                  )}
                </div>
                <input ref={fileRef} type="file" accept=".pdf,.dwg,.dxf,.png,.jpg,.jpeg" style={{ display: 'none' }} onChange={e => setSelectedFile(e.target.files[0])} />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={uploading || !selectedFile}>{uploading ? 'Uploading...' : 'Upload'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="page-header">
        <div><h3>Drawings</h3><div className="page-sub">{drawings.length} drawings</div></div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Upload Drawing</button>
      </div>

      <div className="card">
        {loading ? <div style={{ color: '#888', padding: 16 }}>Loading...</div> :
          drawings.length === 0 ? (
            <div className="empty">
              <div style={{ fontSize: 40, marginBottom: 12 }}>📐</div>
              <p>No drawings yet. Upload your first drawing.</p>
            </div>
          ) : (
            <table className="table">
              <thead><tr><th>Drawing</th><th>Project</th><th>No.</th><th>Version</th><th>Date</th><th></th></tr></thead>
              <tbody>
                {drawings.map(d => (
                  <tr key={d.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 18 }}>{getFileIcon(d.file_path)}</span>
                        <span style={{ fontWeight: 500 }}>{d.title}</span>
                      </div>
                    </td>
                    <td style={{ color: '#888' }}>{d.projects?.name || '—'}</td>
                    <td style={{ color: '#888' }}>{d.drawing_no || '—'}</td>
                    <td><span className="badge badge-blue">{d.version}</span></td>
                    <td style={{ color: '#888', fontSize: 11 }}>{new Date(d.created_at).toLocaleDateString()}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <a href={d.file_path} target="_blank" rel="noreferrer" className="btn btn-sm">View</a>
                        <a href={d.file_path} download className="btn btn-sm">Download</a>
                        <button className="btn btn-sm" style={{ color: '#A32D2D', borderColor: '#A32D2D' }} onClick={() => handleDelete(d)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
    </>
  )
}
