import { useState, useEffect } from 'react'
import { getReports, getVisits, supabase } from '../lib/supabase.js'

export function Reports() {
  const [reports, setReports] = useState([])
  const [visits, setVisits] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ visit_id: '' })
  const [saving, setSaving] = useState(false)
  const [printReport, setPrintReport] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const [r, v] = await Promise.all([getReports(), getVisits()])
      setReports(r || [])
      setVisits(v || [])
    } catch(e) { console.error(e) } finally { setLoading(false) }
  }

  async function handleCreate(e) {
    e.preventDefault(); setSaving(true)
    try {
      const visit = visits.find(v => v.id === form.visit_id)
      const year = new Date().getFullYear()
      const report_no = `SVR-${year}-${String(reports.length + 1).padStart(3, '0')}`
      const { data } = await supabase.from('reports')
        .insert({ report_no, visit_id: form.visit_id, project_id: visit?.project_id })
        .select('*, site_visits(visit_date, notes, severity, projects(name, project_no, location, client_name)), projects(name, project_no, location, client_name)')
        .single()
      setShowModal(false)
      await load()
      if (data) setTimeout(() => openPrint(data), 300)
    } catch(e) { alert(e.message) } finally { setSaving(false) }
  }

  async function openPrint(r) {
    if (!r.site_visits) {
      const { data } = await supabase.from('reports')
        .select('*, site_visits(visit_date, notes, severity, projects(name, project_no, location, client_name)), projects(name, project_no, location, client_name)')
        .eq('id', r.id).single()
      setPrintReport(data)
    } else {
      setPrintReport(r)
    }
    setTimeout(() => window.print(), 400)
  }

  async function handleDelete(r) {
    if (!confirm('Delete this report?')) return
    await supabase.from('reports').delete().eq('id', r.id)
    await load()
  }

  return (
    <>
      <style>{`
        @media print {
          body > * { display: none !important; }
          #print-report { display: block !important; }
        }
        #print-report { display: none; }
      `}</style>

      {printReport && <PrintTemplate report={printReport} />}

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <h3>Generate Report</h3>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label">Select Visit *</label>
                <select className="form-input" value={form.visit_id} onChange={e => setForm(f => ({...f, visit_id: e.target.value}))} required>
                  <option value="">Select visit...</option>
                  {visits.map(v => <option key={v.id} value={v.id}>{v.projects?.name} — {v.visit_date}</option>)}
                </select>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Generating...' : 'Generate & Print'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="page-header">
        <div><h3>Reports</h3><div className="page-sub">{reports.length} reports</div></div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ New Report</button>
      </div>

      <div className="card">
        {loading ? <div style={{ color: '#888', padding: 16 }}>Loading...</div> :
          reports.length === 0 ? (
            <div className="empty">
              <svg width="48" height="48" fill="none" viewBox="0 0 16 16"><path d="M4 2h6l4 4v9H4V2z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/></svg>
              <p>No reports yet. Generate from a site visit.</p>
            </div>
          ) : reports.map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '0.5px solid rgba(0,0,0,0.08)' }}>
              <div>
                <div style={{ fontWeight: 500 }}>{r.report_no}</div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{r.projects?.name} · {r.site_visits?.visit_date}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className={`badge ${r.signed ? 'badge-done' : 'badge-gray'}`}>{r.signed ? 'Signed' : 'Draft'}</span>
                <button className="btn btn-sm" onClick={() => openPrint(r)}>Print / PDF</button>
                <button className="btn btn-sm" style={{ color: '#A32D2D', borderColor: '#A32D2D' }} onClick={() => handleDelete(r)}>Delete</button>
              </div>
            </div>
          ))
        }
      </div>
    </>
  )
}

function PrintTemplate({ report }) {
  const v = report.site_visits || {}
  const p = v.projects || report.projects || {}
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div id="print-report" style={{ fontFamily: 'Arial, sans-serif', color: '#000', background: '#fff', padding: 40, maxWidth: 800, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '3px solid #185FA5', paddingBottom: 20, marginBottom: 24 }}>
        <div>
          <img src="/rekaz-logo.png" alt="Rekaz" style={{ height: 50, width: 'auto', borderRadius: 4 }} />
          <div style={{ fontSize: 13, color: '#555', marginTop: 4 }}>Engineering Office</div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>Bahrain · isatrading79@gmail.com</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#185FA5' }}>SITE VISIT REPORT</div>
          <div style={{ fontSize: 14, color: '#333', marginTop: 4 }}>{report.report_no}</div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>Date: {date}</div>
        </div>
      </div>

      {/* Project Info */}
      <div style={{ background: '#f5f5f0', borderRadius: 8, padding: 16, marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#185FA5', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Project Information</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px' }}>
          {[
            ['Project Name', p.name || '—'],
            ['Project No', p.project_no || '—'],
            ['Location', p.location || '—'],
            ['Client', p.client_name || '—'],
            ['Visit Date', v.visit_date || '—'],
            ['Severity', v.severity || '—'],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', gap: 8 }}>
              <span style={{ color: '#666', fontSize: 12, minWidth: 90 }}>{label}:</span>
              <span style={{ fontSize: 12, fontWeight: 500 }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#185FA5', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Visit Notes & Observations</div>
        <div style={{ border: '1px solid #ddd', borderRadius: 6, padding: 12, minHeight: 80, fontSize: 13, lineHeight: 1.6 }}>
          {v.notes || 'No notes recorded for this visit.'}
        </div>
      </div>

      {/* Checklist */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#185FA5', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Inspection Checklist</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#185FA5', color: 'white' }}>
              <th style={{ padding: '8px 10px', textAlign: 'left' }}>Item</th>
              <th style={{ padding: '8px 10px', textAlign: 'center', width: 80 }}>Pass</th>
              <th style={{ padding: '8px 10px', textAlign: 'center', width: 80 }}>Fail</th>
              <th style={{ padding: '8px 10px', textAlign: 'left' }}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {['Site safety measures', 'Material quality check', 'Work progress verification', 'Compliance with drawings', 'Environmental conditions'].map((item, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? '#fafafa' : 'white' }}>
                <td style={{ padding: '7px 10px', borderBottom: '1px solid #eee' }}>{item}</td>
                <td style={{ padding: '7px 10px', textAlign: 'center', borderBottom: '1px solid #eee' }}>☐</td>
                <td style={{ padding: '7px 10px', textAlign: 'center', borderBottom: '1px solid #eee' }}>☐</td>
                <td style={{ padding: '7px 10px', borderBottom: '1px solid #eee' }}></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Issues */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#185FA5', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Issues & Recommendations</div>
        <div style={{ border: '1px solid #ddd', borderRadius: 6, padding: 12, minHeight: 60, fontSize: 13 }}></div>
      </div>

      {/* Signatures */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24, marginTop: 40 }}>
        {['Site Engineer', 'Supervisor', 'Client Representative'].map(role => (
          <div key={role} style={{ textAlign: 'center' }}>
            <div style={{ borderTop: '1.5px solid #333', paddingTop: 8, marginTop: 40 }}>
              <div style={{ fontSize: 11, color: '#555' }}>{role}</div>
              <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>Name & Signature</div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ borderTop: '1px solid #ddd', marginTop: 32, paddingTop: 12, textAlign: 'center', fontSize: 10, color: '#aaa' }}>
        Rekaz Engineering Office · Bahrain · {report.report_no} · Generated {date}
      </div>
    </div>
  )
}
