'use client'

import { useState, useCallback } from 'react'
import { useAnchorClient } from './useAnchorClient'

export type HintId = 'eliminate2' | 'category' | 'extra-time' | 'first-letter' | 'skip'

export interface HintState {
  loading: boolean
  error: string | null
  purchase: (matchId: string, hintId: HintId) => Promise<boolean>
}

export function useHint(): HintState {
  const client = useAnchorClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const purchase = useCallback(async (_matchId: string, _hintId: HintId): Promise<boolean> => {
    if (!client) {
      setError('Wallet not connected')
      return false
    }
    setLoading(true)
    setError(null)
    try {
      // TODO: await client.program.methods.claimHint({ [hintId]: {} })
      //   .accounts({ game: gamePDA, player: wallet.publicKey, ... })
      //   .rpc()
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Transaction failed')
      return false
    } finally {
      setLoading(false)
    }
  }, [client])

  return { loading, error, purchase }
}
