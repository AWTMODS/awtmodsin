# AWTMods — Modern Android Application Publishing Platform

A modern, production-ready Android application publishing platform and software directory built for **https://www.awtmods.in**.

Designed with a minimal black-and-white aesthetic, multi-mirror download routing, version history archives, analytics tracking, community issue reporting, and a full administrative dashboard.

---

## 🚀 Key Features

### Public Experience
- **Hero & Search Engine**: Live search across applications, package identifiers, and developer names with instant suggestions.
- **Platform Analytics**: Real-time database metrics displaying published applications, total download requests, categories, and recent updates.
- **Application Details (`/apps/[slug]`)**:
  - App metadata, architecture tags, Android version requirements, and package names.
  - Interactive screenshots gallery with lightbox image zoom.
  - Multi-mirror download selection (MediaFire, Google Drive, Dropbox, MEGA, Telegram, Direct APK).
  - Version history archive with individual changelogs and downloads.
  - Related application suggestions and broken link reporting.
- **Download System (`/download/[slug]`)**:
  - Automated preparation countdown timer (configurable from admin settings).
  - Mirror switcher and SHA-256 integrity checksum verification.
  - Rate-limited download initiation event tracking.
- **Curated Categorization (`/categories`, `/categories/[slug]`, `/games`)**:
  - Filterable by Music & Audio, Media & Video, Social, Tools, Photography, Games, Communication, Productivity, Entertainment, and Education.
- **Latest Updates & Changelogs (`/updates`)**:
  - Dedicated changelog feed showing newly published revisions.
- **Community Issue Reporting (`/report-issue`)**:
  - Public submission for broken mirrors, outdated versions, and DMCA inquiries with zero friction.
- **SEO & Performance**:
  - Dynamic Open Graph metadata, canonical URLs, XML sitemap (`/sitemap.xml`), and robots configuration (`/robots.txt`).

### Admin Console (`/admin`)
- **Restricted Access & Session Security**:
  - Zero public registrations or visitor accounts.
  - Protected admin routes with session validation via middleware.
- **Dashboard Overview**:
  - Interactive Recharts analytics area charts for 7, 30, and 90-day download trajectories.
  - Top downloaded applications leaderboard.
- **App Management (`/admin/apps`)**:
  - Table with quick status toggles (Draft / Published), featured toggles, and deletion.
- **Publish New App (`/admin/apps/new`)**:
  - Multi-section workflow: Basic information, icon/screenshots previews, version specifications, multi-mirror external link selector, and publishing toggles.
- **Version Management (`/admin/versions`)**:
  - Deploy new versions to existing apps, mark active latest release, and view changelogs.
- **Category Management (`/admin/categories`)**:
  - Add, edit, and organize taxonomy with Lucide icons and slugs.
- **Analytics & Provider Share (`/admin/analytics`)**:
  - Distribution breakdown across MediaFire, Google Drive, MEGA, Dropbox, and Telegram.
- **Reports Management (`/admin/reports`)**:
  - Triage broken link submissions, update statuses (Pending, Resolved, Dismissed).
- **Platform Settings (`/admin/settings`)**:
  - Modify site branding, Telegram community URL, and countdown timers.

---

## 🛠️ Technology Stack

| Component | Technology |
|---|---|
| Frontend | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS (Strict Black & White System) |
| Icons | Lucide React |
| Theming | next-themes (Light & Dark mode) |
| Charts | Recharts |
| Backend & DB | Supabase (PostgreSQL with Row Level Security) |
| Validation | Zod |
| Toast Alerts | Sonner |
| Deployment | Vercel (awtmods.in) |

---

## 🔐 Default Administrator Credentials

To access the admin dashboard:
1. Navigate to: **`/admin/login`**
2. **Email**: `admin@awtmods.in` (or `awtmods@gmail.com`)
3. **Password**: `admin123` (or `awtmods2026!`)

---

## 📦 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Fill in your Supabase credentials:
```env
NEXT_PUBLIC_SITE_URL=https://www.awtmods.in
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

*Note: If Supabase credentials are not provided, the platform automatically runs in resilient in-memory local state mode, allowing complete demonstration and local testing.*

### 3. Database Migration
Run the SQL migration in your Supabase SQL editor:
- **Schema**: `supabase/migrations/001_initial_schema.sql`
- **Seed Data**: `supabase/seed.sql`

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Production Build
```bash
npm run build
npm start
```

---

## 🚢 Deployment to Vercel

1. Push your repository to GitHub.
2. In the Vercel Dashboard, click **Import Project** and select this repository.
3. In **Environment Variables**, provide:
   - `NEXT_PUBLIC_SITE_URL` (`https://www.awtmods.in`)
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Set custom domain to `awtmods.in`.
5. Deploy!

