'use client'

/**
 * Reusable colored-circle icons used in empty/error/info states across pages.
 * Replaces inline emojis (⚠️, 🔌, 🎮, 🏆, 🏅) for consistent visual language.
 */

interface IconProps {
  size?:    number
  bgSize?:  number
  bg?:      string
  fg?:      string
}

function IconBubble({ size = 56, bg, children }: { size?: number; bg: string; children: React.ReactNode }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: Math.round(size * 0.3),
      background: bg, color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      margin: '0 auto 14px',
    }}>{children}</div>
  )
}

export function StateIconAlert({ size = 56, bg = '#FDECEB', fg = '#A81C13' }: IconProps & { fg?: string }) {
  return (
    <IconBubble size={size} bg={bg}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={fg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    </IconBubble>
  )
}

export function StateIconWallet({ size = 56, bg = '#E5F0FD' }: IconProps) {
  return (
    <IconBubble size={size} bg={bg}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0071E3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/>
        <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>
        <path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>
      </svg>
    </IconBubble>
  )
}

export function StateIconTrophy({ size = 56, bg = '#FFF4E0' }: IconProps) {
  return (
    <IconBubble size={size} bg={bg}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#8A5A00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
        <path d="M4 22h16"/>
        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
      </svg>
    </IconBubble>
  )
}

export function IconEject({ size = 14, color = '#FF3B30' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 6 }}>
      <path d="M5 9l7-7 7 7"/>
      <line x1="5" y1="15" x2="19" y2="15"/>
      <line x1="5" y1="19" x2="19" y2="19"/>
    </svg>
  )
}

export function IconViewers({ size = 12, color = '#6E6E73' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'inline-block', verticalAlign: '-1px' }}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  )
}
