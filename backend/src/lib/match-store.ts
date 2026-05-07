import { randomBytes } from 'crypto'
import { eq, and, or, desc, sql } from 'drizzle-orm'
import { db } from './db.js'
import { matches, queue } from './schema.js'

export type MatchStatus = 'waiting' | 'active' | 'finished'
export type MatchCurrency = 'sol' | 'usdc'

/**
 * Public shape kept compatible with the previous in-memory store so
 * the rest of the backend (routes, websocket) does not need changes.
 *
 * The on-chain board / currentPlayer / winner are derived from the
 * Anchor program; for the cache we only store enough metadata for
 * lobby, queue, leaderboard, and per-player history queries.
 */
export interface MatchState {
  matchId:       string
  joinCode:      string
  playerOne:     string
  playerTwo:     string | null
  mode:          string
  stake:         number
  currency:      MatchCurrency
  status:        MatchStatus
  // Board fields kept for type compatibility — not persisted (on-chain authoritative)
  board:         (string | null)[]
  currentPlayer: 'X' | 'O'
  turn:          number
  winner:        string | null
  createdAt:     number
  updatedAt:     number
}

function rowToState(row: typeof matches.$inferSelect): MatchState {
  return {
    matchId:       row.matchId,
    joinCode:      row.joinCode,
    playerOne:     row.playerOne,
    playerTwo:     row.playerTwo,
    mode:          row.mode,
    stake:         row.stake,
    currency:      row.currency as MatchCurrency,
    status:        row.status as MatchStatus,
    winner:        row.winner,
    createdAt:     row.createdAt,
    updatedAt:     row.updatedAt,
    board:         Array(9).fill(null),
    currentPlayer: 'X',
    turn:          0,
  }
}

function makeId(): string {
  return randomBytes(6).toString('hex').toUpperCase()
}

function makeCode(): string {
  return `MNDL-${randomBytes(3).toString('hex').toUpperCase()}`
}

export async function createMatch(
  playerOne: string,
  mode: string,
  stake: number,
  currency: MatchCurrency = 'sol',
): Promise<MatchState> {
  const matchId = makeId()
  const joinCode = makeCode()
  const now = Date.now()
  const [row] = await db.insert(matches).values({
    matchId, joinCode, playerOne, playerTwo: null,
    mode, stake, currency, status: 'waiting',
    createdAt: now, updatedAt: now,
  }).returning()
  return rowToState(row)
}

export async function joinByCode(joinCode: string, playerTwo: string): Promise<MatchState | null> {
  const [row] = await db.select().from(matches).where(eq(matches.joinCode, joinCode)).limit(1)
  if (!row) return null
  if (row.status !== 'waiting' || row.playerOne === playerTwo) return null

  const now = Date.now()
  const [updated] = await db.update(matches)
    .set({ playerTwo, status: 'active', updatedAt: now })
    .where(eq(matches.matchId, row.matchId))
    .returning()
  return rowToState(updated)
}

export async function getMatch(matchId: string): Promise<MatchState | null> {
  const [row] = await db.select().from(matches).where(eq(matches.matchId, matchId)).limit(1)
  return row ? rowToState(row) : null
}

export async function finishMatch(
  matchId: string,
  winner: string | null,
  pot: number,
  fee: number,
  onChainSig: string | null,
): Promise<void> {
  const now = Date.now()
  await db.update(matches)
    .set({ status: 'finished', winner, pot, fee, onChainSig, finishedAt: now, updatedAt: now })
    .where(eq(matches.matchId, matchId))
}

// ── Matchmaking queue ──────────────────────────────────────────────────
export interface QueueResult {
  status: 'waiting' | 'matched'
  matchId?: string
  position?: number
  /** Categories both players agreed on — only present when status='matched'. */
  sharedCategories?: string[]
}

/**
 * Returns shared categories between two players' preferences. If either side
 * has no preference (null/empty), the other side's preferences are used.
 * If both have preferences but no overlap, returns empty array (no match).
 */
function intersectCategories(a: string[] | null, b: string[] | null): string[] | null {
  if (!a || a.length === 0) return b
  if (!b || b.length === 0) return a
  const set = new Set(a)
  const both = b.filter(c => set.has(c))
  return both.length > 0 ? both : null   // null signals "no overlap, can't match"
}

function parseCategories(raw: string | null): string[] | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) && v.length > 0 ? v as string[] : null
  } catch { return null }
}

