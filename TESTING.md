# MindDuel Test Plan

Smart contract dan backend sudah diverifikasi. Bagian ini fokus pada
**testing UI di browser** — yang harus kamu cek manual.

Estimasi: 1 jam untuk full pass, 25 menit untuk minimum demo viability (M).

---

## ✅ Smart Contract — Already Verified

**Program ID**: `8XZTXNux374128LFJSVhp5XSNyYMPNZpfw4vyjWmSJkN` (devnet)

| Instruction | Deployed | Status |
|---|---|---|
| `initialize_game` (SOL/USDC) | ✓ | tested |
| `join_game` (SOL/USDC) | ✓ | tested |
| `commit_answer` | ✓ | tested |
| `reveal_answer` | ✓ | tested |
| `claim_hint` (SOL) | ✓ | tested |
| `claim_hint_usdc` | ✓ | smoke-tested via `node scripts/smoke-claim-hint-usdc.mjs` (IDL + on-chain dispatch confirmed) |
| `settle_game` (SOL/USDC) | ✓ | tested + `close = player_one` returns rent |
| `cancel_match` (SOL/USDC) | ✓ | tested + full refund |
| `resign_game` (SOL/USDC) | ✓ | tested + opponent receives prize − fee |
| `timeout_turn` | ✓ | logic verified, manual timeout impractical to demo live |

Latest deploy tx: `2DYZ7BiZihNZrh48CxUaYPj54rnxpRWGhd3Y86Q5G4eao8TZw3gEv2d6ZfwScmedbrCe2SHfhWyjhXQNPp7idiW3`

Verifikasi langsung: https://explorer.solana.com/address/8XZTXNux374128LFJSVhp5XSNyYMPNZpfw4vyjWmSJkN?cluster=devnet

---

## ✅ Backend — Already Verified

**URL**: `http://localhost:3001`

| Endpoint | Tested | Result |
|---|---|---|
| `GET /health` | ✓ | 200 ok |
| `GET /api/trivia/question` | ✓ | returns question + sessionId + commitHash |
| `POST /api/trivia/reveal` | ✓ | returns correct + correctIndex |
| `GET /api/trivia/peek?type=eliminate2` | ✓ | returns 2 wrong indices |
| `GET /api/trivia/peek?type=first-letter` | ✓ | returns first letter |
| `GET /api/sponsor/pubkey` | ✓ | returns sponsor pubkey |
| `POST /api/sponsor/sign-tx` | ✓ | rejects malformed payload (400), drain attack (400), rate-limits at 30 req/min (429) |
| `POST /api/match/create` `/join` `/queue` | ✓ | DB persistence working |
| `DELETE /api/match/queue` | ✓ | dequeue cleanup working |
| `WS /ws/:matchId` | ✓ | heartbeat ping/pong 30s, auto-reconnect, payload guard 4KB |
| `POST /api/faucet` | ✓ | 100 USDC per 24h per wallet |
| `POST /api/badge mint` (internal trigger) | ✓ | Metaplex Umi mint with 3× retry backoff |

Env validation log on startup:
```
✓ Env sanity check passed (or warnings for missing optional keys)
```

---

## 🟢 Frontend Testing — User Focus

### Pre-flight (5 min) 🔴 M

- [ ] Buka `http://localhost:3000` — homepage load tanpa error console
- [ ] **Wallet 1** (Phantom): Devnet, ≥ 0.1 SOL + ≥ 20 USDC
- [ ] **Wallet 2** (Phantom di Chrome Incognito ATAU Firefox): Devnet, ≥ 0.1 SOL + ≥ 20 USDC
- [ ] Buka tab **Solana Explorer** di sebelah, set ke Devnet — siap untuk verify tx

> Tip: kalau wallet 2 belum ada USDC, klik tombol **"Faucet USDC"** di lobby → 100 USDC.

---

### A. Wallet & Network (3 min) 🔴 M

- [ ] **A1** Connect Wallet 1 → pill kuning **"DEVNET"** muncul di sebelah address
- [ ] **A2** Klik wallet pill → menu turun → balance SOL & USDC tertampil benar
- [ ] **A3** Disconnect → reconnect → state kembali tanpa flash
- [ ] **A4** Switch theme (toggle ⊙ di header) light↔dark — semua warna proper

---

### B. Lobby UI (3 min)

