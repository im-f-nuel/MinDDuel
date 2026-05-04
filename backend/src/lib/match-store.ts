import { randomBytes } from 'crypto'

export type MatchStatus = 'waiting' | 'active' | 'finished'

export interface MatchState {
  matchId: string
  joinCode: string
  playerOne: string
  playerTwo: string | null
  mode: string
  stake: number
  status: MatchStatus
  board: (string | null)[]
  currentPlayer: 'X' | 'O'
  turn: number
  winner: string | null
  createdAt: number
  updatedAt: number
}

const matches = new Map<string, MatchState>()
const codeIndex = new Map<string, string>()
const queue: string[] = []

function makeId(): string {
  return randomBytes(6).toString('hex').toUpperCase()
}

function makeCode(): string {
  return `MNDL-${randomBytes(3).toString('hex').toUpperCase()}`
}

export function createMatch(playerOne: string, mode: string, stake: number): MatchState {
  const matchId = makeId()
  const joinCode = makeCode()
  const match: MatchState = {
    matchId,
    joinCode,
    playerOne,
    playerTwo: null,
    mode,
    stake,
    status: 'waiting',
    board: Array(9).fill(null),
    currentPlayer: 'X',
    turn: 0,
    winner: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  matches.set(matchId, match)
  codeIndex.set(joinCode, matchId)
  return match
}

export function joinByCode(joinCode: string, playerTwo: string): MatchState | null {
  const matchId = codeIndex.get(joinCode)
  if (!matchId) return null
  const match = matches.get(matchId)
  if (!match || match.status !== 'waiting' || match.playerOne === playerTwo) return null
  match.playerTwo = playerTwo
  match.status = 'active'
  match.updatedAt = Date.now()
  return match
}

export function getMatch(matchId: string): MatchState | null {
  return matches.get(matchId) ?? null
}

// ── Matchmaking queue ──────────────────────────────────────────────────
export interface QueueResult {
  status: 'waiting' | 'matched'
  matchId?: string
  position?: number
}

export function enqueue(playerId: string, mode: string, stake: number): QueueResult {
  const existingIdx = queue.indexOf(playerId)
  if (existingIdx !== -1) {
    return { status: 'waiting', position: existingIdx + 1 }
  }

  if (queue.length > 0) {
    const opponentId = queue.shift()!
    const match = createMatch(opponentId, mode, stake)
    match.playerTwo = playerId
    match.status = 'active'
    match.updatedAt = Date.now()
    return { status: 'matched', matchId: match.matchId }
  }

  queue.push(playerId)
  return { status: 'waiting', position: queue.length }
}

export function dequeue(playerId: string): void {
  const idx = queue.indexOf(playerId)
  if (idx !== -1) queue.splice(idx, 1)
}

export function queueLength(): number {
  return queue.length
}

export function getMatchForPlayer(playerId: string): MatchState | null {
  for (const match of matches.values()) {
    if ((match.playerOne === playerId || match.playerTwo === playerId) && match.status === 'active') {
      return match
    }
  }
  return null
}