export async function enqueue(
  playerId: string,
  mode: string,
  stake: number,
  currency: MatchCurrency = 'sol',
  categories: string[] | null = null,
): Promise<QueueResult> {
  // Already in queue?
  const [existing] = await db.select().from(queue).where(eq(queue.playerId, playerId)).limit(1)
  if (existing) {
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(queue)
    return { status: 'waiting', position: count }
  }

  // Find opponents matching mode + currency + EXACT stake (oldest first).
  // Stake fairness matters: a player who staked 0.05 SOL should never be
  // paired with someone who staked 1.0 SOL.
  const candidates = await db.select().from(queue)
    .where(and(
      eq(queue.mode, mode),
      eq(queue.currency, currency),
      eq(queue.stake, stake),
    ))
    .orderBy(queue.joinedAt)

  // Among candidates, pick the first one whose category preferences
  // intersect with this player's. This way two players who both selected
  // Math/Science play on Math/Science questions, not random.
  const myCats = categories && categories.length > 0 ? categories : null
  let opponent: typeof candidates[number] | null = null
  let sharedCategories: string[] | null = null
  for (const c of candidates) {
    const theirCats = parseCategories(c.categories)
    const shared = intersectCategories(myCats, theirCats)
    if (shared !== null) {     // null = no overlap, skip
      opponent = c
      sharedCategories = shared
      break
    }
  }

  if (opponent) {
    await db.delete(queue).where(eq(queue.playerId, opponent.playerId))
    const match = await createMatch(opponent.playerId, mode, stake, currency)
    const now = Date.now()
    await db.update(matches)
      .set({ playerTwo: playerId, status: 'active', updatedAt: now })
      .where(eq(matches.matchId, match.matchId))
    return {
      status: 'matched',
      matchId: match.matchId,
      sharedCategories: sharedCategories ?? [],
    }
  }

  await db.insert(queue).values({
    playerId, mode, stake, currency,
    categories: myCats ? JSON.stringify(myCats) : null,
    joinedAt: Date.now(),
  })
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(queue)
  return { status: 'waiting', position: count }
}

export async function dequeue(playerId: string): Promise<void> {
  await db.delete(queue).where(eq(queue.playerId, playerId))
}

export async function queueLength(): Promise<number> {
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(queue)
  return count
}

export async function getMatchForPlayer(playerId: string): Promise<MatchState | null> {
  const [row] = await db.select().from(matches)
    .where(and(
      eq(matches.status, 'active'),
      or(eq(matches.playerOne, playerId), eq(matches.playerTwo, playerId)),
    ))
    .orderBy(desc(matches.createdAt))
    .limit(1)
  return row ? rowToState(row) : null
}

// ── Live stats ─────────────────────────────────────────────────────────
export interface LiveStats {
  activeMatches:      number
  waitingMatches:     number
  totalLockedSol:     number
  totalLockedUsdc:    number
  wageredLast24hSol:  number
  wageredLast24hUsdc: number
  finishedTotal:      number
  queueLength:        number
}

export async function getLiveStats(): Promise<LiveStats> {
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000

  const [stats] = await db.select({
    activeMatches:    sql<number>`count(*) FILTER (WHERE ${matches.status} = 'active')::int`,
    waitingMatches:   sql<number>`count(*) FILTER (WHERE ${matches.status} = 'waiting')::int`,
    finishedTotal:    sql<number>`count(*) FILTER (WHERE ${matches.status} = 'finished')::int`,
    lockedSol:        sql<number>`COALESCE(SUM(${matches.stake} * (CASE WHEN ${matches.playerTwo} IS NULL THEN 1 ELSE 2 END)) FILTER (WHERE ${matches.status} != 'finished' AND ${matches.currency} = 'sol'), 0)::real`,
    lockedUsdc:       sql<number>`COALESCE(SUM(${matches.stake} * (CASE WHEN ${matches.playerTwo} IS NULL THEN 1 ELSE 2 END)) FILTER (WHERE ${matches.status} != 'finished' AND ${matches.currency} = 'usdc'), 0)::real`,
    wagered24Sol:     sql<number>`COALESCE(SUM(${matches.stake} * (CASE WHEN ${matches.playerTwo} IS NULL THEN 1 ELSE 2 END)) FILTER (WHERE ${matches.createdAt} >= ${oneDayAgo} AND ${matches.currency} = 'sol'), 0)::real`,
    wagered24Usdc:    sql<number>`COALESCE(SUM(${matches.stake} * (CASE WHEN ${matches.playerTwo} IS NULL THEN 1 ELSE 2 END)) FILTER (WHERE ${matches.createdAt} >= ${oneDayAgo} AND ${matches.currency} = 'usdc'), 0)::real`,
  }).from(matches)

  const qLen = await queueLength()

  return {
    activeMatches:      stats.activeMatches,
    waitingMatches:     stats.waitingMatches,
    totalLockedSol:     Number(stats.lockedSol),
    totalLockedUsdc:    Number(stats.lockedUsdc),
    wageredLast24hSol:  Number(stats.wagered24Sol),
    wageredLast24hUsdc: Number(stats.wagered24Usdc),
    finishedTotal:      stats.finishedTotal,
    queueLength:        qLen,
  }
}

