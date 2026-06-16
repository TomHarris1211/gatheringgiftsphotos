# Gathering Gifts Photos

A mobile-first photo & video capture app for Gathering Events.

- **Staff** open the home page on their phone, type their name, pick the company/client, choose Photo or Video, add media from camera or library, tap the relevant tags, and upload.
- **Admins** sign in to a dashboard to browse all media filtered by client, uploader, date and tag.

## Stack

| Layer        | Tech                                            |
|--------------|-------------------------------------------------|
| Frontend     | Next.js 16 (App Router), deployed on Vercel     |
| Database     | Supabase (Postgres)                             |
| Admin auth   | Supabase Auth (email + password)                |
| Storage      | Cloudflare R2 (S3-compatible, CDN-backed)       |
| Uploads      | Presigned PUT URLs straight from the browser    |

> Tagging is **manual** — staff pick from a fixed set: `food`, `alcohol`, `non-alcohol`, `settlements`, `others`. No third-party AI tagging service is used.

## How uploads work

1. Browser asks `POST /api/upload-url` for a short-lived presigned PUT URL.
2. Browser uploads the file **directly to R2** (the file never passes through the server).
3. Browser calls `POST /api/media` to record the row (client, uploader, type, tags, public URL).

This keeps the Vercel function fast and within request size limits even for large videos.

---

## 1. Prerequisites

- Node.js 20+ and npm
- A Supabase project
- A Cloudflare R2 bucket
- A Vercel account (for deploy)

## 2. Install

```bash
npm install
cp .env.example .env.local   # then fill in the values (see below)
npm run dev                  # http://localhost:3000
```

## 3. Supabase setup

1. Create a project at supabase.com.
2. Open **SQL Editor** and run the contents of [`supabase/schema.sql`](supabase/schema.sql). This creates the `clients`, `media`, `tags`, `media_tags` tables, seeds the five tags, sets up RLS, and creates a `media_view`.
3. **Project Settings → API**: copy the **Project URL**, the **anon public** key, and the **service_role** key into `.env.local`.
4. Create an admin login: **Authentication → Users → Add user** (set an email + password, mark email confirmed). These are the credentials admins use at `/admin/login`.

## 4. Cloudflare R2 setup

1. In the Cloudflare dashboard go to **R2 → Create bucket** (e.g. `gathering-gifts-photos`).
2. **R2 → Manage API Tokens → Create API token** with Object Read & Write. Copy the **Access Key ID** and **Secret Access Key**, and note your **Account ID**.
3. Make objects publicly readable so the dashboard can display them. Either:
   - enable the bucket's **public r2.dev URL** (Settings → Public access), or
   - connect a **custom domain** for CDN delivery.
   Put that base URL in `R2_PUBLIC_BASE_URL`.
4. **CORS** — add a rule so the browser can PUT directly. In bucket **Settings → CORS policy**:

   ```json
   [
     {
       "AllowedOrigins": ["http://localhost:3000", "https://YOUR-VERCEL-DOMAIN.vercel.app"],
       "AllowedMethods": ["PUT", "GET"],
       "AllowedHeaders": ["*"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

## 5. Environment variables

Copy `.env.example` to `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=gathering-gifts-photos
R2_PUBLIC_BASE_URL=https://pub-xxxxxxxx.r2.dev
```

The `SUPABASE_SERVICE_ROLE_KEY` and all `R2_*` values are server-only — never prefix them with `NEXT_PUBLIC_`.

## 6. Deploy to Vercel

1. Push this folder to a GitHub repo.
2. In Vercel: **New Project → import the repo**.
3. Add every variable from `.env.local` under **Settings → Environment Variables**.
4. Deploy. Add your `*.vercel.app` domain to the R2 CORS `AllowedOrigins`.

## Routes

| Path               | Who      | Purpose                                  |
|--------------------|----------|------------------------------------------|
| `/`                | Staff    | Mobile upload portal                     |
| `/admin/login`     | Admin    | Email/password sign in                   |
| `/admin`           | Admin    | Gallery + filters (client/uploader/date/tag) |
| `/api/upload-url`  | —        | Issues presigned R2 PUT URLs             |
| `/api/media`       | —/Admin  | POST records media; GET lists (auth)     |
| `/api/clients`     | —        | Client list for the picker               |

## Project structure

```
src/
  app/
    page.js               Staff upload portal
    admin/login/page.js   Admin sign in
    admin/page.js         Admin dashboard
    api/upload-url/route.js
    api/media/route.js
    api/clients/route.js
  lib/
    r2.js                 R2 (S3) client
    supabaseAdmin.js      Service-role client (server)
    supabaseServer.js     Auth-aware server client
    supabaseBrowser.js    Browser client
    tags.js               Fixed tag taxonomy
  middleware.js           Protects /admin
supabase/schema.sql       Database schema + seed + RLS
```

## Notes & next steps

- The staff page is intentionally open (no login) so event staff can upload instantly. Add a shared access code or Supabase anonymous auth if you want to lock it down.
- Large videos: presigned single-PUT works to a few GB; for very large files consider multipart uploads.
- To add bulk download or per-client galleries, extend `GET /api/media` and the dashboard grid.
