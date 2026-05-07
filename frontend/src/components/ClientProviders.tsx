'use client'

import { useMemo } from 'react'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { ToastProvider } from '@/components/ui/Toast'
import { NetworkStatusBanner } from '@/components/NetworkStatus'
import { KeyboardShortcuts } from '@/components/KeyboardShortcuts'
import { ThemeProvider } from '@/components/ThemeProvider'
import { useEffect } from 'react'
import { sounds } from '@/lib/sounds'

import '@solana/wallet-adapter-react-ui/styles.css'

const RPC_ENDPOINT = process.env.NEXT_PUBLIC_RPC_URL ?? 'https://api.devnet.solana.com'

/** Global keyboard handlers that don't need their own UI. */
function GlobalShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return
      if (e.key.toLowerCase() === 'm' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        sounds.toggle()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
  return null
}

export function ClientProviders({ children }: { children: React.ReactNode }) {
  const wallets = useMemo(() => [new PhantomWalletAdapter()], [])

  return (
    <ThemeProvider>
      <ConnectionProvider endpoint={RPC_ENDPOINT}>
        <WalletProvider wallets={wallets} autoConnect>
          <WalletModalProvider>
            <ToastProvider>
              <NetworkStatusBanner />
              <GlobalShortcuts />
              <KeyboardShortcuts />
              {children}
            </ToastProvider>
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </ThemeProvider>
  )
}
