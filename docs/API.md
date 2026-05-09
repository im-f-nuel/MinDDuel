# MindDuel — Backend API Reference

**Base URL (production):** `https://api.mindduel.app` *(replace with live URL)*
**Base URL (local):** `http://localhost:3001`
**Framework:** Fastify + Zod input validation
**All endpoints:** CORS-restricted. Allowed origins: `http://localhost:3000`, `https://mindduel.app`, and Vercel preview deployments (when `ALLOW_VERCEL_PREVIEW=1`).

---

## Health Check

### `GET /health`

Returns server health and version.

**Response:**
```json
{
  "status": "ok",
  "timestamp": 1746000000000,
  "version": "0.1.0"
}
```

**Example:**
```bash
curl https://api.mindduel.app/health
```

---

## Trivia

All trivia endpoints are prefixed with `/api`.

### `GET /api/trivia/question`

Fetch a random trivia question for the current turn. Returns the question **without** the correct answer index. Also returns a `sessionId` for the commit-reveal anti-cheat flow.

**Query Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `categories` | `string` | No | Comma-separated category filter. Valid: `General Knowledge`, `Crypto & Web3`, `Science`, `History`, `Math`, `Pop Culture` |
| `difficulty` | `string` | No | One of `easy`, `medium`, `hard` |

**Response `200`:**
```json
{
  "sessionId": "a3f2c1d4e5b6",
  "commitHash": "sha256hexstring...",
  "question": {
    "id": "q_0042",
    "question": "What consensus mechanism does Solana use?",
    "options": [
      "Proof of Work",
      "Proof of History",
      "Delegated Proof of Stake",
      "Byzantine Fault Tolerance"
    ],
    "category": "Crypto & Web3",
    "difficulty": "medium",
    "timeLimit": 20
  }
}
```

The `commitHash` is the backend's server-side hash of the correct answer (for informational use). The on-chain commitment is computed independently by the client using the player's chosen answer and a random nonce.

**Example:**
```bash
curl "http://localhost:3001/api/trivia/question?categories=Crypto+%26+Web3&difficulty=medium"
```

---

### `POST /api/trivia/reveal`

Submit the player's answer after committing on-chain. Returns whether the answer was correct and reveals the correct index.

**Request Body:**
```json
{
  "sessionId": "a3f2c1d4e5b6",
  "answerIndex": 1
}
```

| Field | Type | Validation |
|---|---|---|
| `sessionId` | `string` | min length 1 |
| `answerIndex` | `integer` | 0–3 |

**Response `200` (correct):**
```json
{
  "correct": true,
  "correctIndex": 1
}
```

**Response `200` (wrong):**
```json
{
  "correct": false,
  "correctIndex": 1
}
```

**Response `410` (session expired or not found):**
```json
{
  "error": "Session expired or not found"
}
```

Sessions expire after 10 minutes. If the player takes too long (network issue, wallet delay), they should re-fetch a new question.

**Example:**
```bash
curl -X POST http://localhost:3001/api/trivia/reveal \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"a3f2c1d4e5b6","answerIndex":1}'
```

---

### `GET /api/trivia/peek`

Get partial hint information for a session without consuming it. Caller is expected to have already paid for the hint on-chain.

**Query Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `sessionId` | `string` | Yes | Active session ID |
| `type` | `string` | Yes | `eliminate2` or `first-letter` |

**Response `200` (eliminate2):**
```json
{
  "type": "eliminate2",
  "wrongIndices": [0, 3]
}
```

Two wrong answer indices (randomly selected from the three wrong options).

**Response `200` (first-letter):**
```json
{
  "type": "first-letter",
  "firstLetter": "P"
}
```

First letter of the correct answer option.

**Response `410`:**
```json
{
  "error": "Session expired or hint type already peeked"
}
```

Each peek type can only be used once per session.

**Example:**
```bash
curl "http://localhost:3001/api/trivia/peek?sessionId=a3f2c1d4e5b6&type=eliminate2"
```

---

### `GET /api/trivia/categories`

List available categories with question counts.

**Response `200`:**
```json
[
  { "id": "General Knowledge", "label": "General Knowledge", "count": 42 },
  { "id": "Crypto & Web3",     "label": "Crypto & Web3",     "count": 35 },
  { "id": "Science",           "label": "Science",            "count": 28 },
  { "id": "History",           "label": "History",            "count": 31 },
  { "id": "Math",              "label": "Math",               "count": 20 },
  { "id": "Pop Culture",       "label": "Pop Culture",        "count": 25 }
]
```

