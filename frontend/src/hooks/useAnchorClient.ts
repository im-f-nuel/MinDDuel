'use client'

import { useMemo } from 'react'
import type { AnchorClient } from '@/lib/anchor-client'

export function useAnchorClient(): AnchorClient | null {
  // TODO: wire up with useWallet() + useConnection() from @solana/wallet-adapter-react
  // const { wallet } = useWallet()
  // const { connection } = useConnection()
  // return useMemo(
  //   () => (wallet?.adapter.connected ? buildAnchorClient(wallet.adapter, connection) : null),
  //   [wallet, connection],
  // )
  return useMemo(() => null, [])
}
