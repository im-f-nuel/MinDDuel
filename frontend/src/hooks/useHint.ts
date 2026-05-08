'use client'

import { useState, useCallback } from 'react'
import { PublicKey } from '@solana/web3.js'
import { useAnchorClient } from './useAnchorClient'
import { claimHint, type HintId } from '@/lib/anchor-client'

export type { HintId }

export interface HintState {
  loading: boolean
  error: string | null
  /** Returns true on success, false on failure (error string set in `error`). */
  purchase: (playerOnePubkey: PublicKey, hintId: HintId) => Promise<boolean>
}

export function useHint(): HintState {
  const client = useAnchorClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const purchase = useCallback(async (playerOnePubkey: PublicKey, hintId: HintId): Promise<boolean> => {
    if (!client) {
      setError('Wallet not connected')
      return false
    }
    setLoading(true)
    setError(null)
    try {
      await claimHint(client, client.provider.wallet.publicKey, playerOnePubkey, hintId)
      return true
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Transaction failed'
      if (msg.includes('User rejected')) {
        setError('Cancelled')
      } else {
        setError(msg)
      }
      return false
    } finally {
      setLoading(false)
    }
  }, [client])

  return { loading, error, purchase }
}
