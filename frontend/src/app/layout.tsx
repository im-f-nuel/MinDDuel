import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ClientProviders } from '@/components/ClientProviders'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'MindDuel — Prove Your Mind. Win On-Chain.',
  description: 'Trivia-gated PvP Tic Tac Toe with real SOL wagering on Solana.',
  keywords: ['solana', 'web3', 'game', 'pvp', 'trivia', 'nft'],
  openGraph: {
    title: 'MindDuel',
    description: 'Prove Your Mind. Win On-Chain.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-bg-base text-ink antialiased">
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  )
}
