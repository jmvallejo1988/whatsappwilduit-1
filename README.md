# 📱 WhatsApp Manager — PWA

App web progresiva (instalable en Android) para gestionar mensajes de WhatsApp Business.

**Stack:** Next.js 14 · Vercel · Vercel KV (Redis) · WhatsApp Business API

---

## 🚀 Guía de Deploy (paso a paso)

### PASO 1 — Obtener el Phone Number ID

1. Ve a [developers.facebook.com](https://developers.facebook.com) > tu app
2. WhatsApp > Configuración de la API
3. Copia el **Phone Number ID** del número `+1 (201) 361-9941`  
   ⚠️ Es un número como `123456789012345`, NO el teléfono

---

### PASO 2 — Subir a GitHub

```bash
# En tu computadora, dentro de la carpeta del proyecto:
git init
git add .
git commit -m "Initial commit — WhatsApp Manager"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/whatsapp-manager.git
git push -u origin main
```

---

### PASO 3 — Deploy en Vercel

1. Ve a [vercel.com](https://vercel.com) > **Add New Project**
2. Importa el repo de GitHub que acabas de crear
3. Framework: **Next.js** (detección automática)
4. Haz clic en **Deploy**

---

### PASO 4 — Activar Vercel KV

1. En tu proyecto de Vercel > pestaña **Storage**
2. Clic en **Create Database** > elige **KV**
3. Nombre: `whatsapp-messages` > Create
4. Vercel conecta la DB y agrega las variables automáticamente

---

### PASO 5 — Variables de entorno en Vercel

Ve a **Settings > Environment Variables** y agrega:

| Variable | Valor |
|---|---|
| `WHATSAPP_TOKEN` | `ab2084a860e73840710c4130139eb8674cc18da270471ad36b4d9bf2dccce28a` |
| `WHATSAPP_PHONE_NUMBER_ID` | ID del paso 1 |
| `OUR_PHONE_NUMBER` | `12013619941` |
| `WEBHOOK_VERIFY_TOKEN` | `wilduit-webhook-2024` |
| `APP_PASSWORD` | La contraseña que quieras usar |
| `JWT_SECRET` | Una cadena larga y segura (mín. 32 chars) |

Guarda y **redeploya** (Deployments > botón Redeploy).

---

### PASO 6 — Configurar el Webhook en Meta

1. Ve a [developers.facebook.com](https://developers.facebook.com) > tu app
2. WhatsApp > Configuración > Webhooks
3. **Callback URL:** `https://TU-APP.vercel.app/api/webhook`
4. **Verify Token:** `wilduit-webhook-2024`
5. Haz clic en **Verify and Save**
6. Suscríbete a: `messages`

---

### PASO 7 — Instalar en Android

1. Abre Chrome en tu Android
2. Ve a `https://TU-APP.vercel.app`
3. Ingresa tu contraseña
4. Toca los 3 puntos del menú > **"Agregar a pantalla de inicio"**
5. ✅ La app aparece como si fuera nativa

---

## 🎨 Personalizar iconos (opcional)

Reemplaza los archivos en `/public/`:
- `icon-192.png` — 192×192 px
- `icon-512.png` — 512×512 px

---

## 🔒 Seguridad

- Cambia `APP_PASSWORD` y `JWT_SECRET` en producción
- El webhook solo acepta requests de Meta (verificación por token)
- Las rutas privadas están protegidas por middleware JWT

---

## 📐 Arquitectura

```
WhatsApp (Meta) ──webhook──▶ /api/webhook ──▶ Vercel KV (Redis)
                                                      │
Android App (PWA) ◀──polling──▶ /api/messages ───────┘
                              ▶ /api/conversations
```

---

## 💡 Funciones incluidas

- ✅ Recibir mensajes de texto, imágenes, audio, video, docs
- ✅ Responder mensajes de texto
- ✅ Lista de conversaciones ordenada por recientes
- ✅ Iniciar chat con cualquier número
- ✅ Autenticación con contraseña
- ✅ PWA instalable en Android
- ✅ Actualización automática cada 3-5 segundos
