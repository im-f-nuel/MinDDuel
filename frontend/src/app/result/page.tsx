'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { WalletButton } from '@/components/wallet/WalletButton'
import { BottomTabBar } from '@/components/layout/BottomTabBar'

const BLUE       = '#0071E3'
const RED        = '#FF3B30'
const INK        = '#1D1D1F'
const MUTED      = '#6E6E73'
const GREEN      = '#34C759'
const GREEN_DARK = '#0A7A2D'
const BG         = '#F5F5F7'

type ResultKind = 'win' | 'lose'

const MOCK = {
  kind: 'win' as ResultKind,
  potClaimed: '+0.095 SOL',
  platformFee: '−0.005 SOL',
  rankedPoints: '+12.4',
  streak: '3 wins',
  opponent: '0x3f…a9',
  mode: 'Classic Duel',
  questions: 6,
}

const MATCH_QUESTIONS = [
  { q: 'Bitcoin whitepaper year?', correct: true, time: 6.2 },
  { q: 'Persistence of Memory artist?', correct: true, time: 11.4 },
  { q: 'Symbol for gold?', correct: true, time: 4.8 },
  { q: 'Most moons in solar system?', correct: false, time: 14.9 },
  { q: 'Great Barrier Reef country?', correct: true, time: 7.1 },
  { q: 'Year Solana launched?', correct: false, time: 12.3 },
]

// ── Confetti ──────────────────────────────────────────────────────────
type ConfettiPiece = { left: number; top: number; rot: number; size: number; color: string; delay: number; dur: number }

function Confetti() {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([])
  useEffect(() => {
    setPieces(Array.from({ length: 36 }, (_, i) => ({
      left: Math.random() * 100,
      top: -(Math.random() * 30),
      rot: Math.random() * 360,
      size: 6 + Math.random() * 8,
      color: ['#0071E3', '#34C759', '#FF9500', '#FF3B30', '#AF52DE'][i % 5],
      delay: Math.random() * 2.5,
      dur: 4 + Math.random() * 2,
    })))
  }, [])
  if (pieces.length === 0) return null
  return (
    <>
      <style>{`@keyframes cfFall { 0%{transform:translateY(-40px) rotate(0deg);opacity:0} 8%{opacity:1} 100%{transform:translateY(120vh) rotate(720deg);opacity:0} }`}</style>
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}>
        {pieces.map((p, i) => (
          <div key={i} style={{ position: 'absolute', left: `${p.left}%`, top: `${p.top}%`, width: p.size, height: p.size * 0.4, background: p.color, borderRadius: 2, transform: `rotate(${p.rot}deg)`, animation: `cfFall ${p.dur}s ${p.delay}s linear infinite` }} />
        ))}
      </div>
    </>
  )
}

// ── Result Icon ───────────────────────────────────────────────────────
function ResultIcon({ kind }: { kind: ResultKind }) {
  const win = kind === 'win'
  return (
    <div style={{ width: 88, height: 88, borderRadius: 44, background: win ? '#E8F7EE' : '#FDECEB', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
      <div style={{ width: 64, height: 64, borderRadius: 32, background: win ? GREEN : RED, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: win ? '0 8px 24px rgba(52,199,89,0.32)' : '0 8px 24px rgba(255,59,48,0.28)' }}>
        {win ? (
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><path d="M8 16.5L13.5 22L24 11" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        ) : (
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M8 8L20 20M20 8L8 20" stroke="#fff" strokeWidth="3.5" strokeLinecap="round"/></svg>
        )}
      </div>
    </div>
  )
}

// ── Result Row ────────────────────────────────────────────────────────
function ResultRow({ label, value, color, big, badge }: { label: string; value: string; color?: string; big?: boolean; badge?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: '0.5px solid rgba(0,0,0,0.06)' }}>
      <span style={{ fontSize: 13, color: MUTED, fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: big ? 18 : 14, fontWeight: big ? 700 : 600, color: color ?? INK, fontVariantNumeric: 'tabular-nums', display: 'flex', alignItems: 'center', gap: 6 }}>
        {value}{badge && <span style={{ fontSize: 14 }}>{badge}</span>}
      </span>
    </div>
  )
}