**Example:**
```bash
curl http://localhost:3001/api/trivia/categories
```

---

### `GET /api/trivia/stats`

Summary statistics about the question bank.

**Response `200`:**
```json
{
  "total": 181,
  "byCategory": {
    "General Knowledge": 42,
    "Crypto & Web3": 35,
    "Science": 28,
    "History": 31,
    "Math": 20,
    "Pop Culture": 25
  },
  "byDifficulty": {
    "easy": 65,
    "medium": 72,
    "hard": 44
  }
}
```

**Example:**
```bash
curl http://localhost:3001/api/trivia/stats
```

---

## Match Management

### `POST /api/match/create`

Create a private match. Returns a 6-character join code that the creator shares with their opponent.

**Request Body:**
```json
{
  "playerOne": "7ZQmH5...",
  "mode": "classic",
  "stake": 0.05,
  "currency": "sol"
}
```

| Field | Type | Validation | Default |
|---|---|---|---|
| `playerOne` | `string` | min length 1 | — |
| `mode` | `string` | `classic`, `shifting`, `scaleup`, `blitz`, `vs-ai` | `classic` |
| `stake` | `number` | min 0 | `0` |
| `currency` | `string` | `sol`, `usdc` | `sol` |

**Response `200`:**
```json
{
  "matchId": "AB12CD",
  "joinCode": "MNDL-A1B2C3",
  "status": "waiting"
}
```

**Example:**
```bash
curl -X POST http://localhost:3001/api/match/create \
  -H "Content-Type: application/json" \
  -d '{"playerOne":"7ZQmH5aBcDe...","mode":"classic","stake":0.05,"currency":"sol"}'
```

---

### `POST /api/match/join`

Join a private match using the join code.

**Request Body:**
```json
{
  "joinCode": "MNDL-A1B2C3",
  "playerTwo": "9XzKpQ..."
}
```

| Field | Type | Validation |
|---|---|---|
| `joinCode` | `string` | Regex: `^MNDL-[A-F0-9]{6}$` |
| `playerTwo` | `string` | min length 1 |

**Response `200`:**
```json
{
  "matchId": "AB12CD",
  "status": "active",
  "mode": "classic",
  "stake": 0.05,
  "currency": "sol",
  "playerOne": "7ZQmH5aBcDe..."
}
```

**Response `404`:**
```json
{
  "error": "Match not found, already started, or join code invalid"
}
```

**Example:**
```bash
curl -X POST http://localhost:3001/api/match/join \
  -H "Content-Type: application/json" \
  -d '{"joinCode":"MNDL-A1B2C3","playerTwo":"9XzKpQ..."}'
```

---

### `GET /api/match/:matchId`

Get current match state from the database.

**Response `200`:**
```json
{
  "matchId": "AB12CD",
  "joinCode": "MNDL-A1B2C3",
  "playerOne": "7ZQmH5...",
  "playerTwo": "9XzKpQ...",
  "mode": "classic",
  "stake": 0.05,
  "currency": "sol",
  "status": "active",
  "winner": null,
  "pot": 0.1,
  "fee": 0,
  "onChainSig": null,
  "createdAt": 1746000000000,
  "updatedAt": 1746000100000,
  "finishedAt": null
}
```

**Response `404`:**
```json
{ "error": "Match not found" }
```

---

### `POST /api/match/queue`

Join the matchmaking queue for automatic opponent pairing.

**Request Body:**
```json
{
  "playerId": "7ZQmH5...",
  "mode": "classic",
  "stake": 0.05,
  "currency": "sol",
  "categories": ["Crypto & Web3", "Science"]
}
```

**Response `200` (queued — no match yet):**
```json
{
  "status": "queued",
  "queueLength": 3
}
```

**Response `200` (matched instantly):**
```json
{
  "status": "matched",
  "matchId": "AB12CD",
  "joinCode": "MNDL-A1B2C3",
  "queueLength": 0
}
```

---

### `DELETE /api/match/queue`

Leave the matchmaking queue.

**Request Body:**
```json
{ "playerId": "7ZQmH5..." }
```

**Response `200`:**
```json
{ "ok": true, "queueLength": 2 }
```

---

### `GET /api/match/queue/status`

Check how many players are currently in the queue.

**Response `200`:**
```json
{ "queueLength": 4 }
```

---

### `GET /api/match/player/:playerId`

Find an active match for a player (used to poll for matchmaking results).

**Response `200`:**
```json
{ "matchId": "AB12CD", "status": "active" }
```

