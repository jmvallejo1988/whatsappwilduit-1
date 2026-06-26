'use client'
import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Error al iniciar sesión')
        return
      }
      router.push('/chat')
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
        .login-wrap {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: #0a0a0a;
        }
        .login-card {
          background: #111;
          border: 1px solid #222;
          border-radius: 16px;
          padding: 36px 32px;
          width: 100%;
          max-width: 380px;
        }
        .login-logo {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 32px;
          justify-content: center;
        }
        .login-logo-icon {
          width: 48px;
          height: 48px;
          background: #1e3a2a;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
        }
        .login-logo-text h1 {
          font-size: 20px;
          font-weight: 700;
          color: #25D366;
          line-height: 1.2;
        }
        .login-logo-text p {
          font-size: 12px;
          color: #555;
          margin-top: 2px;
        }
        .field { margin-bottom: 16px; }
        .field label {
          display: block;
          font-size: 11px;
          font-weight: 600;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 7px;
        }
        input[type="email"],
        input[type="password"] {
          width: 100%;
          background: #0a0a0a;
          border: 1px solid #2a2a2a;
          border-radius: 10px;
          padding: 13px 14px;
          color: #f0f0f0;
          font-size: 15px;
          outline: none;
          transition: border-color 0.2s;
        }
        input:focus { border-color: #25D366; }
        input::placeholder { color: #333; }
        .btn-submit {
          width: 100%;
          background: #25D366;
          color: #fff;
          border: none;
          border-radius: 10px;
          padding: 14px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          margin-top: 8px;
          transition: opacity 0.2s;
        }
        .btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-submit:not(:disabled):hover { opacity: 0.9; }
        .error-msg {
          background: #2a0a0a;
          border: 1px solid #5a1a1a;
          border-radius: 8px;
          padding: 10px 14px;
          color: #f87171;
          font-size: 13px;
          margin-top: 14px;
          text-align: center;
        }
      `}</style>
      <div className="login-wrap">
        <div className="login-card">
          <div className="login-logo">
            <div className="login-logo-icon">💬</div>
            <div className="login-logo-text">
              <h1>Wilduit WA</h1>
              <p>Manager de WhatsApp</p>
            </div>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Correo electrónico</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                autoFocus
              />
            </div>
            <div className="field">
              <label>Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? 'Entrando...' : 'Iniciar sesión'}
            </button>
            {error && <div className="error-msg">{error}</div>}
          </form>
        </div>
      </div>
    </>
  )
}
