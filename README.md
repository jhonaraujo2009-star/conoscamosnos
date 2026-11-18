# Conoscamosnos — PWA Global de Citas, Amistad y Chat en Tiempo Real

Aplicación web progresiva (**PWA mobile-first**) construida con **React (Vite)**, **Tailwind CSS**, **Lucide Icons**, **Firebase (Authentication + Firestore)** y **Cloudinary**.

---

## Arquitectura Implementada

1. **Autenticación y Onboarding (`users/{userId}`)**
   - Registro/Login con Email/Password y Google (`+18`).
   - Perfil completo: nombre, edad, género, interés, `role` (`'user' | 'admin'`), país (código ISO + bandera), ciudad, biografía, `lookingFor`, `interests`, estado en línea con heartbeat, hasta 6 fotos en Cloudinary y contadores de monetización (`coins`, `earningsDiamonds`, `pendingWithdrawalDiamonds`, `totalWithdrawnUSD`, `isBoosted`, `boostExpiresAt`, `boostCountry`).

2. **Monetización Multimoneda + Ganancias de Creadores**
   - **Tienda de Monedas (`CoinStoreModal`)**:
     - Paquetes: 100 ($1.99), 550 ($7.99), 1200 ($14.99), 3000 ($29.99).
     - **Pago Automático**: facturación y webhook verificable HMAC-SHA512 con **NowPayments** (`/api/payments/create-invoice` + `/api/webhooks/payments`).
     - **Billeteras Directas**: Binance Pay (USDT), Zinli (USD), Pago Móvil (Local), con QR dinámico local y subida de comprobante a Cloudinary (`paymentRequests`).
   - **Retiro de Ganancias por Regalos (`EarningsWithdrawModal`)**:
     - El dinero real de las recargas entra a la **empresa**.
     - Al recibir regalos virtuales, el destinatario acumula **1 Diamante por moneda** (`earningsDiamonds`).
     - Valor base por diamante: `$0.01 USD` → **60% neto para el usuario (`$0.006 USD/diamante`)** y **40% retenido por la empresa**.
     - Al solicitar retiro (mínimo `500` diamantes = `$3.00 USD`), los diamantes se congelan atómicamente en `pendingWithdrawalDiamonds` mediante `runTransaction` y se crea un documento en `withdrawalRequests`.
   - **Panel Super Admin (`role === 'admin'`)**:
     - Tablero financiero de la empresa: Ingresos Brutos, Pagado a Usuarios, Retiros Pendientes y Balance Neto.
     - Auditoría de recargas (`paymentRequests`) con aprobación atómica (`runTransaction`).
     - Gestión de pagos a usuarios (`withdrawalRequests`) para confirmar transferencia realizada o rechazar con devolución automática de diamantes.

3. **Boost VIP por País (`BoostModal`)**
   - 24 horas (100 monedas) / 7 días (500 monedas) descontados atómicamente con `runTransaction`.

4. **Inicio (`HomeFeed`), Descubrimiento (`DiscoverSwipe`) y Perfil Público (`PublicProfileModal`)**
   - Carrusel **Destacados VIP** y cuadrícula **Más Populares** con filtro Local vs. Internacional.
   - Swipe táctil/arrastrable + Likes mutuos (Match) + **Mensaje Directo VIP (50 monedas)** + Reportar/Bloquear.

5. **Chat en Tiempo Real y Regalos Virtuales Animados (`ChatRoom`)**
   - Mensajes en tiempo real (`onSnapshot` en `matches/{matchId}/messages`), envío de imágenes vía Cloudinary y catálogo de regalos (Rosa 10, Café 25, Peluche 50, Champaña 150, Diamante Real 500) con tarjeta animada y animación flotante a pantalla completa.

---

## Puesta en Marcha

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Configurar variables de entorno:**
   Copia `.env.example` a `.env` y completa tus claves de **Firebase** y **Cloudinary** (crea un Upload Preset *Unsigned* en Cloudinary).

3. **Configurar Firebase (Console o CLI):**
   - Habilita **Email/Password** y **Google** en *Authentication → Sign-in method*.
   - Crea la base de datos **Cloud Firestore**.
   - Despliega `firestore.rules` y `firestore.indexes.json`:
     ```bash
     firebase deploy --only firestore:rules,firestore:indexes
     ```
   - Para asignar tu primer **Super Admin**, crea tu cuenta desde la app y luego cambia manualmente en Firestore el campo `role` de ese documento `users/{uid}` de `'user'` a `'admin'`.

4. **Ejecutar en desarrollo o compilar:**
   ```bash
   npm run dev
   npm run build
   ```

> **Nota de Producción:** Mantén `VITE_ENABLE_DEMO_PAYMENTS=false` en producción y registra `https://conoscamosnos.vercel.app/api/webhooks/payments` en NowPayments.
