import { useState } from 'react'

export default function SectionHelp({ title, description, steps, color = '#185FA5', bg = '#E6F1FB' }) {
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem(`rekaz-help-${title}`) === 'true'
  })

  if (dismissed) return null

  function dismiss() {
    localStorage.setItem(`rekaz-help-${title}`, 'true')
    setDismissed(true)
  }

  return (
    <div style={{
      background: bg, border: `0.5px solid ${color}40`,
      borderRadius: 10, padding: '14px 18px', marginBottom: 20,
      display: 'flex', gap: 14, alignItems: 'flex-start'
    }}>
      <div style={{ fontSize: 24, flexShrink: 0 }}>💡</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 500, fontSize: 14, color, marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 13, color: '#444', lineHeight: 1.6, marginBottom: steps ? 8 : 0 }}>{description}</div>
        {steps && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
            {steps.map((s, i) => (
              <div key={i} style={{ background: 'white', border: `0.5px solid ${color}30`, borderRadius: 6, padding: '4px 10px', fontSize: 12, color: '#555' }}>
                <span style={{ color, fontWeight: 500 }}>{i + 1}. </span>{s}
              </div>
            ))}
          </div>
        )}
      </div>
      <button onClick={dismiss} style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: '#999', fontSize: 16, flexShrink: 0, padding: '0 4px'
      }}>✕</button>
    </div>
  )
}