// ── Leaderboard & history queries ──────────────────────────────────────
export interface LeaderboardRow {
  address:    string
  wins:       number
  matches:    number
  solEarned:  number
  usdcEarned: number
  winRate:    number
}

export async function getLeaderboard(limit = 25): Promise<LeaderboardRow[]> {
  const winnerStats = await db.execute(sql<{ address: string; wins: number; sol_earned: number; usdc_earned: number }>`
    SELECT
      winner AS address,
      COUNT(*)::int AS wins,
      COALESCE(SUM(CASE WHEN currency = 'sol'  THEN COALESCE(pot,0) - COALESCE(fee,0) ELSE 0 END), 0)::real AS sol_earned,
      COALESCE(SUM(CASE WHEN currency = 'usdc' THEN COALESCE(pot,0) - COALESCE(fee,0) ELSE 0 END), 0)::real AS usdc_earned
    FROM matches
    WHERE status = 'finished' AND winner IS NOT NULL
    GROUP BY winner
    ORDER BY wins DESC, sol_earned DESC
    LIMIT ${limit}
  `)

  // Total matches per player for winrate
  const out: LeaderboardRow[] = []
  for (const w of winnerStats as unknown as { address: string; wins: number; sol_earned: number; usdc_earned: number }[]) {
    const [{ total }] = await db.select({
      total: sql<number>`count(*) FILTER (WHERE ${matches.status} = 'finished')::int`,
    }).from(matches).where(or(eq(matches.playerOne, w.address), eq(matches.playerTwo, w.address)))
    out.push({
      address:    w.address,
      wins:       w.wins,
      matches:    total,
      solEarned:  Number(w.sol_earned),
      usdcEarned: Number(w.usdc_earned),
      winRate:    total > 0 ? Math.round((w.wins / total) * 100) : 0,
    })
  }
  return out
}

export interface HistoryRow {
  matchId:    string
  mode:       string
  stake:      number
  currency:   MatchCurrency
  status:     MatchStatus
  result:     'win' | 'loss' | 'draw' | 'pending'
  delta:      number   // SOL/USDC won (+) or lost (-) for this player
  opponent:   string | null
  createdAt:  number
  finishedAt: number | null
}

export async function getHistoryForPlayer(playerId: string, limit = 50): Promise<HistoryRow[]> {
  const rows = await db.select().from(matches)
    .where(or(eq(matches.playerOne, playerId), eq(matches.playerTwo, playerId)))
    .orderBy(desc(matches.createdAt))
    .limit(limit)

  return rows.map((r): HistoryRow => {
    const isPlayerOne = r.playerOne === playerId
    const opponent    = isPlayerOne ? r.playerTwo : r.playerOne

    let result: HistoryRow['result'] = 'pending'
    let delta = 0
    if (r.status === 'finished') {
      if (r.winner === playerId) {
        result = 'win'
        delta  = (r.pot ?? 0) - (r.fee ?? 0) - r.stake // net gain
      } else if (r.winner === null) {
        result = 'draw'
        delta  = 0
      } else {
        result = 'loss'
        delta  = -r.stake
      }
    }

    return {
      matchId:    r.matchId,
      mode:       r.mode,
      stake:      r.stake,
      currency:   r.currency as MatchCurrency,
      status:     r.status as MatchStatus,
      result,
      delta,
      opponent,
      createdAt:  r.createdAt,
      finishedAt: r.finishedAt,
    }
  })
}

// ── Cleanup expired matches (older than 24h waiting) ──────────────────
export async function cleanupExpiredMatches(): Promise<number> {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000
  const deleted = await db.delete(matches)
    .where(and(eq(matches.status, 'waiting'), sql`${matches.createdAt} < ${cutoff}`))
    .returning({ matchId: matches.matchId })
  return deleted.length
}
