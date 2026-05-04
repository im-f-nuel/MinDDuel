'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { NavBar } from '@/components/layout/NavBar'

const BLUE       = '#0071E3'
const INK        = '#1D1D1F'
const MUTED      = '#6E6E73'
const GREEN_DARK = '#0A7A2D'
const RED        = '#FF3B30'
const BG         = '#F5F5F7'

type ResultFilter = 'all' | 'wins' | 'losses'
type ModeFilter   = 'all' | 'classic' | 'shifting' | 'vsai' | 'blitz'

interface Match {
  opp: string
  mode: string
  modeId: ModeFilter
  win: boolean
  delta: number
  date: string
  questions: number
  correct: number
}

const MATCHES: Match[] = [
  { opp: '0x3f…a9', mode: 'Classic Duel',   modeId: 'classic',  win: true,  delta:  0.045, date: '2h ago',     questions: 6, correct: 5 },
  { opp: '0x91…2c', mode: 'Shifting Board', modeId: 'shifting', win: true,  delta:  0.023, date: '5h ago',     questions: 6, correct: 6 },
  { opp: '0x44…7e', mode: 'Classic Duel',   modeId: 'classic',  win: false, delta: -0.050, date: 'Yesterday',  questions: 6, correct: 3 },
  { opp: '0xa2…1f', mode: 'vs AI (Hard)',   modeId: 'vsai',     win: true,  delta:  0.000, date: 'Yesterday',  questions: 8, correct: 7 },
  { opp: '0x55…b8', mode: 'Classic Duel',   modeId: 'classic',  win: false, delta: -0.050, date: 'Mar 28',     questions: 6, correct: 2 },
  { opp: '0x82…04', mode: 'Blitz',          modeId: 'blitz',    win: true,  delta:  0.038, date: 'Mar 27',     questions: 5, correct: 5 },
  { opp: '0x10…c7', mode: 'Classic Duel',   modeId: 'classic',  win: true,  delta:  0.045, date: 'Mar 26',     questions: 6, correct: 4 },
  { opp: '0xd8…11', mode: 'Shifting Board', modeId: 'shifting', win: false, delta: -0.023, date: 'Mar 25',     questions: 6, correct: 3 },
  { opp: '0x72…ff', mode: 'Classic Duel',   modeId: 'classic',  win: true,  delta:  0.045, date: 'Mar 24',     questions: 6, correct: 6 },
  { opp: '0x51…b3', mode: 'vs AI (Easy)',   modeId: 'vsai',     win: true,  delta:  0.000, date: 'Mar 23',     questions: 6, correct: 5 },
  { opp: '0xc0…2a', mode: 'Classic Duel',   modeId: 'classic',  win: false, delta: -0.050, date: 'Mar 22',     questions: 6, correct: 3 },
  { opp: '0x88…d6', mode: 'Blitz',          modeId: 'blitz',    win: true,  delta:  0.038, date: 'Mar 21',     questions: 5, correct: 4 },
  { opp: '0x1a…ea', mode: 'Shifting Board', modeId: 'shifting', win: true,  delta:  0.023, date: 'Mar 20',     questions: 6, correct: 5 },
  { opp: '0x5c…73', mode: 'Classic Duel',   modeId: 'classic',  win: false, delta: -0.050, date: 'Mar 19',     questions: 6, correct: 2 },
]

function StatCard({ value, label, accent }: { value: string; label: string; accent?: string }) {
  return (
    <div style={{ flex: 1, background: '#fff', borderRadius: 16, padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.05)' }}>
      <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.6, color: accent ?? INK, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, marginTop: 5, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
    </div>
  )
}

function AccuracyBar({ correct, total }: { correct: number; total: number }) {
  const pct = total > 0 ? (correct / total) * 100 : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 40, height: 3, borderRadius: 2, background: '#E5E5EA', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: pct >= 80 ? '#34C759' : pct >= 50 ? BLUE : RED, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 11, color: MUTED, fontVariantNumeric: 'tabular-nums' }}>{correct}/{total}</span>
    </div>
  )
}

