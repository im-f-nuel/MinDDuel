'use client'

import { useState, useCallback } from 'react'
import { generateNonce, createAnswerHashAsync } from '@/lib/trivia'

export interface TriviaCommit {
  nonce: Uint8Array
  answerIndex: number
  hash: Uint8Array
}

export interface TriviaSession {
  pending: TriviaCommit | null
  /** Prepare commit for the given answer. Returns commit data for on-chain use. */
  prepare: (answerIndex: number) => Promise<TriviaCommit>
  clear: () => void
}

export function useTriviaSession(): TriviaSession {
  const [pending, setPending] = useState<TriviaCommit | null>(null)

  const prepare = useCallback(async (answerIndex: number): Promise<TriviaCommit> => {
    const nonce = generateNonce()
    const hash  = await createAnswerHashAsync(answerIndex, nonce)
    const commit: TriviaCommit = { nonce, answerIndex, hash }
    setPending(commit)
    return commit
  }, [])

  const clear = useCallback(() => setPending(null), [])

  return { pending, prepare, clear }
}
