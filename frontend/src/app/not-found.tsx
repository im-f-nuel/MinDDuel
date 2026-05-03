import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh', background: '#F5F5F7',
      fontFamily: "'Inter', system-ui, sans-serif",
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <div style={{ fontSize: 80, fontWeight: 700, letterSpacing: -4, color: '#1D1D1F', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          404
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: '#1D1D1F', margin: '16px 0 8px', letterSpacing: -0.4 }}>
          Page not found
        </h1>
        <p style={{ fontSize: 15, color: '#6E6E73', margin: '0 0 32px', lineHeight: 1.5 }}>
          This page doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          style={{
            display: 'inline-block', padding: '12px 28px',
            background: '#0071E3', color: '#fff',
            borderRadius: 12, fontSize: 14, fontWeight: 600,
            textDecoration: 'none', boxShadow: '0 4px 14px rgba(0,113,227,0.25)',
          }}
        >
          Back to Home
        </Link>
      </div>
    </div>
  )
}
