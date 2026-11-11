# Utah HackMatch

Hackathon team matching for University of Utah students. Sign in with a utah.edu email, create a profile once, join a hackathon, then find a team or recruit teammates.

**Stack:** Next.js 15 (App Router, Server Actions, TypeScript) · Supabase (Postgres, magic link Auth, RLS) · Tailwind · zod · pnpm · Vercel

## 1. Create the Supabase project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**. Pick a name (e.g. `utah-hackmatch`), a database password, and a US region.
2. Once it's ready, open **SQL Editor → New query**, paste all of [`supabase/schema.sql`](supabase/schema.sql), and click **Run**.
3. New query again: paste [`supabase/seed.sql`](supabase/seed.sql) and **Run**. This adds HackTheU 2026, a second sample hackathon, and the skills/interests picker list.
4. **Authentication → Sign In / Providers → Email**: make sure Email is enabled (magic links work with the default settings).
5. **Authentication → URL Configuration**:
   - **Site URL**: your Vercel URL (use `http://localhost:3000` until you deploy)
   - **Redirect URLs**: add both
     - `http://localhost:3000/**`
     - `https://YOUR-APP.vercel.app/**`
6. **Project Settings → API** (or the **Connect** button): copy the **Project URL** and the **anon / publishable** key.

> The built in Supabase email sender is rate limited (a few emails per hour). For a real launch, set up custom SMTP under **Authentication → Emails → SMTP Settings**.

## 2. Run locally

```bash
pnpm install
cp .env.example .env.local   # then paste your URL and anon key
pnpm dev
```

Open http://localhost:3000, sign in with your `@utah.edu` email, and click the link in the email **in the same browser**.

Checks (all must pass):

```bash
pnpm lint
pnpm typecheck
pnpm build
```

## 3. Deploy to Vercel

1. Push this repo to GitHub.
2. [vercel.com/new](https://vercel.com/new) → **Import** the repo. Framework preset: Next.js (auto detected). Build command and output stay default; pnpm is detected from `pnpm-lock.yaml`.
3. Add environment variables (Production, Preview, Development):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. **Deploy**. Copy the production URL (e.g. `https://utah-hackmatch.vercel.app`).
5. Back in Supabase **Authentication → URL Configuration**: set **Site URL** to the Vercel URL and make sure `https://YOUR-APP.vercel.app/**` is in **Redirect URLs**.
6. Sign in from your phone to confirm.

## Adding hackathons

There's no admin UI. Insert rows in the SQL editor:

```sql
insert into public.hackathons (slug, name, starts_at, ends_at, location, tracks)
values ('my-hack-2027', 'My Hack 2027', '2027-03-01 09:00-07', '2027-03-02 17:00-07',
        'Kahlert School of Computing', array['AI/ML', 'Open Innovation']);
```

## How it works

| Rule | Where |
| --- | --- |
| utah.edu only (subdomains allowed) | `enforce_utah_email` trigger on `auth.users` + login form check |
| Onboarding required | `src/middleware.ts` → `src/lib/supabase/middleware.ts` |
| Team owner auto joins, becomes unavailable | `on_team_created` trigger |
| Atomic accept (permissions, capacity, membership, availability, auto decline) | `accept_join_request(id)` |
| Open teams | `open_teams` view (`security_invoker`) |
| Email/Discord hidden | column grants on `profiles` + `get_contact(user_id)` |
| Match score | `src/lib/match.ts` (`MATCH_WEIGHTS`) |

Match score (0 to 100): same track +30, skill complement +40 (share of the team's `roles_needed`, or of the candidate's skills the other side lacks), shared interests +20 (Jaccard), different year +10.

### Routes

`/` landing · `/login` · `/auth/callback` · `/onboarding` · `/me` · `/h/[slug]` hub (People / Teams tabs) · `/h/[slug]/join` · `/teams/new` · `/teams/[id]`

Only the anon key is used anywhere in the app. All authorization lives in Postgres RLS and security definer functions.
