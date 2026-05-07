'use client'

import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useWallet } from '@solana/wallet-adapter-react'
import { NavBar } from '@/components/layout/NavBar'
import { EditProfileModal, EditableProfile } from '@/components/profile/EditProfileModal'
import { fetchBadges, fetchHistory, type BadgeRow } from '@/lib/api'
import { SkeletonBadgeGrid } from '@/components/ui/SkeletonRow'
import { useToast } from '@/components/ui/Toast'

const PROFILE_STORAGE_PREFIX = 'mddProfile:'

function loadStoredProfile(addr: string | undefined, fallbackSeed: string): EditableProfile {
  if (typeof window === 'undefined' || !addr) return { displayName: '', bio: '', avatarSeed: fallbackSeed }
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_PREFIX + addr)
    if (!raw) return { displayName: '', bio: '', avatarSeed: fallbackSeed }
    const parsed = JSON.parse(raw) as Partial<EditableProfile>
    return {
      displayName: parsed.displayName ?? '',
      bio:         parsed.bio         ?? '',
      avatarSeed:  parsed.avatarSeed  ?? fallbackSeed,
    }
  } catch {
    return { displayName: '', bio: '', avatarSeed: fallbackSeed }
  }
}

function saveStoredProfile(addr: string, p: EditableProfile) {
  try { localStorage.setItem(PROFILE_STORAGE_PREFIX + addr, JSON.stringify(p)) } catch {}
}

const BLUE       = '#0071E3'
const INK        = 'var(--mdd-ink)'
const MUTED      = 'var(--mdd-muted)'
const GREEN      = '#34C759'
const GREEN_DARK = '#0A7A2D'
const RED        = '#FF3B30'
const BG = 'var(--mdd-bg)'

type Tab = 'badges' | 'history' | 'earnings'

// ── Mock data ─────────────────────────────────────────────────────────
const PROFILE = {
  addr:   '0x44a8…2c1f',
  seed:   '0x44a8e2c1',
  joined: 'Mar 2025',
  wins:   0,
  rate:   0,
  sol:    0,
  usdc:   0,
  streak: 0,
  best:   0,
}

const BADGES = [
  { id: 'first-blood', name: 'First Blood', date: 'Mar 14', earned: true,  gradient: ['#FF6B6B', '#C92A2A'] },
  { id: 'streak-3',   name: 'Triple',      date: 'Mar 18', earned: true,  gradient: ['#FFB142', '#FF6A00'] },
  { id: 'perfect',    name: 'Flawless',    date: 'Mar 22', earned: true,  gradient: ['#9B5DE5', '#5E3FBE'] },
  { id: 'speed',      name: 'Lightning',   date: 'Apr 02', earned: true,  gradient: ['#4ECDC4', '#1E847F'] },
  { id: 'whale',      name: 'Big Stake',   date: null,     earned: false, gradient: ['#94A3B8', '#475569'] },
  { id: 'dynasty',    name: 'Dynasty',     date: null,     earned: false, gradient: ['#94A3B8', '#475569'] },
  { id: 'polymath',   name: 'Polymath',    date: null,     earned: false, gradient: ['#94A3B8', '#475569'] },
  { id: 'champion',   name: 'Champion',    date: null,     earned: false, gradient: ['#94A3B8', '#475569'] },
]