- [ ] **B1** 5 mode card tampil: Classic, Shifting Board, Scale Up, Blitz, vs AI
- [ ] **B2** Stake input: ketik huruf → otomatis di-strip; ketik `0.0001` → clamped ke min stake
- [ ] **B3** Currency toggle SOL ↔ USDC → balance preview update
- [ ] **B4** Pilih `vs AI` → tombol jadi "Play vs AI" (tidak ada Quick Match)
- [ ] **B5** Pilih PvP mode → tombol "Create Game" + "Quick Match" tampil

---

### C. SOL Match End-to-End (15 min) 🔴 M

#### C1. Create

- [ ] **Wallet 1**: Classic + Stake + SOL + 0.05 → klik **Create Game**
- [ ] Banner **"Confirm in your wallet…"** muncul di tengah-atas
- [ ] Wallet popup → sign → toast success → redirect ke `/game/{id}`
- [ ] Header tampil join code (format `MNDL-XXXXXX`)

#### C2. Join

- [ ] **Wallet 2**: lobby → masukkan code → Join
- [ ] Banner signing → wallet popup → sign → masuk game
- [ ] Kedua sisi: board sync, "Your Turn" indikator pulsing biru
- [ ] **Verify Explorer**: cari init tx → escrow PDA hold 0.1 SOL

#### C3. Round 1

- [ ] **Wallet 1** (X turn): klik cell tengah → ring biru pulse + "Cell 5 selected — answer to claim"
- [ ] Trivia card slide in dari kanan → 4 opsi entrance staggered
- [ ] Klik jawaban benar:
  - Button hijau dengan checkmark spring in
  - Sound 3-note ascending (C→E→G)
  - Cell terisi `X` warna biru + **expanding ring burst** dari cell
  - Sound `place()` (sine 440Hz)
- [ ] **Wallet 2 sisi**: langsung lihat X muncul (WS push), turn flip ke O
- [ ] **Verify Explorer**: tx commit_answer + reveal_answer berurutan

#### C4. Wrong Answer

- [ ] **Wallet 2** (O turn): klik cell → pilih **jawaban salah**
  - Button red shake (8 frame oscillation)
  - Sound 2-note descending sawtooth
  - Cell tidak terisi → turn flip ke X
- [ ] Toast "Wrong answer — turn lost"

#### C5. Timer & Tick

- [ ] Pilih cell baru → biarkan timer turun
- [ ] **Saat ≤5 detik**: setiap detik dengar **tick sound** (square 1100Hz pendek)
- [ ] Progress bar berubah merah, angka detik merah
- [ ] Habis → toast "Time's up! Turn forfeited" + sound `timeout()`

#### C6. Win + Settle

- [ ] Lanjut sampai 3-in-a-row tercapai (mis. row 0)
- [ ] **Win line glow** muncul melintang
- [ ] Sound 4-note arpeggio ascending (`win()`)
- [ ] Routing ke `/result` → confetti 36 piece + stat panel
- [ ] Pemenang otomatis fire settle tx → banner "Confirm in wallet…" → sign
- [ ] Toast "Prize distributed on-chain ✓"
- [ ] **Verify Explorer**:
  - Pemenang: +0.0975 SOL
  - Treasury `CPoof…`: +0.0025 SOL
  - GameAccount: closed (rent ~0.018 SOL ke Wallet 1)
- [ ] **Verify**: Wallet 1 langsung bisa Create match baru tanpa Recovery Modal

---

### D. USDC Match + Hint USDC (15 min) 🔴 M

#### D1. Faucet & Setup

- [ ] **Wallet 2**: Lobby → klik **"Faucet USDC"** → toast "100 USDC sent" + wallet balance USDC bertambah
- [ ] Wallet pill menu → balance USDC ≥ 100

#### D2. Create + Join USDC

- [ ] **Wallet 1**: Classic + Stake + USDC + 5 → Create
- [ ] Wallet popup → mungkin 2 prompts (ATA approval + initializeGameUsdc) → sign semua
- [ ] **Wallet 2**: join → sign → masuk game
- [ ] **Verify Explorer**: escrow ATA 10 USDC

#### D3. Hint USDC — Eliminate 2