export default function HistoryPage() {
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all')
  const [modeFilter, setModeFilter]     = useState<ModeFilter>('all')
  const [matches, setMatches]           = useState<Match[]>(MATCHES)

  useEffect(() => {
    const stored: Array<{ result: string; opponent: string; mode: string; isVsAI: boolean; stake: number; timestamp: number; questions?: number; correct?: number }> = JSON.parse(localStorage.getItem('mddHistory') ?? '[]')
    if (stored.length === 0) return
    const modeToId = (mode: string, isVsAI: boolean): ModeFilter => {
      if (isVsAI) return 'vsai'
      if (mode.toLowerCase().includes('classic')) return 'classic'
      if (mode.toLowerCase().includes('shift')) return 'shifting'
      if (mode.toLowerCase().includes('blitz')) return 'blitz'
      return 'classic'
    }
    setMatches(stored.map(e => ({
      opp:       e.opponent,
      mode:      e.mode,
      modeId:    modeToId(e.mode, e.isVsAI),
      win:       e.result === 'win',
      delta:     e.result === 'win' ? parseFloat((e.stake * 0.9).toFixed(4)) : e.result === 'lose' ? -e.stake : 0,
      date:      new Date(e.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      questions: e.questions ?? 6,
      correct:   e.correct ?? 3,
    })))
  }, [])

  const filtered = matches.filter(m => {
    if (resultFilter === 'wins'   && !m.win) return false
    if (resultFilter === 'losses' &&  m.win) return false
    if (modeFilter !== 'all' && m.modeId !== modeFilter) return false
    return true
  })

  const totalMatches = matches.length
  const wins         = matches.filter(m => m.win).length
  const winRate      = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0
  const solEarned    = matches.filter(m => m.delta > 0).reduce((acc, m) => acc + m.delta, 0)
  const bestStreak   = (() => {
    let best = 0, cur = 0
    for (const m of matches) { cur = m.win ? cur + 1 : 0; best = Math.max(best, cur) }
    return best
  })()

  return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: "var(--font-inter), 'Inter', system-ui, sans-serif", color: INK }}>

      <NavBar active="history" />

      {/* ── Content ──────────────────────────────────────────────────── */}
      <div className="page-content has-bottom-tab" style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 32px 80px' }}>

        {/* Page title */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          style={{ marginBottom: 24 }}
        >
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.8, margin: '0 0 4px' }}>Match History</h1>
          <p style={{ margin: 0, fontSize: 14, color: MUTED }}>All your duels, wins, and losses</p>
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
          className="stat-grid-4"
          style={{ display: 'flex', gap: 14, marginBottom: 28 }}
        >
          <StatCard value={String(totalMatches)} label="Total Matches" />
          <StatCard value={`${winRate}%`}        label="Win Rate"      accent={BLUE} />
          <StatCard value={`${solEarned.toFixed(3)} SOL`} label="SOL Earned" accent={GREEN_DARK} />
          <StatCard value={`${bestStreak} wins`} label="Best Streak"   accent="#FF6A00" />
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
          style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}
        >
          {/* Result filter */}
          <div style={{ display: 'flex', gap: 4, padding: 4, background: 'rgba(0,0,0,0.05)', borderRadius: 10 }}>
            {([['all', 'All'], ['wins', 'Wins'], ['losses', 'Losses']] as [ResultFilter, string][]).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setResultFilter(id)}
                style={{ appearance: 'none', border: 'none', padding: '7px 14px', borderRadius: 8, background: resultFilter === id ? '#fff' : 'transparent', color: resultFilter === id ? INK : MUTED, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', boxShadow: resultFilter === id ? '0 1px 2px rgba(0,0,0,0.06)' : 'none', transition: 'all 120ms ease' }}
              >
                {label}
              </button>
            ))}
          </div>

          <div style={{ width: 0.5, height: 28, background: 'rgba(0,0,0,0.1)' }} />

          {/* Mode filter */}
          <div style={{ display: 'flex', gap: 4, padding: 4, background: 'rgba(0,0,0,0.05)', borderRadius: 10 }}>
            {([['all', 'All Modes'], ['classic', 'Classic'], ['shifting', 'Shifting'], ['vsai', 'vs AI'], ['blitz', 'Blitz']] as [ModeFilter, string][]).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setModeFilter(id)}
                style={{ appearance: 'none', border: 'none', padding: '7px 12px', borderRadius: 8, background: modeFilter === id ? '#fff' : 'transparent', color: modeFilter === id ? INK : MUTED, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', boxShadow: modeFilter === id ? '0 1px 2px rgba(0,0,0,0.06)' : 'none', transition: 'all 120ms ease' }}
              >
                {label}
              </button>
            ))}
          </div>

          <span style={{ fontSize: 13, color: MUTED, marginLeft: 'auto' }}>{filtered.length} match{filtered.length !== 1 ? 'es' : ''}</span>
        </motion.div>

        {/* Table */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="table-scroll"
          style={{ background: '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.05)' }}
        >
          {/* Table header */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px 12px', borderBottom: '0.5px solid rgba(0,0,0,0.06)', minWidth: 480 }}>
            <div style={{ width: 40, fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.4 }}>Result</div>
            <div style={{ flex: 1, fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.4, paddingLeft: 12 }}>Opponent · Mode</div>
            <div style={{ width: 100, textAlign: 'center', fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.4 }}>Accuracy</div>
            <div style={{ width: 110, textAlign: 'right', fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.4 }}>Δ SOL</div>
            <div style={{ width: 90, textAlign: 'right', fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.4 }}>When</div>
          </div>

          <AnimatePresence mode="popLayout">
            {filtered.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ padding: '48px 20px', textAlign: 'center' }}
              >
                <div style={{ fontSize: 32, marginBottom: 10 }}>🎮</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: INK }}>No matches found</div>
                <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>Try adjusting the filters</div>
              </motion.div>
            ) : (
              filtered.map((m, i) => (
                <motion.div
                  key={`${m.opp}-${m.date}`}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2, delay: i * 0.02 }}
                  style={{ display: 'flex', alignItems: 'center', padding: '13px 16px', minWidth: 480, background: i % 2 === 1 ? '#FAFAFA' : 'transparent', borderBottom: i < filtered.length - 1 ? '0.5px solid rgba(0,0,0,0.04)' : 'none', cursor: 'default', transition: 'background 120ms ease' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = '#F5F8FF' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = i % 2 === 1 ? '#FAFAFA' : 'transparent' }}
                >
                  {/* W/L badge */}
                  <div style={{ width: 40, display: 'flex' }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: m.win ? '#E8F7EE' : '#FDECEB', color: m.win ? '#0A7A2D' : '#A81C13', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                      {m.win ? 'W' : 'L'}
                    </div>
                  </div>

                  {/* Opponent + mode */}
                  <div style={{ flex: 1, paddingLeft: 12 }}>
                    <div style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 13.5, fontWeight: 600, color: INK }}>vs {m.opp}</div>
                    <div style={{ fontSize: 12, color: MUTED, marginTop: 1 }}>{m.mode}</div>
                  </div>

                  {/* Accuracy */}
                  <div style={{ width: 100, display: 'flex', justifyContent: 'center' }}>
                    <AccuracyBar correct={m.correct} total={m.questions} />
                  </div>

                  {/* Δ SOL */}
                  <div style={{ width: 110, textAlign: 'right', fontSize: 14, fontWeight: 600, color: m.delta > 0 ? GREEN_DARK : m.delta < 0 ? RED : MUTED, fontVariantNumeric: 'tabular-nums' }}>
                    {m.delta > 0 ? `+${m.delta.toFixed(3)}` : m.delta < 0 ? `−${Math.abs(m.delta).toFixed(3)}` : '—'}
                  </div>

                  {/* When */}
                  <div style={{ width: 90, textAlign: 'right', fontSize: 12.5, color: MUTED }}>{m.date}</div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </motion.div>

        {/* Pagination hint */}
        {filtered.length > 0 && (
          <p style={{ textAlign: 'center', fontSize: 12, color: MUTED, marginTop: 20 }}>
            Showing {filtered.length} of {filtered.length} matches · On-chain history coming soon
          </p>
        )}
      </div>
    </div>
  )
}