// ── Badge SVG icons ───────────────────────────────────────────────────
const BADGE_ICONS: Record<string, React.ReactElement> = {
  'first-blood': (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
      <path d="M10 22 L22 10 M19 7 L25 13 L13 25 L7 19 Z"/>
      <path d="M7 25 L10 22"/>
    </svg>
  ),
  'streak-3': (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="#fff">
      <path d="M18 4 C18 4 20 10 16 14 C16 14 18 10 14 8 C14 8 16 16 10 20 C10 20 10 14 8 16 C8 16 6 24 14 27 C22 30 26 24 26 18 C26 12 20 10 18 4Z"/>
    </svg>
  ),
  'perfect': (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="#fff">
      <path d="M16 4 L19 12 L28 12 L21 17.5 L24 26 L16 21 L8 26 L11 17.5 L4 12 L13 12 Z"/>
    </svg>
  ),
  'speed': (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="#fff">
      <path d="M19 3 L8 18 L15 18 L13 29 L24 14 L17 14 Z"/>
    </svg>
  ),
  'whale': (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="#fff">
      <path d="M16 4 L22 14 L28 16 L22 18 L16 28 L10 18 L4 16 L10 14 Z"/>
    </svg>
  ),
  'dynasty': (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 22 L6 12 L12 17 L16 8 L20 17 L26 12 L26 22 Z"/>
      <line x1="6" y1="26" x2="26" y2="26"/>
    </svg>
  ),
  'polymath': (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 26 L6 8 C6 8 11 6 16 8 C21 6 26 8 26 8 L26 26 C26 26 21 24 16 26 C11 24 6 26 6 26Z"/>
      <line x1="16" y1="8" x2="16" y2="26"/>
      <line x1="10" y1="13" x2="14" y2="13"/>
      <line x1="18" y1="13" x2="22" y2="13"/>
      <line x1="10" y1="18" x2="14" y2="18"/>
      <line x1="18" y1="18" x2="22" y2="18"/>
    </svg>
  ),
  'champion': (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 6 L10 18 C10 22 13 24 16 24 C19 24 22 22 22 18 L22 6 Z"/>
      <path d="M10 10 L6 10 C6 14 8 17 10 18"/>
      <path d="M22 10 L26 10 C26 14 24 17 22 18"/>
      <line x1="12" y1="28" x2="20" y2="28"/>
      <line x1="16" y1="24" x2="16" y2="28"/>
    </svg>
  ),
}

const MATCHES = [
  { opp: '0x3f…a9', mode: 'Classic Duel',   win: true,  delta:  0.045, date: '2h ago'    },
  { opp: '0x91…2c', mode: 'Speed Round',    win: true,  delta:  0.023, date: 'Yesterday' },
  { opp: '0x44…7e', mode: 'Classic Duel',   win: false, delta: -0.050, date: 'Yesterday' },
  { opp: '0xa2…1f', mode: 'Tournament',     win: true,  delta:  0.180, date: 'Mar 28'    },
  { opp: '0x55…b8', mode: 'Classic Duel',   win: false, delta: -0.050, date: 'Mar 27'    },
  { opp: '0x82…04', mode: 'Speed Round',    win: true,  delta:  0.023, date: 'Mar 26'    },
  { opp: '0x10…c7', mode: 'Classic Duel',   win: true,  delta:  0.045, date: 'Mar 25'    },
]

const EARNINGS = (() => {
  let s = 42
  const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280 }
  let v = 2.1
  const out: number[] = []
  for (let i = 0; i < 30; i++) {
    v += (rand() - 0.35) * 0.18
    if (v < 0.5) v = 0.5
    out.push(v)
  }
  const adj = (4.2 - out[out.length - 1]) / out.length
  return out.map((y, i) => Math.max(0.4, y + adj * i))
})()

// ── Identicon ─────────────────────────────────────────────────────────
function Identicon({ seed, size = 56, radius = 14 }: { seed: string; size?: number; radius?: number }) {
  const { cells, color1, color2 } = useMemo(() => {
    let h = 0
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
    let s = Math.abs(h) || 1
    const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280 }
    const hue1 = Math.floor(rand() * 360)
    const hue2 = (hue1 + 30 + Math.floor(rand() * 60)) % 360
    const grid: boolean[][] = []
    for (let y = 0; y < 5; y++) {
      const row: boolean[] = []
      for (let x = 0; x < 3; x++) row.push(rand() > 0.5)
      grid.push([...row, row[1], row[0]])
    }
    return { cells: grid, color1: `hsl(${hue1}, 70%, 55%)`, color2: `hsl(${hue2}, 75%, 45%)` }
  }, [seed])

  const cell = size / 6
  return (
    <div style={{ width: size, height: size, borderRadius: radius, background: `linear-gradient(135deg, ${color1}, ${color2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 16px rgba(0,0,0,0.12), 0 0 0 0.5px rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(5, ${cell}px)`, gridTemplateRows: `repeat(5, ${cell}px)` }}>
        {cells.flatMap((row, y) => row.map((on, x) => (
          <div key={`${x}-${y}`} style={{ width: cell, height: cell, background: on ? 'rgba(255,255,255,0.92)' : 'transparent', borderRadius: 1 }} />
        )))}
      </div>
    </div>
  )
}