- [ ] **Saat giliran main**: klik cell → trivia muncul
- [ ] Hint pill tampil **5 buah** dengan harga USDC: `Eliminate 2 · 0.40 USDC`, `Category · 0.20 USDC`, dst.
- [ ] Klik **"Eliminate 2 · 0.40 USDC"**
- [ ] Confirm dialog tampil:
  - Title: "Buy Eliminate 2?"
  - Cost: **"0.40 USDC"** (bukan SOL!)
  - Footer: "80% goes to platform treasury, 20% boosts the prize pool"
- [ ] Klik **"Buy & sign"** → banner signing → wallet popup → sign
- [ ] Sound shimmer 3-note (`hint()`)
- [ ] 2 jawaban salah opacity turun ke 32% + line-through
- [ ] **Verify Explorer** (claim_hint_usdc tx):
  - Player ATA: -0.40 USDC
  - Treasury ATA: +0.32 USDC
  - Escrow ATA: +0.08 USDC (boost pot)
  - HintLedger PDA created/updated

#### D4. Hint Lain — Category

- [ ] Klik **"Category · 0.20 USDC"** → confirm → sign
- [ ] Chip violet **"📚 {kategori}"** muncul di atas pertanyaan
- [ ] Sound shimmer

#### D5. Hint Lain — First Letter

- [ ] Pilih cell baru → trivia → klik **"First Letter · 0.20 USDC"** → confirm → sign
- [ ] Chip cyan **"starts with 'X'"** muncul

#### D6. Hint Lain — Extra Time

- [ ] Klik **"Extra Time · 0.60 USDC"** (cell tidak harus dipilih dulu) → confirm → sign
- [ ] Timer +8 detik → bar refresh

#### D7. Hint Lain — Skip

- [ ] Pilih cell → klik **"Skip · 1.00 USDC"** → confirm → sign
- [ ] Toast "Question skipped" → turn forfeit

#### D8. Anti-Double-Spend

- [ ] Coba beli ulang hint yang sudah dipakai → toast **"Hint already used"** (FE block, contract juga akan reject)

#### D9. Settle USDC dengan Boosted Pot

- [ ] Selesaikan match → settle
- [ ] **Verify Explorer**: pemenang dapat **`(10 + 0.08) - 2.5% fee ≈ 9.83 USDC`** (lebih dari 2× stake karena hint boost)

---

### E. Game Modes (10 min)

- [ ] **E1 Shifting Board**: classic 3×3 + mode shifting → main 3 ronde
  - Toast "Board is shifting…" muncul
  - Cells **smooth slide** via Framer Motion `layout` (bukan jump cut)
- [ ] **E2 Scale Up**: jawab 3 benar berturut → board grow 3×3 → 4×4
  - Cell baru muncul, board re-flow
  - Lanjut sampai 5×5 dengan total 9+ benar
- [ ] **E3 Blitz**: timer 5 detik per pertanyaan, sangat tegang
- [ ] **E4 vs AI Easy**: menang dalam 5 ronde
- [ ] **E5 vs AI Hard**: setidaknya draw atau kalah (AI optimal)

---

### F. Recovery & Stuck Match (10 min) 🔴

#### F1. Cancel Waiting Match

- [ ] Wallet 1: create stake match (USDC misal) → JANGAN join dari Wallet 2
- [ ] Tutup tab game atau klik back ke /lobby
- [ ] Wallet 1: coba Create match baru → **Recovery Modal** muncul
- [ ] Modal status: "Waiting for player" + tombol Resume/Cancel
- [ ] Klik **"Cancel match (refund stake)"** → sign
- [ ] Toast "Refunded" + modal tutup
- [ ] **Verify Explorer**: full stake balik, GameAccount closed
- [ ] Sekarang Create match baru tanpa modal

#### F2. Resign Active Match

- [ ] Buat + join match aktif
- [ ] Salah satu pemain: header → ⚙️ menu → **Resign** → confirm dialog
- [ ] Sign → toast "Resigned. Prize sent to opponent on-chain"
- [ ] Sound `lose()`
- [ ] **Verify**: opponent dapat prize INSTANT, tidak tunggu 24h timeout
- [ ] Resigner bisa Create match baru langsung

---

### G. Error Handling (15 min)

#### G1. Hint Edge Cases

- [ ] Klik hint pill **tanpa pilih cell** (kecuali Extra Time) → toast "Select a cell first"
- [ ] **Drain wallet** ke 0.001 SOL → klik Skip 0.005 SOL → toast **"Need 0.005 SOL — your balance is 0.001 SOL"** SEBELUM dialog buka
- [ ] Klik hint, di wallet popup klik **Cancel** → toast "Hint purchase cancelled" (tidak charge)
- [ ] Spam click hint pill 10× cepat → cuma satu yang dieksekusi

