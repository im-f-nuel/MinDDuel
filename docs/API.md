# API Reference

| | |
|---|---|
| **Base URL (production)** | `https://api.mindduel.app` |
| **Base URL (local)** | `http://localhost:3001` |
| **Framework** | Fastify + Zod input validation |
| **CORS** | Restricted to `localhost:3000`, `mindduel.app`, and Vercel previews (`ALLOW_VERCEL_PREVIEW=1`) |

All request bodies must be `Content-Type: application/json`. All error responses follow a standard shape (see [Error Format](#error-response-format)).

---

## Health Check

### `GET /health`

Returns server status and version.

**Response `200`:**

```json
{
  "status": "ok",
  "timestamp": 1746000000000,
  "version": "0.1.0"
}
```

```bash
curl https://api.mindduel.app/health
```

---

## Trivia

### `GET /api/trivia/question`

Fetch a random trivia question for the current turn. The correct answer index is **never** returned — only the `sessionId` needed for the reveal step.

**Query Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `categories` | `string` | No | Comma-separated filter. Valid values: `General Knowledge`, `Crypto & Web3`, `Science`, `History`, `Math`, `Pop Culture` |
| `difficulty` | `string` | No | `easy`, `medium`, or `hard` |

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

> `commitHash` is the backend's server-side hash of the correct answer, provided for informational purposes. The on-chain commitment is computed independently by the client using the player's chosen answer and a fresh random nonce.

```bash
curl "http://localhost:3001/api/trivia/question?categories=Crypto+%26+Web3&difficulty=medium"
```

---

### `POST /api/trivia/reveal`

Submit the player's answer after the on-chain `commitAnswer` transaction has confirmed. Returns whether the answer was correct and reveals the correct index.

**Request body:**

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

**Response `200` — correct:**

```json
{ "correct": true, "correctIndex": 1 }
```

**Response `200` — wrong:**

```json
{ "correct": false, "correctIndex": 1 }
```

**Response `410` — session expired:**

```json
{ "error": "Session expired or not found" }
```

Sessions expire after **10 minutes**. If the session expires (wallet delay, network issue), the player should fetch a new question.

```bash
curl -X POST http://localhost:3001/api/trivia/reveal \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"a3f2c1d4e5b6","answerIndex":1}'
```

---

### `GET /api/trivia/peek`

Retrieve partial hint information for an active session. The caller is expected to have already paid for the hint on-chain before calling this endpoint.

**Query Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `sessionId` | `string` | Yes | Active session ID |
| `type` | `string` | Yes | `eliminate2` or `first-letter` |

**Response `200` — eliminate2:**

```json
{
  "type": "eliminate2",
  "wrongIndices": [0, 3]
}
```

**Response `200` — first-letter:**

```json
{
  "type": "first-letter",
  "firstLetter": "P"
}
```

**Response `410`:**

```json
{ "error": "Session expired or hint type already peeked" }
```

Each peek type can only be used once per session.

---

### `GET /api/trivia/categories`

List all available question categories with their current question counts.

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

---

## Match Management

### `POST /api/match/create`

Create a private match. Returns a join code the creator shares with their opponent.

**Request body:**

```json
{
  "playerOne": "7ZQmH5aBcDe...",
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
| `currency` | `string` | `sol` or `usdc` | `sol` |

**Response `200`:**

```json
{
  "matchId": "AB12CD",
  "joinCode": "MNDL-A1B2C3",
  "status": "waiting"
}
```

---

### `POST /api/match/join`

Join a private match using the join code.

**Request body:**

```json
{
  "joinCode": "MNDL-A1B2C3",
  "playerTwo": "9XzKpQ..."
}
```

| Field | Type | Validation |
|---|---|---|
| `joinCode` | `string` | Pattern: `^MNDL-[A-F0-9]{6}$` |
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
{ "error": "Match not found, already started, or join code invalid" }
```

---

### `GET /api/match/:matchId`

Retrieve current match state from the database.

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

---

### `POST /api/match/queue`

Join the matchmaking queue for automatic opponent pairing.

**Request body:**

```json
{
  "playerId": "7ZQmH5...",
  "mode": "classic",
  "stake": 0.05,
  "currency": "sol",
  "categories": ["Crypto & Web3", "Science"]
}
```

**Response `200` — queued (no immediate match):**

```json
{ "status": "queued", "queueLength": 3 }
```

**Response `200` — matched instantly:**

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

**Request body:** `{ "playerId": "7ZQmH5..." }`

**Response `200`:** `{ "ok": true, "queueLength": 2 }`

---

### `GET /api/match/queue/status`

Check the current queue depth.

**Response `200`:** `{ "queueLength": 4 }`

---

### `GET /api/match/player/:playerId`

Find the active match for a given player (used to poll for matchmaking results).

**Response `200`:** `{ "matchId": "AB12CD", "status": "active" }`

**Response `404`:** `{ "error": "No active match" }`

---

### `POST /api/match/finish`

Report a match result to the database after on-chain settlement. The blockchain is the source of truth — this call only syncs the database for leaderboard and history queries.

**Request body:**

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
| `pot` | `number` | Yes | Total pot in SOL / USDC |
| `fee` | `number` | Yes | Platform fee deducted |
| `onChainSig` | `string \| null` | No | Settlement transaction signature |

**Response `200`:**

```json
{
  "ok": true,
  "earnedBadges": ["first_blood", "high_roller"]
}
```

`earnedBadges` lists badge types awarded to the winner for this match.

---

### `POST /api/match/vsai`

Record a vs-AI practice match result.

**Request body:**

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
| `result` | `string` | `win`, `loss`, or `draw` |

**Response `200`:** `{ "ok": true, "matchId": "A1B2C3" }`

---

## Leaderboard and Statistics

### `GET /api/stats`

Live platform statistics derived from the database.

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
| `period` | `string` | `alltime` | `alltime`, `weekly`, or `daily` (display label only) |
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

```bash
curl "http://localhost:3001/api/leaderboard?limit=10"
```

---

### `GET /api/history/:player`

Match history for a specific wallet address.

**Path parameter:** `:player` — Solana wallet public key (base58)

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

`status` is `"minted"` when `mintAddr` is populated, otherwise `"pending"`.

---

## Tournament

### `POST /api/tournament/create`

Create a new tournament bracket.

**Request body:**

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
| `size` | `number` | `4` or `8` |
| `stake` | `number` | min 0 |
| `currency` | `string` | `sol` or `usdc` |
| `mode` | `string` | `classic`, `shifting`, `scaleup`, or `blitz` |
| `createdBy` | `string` | min length 1 |

**Response `200`:** Tournament object with `id`, `name`, `size`, `status`, and participant list.

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

Get a single tournament's full details.

---

### `GET /api/tournament/:id/bracket`

Get the match bracket for a tournament.

**Response `200`:**

```json
{
  "tournamentId": "T-001",
  "bracket": [
    {
      "round": 1,
      "matchId": "BK-01",
      "player1": "7ZQm...",
      "player2": "9Xzk...",
      "winner": null
    }
  ]
}
```

---

### `POST /api/tournament/:id/join`

Join an open tournament.

**Request body:** `{ "player": "7ZQmH5..." }`

**Response `200`:**

```json
{
  "ok": true,
  "started": false,
  "tournament": { ... }
}
```

`started: true` if joining this player filled the bracket and the first round was generated automatically.

---

## Faucet (Devnet Only)

### `POST /api/faucet`

Request a free airdrop of mock USDC for devnet testing. Rate-limited to one request per wallet per 24 hours.

**Request body:** `{ "wallet": "7ZQmH5..." }`

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

---

## Sponsor (Gasless Transactions)

### `GET /api/sponsor/pubkey`

Get the sponsor's fee-payer public key. Returns `null` if the sponsor keypair is not configured.

**Response `200`:**

```json
{ "pubkey": "SponsorAddr..." }
```

---

### `POST /api/sponsor/sign-tx`

Submit a partially-built, unsigned transaction for the sponsor to cosign as fee payer. Returns the transaction with the sponsor's signature attached. The frontend wallet then adds the required user signature(s).

**Request body:**

```json
{ "wireBase64": "AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAQMi..." }
```

**Response `200`:**

```json
{ "signedBase64": "AQAAA..." }
```

---

## WebSocket

### `WS /ws/:matchId`

Connect to a game room for real-time board updates and viewer counts.

**URL parameters:**

| Parameter | Description |
|---|---|
| `:matchId` | Match ID returned by `match/create` or `match/join` |
| `?role=spectator` | Optional. Marks the connection as read-only |

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
| `state` | `{ match }` | Full match state snapshot — sent immediately on connect |
| `board_updated` | `{ board, currentPlayer, winLine, correct }` | Emitted after a successful `revealAnswer` |
| `viewer_count` | `{ count }` | Current spectator count — sent on connect and on change |
| `ping` | `{ t }` | Heartbeat — client must reply with `{ type: "pong" }` |

**Events sent by player clients:**

| `type` | Payload | Description |
|---|---|---|
| `board_updated` | `{ board, currentPlayer, winLine, correct }` | Broadcast after a successful turn |
| `pong` | — | Heartbeat reply |

**Connection limits:**

| Limit | Value |
|---|---|
| Max payload size | 4 KB — larger messages are silently dropped |
| Rate limit | 60 messages per 30-second window per connection |
| Spectator write | Silently dropped — spectators are read-only |
| Idle timeout | Connections idle for 90 seconds are force-disconnected |
| Heartbeat interval | Server sends `ping` every 30 seconds |

---

## Error Response Format

All REST errors use this shape:

```json
{
  "error": "Human-readable error message",
  "details": { }
}
```

`details` is only included for Zod validation errors and contains the full `flatten()` output.

### HTTP Status Codes

| Code | Meaning |
|---|---|
| `200` | Success |
| `400` | Invalid request body or query parameters |
| `404` | Resource not found |
| `410` | Session expired (trivia reveal) |
| `429` | Rate limited (faucet) |
| `500` | Internal server error |
