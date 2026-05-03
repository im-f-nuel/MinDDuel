'use client'

import { useEffect } from 'react'

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
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <div style={{ width: 72, height: 72, borderRadius: 22, background: '#FDECEB', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path d="M16 11v7M16 22v1" stroke="#FF3B30" strokeWidth="2.5" strokeLinecap="round"/>
            <path d="M13.5 5.5L3 24a3.3 3.3 0 002.9 5h20.2a3.3 3.3 0 002.9-5L18.5 5.5a3.3 3.3 0 00-5 0z" stroke="#FF3B30" strokeWidth="2" fill="none" strokeLinejoin="round"/>
          </svg>
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: '#1D1D1F', margin: '0 0 8px', letterSpacing: -0.4 }}>
          Something went wrong
        </h1>
        <p style={{ fontSize: 14, color: '#6E6E73', margin: '0 0 28px', lineHeight: 1.5 }}>
          {error.digest ? `Reference: ${error.digest}` : 'An unexpected error occurred.'}
        </p>
        <button
          onClick={reset}
          style={{
            appearance: 'none', border: 'none',
            padding: '12px 28px', background: '#0071E3', color: '#fff',
            borderRadius: 12, fontSize: 14, fontWeight: 600,
            fontFamily: 'inherit', cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(0,113,227,0.25)',
          }}
        >
          Try again
        </button>
      </div>
    </div>
  )
}
