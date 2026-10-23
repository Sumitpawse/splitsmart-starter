# SplitSmart — starter

The starter app for the **deepEntra Academy · Build & Ship It** course. It's a basic
expense-splitter (one group, a list of expenses, a running total). Over the course you'll
give it an **AI brain** (Hour 3) and a **real database with logins** (Hour 5), then polish
and ship it to your own domain (Hours 7–8).

This is the **"My Group"** app you see on the course slide — the basic version you deploy in
Hour 2, before you add the magic.

<p align="center"><b>SplitSmart · My Group</b><br/>🍽️ Dinner — paid by Aisha — ₹1,800<br/>🚕 Cab — paid by Raj — ₹400<br/><b>Total ₹2,200</b></p>

---

## Hour 2 — get it on your laptop & ship it

### 1. Fork this repo
Click **Fork** (top-right) → you get your own copy under your GitHub account.

### 2. Clone your fork and open it
Ask your AI assistant: *"Clone my fork and open it in VS Code."* Or, in a terminal:

```bash
git clone https://github.com/<your-username>/splitsmart-starter.git
cd splitsmart-starter
```

### 3. Install the app's parts
```bash
npm install
```

### 4. Run it
```bash
npm run dev
```
Open **http://localhost:3000** — SplitSmart is alive on your laptop. 🎉

### 5. Make one tiny change
Ask your AI: *"Change the title to 'Raj's SplitSmart' and keep the button deepEntra blue."*
Save → the browser updates instantly. Then snapshot it:

```bash
git add -A
git commit -m "My first change"
git push
```

### 6. Put it on the internet — Vercel 🚀

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/maheshbaxi/splitsmart-starter)

- Import your fork into **[Vercel](https://vercel.com/new)** (it finds your GitHub repo).
- Click **Deploy** → ~1 minute → you get a live `…vercel.app` link. Open it on your phone and
  text it to a friend.
- From now on, **every `git push` redeploys your live site automatically.**

> 🔒 **Keep your API keys private** — never paste them into a screenshot, a commit, or a shared
> doc. Secrets go in Vercel's **Environment Variables** (and in `.env.local` locally, which is
> git-ignored). See `.env.example`.

---

## What's inside

| | |
| --- | --- |
| **Framework** | [Next.js](https://nextjs.org) (App Router) + React |
| **The app** | `app/page.js` — the whole SplitSmart UI (one file to start) |
| **Styles** | `app/globals.css` + inline styles (deepEntra blue) |
| **Data** | Saved in your browser (`localStorage`) for now — you'll move it to a real database in Hour 5 |

## Scripts
```bash
npm run dev     # local dev → http://localhost:3000
npm run build   # production build
npm run start   # run the production build
```

## Hour 5 — Supabase logins + database

The app uses browser-only `localStorage` when Supabase is not configured. With Supabase
configured, expenses are stored in Postgres and protected by Row-Level Security:

1. Create a Supabase project, then copy its **Project URL** and **anon public key** from
   **Project Settings → API**.
2. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Keep `.env.local` private; it is ignored by Git.
3. In Supabase **SQL Editor**, run [`supabase/schema.sql`](supabase/schema.sql) to create
   the expenses table and its per-user row-level security policies.
4. In Supabase **Authentication → URL Configuration**, allow `http://localhost:3000`
   (and your deployed site URL when you configure hosting).
5. Restart the development server with `npm run dev`. The app supports email/password
   accounts and username/password accounts. To use usernames without signup emails, turn
   off **Confirm Email** under **Authentication → Sign In / Providers → Email**. Expenses
   are saved to Supabase for the signed-in account. Existing browser expenses are imported
   once when that account has no database expenses yet.

For Vercel, add the same two environment variables in the project's Environment
Variables settings and redeploy there. This repository change does not configure or
deploy a Vercel project.

## Hour 6 — private groups

After Hour 5 is set up, open Supabase **SQL Editor → New query**, paste and run
[`supabase/schema_hour6.sql`](supabase/schema_hour6.sql). It creates private groups,
membership, invite codes, and group-scoped Row-Level Security. Existing expenses are
preserved in a private **My Group** for their current owner.

After deploying this code, the app creates a **My Group** for a user with no groups.
Use the group selector to switch groups, share the displayed invite code, or enter a
friend's code to join. New expenses are saved to the selected group. The SQL uses
security-definer functions for group creation and joining so clients cannot add
themselves to a group by inserting membership rows directly.

To check privacy, sign in with a second account in a private browser, join the first
account's group using its code, and confirm that expenses in groups it has not joined
do not appear. A separate username account starts with its own data; existing expenses
stay under their original Supabase account.

---

Made for **deepEntra Academy** · [academy.deepentra.ai](https://academy.deepentra.ai)
