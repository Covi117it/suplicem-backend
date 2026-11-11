# 🔐 Guía Maestra de Variables de Entorno de Producción (.env) - Suplicem

Este documento consolida y detalla la configuración de variables de entorno requeridas para ejecutar el ecosistema **Suplicem** en producción (`suplicem-go`, `suplicem-backend` y `suplicem-admin`) con todas sus funcionalidades activas y sin dependencias de entornos locales.

---

## 📱 1. App Móvil (`suplicem-go`)

* **Ubicación:** `suplicem-go/.env`
* **Tipo:** Variables públicas consumidas por el cliente Expo / React Native.

```bash
# ========================================================
# SUPLICEM MOBILE APP (suplicem-go) - PRODUCCIÓN
# ========================================================

# 1. URL Base del Servidor API (Debe incluir /api al final)
EXPO_PUBLIC_API_URL=https://suplicem-admin.duckdns.org/api

# 2. Google Maps API Key
# Habilita Geocoding API y Places API en Google Cloud Console para autocompletar
# y geolocalizar direcciones de clientes y puntos de entrega.
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSy...TU_GOOGLE_MAPS_KEY_AQUI

# 3. Optimizaciones de Entorno para Expo en Producción
EXPO_NO_DEPENDENCY_VALIDATION=1
EXPO_ROUTER_DISABLE_RN_NAVIGATION_CHECK=1
```

> **Compilación EAS:** Al generar APKs o App Bundles con EAS (`eas build --profile production`), asegúrate de que `EXPO_PUBLIC_API_URL` esté definido en el apartado `env` de tu archivo `eas.json` o cargado en los Secrets de tu cuenta de Expo.

---

## 🖥️ 2. Servidor API Backend (`suplicem-backend`)

* **Ubicación:** `suplicem-backend/.env`
* **Tipo:** Variables privadas de Node.js, Express, Firebase Admin SDK y pasarelas de servicios oficiales.

```bash
# ========================================================
# SUPLICEM BACKEND API - PRODUCCIÓN
# ========================================================

# Configuración del Servidor HTTP
PORT=3000
NODE_ENV=production
API_URL=https://suplicem-admin.duckdns.org

# --------------------------------------------------------
# FIREBASE & GOOGLE CLOUD SERVICES
# --------------------------------------------------------
# Proyecto y Storage Bucket oficial de Firebase
FIREBASE_PROJECT_ID=suplicem-ce464
FIREBASE_STORAGE_BUCKET=suplicem-ce464.firebasestorage.app

# Firebase Web API Key (requerido para endpoints de Firebase Auth REST)
FIREBASE_API_KEY=AIzaSy...TU_FIREBASE_API_KEY_AQUI

# Endpoints oficiales de Google Identity Toolkit
GOOGLE_API_URL=https://identitytoolkit.googleapis.com/v1
SECURE_TOKEN_GOOGLE_API_URL=https://securetoken.googleapis.com/v1

# Firebase Admin SDK (Service Account para acceso a Firestore y Storage)
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@suplicem-ce464.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"

# --------------------------------------------------------
# SERVICIOS DE CONSULTA OFICIAL (DGII & JCE)
# --------------------------------------------------------
# API para consulta de RNC y empresas en República Dominicana
DGII_API_URL=https://api.directoriornc.com/api/DGII

# Servicio de validación de Cédulas dominicanas (JCE)
JCE_API_URL=https://api.digital.gob.do/v1/identidad
JCE_API_TOKEN=tu_token_de_acceso_jce_opcional

# --------------------------------------------------------
# NOTIFICACIONES POR CORREO (SMTP / Gmail / SendGrid)
# --------------------------------------------------------
# Configuración SMTP (Ej. Gmail con Contraseña de Aplicación de 16 caracteres)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=suplicem.notificaciones@gmail.com
SMTP_PASS=tu_app_password_de_gmail

# Alternativa directa con SendGrid
# SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxx

# --------------------------------------------------------
# SMS & VERIFICACIÓN OTP (Twilio)
# --------------------------------------------------------
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# Remitente de Twilio. Puede ser un número de EE. UU. (incluido el trial).
TWILIO_SMS_FROM=+1XXXXXXXXXX

# Secreto para firma criptográfica de tokens OTP
OTP_HASH_SECRET=clave_criptografica_segura_para_hash_otp
```

> **Nota sobre Twilio Trial:** el remitente (`TWILIO_SMS_FROM`) no necesita ser
> dominicano. En cambio, el destinatario (`user.phone`) sí debe ser un número de
> RD (`809`, `829` o `849`). En cuentas trial solo se entrega a números
> verificados (máximo 5) y puede ser necesario habilitar República Dominicana en
> **Messaging → Geo permissions**. Además, el trial solo admite plantillas
> predefinidas: el servicio reintenta automáticamente con `sms_account_alerts`
> (o `sms_2fa` para códigos OTP). La plantilla `sms_2fa` del trial no transporta
> el código generado por la app, así que la verificación OTP real requiere una
> cuenta paga. Para enviar el texto personalizado también hay que actualizar la
> cuenta.

---

## 🌐 3. Panel Web Administrativo (`suplicem-admin`)

* **Ubicación:** `suplicem-admin/.env.local`
* **Tipo:** Variables de entorno para la aplicación Next.js.

```bash
# ========================================================
# SUPLICEM ADMIN DASHBOARD - PRODUCCIÓN
# ========================================================

NEXT_PUBLIC_API_URL=https://suplicem-admin.duckdns.org/api
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSy...TU_GOOGLE_MAPS_KEY_AQUI
```

---

## 🗺️ Matriz de Funcionalidades vs Variables

| Funcionalidad en la App | Variable Requerida | Proyecto |
| :--- | :--- | :--- |
| **Inicio de Sesión y Registro** | `EXPO_PUBLIC_API_URL`, `FIREBASE_API_KEY` | `suplicem-go` / `suplicem-backend` |
| **Consulta Automática de RNC (DGII)** | `DGII_API_URL` | `suplicem-backend` |
| **Validación de Cédula (JCE)** | `JCE_API_URL`, `JCE_API_TOKEN` | `suplicem-backend` |
| **Subida de Comprobantes de Pago / Cédula** | `FIREBASE_STORAGE_BUCKET`, `FIREBASE_PRIVATE_KEY` | `suplicem-backend` |
| **Selector de Direcciones y Mapas** | `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | `suplicem-go` |
| **Envío de Correos de Verificación** | `SMTP_USER`, `SMTP_PASS` (o `SENDGRID_API_KEY`) | `suplicem-backend` |
| **Envío de SMS con Códigos OTP** | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SMS_FROM` | `suplicem-backend` |