// ── Match Stats Panel ─────────────────────────────────────────────────
function MatchStats() {
  const correct = MATCH_QUESTIONS.filter(q => q.correct).length
  const total   = MATCH_QUESTIONS.length
  const avg     = (MATCH_QUESTIONS.reduce((a, q) => a + q.time, 0) / total).toFixed(1)
  return (
    <div style={{ background: '#fff', borderRadius: 20, padding: '20px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
        <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: -0.2 }}>Match Stats</span>
        <span style={{ fontSize: 12, color: MUTED }}>{correct}/{total} correct · avg {avg}s</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {MATCH_QUESTIONS.map((q, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: i ? '0.5px solid rgba(0,0,0,0.06)' : 'none' }}>
            <div style={{ width: 22, height: 22, borderRadius: 11, flexShrink: 0, background: q.correct ? '#E8F7EE' : '#FDECEB', color: q.correct ? GREEN_DARK : '#A81C13', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
              {q.correct ? '✓' : '✕'}
            </div>
            <span style={{ fontSize: 12, color: MUTED, fontWeight: 600, width: 22, fontVariantNumeric: 'tabular-nums' }}>Q{i + 1}</span>
            <span style={{ flex: 1, fontSize: 13, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.q}</span>
            <span style={{ fontSize: 12, color: q.time > 12 ? RED : MUTED, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{q.time}s</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── MindDuel Logo ─────────────────────────────────────────────────────
function NavLogo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 28, height: 28, borderRadius: 8, background: INK, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 11, height: 11, borderRadius: 6, background: BLUE, boxShadow: `4px 0 0 ${RED}`, transform: 'translateX(-2px)' }} />
      </div>
      <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: -0.4 }}>MindDuel</span>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────
export default function ResultPage() {
  const result = MOCK
  const win    = result.kind === 'win'

  return (
    <div style={{ minHeight: '100vh', background: win ? BG : '#EEEEF0', fontFamily: "var(--font-inter), 'Inter', system-ui, sans-serif", color: INK, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>

      {win && <Confetti />}

      {/* ── Nav ────────────────────────────────────────────────────── */}
      <nav className="glass-nav" style={{ height: 64, flexShrink: 0, zIndex: 2 }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 20px', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <NavLogo />
          <WalletButton />
        </div>
      </nav>

      {/* ── Content ─────────────────────────────────────────────────── */}
      <div className="has-bottom-tab" style={{ flex: 1, padding: '32px 20px', display: 'flex', justifyContent: 'center', gap: 24, position: 'relative', zIndex: 1, overflow: 'auto', maxWidth: 1280, margin: '0 auto', width: '100%' }}>
        <div className="page-cols" style={{ width: '100%', maxWidth: 1100, display: 'flex', gap: 24, flexWrap: 'wrap' }}>

          {/* ── Left: Result ─────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            style={{ flex: 1, minWidth: 300, display: 'flex', flexDirection: 'column', gap: 18 }}
          >
            {/* Hero */}
            <div style={{ textAlign: 'center', padding: '8px 0 6px' }}>
              <ResultIcon kind={result.kind} />
              <h1 style={{ fontSize: 44, fontWeight: 700, letterSpacing: -1.5, margin: '18px 0 6px', lineHeight: 1.05 }}>
                {win ? 'You Won!' : 'You Lost'}
              </h1>
              <p style={{ fontSize: 14, color: MUTED, margin: 0 }}>
                {win
                  ? `vs ${result.opponent} · ${result.mode} · ${result.questions} questions`
                  : `Better luck next time. vs ${result.opponent} · ${result.mode}`}
              </p>
            </div>

            {/* Stats card */}
            <div style={{ background: '#fff', borderRadius: 20, padding: '6px 22px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.05)' }}>
              {win ? (
                <>
                  <ResultRow label="Pot Claimed"    value={result.potClaimed}    color={GREEN_DARK} big />
                  <ResultRow label="Platform Fee"   value={result.platformFee}   color={MUTED} />
                  <ResultRow label="Ranked Points"  value={result.rankedPoints}  color={BLUE} />
                  <ResultRow label="Streak"         value={result.streak}        color="#FF6A00" badge="🔥" />
                </>
              ) : (
                <>
                  <ResultRow label="SOL Lost"        value="−0.05 SOL"  color={RED}  big />
                  <ResultRow label="Ranked Points"   value="−4.2"       color={MUTED} />
                  <ResultRow label="Opponent Streak" value="5 wins" />
                </>
              )}
            </div>

            {/* Epic banner (win) / Encouragement (lose) */}
            {win ? (
              <div style={{ background: '#fff', borderRadius: 20, padding: '18px 22px', border: '1.5px solid #E8B844', boxShadow: '0 6px 20px rgba(232,184,68,0.15)', display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, #FFD66B, #E8B844)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>⚡</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: -0.2 }}>Epic Game!</div>
                  <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.4, marginTop: 2 }}>This match scored high on drama. Mint it as an NFT.</div>
                </div>
                <button style={{ appearance: 'none', border: 'none', padding: '10px 16px', background: INK, color: '#fff', borderRadius: 12, fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>Mint for 0.01 SOL</button>
                <button style={{ appearance: 'none', border: 'none', background: 'transparent', color: MUTED, fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>Skip</button>
              </div>
            ) : (
              <div style={{ background: '#E5F0FD', borderRadius: 16, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: 20, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="20" height="20" viewBox="0 0 18 18" fill="none"><path d="M9 2L11 6.5L16 7L12.5 10.5L13.5 15.5L9 13L4.5 15.5L5.5 10.5L2 7L7 6.5L9 2Z" fill={BLUE}/></svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: INK }}>You answered 4 of 6 correctly</div>
                  <div style={{ fontSize: 12.5, color: MUTED, marginTop: 2 }}>Top 30% performance for this match. The questions get easier with practice.</div>
                </div>
              </div>
            )}

            {/* CTAs */}
            <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
              <a href="/lobby" style={{ flex: 1 }}>
                <button style={{ appearance: 'none', border: 'none', width: '100%', padding: '14px', background: BLUE, color: '#fff', borderRadius: 14, fontSize: 15, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,113,227,0.25)' }}>
                  {win ? 'Play Again' : 'Rematch'}
                </button>
              </a>
              <a href="/lobby" style={{ display: 'block' }}>
                <button style={{ appearance: 'none', border: '1.5px solid rgba(0,0,0,0.10)', padding: '14px 22px', background: '#fff', color: INK, borderRadius: 14, fontSize: 15, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {win ? 'View Replay' : 'Back to Lobby'}
                </button>
              </a>
            </div>
          </motion.div>

          {/* ── Right: Match Stats ────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            style={{ width: 440, flexShrink: 0 }}
            className="desktop-only hidden lg:block"
          >
            <MatchStats />
          </motion.div>
        </div>
      </div>
      <BottomTabBar active="play" />
    </div>
  )
}
