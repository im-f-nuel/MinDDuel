'use client'

import { useEffect, useState } from 'react'
import type { GameAccount } from '@/lib/anchor-client'

export interface GameStateResult {
  account: GameAccount | null
  loading: boolean
  error: string | null
}

export function useGameState(matchId: string): GameStateResult {
  const [account, setAccount] = useState<GameAccount | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!matchId || matchId === 'demo-match-id') {
      setLoading(false)
      return
    }
    // TODO: subscribe to GameAccount PDA via Solana RPC WebSocket
    // const [gameKey] = findGamePDA(playerOne, playerTwo)
    // const sub = connection.onAccountChange(gameKey, (info) => {
    //   setAccount(program.coder.accounts.decode('GameAccount', info.data))
    // })
    // return () => connection.removeAccountChangeListener(sub)
    setLoading(false)
  }, [matchId])

  return { account, loading, error }
}
