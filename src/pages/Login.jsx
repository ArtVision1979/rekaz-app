import { useState } from 'react'
import { signIn } from '../lib/supabase.js'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState(null)

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
      minHeight: '100vh',
      display: 'flex',
      background: '#0f1117',
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      overflow: 'hidden',
      position: 'relative'
    }}>
      <style>{`
        @keyframes float { 0%,100% { transform: translateY(0px) rotate(0deg); } 50% { transform: translateY(-20px) rotate(5deg); } }
        @keyframes pulse { 0%,100% { opacity: 0.3; } 50% { opacity: 0.6; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shimmer { from { background-position: -200% center; } to { background-position: 200% center; } }
        .login-card { animation: fadeIn 0.6s ease forwards; }
        .login-btn { transition: all 0.2s ease; }
        .login-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 25px rgba(24,95,165,0.4); }
        .login-btn:active { transform: translateY(0); }
        .input-field { transition: all 0.2s ease; }
        .input-field:focus { border-color: #185FA5 !important; box-shadow: 0 0 0 3px rgba(24,95,165,0.15); }
        .orb { animation: float 6s ease-in-out infinite; }
        .orb2 { animation: float 8s ease-in-out infinite reverse; }
        .orb3 { animation: pulse 4s ease-in-out infinite; }
      `}</style>

      {/* Background orbs */}
      <div className="orb" style={{position:'absolute',top:'10%',left:'5%',width:300,height:300,borderRadius:'50%',background:'radial-gradient(circle, rgba(24,95,165,0.15) 0%, transparent 70%)',pointerEvents:'none'}}/>
      <div className="orb2" style={{position:'absolute',bottom:'10%',right:'5%',width:400,height:400,borderRadius:'50%',background:'radial-gradient(circle, rgba(15,110,86,0.1) 0%, transparent 70%)',pointerEvents:'none'}}/>
      <div className="orb3" style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',width:600,height:600,borderRadius:'50%',background:'radial-gradient(circle, rgba(24,95,165,0.05) 0%, transparent 70%)',pointerEvents:'none'}}/>

      {/* Grid pattern */}
      <div style={{position:'absolute',inset:0,backgroundImage:'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',backgroundSize:'40px 40px',pointerEvents:'none'}}/>

      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:24,zIndex:1}}>
        <div className="login-card" style={{width:'100%',maxWidth:420}}>

          {/* Logo */}
          <div style={{textAlign:'center',marginBottom:40}}>
            <div style={{display:'inline-block',padding:'16px 24px',background:'rgba(255,255,255,0.05)',borderRadius:16,border:'1px solid rgba(255,255,255,0.08)',marginBottom:16,backdropFilter:'blur(10px)'}}>
              <img src="/rekaz-logo.jpg" alt="Rekaz" style={{height:48,width:'auto',borderRadius:8,display:'block'}}/>
            </div>
            <div style={{fontSize:13,color:'rgba(255,255,255,0.4)',letterSpacing:2,textTransform:'uppercase'}}>
              Site Visit Manager
            </div>
          </div>

          {/* Card */}
          <div style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:20,padding:32,backdropFilter:'blur(20px)'}}>
            <h2 style={{color:'white',fontSize:22,fontWeight:600,marginBottom:6,textAlign:'center'}}>
              Welcome back
            </h2>
            <p style={{color:'rgba(255,255,255,0.4)',fontSize:13,textAlign:'center',marginBottom:28}}>
              Sign in to your account
            </p>

            <form onSubmit={handleSubmit}>
              <div style={{marginBottom:16}}>
                <label style={{display:'block',fontSize:12,color:'rgba(255,255,255,0.5)',marginBottom:8,letterSpacing:0.5}}>
                  EMAIL ADDRESS
                </label>
                <input
                  className="input-field"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onFocus={() => setFocused('email')}
                  onBlur={() => setFocused(null)}
                  placeholder="engineer@rekaz.bh"
                  required
                  style={{
                    width:'100%',padding:'12px 16px',
                    background:'rgba(255,255,255,0.06)',
                    border:`1px solid ${focused==='email' ? '#185FA5' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius:10,fontSize:14,color:'white',outline:'none',
                    boxSizing:'border-box'
                  }}
                />
              </div>

              <div style={{marginBottom:24}}>
                <label style={{display:'block',fontSize:12,color:'rgba(255,255,255,0.5)',marginBottom:8,letterSpacing:0.5}}>
                  PASSWORD
                </label>
                <input
                  className="input-field"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onFocus={() => setFocused('password')}
                  onBlur={() => setFocused(null)}
                  placeholder="••••••••"
                  required
                  style={{
                    width:'100%',padding:'12px 16px',
                    background:'rgba(255,255,255,0.06)',
                    border:`1px solid ${focused==='password' ? '#185FA5' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius:10,fontSize:14,color:'white',outline:'none',
                    boxSizing:'border-box'
                  }}
                />
              </div>

              {error && (
                <div style={{background:'rgba(163,45,45,0.2)',border:'1px solid rgba(163,45,45,0.4)',color:'#ff8585',fontSize:12,padding:'10px 14px',borderRadius:8,marginBottom:16}}>
                  {error}
                </div>
              )}

              <button
                className="login-btn"
                type="submit"
                disabled={loading}
                style={{
                  width:'100%',padding:'13px',
                  background: loading ? 'rgba(24,95,165,0.5)' : 'linear-gradient(135deg, #185FA5 0%, #0C447C 100%)',
                  border:'none',borderRadius:10,color:'white',
                  fontSize:14,fontWeight:600,cursor:loading?'not-allowed':'pointer',
                  letterSpacing:0.5
                }}>
                {loading ? (
                  <span style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                    <span style={{width:14,height:14,border:'2px solid rgba(255,255,255,0.3)',borderTopColor:'white',borderRadius:'50%',display:'inline-block',animation:'spin 0.8s linear infinite'}}/>
                    Signing in...
                  </span>
                ) : 'Sign In →'}
              </button>
            </form>
          </div>

          <p style={{textAlign:'center',fontSize:11,color:'rgba(255,255,255,0.2)',marginTop:24}}>
            Rekaz Engineering Office · Bahrain © 2026
          </p>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
