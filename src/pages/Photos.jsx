import { useState, useEffect, useRef } from 'react'
import { getProjects, getVisits, supabase } from '../lib/supabase.js'

async function compressImage(file, maxSizeKB = 300) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let { width, height } = img
        const MAX = 1200
        if (width > MAX || height > MAX) {
          if (width > height) { height = height * MAX / width; width = MAX }
          else { width = width * MAX / height; height = MAX }
        }
        canvas.width = width; canvas.height = height
        canvas.getContext('2d').drawImage(img, 0, 0, width, height)
        let quality = 0.8
        const tryCompress = () => {
          canvas.toBlob((blob) => {
            if (blob.size / 1024 > maxSizeKB && quality > 0.3) { quality -= 0.1; tryCompress() }
            else resolve(new File([blob], file.name, { type: 'image/jpeg' }))
          }, 'image/jpeg', quality)
        }
        tryCompress()
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

export default function Photos() {
  const [photos, setPhotos] = useState([])
  const [visits, setVisits] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  const [form, setForm] = useState({ visit_id:'', caption:'' })
  const [selectedFile, setSelectedFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [filterProject, setFilterProject] = useState('all')
  const [filterVisit, setFilterVisit] = useState('all')
  const fileRef = useRef()

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const [{ data: ph }, v, p] = await Promise.all([
        supabase.from('visit_photos').select('*, site_visits(visit_date, notes, project_id, projects(name))').order('created_at', { ascending: false }),
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
      const compressed = await compressImage(selectedFile)
      const path = `visits/${form.visit_id}/photos/${Date.now()}.jpg`
      const { error: uploadError } = await supabase.storage.from('Rekaz').upload(path, compressed)
      if (uploadError) throw uploadError
      const { data: { publicUrl } } = supabase.storage.from('Rekaz').getPublicUrl(path)
      await supabase.from('visit_photos').insert({ visit_id: form.visit_id, file_path: publicUrl, caption: form.caption })
      setShowModal(false); setSelectedFile(null); setPreview(null)
      setForm({ visit_id:'', caption:'' }); await load()
    } catch(e) { alert('Upload failed: ' + e.message) } finally { setUploading(false) }
  }

  async function handleDelete(photo) {
    if (!confirm('Delete this photo?')) return
    await supabase.from('visit_photos').delete().eq('id', photo.id)
    setPhotos(prev => prev.filter(p => p.id !== photo.id))
    if (lightbox?.id === photo.id) setLightbox(null)
  }

  function openLightbox(photo) { setLightbox(photo) }

  function navLightbox(dir) {
    const filtered = getFiltered()
    const idx = filtered.findIndex(p => p.id === lightbox.id)
    const next = filtered[idx + dir]
    if (next) setLightbox(next)
  }

  function getFiltered() {
    return photos.filter(p => {
      const matchProject = filterProject === 'all' || p.site_visits?.project_id === filterProject
      const matchVisit = filterVisit === 'all' || p.visit_id === filterVisit
      return matchProject && matchVisit
    })
  }

  const filtered = getFiltered()
  const filteredVisits = filterProject === 'all' ? visits : visits.filter(v => v.project_id === filterProject)

  return (
    <>
      <style>{`
        .photo-card { cursor: pointer; transition: transform 0.15s ease, box-shadow 0.15s ease; }
        .photo-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.12); }
        .photo-img { transition: transform 0.3s ease; }
        .photo-card:hover .photo-img { transform: scale(1.04); }
      `}</style>

      {/* Lightbox */}
      {lightbox && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.95)',zIndex:2000,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}
          onClick={e => e.target === e.currentTarget && setLightbox(null)}>
          {/* Top bar */}
          <div style={{position:'absolute',top:0,left:0,right:0,padding:'16px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',background:'linear-gradient(rgba(0,0,0,0.5),transparent)'}}>
            <div>
              <div style={{color:'white',fontWeight:500,fontSize:14}}>{lightbox.site_visits?.projects?.name||'—'}</div>
              <div style={{color:'rgba(255,255,255,0.6)',fontSize:12}}>{lightbox.site_visits?.notes?.split(' — ')[0]||'Site Visit'} · {lightbox.site_visits?.visit_date}</div>
            </div>
            <div style={{display:'flex',gap:10}}>
              <a href={lightbox.file_path} download target="_blank" rel="noreferrer"
                style={{background:'rgba(255,255,255,0.1)',border:'none',borderRadius:8,color:'white',cursor:'pointer',padding:'8px 14px',fontSize:12,textDecoration:'none',display:'flex',alignItems:'center',gap:5}}>
                ⬇ Download
              </a>
              <button onClick={() => handleDelete(lightbox)}
                style={{background:'rgba(163,45,45,0.4)',border:'none',borderRadius:8,color:'white',cursor:'pointer',padding:'8px 14px',fontSize:12}}>
                🗑 Delete
              </button>
              <button onClick={() => setLightbox(null)}
                style={{background:'rgba(255,255,255,0.1)',border:'none',borderRadius:8,color:'white',cursor:'pointer',padding:'8px 14px',fontSize:18}}>
                ✕
              </button>
            </div>
          </div>

          {/* Navigation */}
          {filtered.findIndex(p=>p.id===lightbox.id) > 0 && (
            <button onClick={()=>navLightbox(-1)} style={{position:'absolute',left:16,background:'rgba(255,255,255,0.1)',border:'none',borderRadius:50,color:'white',cursor:'pointer',width:44,height:44,fontSize:20,display:'flex',alignItems:'center',justifyContent:'center'}}>‹</button>
          )}
          {filtered.findIndex(p=>p.id===lightbox.id) < filtered.length - 1 && (
            <button onClick={()=>navLightbox(1)} style={{position:'absolute',right:16,background:'rgba(255,255,255,0.1)',border:'none',borderRadius:50,color:'white',cursor:'pointer',width:44,height:44,fontSize:20,display:'flex',alignItems:'center',justifyContent:'center'}}>›</button>
          )}

          {/* Image */}
          <img src={lightbox.file_path} alt={lightbox.caption||''}
            style={{maxWidth:'90vw',maxHeight:'80vh',objectFit:'contain',borderRadius:8}}/>

          {/* Caption */}
          {lightbox.caption && (
            <div style={{color:'rgba(255,255,255,0.8)',fontSize:13,marginTop:12,padding:'0 20px',textAlign:'center'}}>
              {lightbox.caption}
            </div>
          )}

          {/* Counter */}
          <div style={{color:'rgba(255,255,255,0.4)',fontSize:12,marginTop:8}}>
            {filtered.findIndex(p=>p.id===lightbox.id)+1} / {filtered.length}
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget&&setShowModal(false)}>
          <div className="modal">
            <h3>Upload Photo</h3>
            <form onSubmit={handleUpload}>
              <div className="form-group">
                <label className="form-label">Site Visit *</label>
                <select className="form-input" value={form.visit_id} onChange={e=>setForm(f=>({...f,visit_id:e.target.value}))} required>
                  <option value="">Select visit...</option>
                  {visits.map(v=><option key={v.id} value={v.id}>{v.projects?.name} — {v.visit_date}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Photo *</label>
                <div onClick={()=>fileRef.current.click()}
                  style={{border:'1.5px dashed var(--border)',borderRadius:10,padding:20,textAlign:'center',cursor:'pointer',background:'var(--bg)',transition:'border-color 0.15s'}}
                  onMouseEnter={e=>e.currentTarget.style.borderColor='#185FA5'}
                  onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}>
                  {preview ? (
                    <img src={preview} alt="preview" style={{maxHeight:180,maxWidth:'100%',borderRadius:8,objectFit:'cover'}}/>
                  ) : (
                    <div>
                      <div style={{fontSize:32,marginBottom:8}}>📷</div>
                      <div style={{fontSize:13,color:'var(--text-muted)'}}>Click to select photo</div>
                      <div style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>JPG, PNG, HEIC</div>
                    </div>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleFileSelect}/>
              </div>
              <div className="form-group">
                <label className="form-label">Caption</label>
                <input className="form-input" value={form.caption} onChange={e=>setForm(f=>({...f,caption:e.target.value}))} placeholder="Describe the photo..."/>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={()=>setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={uploading||!selectedFile}>
                  {uploading ? 'Uploading...' : 'Upload Photo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="page-header">
        <div><h3>Photos</h3><div className="page-sub">{filtered.length} photos</div></div>
        <button className="btn btn-primary" onClick={()=>setShowModal(true)}>📷 Upload</button>
      </div>

      {/* Filters */}
      <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap'}}>
        <select className="form-input" style={{width:200}} value={filterProject} onChange={e=>{setFilterProject(e.target.value);setFilterVisit('all')}}>
          <option value="all">All Projects</option>
          {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className="form-input" style={{width:240}} value={filterVisit} onChange={e=>setFilterVisit(e.target.value)}>
          <option value="all">All Visits</option>
          {filteredVisits.map(v=><option key={v.id} value={v.id}>{v.projects?.name} — {v.visit_date}</option>)}
        </select>
        {(filterProject !== 'all' || filterVisit !== 'all') && (
          <button className="btn btn-sm" onClick={()=>{setFilterProject('all');setFilterVisit('all')}}>✕ Clear</button>
        )}
      </div>

      {loading ? (
        <div style={{color:'var(--text-muted)',padding:24}}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="card"><div className="empty">
          <div style={{fontSize:48,marginBottom:12}}>📷</div>
          <p>No photos yet.</p>
          <button className="btn btn-primary" style={{marginTop:12}} onClick={()=>setShowModal(true)}>Upload First Photo</button>
        </div></div>
      ) : (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:12}}>
          {filtered.map(photo=>(
            <div key={photo.id} className="photo-card card" style={{padding:0,overflow:'hidden'}} onClick={()=>openLightbox(photo)}>
              <div style={{aspectRatio:'4/3',background:'var(--bg)',overflow:'hidden'}}>
                <img className="photo-img" src={photo.file_path} alt={photo.caption||''}
                  style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}
                  onError={e=>{e.target.style.display='none'}}/>
              </div>
              <div style={{padding:'10px 12px'}}>
                <div style={{fontSize:12,fontWeight:550,color:'var(--text)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                  {photo.site_visits?.projects?.name||'—'}
                </div>
                <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                  {photo.site_visits?.notes?.split(' — ')[0]||'—'}
                </div>
                {photo.caption && (
                  <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',fontStyle:'italic'}}>
                    {photo.caption}
                  </div>
                )}
                <div style={{fontSize:10,color:'var(--text-muted)',marginTop:4}}>{photo.site_visits?.visit_date}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
