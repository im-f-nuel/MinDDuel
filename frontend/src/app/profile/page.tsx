'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { NavBar } from '@/components/layout/NavBar'

const BLUE       = '#0071E3'
const INK        = '#1D1D1F'
const MUTED      = '#6E6E73'
const GREEN      = '#34C759'
const GREEN_DARK = '#0A7A2D'
const RED        = '#FF3B30'
const BG         = '#F5F5F7'

type Tab = 'badges' | 'history' | 'earnings'

// ── Mock data ─────────────────────────────────────────────────────────
const PROFILE = {
  addr:   '0x44a8…2c1f',
  seed:   '0x44a8e2c1',
  joined: 'Mar 2025',
  wins:   142,
  rate:   67,
  sol:    4.20,
  streak: 3,
  best:   11,
}

const BADGES = [
  { id: 'first-blood', name: 'First Blood', icon: '🩸', date: 'Mar 14', earned: true,  gradient: ['#FF6B6B', '#C92A2A'] },
  { id: 'streak-3',   name: 'Triple',      icon: '🔥', date: 'Mar 18', earned: true,  gradient: ['#FFB142', '#FF6A00'] },
  { id: 'perfect',    name: 'Flawless',    icon: '✨', date: 'Mar 22', earned: true,  gradient: ['#9B5DE5', '#5E3FBE'] },
  { id: 'speed',      name: 'Lightning',   icon: '⚡', date: 'Apr 02', earned: true,  gradient: ['#4ECDC4', '#1E847F'] },
  { id: 'whale',      name: 'Big Stake',   icon: '💎', date: null,     earned: false, gradient: ['#94A3B8', '#475569'] },
  { id: 'dynasty',    name: 'Dynasty',     icon: '👑', date: null,     earned: false, gradient: ['#94A3B8', '#475569'] },
  { id: 'polymath',   name: 'Polymath',    icon: '📚', date: null,     earned: false, gradient: ['#94A3B8', '#475569'] },
  { id: 'champion',   name: 'Champion',    icon: '🏆', date: null,     earned: false, gradient: ['#94A3B8', '#475569'] },
]

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
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, opacity: badge.earned ? 1 : 0.5 }}>
      <div style={{ width: 72, height: 72, borderRadius: 20, background: badge.earned ? `linear-gradient(140deg, ${badge.gradient[0]}, ${badge.gradient[1]})` : '#E5E5EA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, boxShadow: badge.earned ? `0 6px 16px ${badge.gradient[1]}40, inset 0 1px 0 rgba(255,255,255,0.4)` : 'inset 0 0 0 1px rgba(0,0,0,0.05)', position: 'relative' }}>
        <span style={{ filter: badge.earned ? 'none' : 'grayscale(100%)' }}>{badge.icon}</span>
        {!badge.earned && (
          <div style={{ position: 'absolute', bottom: -3, right: -3, width: 22, height: 22, borderRadius: 11, background: '#fff', boxShadow: '0 0 0 0.5px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
function EarningsChart() {
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

  return (
    <svg width={W} height={H} style={{ display: 'block' }}>
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={BLUE} stopOpacity="0.18"/>
          <stop offset="100%" stopColor={BLUE} stopOpacity="0"/>
        </linearGradient>
      </defs>
      {ticks.map((t, i) => (
        <text key={i} x={padL - 8} y={t.y + 4} fontSize="10" fill="#AEAEB2" textAnchor="end" fontFamily="system-ui, sans-serif" style={{ fontVariantNumeric: 'tabular-nums' }}>{t.v.toFixed(1)}</text>
      ))}
      {xLabels.map((t, i) => (
        <text key={i} x={padL + t.i * xStep} y={H - 8} fontSize="10" fill="#AEAEB2" textAnchor="middle" fontFamily="system-ui, sans-serif">{t.label}</text>
      ))}
      <path d={areaD} fill="url(#areaGrad)" />
      <path d={pathD} fill="none" stroke={BLUE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="4" fill="#fff" stroke={BLUE} strokeWidth="2"/>
    </svg>
  )
}

// ── Page ──────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const [tab, setTab] = useState<Tab>('history')

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
            <div style={{ background: '#fff', borderRadius: 24, padding: '28px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <Identicon seed={PROFILE.seed} size={96} radius={22} />

              <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: -0.3, marginTop: 16, fontFamily: 'ui-monospace, Menlo, monospace' }}>
                {PROFILE.addr}
              </div>

              <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, background: '#E8F7EE', color: GREEN_DARK, fontSize: 11, fontWeight: 600 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 3, background: GREEN }} />
                  Solana Mainnet
                </span>
                <span style={{ padding: '3px 9px', borderRadius: 999, background: '#F5F5F7', color: MUTED, fontSize: 11, fontWeight: 600 }}>
                  Joined {PROFILE.joined}
                </span>
              </div>

              {/* Stats list */}
              <div style={{ width: '100%', marginTop: 22, paddingTop: 18, borderTop: '0.5px solid rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  { label: 'Total Wins',      value: String(PROFILE.wins),        color: INK },
                  { label: 'Win Rate',        value: `${PROFILE.rate}%`,          color: BLUE },
                  { label: 'SOL Earned',      value: `${PROFILE.sol.toFixed(1)} SOL`, color: GREEN_DARK },
                  { label: 'Current Streak',  value: `${PROFILE.streak} wins 🔥`, color: '#FF6A00' },
                  { label: 'Best Streak',     value: `${PROFILE.best} wins`,      color: INK },
                ].map(s => (
                  <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: 13, color: MUTED }}>{s.label}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: s.color, fontVariantNumeric: 'tabular-nums' }}>{s.value}</span>
                  </div>
                ))}
              </div>

              <button
                style={{ appearance: 'none', border: '1.5px solid rgba(0,0,0,0.1)', background: '#fff', color: INK, padding: '11px 14px', borderRadius: 14, width: '100%', marginTop: 22, fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', transition: 'background 120ms ease' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F5F5F7')}
                onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
              >
                Edit Profile
              </button>
            </div>
          </motion.aside>

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
                  style={{ appearance: 'none', border: 'none', padding: '7px 18px', borderRadius: 8, background: tab === id ? '#fff' : 'transparent', color: tab === id ? INK : MUTED, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', boxShadow: tab === id ? '0 1px 2px rgba(0,0,0,0.06)' : 'none', transition: 'all 120ms ease' }}
                >
                  {label}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">

              {/* ── Badges ─────────────────────────────────────────── */}
              {tab === 'badges' && (
                <motion.div key="badges" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}
                  style={{ background: '#fff', borderRadius: 20, padding: '26px 28px', boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.05)' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 22 }}>
                    <span style={{ fontSize: 16, fontWeight: 700 }}>Achievements</span>
                    <span style={{ fontSize: 12, color: MUTED }}>4 of {BADGES.length} unlocked</span>
                  </div>
                  <div className="badge-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '28px 16px' }}>
                    {BADGES.map(b => <BadgeCard key={b.id} badge={b} />)}
                  </div>
                </motion.div>
              )}

              {/* ── Match History ───────────────────────────────────── */}
              {tab === 'history' && (
                <motion.div key="history" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}
                  className="table-scroll"
                  style={{ background: '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.05)' }}
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
                      style={{ display: 'flex', alignItems: 'center', padding: '13px 20px', background: i % 2 === 1 ? '#FAFAFA' : 'transparent', borderBottom: i < MATCHES.length - 1 ? '0.5px solid rgba(0,0,0,0.04)' : 'none', transition: 'background 120ms ease', cursor: 'default' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#F5F8FF')}
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
                  style={{ background: '#fff', borderRadius: 20, padding: '24px 28px', boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.05)' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div>
                      <div style={{ fontSize: 12, color: MUTED, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>SOL Balance</div>
                      <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: -1, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                        {PROFILE.sol.toFixed(2)} <span style={{ fontSize: 18, color: MUTED, fontWeight: 600 }}>SOL</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', marginTop: 4 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: GREEN_DARK, fontVariantNumeric: 'tabular-nums' }}>+2.10 SOL</div>
                      <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>Last 30 days</div>
                    </div>
                  </div>
                  <div style={{ marginLeft: -8 }}>
                    <EarningsChart />
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
