# Deployment Checklist

Pre-flight checks before pushing to Vercel (frontend) + Railway/Render (backend).

## Pre-deploy verification

- [ ] `cd frontend && npm run build` — passes (no TypeScript or ESLint errors)
- [ ] `cd backend && npx tsc --noEmit` — passes
- [ ] `node scripts/smoke-claim-hint-usdc.mjs` — IDL + on-chain dispatch verified
- [ ] Anchor program deployed to devnet: program ID `8XZTXNux374128LFJSVhp5XSNyYMPNZpfw4vyjWmSJkN`
- [ ] Sponsor wallet (`CPoofbZho4bJmSAyVJxfeMK9CoZpXpDYftctghwUJX86`) has at least **2 SOL** for sustained gas sponsorship
- [ ] Mock USDC mint exists on devnet: `GcANNzhJDpToS3QeCqw1oAGhdcFU8qPnpfex3e1EFU4B`
- [ ] Faucet wallet has minted reserve to distribute (run `backend/scripts/setup-mock-usdc.ts` if first deploy)

## Backend → Railway / Render

1. **Connect repo** — pick `backend/` as root directory
2. **Build command**: `npm install && npm run build`
3. **Start command**: `node dist/index.js`
4. **Environment variables** — copy from `backend/.env.production.example`:
   - `PORT=3001`
   - `ALLOWED_ORIGINS` — set to your final Vercel URL (after FE deploys)
   - `ALLOW_VERCEL_PREVIEW=1` (allow `*.vercel.app` for preview branches)
   - `DATABASE_URL` — Neon Postgres connection string
   - `RPC_URL` — paid Solana RPC for production reliability
   - `MIND_DUEL_PROGRAM_ID=8XZTXNux374128LFJSVhp5XSNyYMPNZpfw4vyjWmSJkN`
   - `MOCK_USDC_MINT=GcANNzhJDpToS3QeCqw1oAGhdcFU8qPnpfex3e1EFU4B`
5. **Secret files** — upload these via Railway's "secret files" feature (NOT plain env vars):
   - `/etc/secrets/sponsor.json` — sponsor keypair (the deployer keypair)
   - `/etc/secrets/badge-minter.json` — same as sponsor or separate
   - `/etc/secrets/faucet.json` — faucet keypair
   Then set `SPONSOR_KEYPAIR_PATH=/etc/secrets/sponsor.json`, etc.
6. **Verify** — after first deploy, hit `https://YOUR-BE.railway.app/health` → expect `200 OK`
7. **WebSocket** — confirm Railway/Render proxies WebSocket. Open browser dev tools after FE deploys, look for `wss://` upgrade.

## Frontend → Vercel

1. **Import repo** — pick `frontend/` as root directory
2. **Framework preset** — Next.js (auto-detected)
3. **Build command**: `npm run build` (default)
4. **Environment variables** — copy from `frontend/.env.production.example`:
   - `NEXT_PUBLIC_RPC_ENDPOINT` — same paid RPC as backend
   - `NEXT_PUBLIC_PROGRAM_ID=8XZTXNux374128LFJSVhp5XSNyYMPNZpfw4vyjWmSJkN`
   - `NEXT_PUBLIC_BACKEND_URL=https://YOUR-BACKEND.railway.app`
   - `NEXT_PUBLIC_WS_URL=wss://YOUR-BACKEND.railway.app` ⚠ MUST be `wss://` (not `ws://`)
   - `NEXT_PUBLIC_MOCK_USDC_MINT=GcANNzhJDpToS3QeCqw1oAGhdcFU8qPnpfex3e1EFU4B`
5. **Domain** — once deployed, copy the production URL (`mind-duel.vercel.app` or custom)
6. **Update backend CORS** — go back to Railway, set `ALLOWED_ORIGINS` to include this URL, redeploy

## Post-deploy smoke test

1. Open production URL → should load without "Devnet" banner errors
2. Click `Connect Wallet` → Phantom devnet → connect
3. Faucet 100 USDC (Lobby → Faucet button)
4. Create a USDC stake match → wait → cancel via Recovery Modal → match closes, stake refunded
5. Open `Solana Explorer` link from result page → confirm tx visible

## Operational

- **Sponsor balance monitoring**: set up an external alert (e.g. cron job hitting `https://api.devnet.solana.com` for sponsor balance) — alert if drops below 0.5 SOL
- **DB backups**: Neon automatically backs up. Confirm retention policy ≥ 7 days
- **Logs**: Railway/Render dashboards. Filter for `[badges]` and `Sponsor sign failed` lines

## Known limitations

- `prize_pool` 20% boost is implemented for **USDC matches only**. The SOL `claim_hint` instruction transfers the boost into escrow but doesn't update `pot_lamports`, so the boost stays locked after settle. Fix planned post-hackathon.
- `/api/trivia/peek` (hint reveal endpoint) doesn't verify on-chain payment — trust model accepted for hackathon demo
- Tournament feature is partially built; live demo should focus on Classic/Shifting/ScaleUp + Quick Match