// ── Badge card ────────────────────────────────────────────────────────
function BadgeCard({ badge }: { badge: typeof BADGES[number] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, opacity: badge.earned ? 1 : 0.45 }}>
      <div style={{
        width: 72, height: 72, borderRadius: 20, position: 'relative',
        background: badge.earned ? `linear-gradient(140deg, ${badge.gradient[0]}, ${badge.gradient[1]})` : '#E5E5EA',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: badge.earned
          ? `0 6px 16px ${badge.gradient[1]}40, inset 0 1px 0 rgba(255,255,255,0.25)`
          : 'inset 0 0 0 1px rgba(0,0,0,0.06)',
      }}>
        <div style={{ opacity: badge.earned ? 1 : 0.5 }}>
          {BADGE_ICONS[badge.id] ?? null}
        </div>
        {!badge.earned && (
          <div style={{ position: 'absolute', bottom: -3, right: -3, width: 22, height: 22, borderRadius: 11, background: 'var(--mdd-card)', boxShadow: '0 0 0 0.5px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <rect x="2" y="5" width="7" height="5" rx="1" stroke="#6E6E73" strokeWidth="1.2" fill="none"/>
              <path d="M3.5 5V3.5C3.5 2.4 4.4 1.5 5.5 1.5C6.6 1.5 7.5 2.4 7.5 3.5V5" stroke="#6E6E73" strokeWidth="1.2" fill="none"/>
            </svg>
          </div>
        )}
      </div>
      <div style={{ textAlign: 'center', lineHeight: 1.3 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: INK }}>{badge.name}</div>
        <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{badge.earned ? `Earned ${badge.date}` : 'Locked'}</div>
      </div>
    </div>
  )
}

// ── Earnings chart ────────────────────────────────────────────────────
function EarningsChart({ accent = BLUE }: { accent?: string }) {
  const W = 620, H = 220
  const padL = 40, padR = 16, padT = 16, padB = 28
  const min = Math.min(...EARNINGS) * 0.9
  const max = Math.max(...EARNINGS) * 1.05
  const xStep = (W - padL - padR) / (EARNINGS.length - 1)
  const yScale = (v: number) => padT + (H - padT - padB) * (1 - (v - min) / (max - min))
  const pts = EARNINGS.map((v, i) => [padL + i * xStep, yScale(v)] as [number, number])
  const pathD = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ')
  const areaD = pathD + ` L ${pts[pts.length - 1][0].toFixed(1)} ${H - padB} L ${padL} ${H - padB} Z`
  const ticks = [min, (min + max) / 2, max].map(v => ({ v, y: yScale(v) }))
  const xLabels = [{ i: 0, label: '30d ago' }, { i: 14, label: '15d' }, { i: 29, label: 'Today' }]
  const gradientId = `areaGrad-${accent.replace(/[^a-z0-9]/gi, '')}`

  return (
    <svg width={W} height={H} style={{ display: 'block', maxWidth: '100%' }}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.22"/>
          <stop offset="100%" stopColor={accent} stopOpacity="0"/>
        </linearGradient>
      </defs>
      {ticks.map((t, i) => (
        <text key={i} x={padL - 8} y={t.y + 4} fontSize="10" fill="#AEAEB2" textAnchor="end" fontFamily="system-ui, sans-serif" style={{ fontVariantNumeric: 'tabular-nums' }}>{t.v.toFixed(1)}</text>
      ))}
      {xLabels.map((t, i) => (
        <text key={i} x={padL + t.i * xStep} y={H - 8} fontSize="10" fill="#AEAEB2" textAnchor="middle" fontFamily="system-ui, sans-serif">{t.label}</text>
      ))}
      <path d={areaD} fill={`url(#${gradientId})`} />
      <path d={pathD} fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="4" fill="var(--mdd-card)" stroke={accent} strokeWidth="2"/>
    </svg>
  )
}

