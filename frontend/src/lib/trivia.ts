export interface TriviaQuestion {
  id: string
  question: string
  options: string[]
  correctIndex: number
  category: string
  timeLimit: number
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export async function fetchTrivia(
  category = 'any',
  difficulty = 'medium',
  amount = 5,
): Promise<TriviaQuestion[]> {
  const params = new URLSearchParams({ category, difficulty, amount: String(amount) })
  const res = await fetch(`${API_BASE}/trivia?${params}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Trivia API error: ${res.status}`)
  const data: { questions: TriviaQuestion[] } = await res.json()
  return data.questions
}

/** Generate a cryptographically random 32-byte nonce. */
export function generateNonce(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32))
}

/**
 * SHA-256 hash of [answerIndex, ...nonce32Bytes] — matches on-chain reveal_answer preimage.
 * Returns 32-byte hash as Uint8Array.
 */
export async function createAnswerHashAsync(
  answerIndex: number,
  nonce: Uint8Array,
): Promise<Uint8Array> {
  const preimage = new Uint8Array(33)
  preimage[0] = answerIndex
  preimage.set(nonce, 1)
  const hashBuffer = await crypto.subtle.digest('SHA-256', preimage)
  return new Uint8Array(hashBuffer)
}

/** Encode Uint8Array to hex string (for display / storage in localStorage). */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

/** Decode hex string to Uint8Array. */
export function hexToBytes(hex: string): Uint8Array {
  const result = new Uint8Array(hex.length / 2)
  for (let i = 0; i < result.length; i++) {
    result[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return result
}
