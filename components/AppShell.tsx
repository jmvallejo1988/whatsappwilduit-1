'use client'
import { ReactNode, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Tab = 'chats' | 'citas' | 'configuraciones'

function getTheme() {
  const h = new Date().getHours()
  return h >= 6 && h < 18 ? 'light' : 'dark'
}

const themes = {
  dark: {
    bg: '#111',
    bgMain: '#111',
    sidebar: '#0d0d0d',
    border: '#222',
    borderLight: '#2a2a2a',
    header: '#1a1a1a',
    hover: '#1a1a1a',
    activeNavBg: '#0d2a1e',
    text: '#fff',
    textMuted: '#888',
    textDim: '#555',
    accent: '#25D366',
    logoutHover: '#2a1010',
    bottomNav: '#1a1a1a',
    bottomNavText: '#666',
    cardBg: '#1a1a1a',
  },
  light: {
    bg: '#f0f2f0',
    bgMain: '#f5f7f5',
    sidebar: '#fff',
    border: '#e0e0e0',
    borderLight: '#ebebeb',
    header: '#fff',
    hover: '#f0f0f0',
    activeNavBg: '#e6f7ee',
    text: '#111',
    textMuted: '#555',
    textDim: '#aaa',
    accent: '#128c4a',
    logoutHover: '#fde8e8',
    bottomNav: '#fff',
    bottomNavText: '#888',
    cardBg: '#fff',
  },
}

export default function AppShell({ children, activeTab, title, backHref }: {
  children: ReactNode
  activeTab?: Tab
  title?: string
  backHref?: string
}) {
  const router = useRouter()
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    setTheme(getTheme())
    // Update every minute in case the hour changes while the app is open
    const id = setInterval(() => setTheme(getTheme()), 60 * 1000)
    return () => clearInterval(id)
  }, [])

  const t = themes[theme]

  async function handleLogout() {
    await fetch('/api/auth', { method: 'DELETE' })
    router.push('/')
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; background: ${t.bg}; color: ${t.text}; transition: background 0.3s, color 0.3s; }

        .app-container {
          display: flex;
          height: 100vh;
          overflow: hidden;
          background: ${t.bg};
        }

        /* ── Sidebar (desktop) ── */
        .sidebar {
          width: 220px;
          background: ${t.sidebar};
          border-right: 1px solid ${t.border};
          display: flex;
          flex-direction: column;
          flex-shrink: 0;
        }
        .sidebar-logo {
          padding: 18px 16px 12px;
          display: flex;
          align-items: center;
          gap: 8px;
          border-bottom: 1px solid ${t.border};
        }
        .sidebar-logo span { font-size: 20px; }
        .sidebar-logo h1 {
          color: ${t.accent};
          font-size: 15px;
          font-weight: 700;
          margin: 0;
        }
        .sidebar-nav {
          display: flex;
          flex-direction: column;
          padding: 8px 0;
          flex: 1;
        }
        .nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 11px 16px;
          color: ${t.textMuted};
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
          transition: background 0.15s, color 0.15s;
          cursor: pointer;
          border: none;
          background: none;
          width: 100%;
          text-align: left;
          border-radius: 0;
        }
        .nav-item:hover { background: ${t.hover}; color: ${t.text}; }
        .nav-item.active { color: ${t.accent}; background: ${t.activeNavBg}; font-weight: 600; }
        .nav-item .nav-icon { font-size: 18px; width: 22px; text-align: center; }

        .sidebar-footer {
          padding: 12px 8px;
          border-top: 1px solid ${t.border};
        }
        .logout-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 16px;
          color: #e55;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid #e5555533;
          background: none;
          width: 100%;
          text-align: left;
          border-radius: 8px;
          transition: background 0.15s, color 0.15s;
        }
        .logout-btn:hover { background: ${t.logoutHover}; color: #ef4444; border-color: #ef444466; }

        /* ── Main content ── */
        .main-area {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: ${t.bgMain};
        }
        .top-header {
          background: ${t.header};
          padding: 10px 16px;
          display: flex;
          align-items: center;
          gap: 10px;
          border-bottom: 1px solid ${t.borderLight};
          flex-shrink: 0;
        }
        .page-title {
          font-size: 16px;
          font-weight: 700;
          color: ${t.text};
          margin: 0;
        }
        .content-scroll {
          flex: 1;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }

        /* ── Bottom nav (mobile) ── */
        .bottom-nav {
          display: none;
          background: ${t.bottomNav};
          border-top: 1px solid ${t.border};
          flex-shrink: 0;
        }
        .bottom-nav-inner {
          display: flex;
          justify-content: space-around;
          padding: 6px 0 env(safe-area-inset-bottom, 0);
        }
        .bottom-nav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
          padding: 6px 16px;
          text-decoration: none;
          color: ${t.bottomNavText};
          font-size: 11px;
          font-weight: 500;
          border: none;
          background: none;
          cursor: pointer;
        }
        .bottom-nav-item .bnav-icon { font-size: 22px; }
        .bottom-nav-item.active { color: ${t.accent}; }

        @media (max-width: 768px) {
          .sidebar { display: none; }
          .bottom-nav { display: block; }
          .app-container { flex-direction: column; }
          .main-area { flex: 1; overflow: hidden; }
        }
      `}</style>

      <div className="app-container">
        {/* ── Sidebar (desktop) ── */}
        <aside className="sidebar">
          <div className="sidebar-logo">
            <span>💬</span>
            <h1>Wilduit WA</h1>
          </div>
          <nav className="sidebar-nav">
            <Link href="/chat" className={`nav-item ${activeTab === 'chats' ? 'active' : ''}`}>
              <span className="nav-icon">💬</span>
              Chats
            </Link>
            <Link href="/citas" className={`nav-item ${activeTab === 'citas' ? 'active' : ''}`}>
              <span className="nav-icon">📅</span>
              Citas
            </Link>
            <Link href="/configuraciones" className={`nav-item ${activeTab === 'configuraciones' ? 'active' : ''}`}>
              <span className="nav-icon">⚙️</span>
              Configuraciones
            </Link>
          </nav>
          <div className="sidebar-footer">
            <button className="logout-btn" onClick={handleLogout}>
              <span style={{ fontSize: 16 }}>🚪</span>
              Cerrar sesión
            </button>
          </div>
        </aside>

        {/* ── Main area ── */}
        <main className="main-area">
          {(backHref || title) && (
            <div className="top-header">
              {backHref && (
                <Link href={backHref} style={{ color: t.accent, fontSize: 22, textDecoration: 'none', lineHeight: 1 }}>←</Link>
              )}
              {title && <h2 className="page-title">{title}</h2>}
            </div>
          )}

          <div className="content-scroll">
            {/* Mobile top bar */}
            {!backHref && (
              <div className="mobile-only-header" style={{
                padding: '12px 16px 10px',
                borderBottom: `1px solid ${t.border}`,
                background: t.header,
              }}>
                <style>{`@media (min-width: 769px) { .mobile-only-header { display: none; } }`}</style>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18 }}>
                      {activeTab === 'chats' ? '💬' : activeTab === 'citas' ? '📅' : '⚙️'}
                    </span>
                    <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: t.accent }}>
                      {activeTab === 'chats' ? 'Wilduit WA' : activeTab === 'citas' ? 'Citas' : 'Configuraciones'}
                    </h1>
                  </div>
                  {/* Logout button — visible on mobile */}
                  <button
                    onClick={handleLogout}
                    style={{
                      background: '#ef444422',
                      border: '1px solid #ef444455',
                      color: '#ef4444',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 600,
                      padding: '6px 12px',
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    🚪 Salir
                  </button>
                </div>
              </div>
            )}
            {children}
          </div>

          {/* Bottom nav (mobile) */}
          <nav className="bottom-nav">
            <div className="bottom-nav-inner">
              <Link href="/chat" className={`bottom-nav-item ${activeTab === 'chats' ? 'active' : ''}`}>
                <span className="bnav-icon">💬</span>
                Chats
              </Link>
              <Link href="/citas" className={`bottom-nav-item ${activeTab === 'citas' ? 'active' : ''}`}>
                <span className="bnav-icon">📅</span>
                Citas
              </Link>
              <Link href="/configuraciones" className={`bottom-nav-item ${activeTab === 'configuraciones' ? 'active' : ''}`}>
                <span className="bnav-icon">⚙️</span>
                Config
              </Link>
            </div>
          </nav>
        </main>
      </div>
    </>
  )
}
