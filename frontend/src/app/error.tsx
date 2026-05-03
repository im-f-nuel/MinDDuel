'use client'

import { useEffect } from 'react'
import Link from 'next/link'

const INK   = '#1D1D1F'
const BLUE  = '#0071E3'
const RED   = '#FF3B30'
const MUTED = '#6E6E73'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => { console.error(error) }, [error])

  return (
    <div style={{
      minHeight: '100vh', background: '#F5F5F7',
      fontFamily: "'Inter', system-ui, sans-serif",
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 36 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: INK, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 11, height: 11, borderRadius: 6, background: BLUE, boxShadow: `4px 0 0 ${RED}`, transform: 'translateX(-2px)' }} />
        </div>
        <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: -0.4, color: INK }}>MindDuel</span>
      </div>

      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <div style={{ width: 80, height: 80, borderRadius: 24, background: '#FDECEB', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <svg width="36" height="36" viewBox="0 0 32 32" fill="none">
            <path d="M16 11v7M16 22v1" stroke="#FF3B30" strokeWidth="2.5" strokeLinecap="round"/>
            <path d="M13.5 5.5L3 24a3.3 3.3 0 002.9 5h20.2a3.3 3.3 0 002.9-5L18.5 5.5a3.3 3.3 0 00-5 0z" stroke="#FF3B30" strokeWidth="2" fill="none" strokeLinejoin="round"/>
          </svg>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: INK, margin: '0 0 8px', letterSpacing: -0.5 }}>
          Something went wrong
        </h1>
        <p style={{ fontSize: 14, color: MUTED, margin: '0 0 32px', lineHeight: 1.5 }}>
          {error.digest ? `Error ref: ${error.digest}` : 'An unexpected error occurred. Try refreshing the page.'}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button
            onClick={reset}
            style={{ appearance: 'none', border: 'none', padding: '12px 24px', background: BLUE, color: '#fff', borderRadius: 12, fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,113,227,0.25)' }}
          >
            Try again
          </button>
          <Link
            href="/"
            style={{ display: 'inline-flex', alignItems: 'center', padding: '12px 24px', background: '#fff', color: INK, borderRadius: 12, fontSize: 14, fontWeight: 600, textDecoration: 'none', boxShadow: '0 0 0 1.5px rgba(0,0,0,0.10)' }}
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  )
}
