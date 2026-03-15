import { useState } from 'react'
import { signIn } from '../lib/supabase.js'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(email, password)
    } catch (err) {
      setError(err.message || 'Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#f5f5f0', padding: 16
    }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14, background: '#185FA5',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px', color: 'white', fontSize: 22, fontWeight: 700
          }}>R</div>
          <h1 style={{ fontSize: 20, fontWeight: 600 }}>Rekaz</h1>
          <p style={{ fontSize: 13, color: '#888', marginTop: 4 }}>Site Visit Manager</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={email}
                onChange={e => setEmail(e.target.value)} placeholder="engineer@rekaz.bh" required />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-input" type="password" value={password}
                onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
            </div>
            {error && (
              <div style={{
                background: '#FCEBEB', color: '#A32D2D', fontSize: 12,
                padding: '8px 12px', borderRadius: 6, marginBottom: 14
              }}>{error}</div>
            )}
            <button className="btn btn-primary" type="submit"
              style={{ width: '100%', padding: '10px' }} disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: '#aaa', marginTop: 20 }}>
          Rekaz Engineering Office © 2026
        </p>
      </div>
    </div>
  )
}
