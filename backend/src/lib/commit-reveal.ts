import { createHash, randomBytes } from 'crypto'

interface CommitSession {
  questionId: string
  correctIndex: number
  salt: string
  hash: string
  expiresAt: number
}

// In production this lives on-chain (answer_hash stored in GameAccount PDA).
// For hackathon demo the server holds it in memory with a TTL.
const sessions = new Map<string, CommitSession>()

// Prune expired sessions every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [id, s] of sessions) {
    if (now > s.expiresAt) sessions.delete(id)
  }
}, 300_000)

export function createCommit(questionId: string, correctIndex: number): { sessionId: string; hash: string } {
  const salt = randomBytes(16).toString('hex')
  const hash = createHash('sha256')
    .update(`${correctIndex}:${salt}`)
    .digest('hex')
  const sessionId = randomBytes(16).toString('hex')
  sessions.set(sessionId, {
    questionId,
    correctIndex,
    salt,
    hash,
    expiresAt: Date.now() + 120_000,
  })
  return { sessionId, hash }
}

export interface RevealResult {
  correct: boolean
  correctIndex: number
}

export function revealCommit(sessionId: string, answerIndex: number): RevealResult | null {
  const session = sessions.get(sessionId)
  if (!session || Date.now() > session.expiresAt) return null
  sessions.delete(sessionId)
  return { correct: answerIndex === session.correctIndex, correctIndex: session.correctIndex }
}

/**
 * Look up the correct index for a session WITHOUT consuming it. Used by
 * the hint reveal endpoint after a player has paid for a hint on-chain.
 * Returns null if the session expired.
 */
export function peekCommit(sessionId: string): { questionId: string; correctIndex: number } | null {
  const session = sessions.get(sessionId)
  if (!session || Date.now() > session.expiresAt) return null
  return { questionId: session.questionId, correctIndex: session.correctIndex }
}