**Response `404`:**
```json
{ "error": "No active match" }
```

---

### `POST /api/match/finish`

Report a match result to sync the database after on-chain settlement. This endpoint trusts the caller — on-chain is the source of truth. The database is updated for leaderboard and history queries.

**Request Body:**
```json
{
  "matchId": "AB12CD",
  "winner": "7ZQmH5...",
  "pot": 0.1,
  "fee": 0.0025,
  "onChainSig": "5pLm8R..."
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `matchId` | `string` | Yes | |
| `winner` | `string \| null` | Yes | Null for draw |
| `pot` | `number` | Yes | Total pot in SOL/USDC |
| `fee` | `number` | Yes | Platform fee taken |
| `onChainSig` | `string \| null` | No | Settlement transaction signature |

**Response `200`:**
```json
{
  "ok": true,
  "earnedBadges": ["first_blood", "high_roller"]
}
```

`earnedBadges` is the list of badge types awarded to the winner for this match.

---

### `POST /api/match/vsai`

Record a vs-AI practice match result.

**Request Body:**
```json
{
  "player": "7ZQmH5...",
  "mode": "classic",
  "result": "win"
}
```

| Field | Type | Validation |
|---|---|---|
| `player` | `string` | min length 1 |
| `mode` | `string` | min length 1 |
| `result` | `string` | `win`, `loss`, `draw` |

**Response `200`:**
```json
{ "ok": true, "matchId": "A1B2C3" }
```

---

## Leaderboard and Statistics

### `GET /api/stats`

Live platform statistics (derived from the database).

**Response `200`:**
```json
{
  "totalMatches": 1234,
  "activeMatches": 12,
  "totalPlayers": 456,
  "totalVolumeSol": 891.5,
  "totalVolumeUsdc": 4200.0
}
```

---

### `GET /api/leaderboard`

Top players ranked by wins.

**Query Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `period` | `string` | `alltime` | For display purposes only (`alltime`, `weekly`, `daily`) |
| `limit` | `number` | `25` | Max 50 |

**Response `200`:**
```json
{
  "period": "alltime",
  "entries": [
    {
      "rank": 1,
      "address": "7ZQmH5aBcDe...",
      "wins": 42,
      "matches": 55,
      "losses": 13,
      "solEarned": 12.75,
      "usdcEarned": 0,
      "winRate": 0.764
    }
  ]
}
```

**Example:**
```bash
curl "http://localhost:3001/api/leaderboard?limit=10"
```

---

### `GET /api/history/:player`

Match history for a specific wallet address.

**Path Parameter:** `:player` — Solana wallet public key (base58)

**Query Parameters:**

| Parameter | Type | Default | Max |
|---|---|---|---|
| `limit` | `number` | `50` | `100` |

**Response `200`:**
```json
{
  "player": "7ZQmH5...",
  "count": 12,
  "matches": [
    {
      "matchId": "AB12CD",
      "playerOne": "7ZQmH5...",
      "playerTwo": "9XzKpQ...",
      "mode": "classic",
      "stake": 0.05,
      "currency": "sol",
      "status": "finished",
      "winner": "7ZQmH5...",
      "pot": 0.1,
      "fee": 0.0025,
      "onChainSig": "5pLm8R...",
      "createdAt": 1746000000000,
      "finishedAt": 1746003600000
    }
  ]
}
```

**Example:**
```bash
curl "http://localhost:3001/api/history/7ZQmH5aBcDe...?limit=20"
```

---

### `GET /api/badges/:player`

List all badges earned by a player.

**Response `200`:**
```json
{
  "player": "7ZQmH5...",
  "count": 3,
  "badges": [
    {
      "id": 1,
      "type": "first_blood",
      "name": "First Blood",
      "symbol": "MNDL-FB",
      "description": "Won your first MindDuel match",
      "image": "https://...",
      "mintAddr": "NFTMintAddr...",
      "txSig": "MintTxSig...",
      "earnedAt": 1746000000000,
      "status": "minted"
    }
  ]
}
```

`status` is `"minted"` when `mintAddr` is set, otherwise `"pending"`.

---

## Tournament

### `POST /api/tournament/create`

Create a new tournament bracket.

**Request Body:**
```json
{
  "name": "Devnet Championship",
  "size": 8,
  "stake": 0.1,
  "currency": "sol",
  "mode": "classic",
  "createdBy": "7ZQmH5..."
}
```

| Field | Type | Validation |
|---|---|---|
| `name` | `string` | 2–60 characters |
| `size` | `number` | 4 or 8 |
| `stake` | `number` | min 0 |
| `currency` | `string` | `sol` or `usdc` |
| `mode` | `string` | `classic`, `shifting`, `scaleup`, `blitz` |
| `createdBy` | `string` | min length 1 |

**Response `200`:** Tournament object with `id`, `name`, `size`, `status`, participant list.

---

### `GET /api/tournament/list`

List all open tournaments.

**Response `200`:**
```json
{
  "tournaments": [
    {
      "id": "T-001",
      "name": "Devnet Championship",
      "size": 8,
      "mode": "classic",
      "stake": 0.1,
      "currency": "sol",
      "status": "open",
      "participantCount": 5
    }
  ]
}
```

---

### `GET /api/tournament/:id`

Get a single tournament's details.

---

### `GET /api/tournament/:id/bracket`

Get the match bracket for a tournament.

**Response `200`:**
```json
{
  "tournamentId": "T-001",
  "bracket": [
    { "round": 1, "matchId": "BK-01", "player1": "7ZQm...", "player2": "9Xzk...", "winner": null }
  ]
}
```

---

### `POST /api/tournament/:id/join`

Join an open tournament.

**Request Body:**
```json
{ "player": "7ZQmH5..." }
```

**Response `200`:**
```json
{
  "ok": true,
  "started": false,
  "tournament": { ... }
}
```

`started: true` if joining this player filled the bracket and the first round was generated.

---

## Faucet (Devnet Only)

### `POST /api/faucet`

Request a free airdrop of mock USDC for devnet testing.

**Request Body:**
```json
{ "wallet": "7ZQmH5..." }
```

**Response `200`:**
```json
{
  "signature": "5pLm8R...",
  "amount": 100
}
```

**Response `429`:**
```json
{ "error": "Rate limited — try again in 24 hours" }
```

Rate-limited to one request per wallet per 24 hours.

---

## Sponsor (Gas Sponsorship)

### `GET /api/sponsor/pubkey`

Get the sponsor's fee-payer public key.

**Response `200`:**
```json
{ "pubkey": "SponsorAddr..." }
```

**Response when sponsor unavailable:**
```json
{ "pubkey": null }
```

---

### `POST /api/sponsor/sign-tx`

Submit a partially-built transaction for the sponsor to sign as fee payer.

**Request Body:**
```json
{ "wireBase64": "AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAEDi..." }
```

**Response `200`:**
```json
{ "signedBase64": "AQA..." }
```

The returned transaction has the sponsor's signature attached. The frontend wallet then signs for required user signatures.

---

## WebSocket

### `WS /ws/:matchId`

Connect to a game room for real-time board updates and viewer counts.

**URL Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `:matchId` | `string` | Match ID (from `match/create` or `match/join`) |
| `?role=spectator` | `string` | Optional. Marks connection as spectator (read-only) |

**Connection examples:**
```javascript
// Player connection
const ws = new WebSocket('wss://api.mindduel.app/ws/AB12CD')