// ── Page ──────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { publicKey } = useWallet()
  const toast = useToast()
  const [tab, setTab]     = useState<Tab>('history')
  const [profile, setProfile] = useState(PROFILE)
  const [editable, setEditable] = useState<EditableProfile>({ displayName: '', bio: '', avatarSeed: PROFILE.seed })
  const [editOpen, setEditOpen] = useState(false)
  const [badges, setBadges]     = useState<BadgeRow[]>([])
  const [badgesLoading, setBadgesLoading] = useState(false)

  const walletAddr = publicKey?.toBase58()
  const defaultSeed = walletAddr ? walletAddr.slice(0, 10) : PROFILE.seed

  useEffect(() => {
    if (!publicKey) return
    const addr = publicKey.toBase58()
    const short = addr.slice(0, 6) + '…' + addr.slice(-4)
    setProfile(p => ({ ...p, addr: short, seed: addr.slice(0, 10) }))
    setEditable(loadStoredProfile(addr, addr.slice(0, 10)))
  }, [publicKey])

  function handleSaveProfile(next: EditableProfile) {
    setEditable(next)
    if (walletAddr) saveStoredProfile(walletAddr, next)
    setEditOpen(false)
    toast('Profile saved ✓', 'success')
  }

  // Fetch real badges for the connected wallet
  useEffect(() => {
    if (!walletAddr) { setBadges([]); return }
    let cancelled = false
    setBadgesLoading(true)
    fetchBadges(walletAddr)
      .then(b => { if (!cancelled) setBadges(b) })
      .catch(() => { if (!cancelled) setBadges([]) })
      .finally(() => { if (!cancelled) setBadgesLoading(false) })
    return () => { cancelled = true }
  }, [walletAddr])

  // Compute stats from backend history (DB-backed). Falls back to zero state
  // when wallet isn't connected.
  useEffect(() => {
    if (!walletAddr) {
      setProfile(p => ({ ...p, wins: 0, rate: 0, sol: 0, usdc: 0, streak: 0, best: 0 }))
      return
    }
    let cancelled = false
    fetchHistory(walletAddr, 200)
      .then(rows => {
        if (cancelled) return
        // Only count finished matches for stats; drop pending.
        const finished = rows.filter(r => r.result === 'win' || r.result === 'loss' || r.result === 'draw')
        const total    = finished.length
        const wins     = finished.filter(r => r.result === 'win').length
        const solEarned  = finished.filter(r => r.result === 'win' && r.currency === 'sol' ).reduce((s, r) => s + Math.max(0, r.delta), 0)
        const usdcEarned = finished.filter(r => r.result === 'win' && r.currency === 'usdc').reduce((s, r) => s + Math.max(0, r.delta), 0)

        // history is ordered newest-first
        let streak = 0
        for (const r of finished) {
          if (r.result === 'win') streak++
          else break
        }
        // best streak: walk in chronological order (oldest first)
        const chrono = [...finished].reverse()
        let best = 0, cur = 0
        for (const r of chrono) {
          cur = r.result === 'win' ? cur + 1 : 0
          best = Math.max(best, cur)
        }

        setProfile(p => ({
          ...p,
          wins,
          rate:   total > 0 ? Math.round((wins / total) * 100) : 0,
          sol:    parseFloat(solEarned.toFixed(3)),
          usdc:   parseFloat(usdcEarned.toFixed(2)),
          streak, best,
        }))
      })
      .catch(() => { /* keep last good values on error */ })
    return () => { cancelled = true }
  }, [walletAddr])

  return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: "var(--font-inter), 'Inter', system-ui, sans-serif", color: INK }}>

      <NavBar active="profile" />

      {/* ── Body ─────────────────────────────────────────────────── */}
      <div className="page-content has-bottom-tab" style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 32px 80px' }}>
        <div className="page-cols" style={{ display: 'flex', gap: 28, alignItems: 'flex-start' }}>

          {/* ── Sidebar ────────────────────────────────────────────── */}
          <motion.aside
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="mobile-full"
            style={{ width: 300, flexShrink: 0 }}
          >
            <div style={{ background: 'var(--mdd-card)', borderRadius: 24, padding: '28px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <Identicon seed={editable.avatarSeed || profile.seed} size={96} radius={22} />

              {editable.displayName && (
                <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: -0.3, marginTop: 16, color: INK }}>
                  {editable.displayName}
                </div>
              )}

              <div style={{ fontSize: editable.displayName ? 13 : 17, fontWeight: editable.displayName ? 500 : 700, letterSpacing: -0.3, marginTop: editable.displayName ? 4 : 16, fontFamily: 'ui-monospace, Menlo, monospace', color: editable.displayName ? MUTED : INK }}>
                {profile.addr}
              </div>

              {editable.bio && (
                <p style={{ margin: '12px 0 0', fontSize: 13, color: MUTED, lineHeight: 1.5, maxWidth: 240 }}>
                  {editable.bio}
                </p>
              )}

              <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, background: '#E8F7EE', color: GREEN_DARK, fontSize: 11, fontWeight: 600 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 3, background: GREEN }} />
                  Solana Devnet
                </span>
                <span style={{ padding: '3px 9px', borderRadius: 999, background: 'var(--mdd-bg)', color: MUTED, fontSize: 11, fontWeight: 600 }}>
                  Joined {profile.joined}
                </span>
              </div>

              {/* Stats list */}
              <div style={{ width: '100%', marginTop: 22, paddingTop: 18, borderTop: '0.5px solid rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  { label: 'Total Wins',      value: String(profile.wins),        color: INK },
                  { label: 'Win Rate',        value: `${profile.rate}%`,          color: BLUE },
                  { label: 'SOL Earned',      value: `${profile.sol.toFixed(2)} SOL`,  color: '#9945FF' },
                  { label: 'USDC Earned',     value: `${(profile.usdc ?? 0).toFixed(2)} USDC`, color: '#2775CA' },
                  { label: 'Current Streak',  value: `${profile.streak} wins 🔥`, color: '#FF6A00' },
                  { label: 'Best Streak',     value: `${profile.best} wins`,      color: INK },
                ].map(s => (
                  <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: 13, color: MUTED }}>{s.label}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: s.color, fontVariantNumeric: 'tabular-nums' }}>{s.value}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setEditOpen(true)}
                disabled={!walletAddr}
                style={{
                  appearance: 'none', border: 'none',
                  background: walletAddr ? BLUE : 'var(--mdd-card)',
                  color: walletAddr ? '#fff' : MUTED,
                  padding: '12px 14px', borderRadius: 14,
                  width: '100%', marginTop: 22,
                  fontSize: 13.5, fontWeight: 600,
                  fontFamily: 'inherit',
                  cursor: walletAddr ? 'pointer' : 'not-allowed',
                  boxShadow: walletAddr ? '0 4px 14px rgba(0,113,227,0.25)' : 'none',
                  transition: 'transform 120ms ease, box-shadow 160ms ease',
                  opacity: walletAddr ? 1 : 0.6,
                }}
                onMouseEnter={e => { if (walletAddr) e.currentTarget.style.transform = 'translateY(-1px)' }}
                onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
                title={walletAddr ? 'Edit your profile' : 'Connect wallet to edit profile'}
              >
                {walletAddr ? 'Edit Profile' : 'Connect wallet to edit'}
              </button>
            </div>
          </motion.aside>

          <EditProfileModal
            open={editOpen}
            initial={editable}
            defaultSeed={defaultSeed}
            onClose={() => setEditOpen(false)}
            onSave={handleSaveProfile}
          />

          {/* ── Main ───────────────────────────────────────────────── */}
          <motion.main
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
            style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}
          >
            {/* Tab control */}
            <div style={{ display: 'flex', gap: 4, padding: 4, background: 'rgba(0,0,0,0.05)', borderRadius: 10, width: 'fit-content' }}>
              {([['badges', 'Badges'], ['history', 'Match History'], ['earnings', 'Earnings']] as [Tab, string][]).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  style={{ appearance: 'none', border: 'none', padding: '7px 18px', borderRadius: 8, background: tab === id ? 'var(--mdd-card)' : 'transparent', color: tab === id ? INK : MUTED, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', boxShadow: tab === id ? '0 1px 2px rgba(0,0,0,0.06)' : 'none', transition: 'all 120ms ease' }}
                >
                  {label}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">

              {/* ── Badges ─────────────────────────────────────────── */}
              {tab === 'badges' && (
                <motion.div key="badges" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}
                  style={{ background: 'var(--mdd-card)', borderRadius: 20, padding: '26px 28px', boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.05)' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 22 }}>
                    <span style={{ fontSize: 16, fontWeight: 700 }}>NFT Achievements</span>
                    <span style={{ fontSize: 12, color: MUTED }}>{badges.length} earned · soulbound</span>
                  </div>

                  {!walletAddr ? (
                    <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                      <div style={{ fontSize: 28, marginBottom: 8 }}>🔌</div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>Connect wallet to see your badges</div>
                    </div>
                  ) : badgesLoading ? (
                    <SkeletonBadgeGrid count={6} />
                  ) : badges.length === 0 ? (
                    <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                      <div style={{ fontSize: 28, marginBottom: 8 }}>🏅</div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>No badges yet</div>
                      <div style={{ fontSize: 12.5, color: MUTED, marginTop: 4, maxWidth: 340, margin: '4px auto 0', lineHeight: 1.5 }}>
                        Win your first match to earn the <strong>First Blood</strong> badge — minted as a soulbound NFT to your wallet.
                      </div>
                    </div>
                  ) : (
                    <div className="badge-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px 14px' }}>
                      {badges.map(b => (
                        <a
                          key={b.id}
                          href={b.mintAddr ? `https://explorer.solana.com/address/${b.mintAddr}?cluster=devnet` : undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={b.description}
                          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textDecoration: 'none', color: 'inherit', cursor: b.mintAddr ? 'pointer' : 'default' }}
                        >
                          <div style={{ width: 72, height: 72, borderRadius: 18, position: 'relative', overflow: 'hidden', boxShadow: '0 6px 16px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.25)' }}>
                            {b.image && b.image.startsWith('data:') ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={b.image} alt={b.name} style={{ width: '100%', height: '100%' }} />
                            ) : (
                              <div style={{ width: '100%', height: '100%', background: '#9B5DE5' }} />
                            )}
                            {b.status === 'pending' && (
                              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ fontSize: 9.5, fontWeight: 700, color: '#fff', letterSpacing: 0.5 }}>MINTING…</span>
                              </div>
                            )}
                          </div>
                          <div style={{ textAlign: 'center', lineHeight: 1.3 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 600, color: INK }}>{b.name}</div>
                            <div style={{ fontSize: 10.5, color: MUTED, marginTop: 2 }}>
                              {b.status === 'minted' ? 'On-chain ↗' : 'Pending mint'}
                            </div>
                          </div>
                        </a>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {/* ── Match History ───────────────────────────────────── */}
              {tab === 'history' && (
                <motion.div key="history" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}
                  className="table-scroll"
                  style={{ background: 'var(--mdd-card)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.05)' }}
                >
                  {/* Header row */}
                  <div style={{ display: 'flex', alignItems: 'center', padding: '14px 20px 12px', borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}>
                    <div style={{ width: 40, fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.4 }}>Result</div>
                    <div style={{ flex: 1, fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.4, paddingLeft: 12 }}>Opponent · Mode</div>
                    <div style={{ width: 110, textAlign: 'right', fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.4 }}>Δ SOL</div>
                    <div style={{ width: 90, textAlign: 'right', fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.4 }}>When</div>
                  </div>

                  {MATCHES.map((m, i) => (
                    <div
                      key={i}
                      style={{ display: 'flex', alignItems: 'center', padding: '13px 20px', background: i % 2 === 1 ? 'var(--mdd-card-alt)' : 'transparent', borderBottom: i < MATCHES.length - 1 ? '0.5px solid rgba(0,0,0,0.04)' : 'none', transition: 'background 120ms ease', cursor: 'default' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--mdd-bg-soft)')}
                      onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 1 ? '#FAFAFA' : 'transparent')}
                    >
                      <div style={{ width: 40, display: 'flex' }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: m.win ? '#E8F7EE' : '#FDECEB', color: m.win ? '#0A7A2D' : '#A81C13', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
                          {m.win ? 'W' : 'L'}
                        </div>
                      </div>
                      <div style={{ flex: 1, paddingLeft: 12 }}>
                        <div style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 13.5, fontWeight: 600, color: INK }}>vs {m.opp}</div>
                        <div style={{ fontSize: 12, color: MUTED, marginTop: 1 }}>{m.mode}</div>
                      </div>
                      <div style={{ width: 110, textAlign: 'right', fontSize: 14, fontWeight: 600, color: m.delta >= 0 ? GREEN_DARK : RED, fontVariantNumeric: 'tabular-nums' }}>
                        {m.delta >= 0 ? `+${m.delta.toFixed(3)}` : `−${Math.abs(m.delta).toFixed(3)}`}
                      </div>
                      <div style={{ width: 90, textAlign: 'right', fontSize: 12.5, color: MUTED }}>{m.date}</div>
                    </div>
                  ))}
                </motion.div>
              )}

              {/* ── Earnings ────────────────────────────────────────── */}
              {tab === 'earnings' && (
                <motion.div key="earnings" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}
                  style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
                >
                  {/* SOL panel */}
                  <div style={{ background: 'var(--mdd-card)', borderRadius: 20, padding: '24px 28px', boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                      <div>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: MUTED, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                          <span style={{ width: 16, height: 16, borderRadius: 8, background: 'linear-gradient(135deg, #9945FF, #14F195)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 9, fontWeight: 700 }}>◎</span>
                          SOL Earned
                        </div>
                        <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: -1, marginTop: 6, fontVariantNumeric: 'tabular-nums', color: '#9945FF' }}>
                          {profile.sol.toFixed(2)} <span style={{ fontSize: 16, color: MUTED, fontWeight: 600 }}>SOL</span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', marginTop: 4 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: GREEN_DARK, fontVariantNumeric: 'tabular-nums' }}>
                          {profile.sol > 0 ? `+${profile.sol.toFixed(3)}` : '0.000'} SOL
                        </div>
                        <div style={{ fontSize: 11.5, color: MUTED, marginTop: 2 }}>All time</div>
                      </div>
                    </div>
                    <div style={{ marginLeft: -8 }}>
                      <EarningsChart accent="#9945FF" />
                    </div>
                  </div>

                  {/* USDC panel */}
                  <div style={{ background: 'var(--mdd-card)', borderRadius: 20, padding: '24px 28px', boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                      <div>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: MUTED, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                          <span style={{ width: 16, height: 16, borderRadius: 8, background: 'linear-gradient(135deg, #2775CA, #1B5DA5)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 9, fontWeight: 700 }}>$</span>
                          USDC Earned
                        </div>
                        <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: -1, marginTop: 6, fontVariantNumeric: 'tabular-nums', color: '#2775CA' }}>
                          {(profile.usdc ?? 0).toFixed(2)} <span style={{ fontSize: 16, color: MUTED, fontWeight: 600 }}>USDC</span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', marginTop: 4 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: GREEN_DARK, fontVariantNumeric: 'tabular-nums' }}>
                          {(profile.usdc ?? 0) > 0 ? `+${(profile.usdc ?? 0).toFixed(2)}` : '0.00'} USDC
                        </div>
                        <div style={{ fontSize: 11.5, color: MUTED, marginTop: 2 }}>All time</div>
                      </div>
                    </div>
                    <div style={{ marginLeft: -8 }}>
                      <EarningsChart accent="#2775CA" />
                    </div>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          </motion.main>
        </div>
      </div>
      <style>{`
        @media (max-width: 767px) {
          .badge-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .profile-history-row { min-width: 420px; }
          .profile-history-header { min-width: 420px; }
        }
      `}</style>
    </div>
  )
}
