# Dating App — Starter Scaffold

Next.js (frontend) + NestJS (backend) + PostgreSQL + Prisma. Phone/OTP auth via
Firebase, photo storage on AWS S3, real-time chat via Socket.IO,
location-based discovery.

## Structure

```
backend/    NestJS API (auth, users, photos, discovery, swipes, matches, chat)
frontend/   Next.js App Router (login, discover, matches, chat)
```

Firebase Admin credentials come from your Firebase project's service account
(Project Settings → Service Accounts → Generate new private key).

AWS S3 credentials come from IAM (create a user with `s3:PutObject`,
`s3:DeleteObject`, and `s3:GetObject` on your bucket). `AWS_S3_PUBLIC_URL` is
your bucket's public URL via CloudFront or bucket public access.

## Backend setup

```bash
cd backend
npm install
cp .env.example .env    # fill in DATABASE_URL, Firebase Admin creds, AWS S3 creds
npx prisma migrate dev --name init
npm run start:dev      
```

## Frontend setup (Web)

```bash
cd frontend
npm install
cp .env.local.example .env.local   # fill in API URL + Firebase client config
npm run dev              
```

## Mobile App setup (React Native / Expo)

```bash
cd mobile
npm install
# Configure EXPO_PUBLIC_API_URL in mobile/.env (defaults to dynamic host / localhost:3001)
npx expo start
```

### Instant Testing & Dev OTPs (Web & Mobile)
- **Automatic Test Code Display**: When requesting an OTP on both Web and Mobile, the generated OTP code is displayed directly on the screen in a banner with a 1-click **Auto-fill** button.
- **Universal Dev Bypass Code**: You can also enter `123456` or `000000` on any phone number in development mode.
- **Terminal Logs**: The backend prints every generated OTP to the console: `[AuthService] OTP generated for +91XXXXXXXXXX: 123456`.

## What's scaffolded

- **Auth**: client signs in with Firebase Phone Auth (handles OTP SMS
  delivery/verification itself) → sends the Firebase ID token to
  `POST /auth/verify` → backend verifies it with firebase-admin and issues its
  own JWT access/refresh token pair.
- **Discovery**: Geo-distance & haversine query with passport mode, filters, chemistry scoring, two truths and a lie mini-games, and live online presence.
- **Swipes/Matches**: 10-swipe daily quota with live counter, superlikes, compliments before matching, reciprocal mutual matches.
- **Chat & Socket.IO**: Real-time messaging with typing indicators, ephemeral disappearing media, and interactive in-chat date invites.
- **Safety & Moderation**: User reporting with categories (Harassment, Fake Profile/Catfish, Inappropriate Photos, Spam), user blocking, photo verification pipeline, and SafeDate emergency contact check-ins.
- **Admin Dashboard & Moderation**:
  - Live Overview KPIs (total users, verified profiles, active matches, pending reports, banned accounts).
  - Reversible **Ban & Unban** system with 1-click toggling, reasons, and automatic feed restriction.
  - Verification checkmark badge granting & revoking.
  - Moderation queue for community violation reports.
  - Broadcast system-wide announcements to all active users.
- **Stories**: 24h ephemeral story feed with rich media previews and viewer analytics.
## Mobile Active Status Troubleshooting

When users report that their **online/active status** does not update on mobile, check the following:

1. **Expo environment variables** – ensure `EXPO_PUBLIC_API_URL` points to the correct backend URL (e.g., `http://<host>:3001`).
2. **Push notification permissions** – the mobile app uses a lightweight heartbeat (`POST /users/:id/heartbeat`) that runs only when the app has background permission. Verify that the permission is granted in device settings.
3. **WebSocket connection** – the mobile client connects to the same Socket.IO namespace as the web client. Open the device console (Expo DevTools) and look for `socket.io-client` connection logs. Re‑connect if you see `disconnect` events.
4. **Backend health** – confirm that `backend/src/users/users.service.ts`’s `setActiveStatus` method runs without errors (check the server logs for `Active status updated`).
5. **Caching** – the mobile client caches the last status for 30 seconds. If you changed the code, clear the app cache (`expo start -c`) and reinstall the app.

**Quick fix**:
```bash
# Restart the dev server and clear caches
cd backend && npm run start:dev
cd mobile && expo start -c
```

If the problem persists, open an issue with the relevant logs and the device model/OS version.