// Spectator connection
const ws = new WebSocket('wss://api.mindduel.app/ws/AB12CD?role=spectator')
```

**Events received from server:**

| `type` | Payload | Description |
|---|---|---|
| `state` | `{ match }` | Full match state snapshot (sent on connect) |
| `board_updated` | `{ board, currentPlayer, winLine, correct }` | After a reveal_answer tx |
| `viewer_count` | `{ count }` | Number of spectators in the room |
| `ping` | `{ t }` | Heartbeat ping — client should reply with `{ type: "pong" }` |

**Events sent by player clients:**

| `type` | Payload | Description |
|---|---|---|
| `board_updated` | `{ board, currentPlayer, winLine, correct }` | Broadcast after a successful turn |
| `pong` | — | Heartbeat reply to server ping |

**Limits:**
- Max payload size: 4 KB per message (larger messages are dropped).
- Rate limit: 60 messages per 30-second window per connection.
- Spectators: cannot send messages (all spectator messages are dropped).
- Heartbeat: server sends ping every 30 seconds; clients idle for 90 seconds are force-disconnected.

---

## Error Response Format

All REST errors follow this shape:

```json
{
  "error": "Human-readable error message",
  "details": { ... }
}
```

`details` is only included for Zod validation errors and contains the full Zod flatten output.

## HTTP Status Codes Used

| Code | Meaning |
|---|---|
| 200 | Success |
| 400 | Invalid request body or query params |
| 404 | Resource not found |
| 410 | Session expired (trivia reveal) |
| 429 | Rate limited (faucet) |
| 500 | Internal server error |
