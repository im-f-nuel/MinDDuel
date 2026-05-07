'use client'

import { useEffect, useState } from 'react'
import type { PublicKey } from '@solana/web3.js'

export interface OnChainGameState {
  playerOne: PublicKey
  playerTwo: PublicKey
  board: string[]
  currentPlayer: string
  status: string
  potLamports: string
}

export interface GameStateResult {
  account: OnChainGameState | null
  loading: boolean
  error: string | null
}

export function useGameState(matchId: string): GameStateResult {
  const [account, setAccount] = useState<OnChainGameState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!matchId || matchId.startsWith('vs-ai-')) {
      setLoading(false)
      return
    }
    // TODO: subscribe to GameAccount PDA via Solana RPC WebSocket
    // const [gameKey] = findGamePDA(new PublicKey(matchId))
    // const sub = connection.onAccountChange(gameKey, (info) => {
    //   setAccount(program.coder.accounts.decode('GameAccount', info.data))
    // })
    // return () => connection.removeAccountChangeListener(sub)
    setLoading(false)
  }, [matchId])

  return { account, loading, error }
}
