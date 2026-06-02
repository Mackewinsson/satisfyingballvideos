# Satisfying Ring Studio

Next.js app: customize the bouncing-ring animation in the browser and export MP4, GIF, WebM, or PNG sequences.

## Setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — **Studio** at `/studio`.

## Paywall (MVP)

- Set `PAYWALL_BYPASS=true` in `.env.local` to download without payment while building.
- Production: integrate **Stripe Checkout** in [`app/api/unlock/route.ts`](app/api/unlock/route.ts) (see comments). Redirect success URL to `/studio?session_id={CHECKOUT_SESSION_ID}`.

## Deploy (Vercel)

1. Import this repo (root directory is the project root).
2. Add env vars (`PAYWALL_BYPASS=false` in production).
3. Push to `main` for automatic production deploys.

## Structure

- [`lib/simulation/`](lib/simulation/) — core 2D canvas physics engine
- [`components/BouncingRingCanvas.tsx`](components/BouncingRingCanvas.tsx) — live preview + recording
- [`lib/gifExport.ts`](lib/gifExport.ts) — client GIF encode (`gifenc`)
- [`lib/paywall.ts`](lib/paywall.ts) — unlock token in `sessionStorage`
