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

// Deterministic hash for commit-reveal — SHA-256 via Web Crypto API
export async function createAnswerHashAsync(answerIndex: number, nonce: string): Promise<string> {
  const payload = new TextEncoder().encode(`${answerIndex}:${nonce}`)
  const hashBuffer = await crypto.subtle.digest('SHA-256', payload)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// Synchronous base64 variant — use only for non-security contexts (UI display)
export function createAnswerHash(answerIndex: number, nonce: string): string {
  return btoa(`${answerIndex}:${nonce}`)
}
