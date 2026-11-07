# ID Studio — ID Card Generator SaaS Boilerplate

Unified Next.js monorepo (frontend + API routes in one project).

## Structure

```
id-studio/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── (auth)/          # Login, Register, Forgot Password
│   │   ├── (dashboard)/     # User dashboard, editor, templates
│   │   ├── (admin)/         # Super Admin area
│   │   └── api/             # Backend API routes
│   │       ├── auth/
│   │       ├── admin/
│   │       ├── templates/
│   │       └── dashboard/
│   ├── components/
│   ├── lib/                 # Auth, DB, HTTP helpers
│   ├── models/              # Mongoose models
│   ├── services/            # Client API services
│   ├── stores/
│   ├── hooks/
│   └── types/
├── scripts/
│   └── seed-superadmin.ts
├── package.json             # Single package for everything
├── .env.example
└── README.md
```

## Quick Start

### 1. Install

```bash
npm install
```

### 2. Environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/id-studio?retryWrites=true&w=majority
JWT_SECRET=your-long-random-secret-min-32-chars
JWT_EXPIRES_IN=7d
COOKIE_NAME=id_studio_token
COOKIE_SECURE=false
NEXT_PUBLIC_APP_URL=http://localhost:3000
SUPERADMIN_NAME=Super Admin
SUPERADMIN_EMAIL=admin@idstudio.com
SUPERADMIN_PASSWORD=SuperSecurePassword123!
```

### 3. Seed Super Admin

```bash
npm run seed
```

### 4. Run

```bash
npm run dev
```

Open http://localhost:3000

## Features

- JWT auth with HTTP-only cookies
- SUPERADMIN / USER roles
- Super Admin dashboard + user management (suspend / activate)
- Suspension enforced on API routes
- User dashboard, template library, basic ID card editor UI
- Light / dark mode
- **Fabric.js ID Card Editor** (text, image, shapes, QR, undo/redo, save)
- MongoDB via Mongoose (collections auto-created)

## Scripts

| Command        | Description              |
|----------------|--------------------------|
| `npm run dev`  | Start development server |
| `npm run build`| Production build         |
| `npm start`    | Run production server    |
| `npm run seed` | Create Super Admin       |

## Security

- Passwords hashed with bcrypt (12 rounds)
- Access + Refresh JWT pair (HTTP-only cookies)
- Refresh token rotation + hashed storage in MongoDB
- Immediate session revoke on user suspend
- Rate limiting on login (10/15min) and register (5/hour)
- Role checks on every protected API route
- Suspended users cannot authenticate
- Super Admin cannot be suspended via user-management UI
