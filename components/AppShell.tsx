'use client'
import { ReactNode } from 'react'

type Tab = 'chats' | 'citas' | 'configuraciones'

export default function AppShell({ children, activeTab, title, backHref }: {
  children: ReactNode
  activeTab?: Tab
  title?: string
  backHref?: string
}) {
  const isChat = !!backHref

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; }

        /* Desktop layout */
        .app-container {
          display: flex;
          height: 100vh;
          overflow: hidden;
        }

        /* Sidebar — desktop only */
        .sidebar {
          width: 220px;
          background: #111;
          border-right: 1px solid #222;
          display: flex;
          flex-direction: column;
          flex-shrink: 0;
        }
        .sidebar-logo {
          padding: 18px 16px 12px;
          display: flex;
          align-items: center;
          gap: 8px;
          border-bottom: 1px solid #222;
        }
        .sidebar-logo span { font-size: 20px; }
        .sidebar-logo h1 {
          color: #25D366;
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
          color: #888;
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
          border-radius: 0;
          transition: background 0.15s, color 0.15s;
          cursor: pointer;
          border: none;
          background: none;
          width: 100%;
          text-align: left;
        }
        .nav-item:hover { background: #1a1a1a; color: #fff; }
        .nav-item.active { color: #25D366; background: #0d2a1e; }
        .nav-item .nav-icon { font-size: 18px; width: 22px; text-align: center; }

        /* Main content area */
        .main-area {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: #111;
        }

        /* Top header (for sub-pages like chat) */
        .top-header {
          background: #1a1a1a;
          padding: 10px 16px;
          display: flex;
          align-items: center;
          gap: 10px;
          border-bottom: 1px solid #2a2a2a;
          flex-shrink: 0;
        }
        .page-title {
          font-size: 16px;
          font-weight: 700;
          color: #fff;
          margin: 0;
        }

        /* Scrollable content */
        .content-scroll {
          flex: 1;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }

        /* Bottom nav — mobile only */
        .bottom-nav {
          display: none;
          background: #1a1a1a;
          border-top: 1px solid #222;
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
          padding: 6px 20px;
          text-decoration: none;
          color: #666;
          font-size: 11px;
          font-weight: 500;
          border: none;
          background: none;
          cursor: pointer;
        }
        .bottom-nav-item .bnav-icon { font-size: 22px; }
        .bottom-nav-item.active { color: #25D366; }

        /* Responsive: on mobile, hide sidebar, show bottom nav */
        @media (max-width: 768px) {
          .sidebar { display: none; }
          .bottom-nav { display: block; }
          .app-container { flex-direction: column; }
          .main-area { flex: 1; overflow: hidden; }
        }

        /* On desktop, for chat page — still full-width within main area */
        @media (min-width: 769px) {
          .main-area { max-width: none; }
        }
      `}</style>

      <div className="app-container">
        {/* Sidebar (desktop) */}
        <aside className="sidebar">
          <div className="sidebar-logo">
            <span>💬</span>
            <h1>Wilduit WA</h1>
          </div>
          <nav className="sidebar-nav">
            <a href="/" className={`nav-item ${activeTab === 'chats' ? 'active' : ''}`}>
              <span className="nav-icon">💬</span>
              Chats
            </a>
            <a href="/citas" className={`nav-item ${activeTab === 'citas' ? 'active' : ''}`}>
              <span className="nav-icon">📅</span>
              Citas
            </a>
            <a href="/configuraciones" className={`nav-item ${activeTab === 'configuraciones' ? 'active' : ''}`}>
              <span className="nav-icon">⚙️</span>
              Configuraciones
            </a>
          </nav>
        </aside>

        {/* Main area */}
        <main className="main-area">
          {/* Header for sub-pages or mobile top bar */}
          {(backHref || title) && (
            <div className="top-header">
              {backHref && (
                <a href={backHref} style={{ color: '#25D366', fontSize: 22, textDecoration: 'none', lineHeight: 1 }}>←</a>
              )}
              {title && <h2 className="page-title">{title}</h2>}
            </div>
          )}

          {/* Mobile top bar for main pages (no back button) */}
          {!backHref && !title && (
            <div className="top-header" style={{ display: 'none' }}>
              <style>{`@media (max-width: 768px) { .mobile-header { display: flex !important; } }`}</style>
            </div>
          )}

          <div className="content-scroll">
            {/* Mobile: show page title */}
            {!backHref && (
              <div style={{ padding: '14px 16px 8px', borderBottom: '1px solid #222' }}
                className="mobile-only-header">
                <style>{`@media (min-width: 769px) { .mobile-only-header { display: none; } }`}</style>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18 }}>{activeTab === 'chats' ? '💬' : '⚙️'}</span>
                  <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#25D366' }}>
                    {activeTab === 'chats' ? 'Wilduit WA Manager' : 'Configuraciones'}
                  </h1>
                </div>
              </div>
            )}
            {children}
          </div>

          {/* Bottom nav (mobile) */}
          <nav className="bottom-nav">
            <div className="bottom-nav-inner">
              <a href="/" className={`bottom-nav-item ${activeTab === 'chats' ? 'active' : ''}`}>
                <span className="bnav-icon">💬</span>
                Chats
              </a>
              <a href="/citas" className={`bottom-nav-item ${activeTab === 'citas' ? 'active' : ''}`}>
                <span className="bnav-icon">📅</span>
                Citas
              </a>
              <a href="/configuraciones" className={`bottom-nav-item ${activeTab === 'configuraciones' ? 'active' : ''}`}>
                <span className="bnav-icon">⚙️</span>
                Config
              </a>
            </div>
          </nav>
        </main>
      </div>
    </>
  )
}
