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
- **Discovery**: raw-SQL haversine distance query filtered by gender
  preference, age range, and already-swiped users. Swap for PostGIS
  `ST_DWithin` once you enable the extension for better index performance at
  scale.
- **Swipes/Matches**: swiping "like" checks for a reciprocal like and creates
  a `Match` row if found.
- **Chat**: Socket.IO gateway authenticated via JWT on connection; messages
  persist to Postgres and broadcast to both users in the match room.
- **Photos**: signed-URL upload flow — backend generates a presigned S3 PUT
  URL, client uploads directly to S3, then confirms so a `Photo` row is saved.

## Not yet built (natural next steps)

- Photo moderation/verification pipeline
- Push notifications for new matches/messages
- Rate limiting on OTP requests and swipes
- Report/block users
- Admin dashboard
- Onboarding flow UI (profile setup + photo upload screens are stubbed as
  empty route folders: `app/(onboarding)/setup`)
