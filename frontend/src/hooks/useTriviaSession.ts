'use client'

import { useState, useCallback } from 'react'
import { createAnswerHashAsync } from '@/lib/trivia'

export interface TriviaSession {
  commitHash: string | null
  nonce: string | null
  commit: (answerIndex: number) => Promise<string>
  clear: () => void
}

export function useTriviaSession(): TriviaSession {
  const [commitHash, setCommitHash] = useState<string | null>(null)
  const [nonce, setNonce] = useState<string | null>(null)

  const commit = useCallback(async (answerIndex: number): Promise<string> => {
    const n = crypto.randomUUID()
    const hash = await createAnswerHashAsync(answerIndex, n)
    setNonce(n)
    setCommitHash(hash)
    return hash
    // TODO: after getting hash, call program.methods.commitAnswer(hash).accounts({...}).rpc()
  }, [])

  const clear = useCallback(() => {
    setCommitHash(null)
    setNonce(null)
  }, [])

  return { commitHash, nonce, commit, clear }
}
