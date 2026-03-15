import { useState } from 'react'

export default function SectionHelp({ title, description, steps, color = '#185FA5', bg = '#E6F1FB' }) {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(`rekaz-help-${title}`) === 'true' }
    catch { return false }
  })

  if (dismissed) return null

  function dismiss() {
    try { localStorage.setItem(`rekaz-help-${title}`, 'true') } catch {}
    setDismissed(true)
  }

  return (
    <div style={{
      background: bg, border: `0.5px solid ${color}`,
      borderRadius: 10, padding: '14px 18px', marginBottom: 20,
      display: 'flex', gap: 14, alignItems: 'flex-start',
      position: 'relative'
    }}>
      <div style={{ fontSize: 22, flexShrink: 0 }}>💡</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 500, fontSize: 14, color, marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6, marginBottom: steps ? 8 : 0 }}>{description}</div>
        {steps && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
            {steps.map((s, i) => (
              <div key={i} style={{ background: 'white', border: `0.5px solid ${color}50`, borderRadius: 6, padding: '4px 10px', fontSize: 12, color: '#444' }}>
                <span style={{ color, fontWeight: 500 }}>{i + 1}. </span>{s}
              </div>
            ))}
          </div>
        )}
      </div>
      <button onClick={dismiss} style={{
        background: 'rgba(0,0,0,0.08)', border: 'none', cursor: 'pointer',
        color: '#666', fontSize: 14, flexShrink: 0,
        width: 24, height: 24, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>✕</button>
    </div>
  )
}
