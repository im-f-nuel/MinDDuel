'use client'

import { useEffect, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import { useConnection } from '@solana/wallet-adapter-react'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'
import { motion, AnimatePresence } from 'framer-motion'

const INK = '#1D1D1F'
const RED = '#FF3B30'

function shortAddr(pk: string) {
  return pk.slice(0, 4) + '…' + pk.slice(-4)
}

interface WalletButtonProps {
  className?: string
}

export function WalletButton({ className }: WalletButtonProps) {
  const { publicKey, connected, connecting, disconnect } = useWallet()
  const { setVisible } = useWalletModal()
  const { connection } = useConnection()
  const [balance, setBalance] = useState<number | null>(null)
  const [showMenu, setShowMenu] = useState(false)

  useEffect(() => {
    if (!connected || !publicKey) { setBalance(null); return }
    connection.getBalance(publicKey).then(lamports => setBalance(lamports / LAMPORTS_PER_SOL)).catch(() => setBalance(null))
  }, [connected, publicKey, connection])

  if (!connected) {
    return (
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => setVisible(true)}
        disabled={connecting}
        className={className}
        style={{
          appearance: 'none', border: 'none',
          background: INK, color: '#fff',
          padding: '9px 18px', borderRadius: 999,
          fontSize: 13, fontWeight: 600,
          cursor: connecting ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
          display: 'inline-flex', alignItems: 'center', gap: 8,
          opacity: connecting ? 0.7 : 1,
          transition: 'opacity 150ms ease',
        }}
      >
        {connecting ? (
          <>
            <span style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
            Connecting…
          </>
        ) : (
          <>
            <div style={{ width: 18, height: 18, borderRadius: 9, background: 'linear-gradient(135deg, #9945FF, #14F195)' }} />
            Connect Wallet
          </>
        )}
      </motion.button>
    )
  }

  const addr = publicKey!.toBase58()

  return (
    <div style={{ position: 'relative' }}>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => setShowMenu(v => !v)}
        className={className}
        style={{
          appearance: 'none', border: 'none',
          background: INK, color: '#fff',
          padding: '9px 16px', borderRadius: 999,
          fontSize: 13, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'inherit',
          display: 'inline-flex', alignItems: 'center', gap: 8,
        }}
      >
        <div style={{ width: 18, height: 18, borderRadius: 9, background: 'linear-gradient(135deg, #9945FF, #14F195)' }} />
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{shortAddr(addr)}</span>
        {balance !== null && (
          <span style={{ opacity: 0.7, fontVariantNumeric: 'tabular-nums' }}>{balance.toFixed(2)} SOL</span>
        )}
        <svg style={{ width: 12, height: 12, transform: showMenu ? 'rotate(180deg)' : 'none', transition: 'transform 160ms ease', opacity: 0.7 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </motion.button>

      <AnimatePresence>
        {showMenu && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            style={{
              position: 'absolute', right: 0, top: 'calc(100% + 8px)',
              width: 200, background: '#fff', borderRadius: 16,
              boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 0 0 0.5px rgba(0,0,0,0.07)',
              overflow: 'hidden', zIndex: 50, padding: 6,
            }}
          >
            <button
              onClick={() => { navigator.clipboard.writeText(addr); setShowMenu(false) }}
              style={{ appearance: 'none', border: 'none', display: 'block', width: '100%', padding: '9px 12px', background: 'transparent', borderRadius: 10, textAlign: 'left', fontSize: 13, fontWeight: 500, color: INK, cursor: 'pointer', fontFamily: 'inherit', transition: 'background 120ms ease' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F5F5F7')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              ⎘ Copy Address
            </button>
            <button
              onClick={() => { window.open(`https://explorer.solana.com/address/${addr}?cluster=devnet`, '_blank'); setShowMenu(false) }}
              style={{ appearance: 'none', border: 'none', display: 'block', width: '100%', padding: '9px 12px', background: 'transparent', borderRadius: 10, textAlign: 'left', fontSize: 13, fontWeight: 500, color: INK, cursor: 'pointer', fontFamily: 'inherit', transition: 'background 120ms ease' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F5F5F7')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              ↗ View on Explorer
            </button>
            <div style={{ height: 0.5, background: 'rgba(0,0,0,0.06)', margin: '4px 0' }} />
            <button
              onClick={() => { disconnect(); setShowMenu(false) }}
              style={{ appearance: 'none', border: 'none', display: 'block', width: '100%', padding: '9px 12px', background: 'transparent', borderRadius: 10, textAlign: 'left', fontSize: 13, fontWeight: 500, color: RED, cursor: 'pointer', fontFamily: 'inherit', transition: 'background 120ms ease' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#FDECEB')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              ⏏ Disconnect
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
