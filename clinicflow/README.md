# ClinicFlow

ClinicFlow is a real-time dental and medical clinic management app built with Next.js and Supabase.

## Stack

- Next.js (App Router + TypeScript)
- Tailwind CSS
- Supabase (PostgreSQL + Realtime + Storage)
- TanStack Query + Zustand

## 1) Install

```bash
npm install
```

## 2) Configure environment

Copy `.env.example` to `.env.local` and set your Supabase credentials:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## 3) Create database schema

Run `supabase/schema.sql` in Supabase SQL Editor, then run `supabase/seed.sql`.

Files:

- `supabase/schema.sql` creates all required tables and constraints.
- `supabase/seed.sql` inserts common dental treatment catalog entries.

## 4) Start development server

```bash
npm run dev
```

Open http://localhost:3000.

## 5) Authentication and RLS

The app now expects users to sign in before accessing clinic data.

- Create staff users in Supabase Authentication or use the sign-up page at `/login`.
- Run `supabase/schema.sql` again after pulling the latest changes so authenticated-only RLS policies are applied.
- The app uses the public anon key, but database access is now restricted to authenticated sessions.

## 6) Deploy to GitHub and Vercel

If Git is installed on your machine, from the project folder run:

```bash
git init
git add .
git commit -m "Initial ClinicFlow app"
git branch -M main
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

Then import the repository in Vercel and set:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

After deploy, share the Vercel URL with clinic staff.

## Supabase client usage

Use the browser client helper from `lib/supabase/client.ts`:

```ts
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

const supabase = getSupabaseBrowserClient();
```

Database types are defined in `lib/supabase/database.types.ts`.