#### G2. Match Join Edge Cases

- [ ] Join dengan code tidak ada → "Code not found or match already started"
- [ ] Join code yang dibuat sendiri → "You created this match — share the code instead"
- [ ] Wallet 2 dengan balance < stake → di lobby langsung tampil **"Need X SOL/USDC — you have Y"** (TIDAK route ke game page)

#### G3. Quick Match Cleanup

- [ ] Klik Quick Match → status "Looking for opponent…" + chip kriteria muncul
- [ ] Tutup tab tanpa Cancel → buka lagi → Quick Match → tidak stuck waiting
- [ ] Klik Cancel manual → kembali ke idle state

#### G4. Trivia Session Expiry

- [ ] Klik cell, biarkan tab idle 3+ menit (tunggu sampai session 120s expired)
- [ ] Coba pilih jawaban → toast **"Question expired — fetching a new one"** → trivia fresh muncul

#### G5. Concurrent Settle Race

- [ ] Wallet 1 menang 3-in-a-row → otomatis settle
- [ ] Sebelum tx confirm, di Wallet 2 buka menu → klik Resign cepat
- [ ] Wallet 2 resign tx fail dengan InvalidGameState → toast **"Match already settled — opponent claimed the prize"** (silent, tidak crash)

---

### H. Real-time WebSocket (5 min)

- [ ] **H1 Heartbeat**: buka game → DevTools → Network → filter WS
  - Setiap 30s: frame `{"type":"ping","t":...}` masuk dari server
  - Frame `{"type":"pong","t":...}` reply dari client otomatis
- [ ] **H2 Reconnect**: matikan WiFi 5 detik → nyalakan → console log "WebSocket connecting…" → reopen → state sync ulang dari `lastEvent` cache
- [ ] **H3 Spectator**: copy URL match → buka tab ketiga `/spectate/{matchId}`
  - Read-only board state
  - Viewer count "1 watching" naik di tab pemain

---

### I. Visual & Audio Polish (5 min)

- [ ] **I1 Sounds** (klik mute toggle untuk verify on/off):
  - correct: 3-note ascending
  - wrong: 2-note descending sawtooth
  - place: single sine 440Hz
  - win: 4-note arpeggio
  - lose: 2-note descending triangle
  - draw: 3 flat notes triangle
  - hint: 3-note shimmer ascending
  - tick: square 1100Hz (saat ≤5s)
  - timeout: 2-note descending
- [ ] **I2 Animasi**:
  - Cell place → expanding ring burst (warna sesuai mark)
  - Trivia option entrance staggered (45ms delay per option)
  - Pending cell pulse infinite
  - Win line overlay glow (3×3) atau cell glow (4×4/5×5)
  - Confetti di result page win (36 pieces)
  - Modal entrance spring scale 0.82 → 1
- [ ] **I3 Loading**: leaderboard pakai SkeletonRows (bukan teks "Loading…")
- [ ] **I4 Toast**: bottom-right, auto-dismiss 3s, warna sesuai tone (success hijau, warning kuning, error merah, info biru)
- [ ] **I5 Signing banner**: muncul di tengah-atas saat wallet popup, auto-dismiss setelah sign atau 60s timeout

---

### J. Security Visual Checks (3 min)

- [ ] **J1 DEVNET pill**: SELALU tampil kuning di wallet button — judge instan tahu ini bukan mainnet
- [ ] **J2 Security Headers**: DevTools → Network → Response Headers di `/`:
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- [ ] **J3 No secrets in source**: View Page Source → search "secret" / "private" — tidak ada keypair leak

---

## Summary Centang Cepat

Untuk demo viability minimum (M-marked sections), centang ini saja:

- [ ] Pre-flight setup
- [ ] A. Wallet & Network
- [ ] C. SOL Match End-to-End
- [ ] D. USDC Match + Hint USDC
- [ ] F. Recovery (Cancel + Resign)

Total ~25 menit. Kalau semua lulus → siap demo + deploy.

---

## Reporting Bug

Format:
```
[Section X.Y] Brief description
Repro:
1. ...
2. ...
Expected: ...
Actual: ...
Console error (if any): ...
```

Kirim ke saya → saya fix.
