import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'WhatsApp Manager',
  description: 'Gestiona tus mensajes de WhatsApp Business',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'WA Manager',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#128C7E',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  // Limpia caches viejos y registra el SW actualizado
                  if ('caches' in window) {
                    caches.keys().then(function(names) {
                      names.forEach(function(name) {
                        if (name !== 'wa-manager-v3') {
                          caches.delete(name);
                        }
                      });
                    });
                  }
                  navigator.serviceWorker.getRegistrations().then(function(registrations) {
                    var needsReload = false;
                    var promises = registrations.map(function(reg) {
                      return reg.update().catch(function() {});
                    });
                    Promise.all(promises).then(function() {
                      navigator.serviceWorker.register('/sw.js').then(function(reg) {
                        reg.addEventListener('updatefound', function() {
                          var newWorker = reg.installing;
                          if (newWorker) {
                            newWorker.addEventListener('statechange', function() {
                              if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
                                window.location.reload();
                              }
                            });
                          }
                        });
                      });
                    });
                  });
                });
              }
            `,
          }}
        />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
