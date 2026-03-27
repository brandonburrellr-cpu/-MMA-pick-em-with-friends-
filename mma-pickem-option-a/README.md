# MMA Pick'Em – Option A

A simple UFC pick'em site for friends.

## What it does
- No login required
- Enter your name
- Click the fighter you think will win
- Save picks per event
- Tally leaderboard by correct winners
- Admin can click official winners after the event

## 1. Install
```bash
npm install
```

## 2. Create Supabase
Create a Supabase project and run the SQL in:
```bash
supabase/schema.sql
```

## 3. Add env file
Copy `.env.example` to `.env.local` and fill in:
```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## 4. Run locally
```bash
npm run dev
```

## 5. Deploy to Vercel
- Push this project to GitHub
- Import the repo in Vercel
- Add the same two environment variables in Vercel
- Deploy

## Notes
This version is intentionally simple. It does not use authentication. Anyone with the site can save picks with a name and use the admin result buttons.
