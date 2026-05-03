'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const INK  = '#1D1D1F'
const MUTED = '#6E6E73'
const BLUE  = '#0071E3'
const GREEN = '#34C759'
const RED   = '#FF3B30'

interface WalletButtonProps {
  className?: string
}

export function WalletButton({ className }: WalletButtonProps) {
  const [connected, setConnected]   = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [showMenu, setShowMenu]     = useState(false)
  const address = '0x44…8e'
  const balance = 4.218

  async function handleConnect() {
    setConnecting(true)
    await new Promise(r => setTimeout(r, 1100))
    setConnecting(false)
    setConnected(true)
  }

  if (!connected) {
    return (
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        onClick={handleConnect}
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
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{address}</span>
        <span style={{ opacity: 0.7, fontVariantNumeric: 'tabular-nums' }}>{balance.toFixed(2)} SOL</span>
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
            {[
              { label: '↗ View on Explorer', color: INK },
              { label: '⎘ Copy Address',      color: INK },
            ].map(item => (
              <button key={item.label} onClick={() => setShowMenu(false)} style={{ appearance: 'none', border: 'none', display: 'block', width: '100%', padding: '9px 12px', background: 'transparent', borderRadius: 10, textAlign: 'left', fontSize: 13, fontWeight: 500, color: item.color, cursor: 'pointer', fontFamily: 'inherit', transition: 'background 120ms ease' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F5F5F7')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {item.label}
              </button>
            ))}
            <div style={{ height: 0.5, background: 'rgba(0,0,0,0.06)', margin: '4px 0' }} />
            <button
              onClick={() => { setConnected(false); setShowMenu(false) }}
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
