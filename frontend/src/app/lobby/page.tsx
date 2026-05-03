'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import type { AIDifficulty } from '@/lib/ai'
import { cn } from '@/lib/utils'
import { NavBar } from '@/components/layout/NavBar'

// ── Design tokens ────────────────────────────────────────────────────
const BLUE   = '#0071E3'
const INK    = '#1D1D1F'
const MUTED  = '#6E6E73'
const GREEN  = '#34C759'
const GREEN_DARK = '#0A7A2D'

// ── Data ─────────────────────────────────────────────────────────────
const MODES = [
  { id: 'classic',  name: 'Classic Duel',    desc: 'Standard 3×3, first to align 3.', tag: 'EASY',    tagBg: '#E8F7EE', tagColor: GREEN_DARK,  available: true },
  { id: 'shifting', name: 'Shifting Board',  desc: 'Cells rotate every 3 rounds.',     tag: 'MEDIUM',  tagBg: '#FFF4E0', tagColor: '#8A5A00',   available: false },
  { id: 'scaleup',  name: 'Scale Up',        desc: 'Board grows from 3×3 → 5×5.',      tag: 'HARD',    tagBg: '#FDECEB', tagColor: '#A81C13',   available: false },
  { id: 'blitz',    name: 'Blitz',           desc: '5-second answers. No mercy.',       tag: 'INTENSE', tagBg: '#FDECEB', tagColor: '#A81C13',   available: false },
  { id: 'vs-ai',   name: 'vs AI',           desc: 'Practice vs MindDuel AI. Free.',    tag: 'NEW',     tagBg: '#E5F0FD', tagColor: BLUE,        available: true },
] as const

type ModeId = typeof MODES[number]['id']

// ── Mode icons (custom SVG) ───────────────────────────────────────────
function IconClassicDuel() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <line x1="8" y1="1.5" x2="8" y2="22.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
      <line x1="16" y1="1.5" x2="16" y2="22.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
      <line x1="1.5" y1="8" x2="22.5" y2="8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
      <line x1="1.5" y1="16" x2="22.5" y2="16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
      <line x1="2.5" y1="2.5" x2="6.5" y2="6.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
      <line x1="6.5" y1="2.5" x2="2.5" y2="6.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
      <circle cx="12" cy="12" r="2.4" stroke="currentColor" strokeWidth="1.7"/>
      <line x1="17.5" y1="17.5" x2="21.5" y2="21.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
      <line x1="21.5" y1="17.5" x2="17.5" y2="21.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
    </svg>
  )
}

function IconShiftingBoard() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <line x1="8" y1="1.5" x2="8" y2="22.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.25"/>
      <line x1="16" y1="1.5" x2="16" y2="22.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.25"/>
      <line x1="1.5" y1="8" x2="22.5" y2="8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.25"/>
      <line x1="1.5" y1="16" x2="22.5" y2="16" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.25"/>
      <path d="M12 4.5 A7.5 7.5 0 1 1 4.5 12" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" fill="none"/>
      <path d="M9.2 1.8 L12.2 5 L15.2 2.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconScaleUp() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="1.5" y="1.5" width="9.5" height="9.5" rx="1.5" stroke="currentColor" strokeWidth="1.6"/>
      <line x1="6.25" y1="1.5" x2="6.25" y2="11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="1.5" y1="6.25" x2="11" y2="6.25" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M22.5 1.5 L17.5 1.5 M22.5 1.5 L22.5 6.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" opacity="0.4"/>
      <path d="M13 22.5 L22.5 22.5 L22.5 13" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="13" y1="17.5" x2="22.5" y2="17.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.4"/>
      <line x1="17.5" y1="13" x2="17.5" y2="22.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.4"/>
      <line x1="11" y1="11" x2="15.5" y2="15.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.35"/>
    </svg>
  )
}

function IconBlitz() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M14 2 L5 13.5 L11.2 13.5 L10 22 L19 10.5 L12.8 10.5 Z"/>
    </svg>
  )
}

function IconVsAI() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="6.5" y="6.5" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.7"/>
      <line x1="9.5" y1="6.5" x2="9.5" y2="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="14.5" y1="6.5" x2="14.5" y2="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="9.5" y1="17.5" x2="9.5" y2="21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="14.5" y1="17.5" x2="14.5" y2="21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="6.5" y1="9.5" x2="3" y2="9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="6.5" y1="14.5" x2="3" y2="14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="17.5" y1="9.5" x2="21" y2="9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="17.5" y1="14.5" x2="21" y2="14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <rect x="9.5" y="9.5" width="5" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.2" opacity="0.4"/>
    </svg>
  )
}

const MODE_ICONS: Record<ModeId, React.ReactElement> = {
  'classic':  <IconClassicDuel />,
  'shifting': <IconShiftingBoard />,
  'scaleup':  <IconScaleUp />,
  'blitz':    <IconBlitz />,
  'vs-ai':    <IconVsAI />,
}

const CATEGORIES = ['General Knowledge', 'Crypto & Web3', 'Science', 'History', 'Pop Culture']

const DIFFICULTIES: { id: AIDifficulty; label: string; desc: string; tag: string; tagBg: string; tagColor: string }[] = [
  { id: 'easy',   label: 'Easy',   desc: 'AI plays randomly most of the time.',    tag: 'EASY',   tagBg: '#E8F7EE', tagColor: GREEN_DARK },
  { id: 'medium', label: 'Medium', desc: 'Balanced. AI mixes smart and random.',    tag: 'MEDIUM', tagBg: '#FFF4E0', tagColor: '#8A5A00' },
  { id: 'hard',   label: 'Hard',   desc: 'Perfect minimax. Every move is optimal.', tag: 'HARD',   tagBg: '#FDECEB', tagColor: '#A81C13' },
]

const RECENT_WINNERS = [
  { addr: '0x9f…c2', sol: '+0.10', mode: 'Blitz' },
  { addr: '0xa1…7d', sol: '+0.05', mode: 'Classic' },
  { addr: '0xbe…04', sol: '+0.20', mode: 'Scale Up' },
]

// ── Sub-components ───────────────────────────────────────────────────
function MindDuelLogo() {
  return (
    <div className="flex items-center gap-2">
      <div style={{ width: 28, height: 28, borderRadius: 8, background: INK, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 11, height: 11, borderRadius: 6, background: BLUE, boxShadow: '4px 0 0 #FF3B30', transform: 'translateX(-2px)' }} />
      </div>
      <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: -0.4, color: INK }}>MindDuel</span>
    </div>
  )
}

function SolBadge({ label }: { label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 999, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.3 }}>
      {label}
    </span>
  )
}

interface ModeCardProps {
  mode: typeof MODES[number]
  selected: boolean
  onClick: () => void
}
function ModeCard({ mode, selected, onClick }: ModeCardProps) {
  return (
    <motion.button
      onClick={() => mode.available && onClick()}
      disabled={!mode.available}
      whileHover={mode.available ? { scale: 1.02 } : {}}
      whileTap={mode.available ? { scale: 0.98 } : {}}
      style={{
        appearance: 'none', textAlign: 'left', fontFamily: 'inherit',
        flex: '0 0 auto', width: 158, padding: '16px 14px',
        background: '#fff', borderRadius: 18,
        border: selected ? `2px solid ${BLUE}` : '2px solid transparent',
        boxShadow: selected
          ? `0 6px 18px rgba(0,113,227,0.16), 0 0 0 0.5px rgba(0,113,227,0.3)`
          : '0 1px 2px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.06)',
        cursor: mode.available ? 'pointer' : 'not-allowed',
        opacity: mode.available ? 1 : 0.42,
        display: 'flex', flexDirection: 'column', gap: 10,
        transition: 'box-shadow 160ms ease, border-color 160ms ease',
      }}
    >
      <div style={{
        width: 48, height: 48, borderRadius: 14,
        background: selected ? '#E5F0FD' : '#F5F5F7',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: selected ? BLUE : INK,
      }}>{MODE_ICONS[mode.id]}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: INK, letterSpacing: -0.3, lineHeight: 1.2 }}>{mode.name}</div>
      <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.4, flex: 1 }}>{mode.desc}</div>
      <div style={{ alignSelf: 'flex-start', padding: '4px 9px', borderRadius: 999, background: mode.tagBg, color: mode.tagColor, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.3 }}>
        {mode.tag}
      </div>
    </motion.button>
  )
}

function CategoryChip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.96 }}
      style={{
        appearance: 'none', fontFamily: 'inherit', flexShrink: 0,
        padding: '7px 14px', borderRadius: 999,
        background: selected ? BLUE : '#fff',
        color: selected ? '#fff' : INK,
        border: 'none',
        boxShadow: selected ? '0 2px 8px rgba(0,113,227,0.25)' : '0 0 0 0.5px rgba(0,0,0,0.10)',
        fontSize: 13, fontWeight: 600, cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 5,
        transition: 'all 140ms ease',
      }}
    >
      {selected && <span style={{ fontSize: 10 }}>✓</span>}
      {label}
    </motion.button>
  )
}

function StakeStepper({ value, onStep }: { value: number; onStep: (d: number) => void }) {
  const BtnStyle: React.CSSProperties = {
    appearance: 'none', border: 'none', fontFamily: 'inherit',
    width: 40, height: 40, borderRadius: 14,
    background: '#F5F5F7', color: INK,
    fontSize: 22, fontWeight: 600, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', borderRadius: 14, padding: '10px 12px', boxShadow: '0 0 0 0.5px rgba(0,0,0,0.08)' }}>
      <button style={BtnStyle} onClick={() => onStep(-0.01)}>−</button>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1 }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: '#34C759', fontVariantNumeric: 'tabular-nums', letterSpacing: -0.4 }}>
          {value.toFixed(2)} <span style={{ fontSize: 14, fontWeight: 600 }}>SOL</span>
        </span>
        <span style={{ fontSize: 10.5, color: MUTED, fontWeight: 500, marginTop: 2 }}>
          Pot total: {(value * 2).toFixed(2)} SOL
        </span>
      </div>
      <button style={BtnStyle} onClick={() => onStep(0.01)}>+</button>
    </div>
  )
}

function PlayTypeToggle({ value, onChange }: { value: 'free' | 'stake'; onChange: (v: 'free' | 'stake') => void }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {(['free', 'stake'] as const).map(id => {
        const active = value === id
        return (
          <motion.button
            key={id}
            onClick={() => onChange(id)}
            whileTap={{ scale: 0.98 }}
            style={{
              appearance: 'none', fontFamily: 'inherit', flex: 1,
              padding: '12px', borderRadius: 14,
              background: active ? BLUE : '#fff',
              color: active ? '#fff' : INK,
              border: active ? `2px solid ${BLUE}` : '2px solid transparent',
              boxShadow: active ? '0 4px 12px rgba(0,113,227,0.22)' : '0 0 0 0.5px rgba(0,0,0,0.10)',
              cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              transition: 'all 160ms ease',
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 600 }}>{id === 'free' ? 'Free Play' : 'Stake Mode'}</span>
            <span style={{ fontSize: 11, opacity: active ? 0.85 : 0.6 }}>{id === 'free' ? 'Just for fun' : 'Real SOL'}</span>
          </motion.button>
        )
      })}
    </div>
  )
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('bg-white rounded-[20px] p-[22px]', className)} style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.05)' }}>
      {children}
    </div>
  )
}

function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10, padding: '0 2px' }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: INK, letterSpacing: -0.2 }}>{children}</span>
      {hint && <span style={{ fontSize: 11, color: MUTED }}>{hint}</span>}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────
export default function LobbyPage() {
  const router = useRouter()

  const [selectedMode, setSelectedMode] = useState<ModeId>('classic')
  const [playType, setPlayType]         = useState<'free' | 'stake'>('stake')
  const [stake, setStake]               = useState(0.05)
  const [cats, setCats]                 = useState<string[]>(['General Knowledge', 'Crypto & Web3'])
  const [difficulty, setDifficulty]     = useState<AIDifficulty>('hard')
  const [matchmaking, setMatchmaking]   = useState(false)

  const isVsAI = selectedMode === 'vs-ai'

  function toggleCat(c: string) {
    setCats(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])
  }
  function stepStake(d: number) {
    setStake(s => Math.max(0.01, parseFloat((s + d).toFixed(2))))
  }

  async function handleCreate() {
    setMatchmaking(true)
    sessionStorage.setItem('mddVsAI', isVsAI ? '1' : '0')
    sessionStorage.setItem('mddMode', selectedMode)
    sessionStorage.setItem('mddDifficulty', difficulty)
    await new Promise(r => setTimeout(r, 900))
    router.push('/game/demo-match-id')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5F5F7', fontFamily: "var(--font-inter), 'Inter', system-ui, sans-serif", color: INK }}>

      <NavBar active="play" />

      {/* ── Content ─────────────────────────────────────────────────── */}
      <div className="page-content has-bottom-tab" style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 40px', display: 'flex', gap: 24, alignItems: 'flex-start' }}>

        {/* ── Main column ─────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}
        >
          <div>
            <h1 style={{ fontSize: 36, fontWeight: 700, letterSpacing: -1.2, margin: '0 0 6px', lineHeight: 1.1 }}>New Match</h1>
            <p style={{ fontSize: 15, color: MUTED, margin: 0, lineHeight: 1.4 }}>
              Configure your duel — pick a mode, set the stakes, choose what you know.
            </p>
          </div>

          {/* Choose Mode */}
          <Card>
            <SectionTitle hint="Swipe →">Choose Mode</SectionTitle>
            <div style={{
              display: 'flex', gap: 10,
              overflowX: 'auto', paddingBottom: 4,
              scrollSnapType: 'x mandatory',
              WebkitOverflowScrolling: 'touch',
              msOverflowStyle: 'none',
            }}
              className="mode-scroll"
            >
              {MODES.map(m => (
                <div key={m.id} style={{ scrollSnapAlign: 'start', flexShrink: 0 }}>
                  <ModeCard mode={m} selected={selectedMode === m.id} onClick={() => setSelectedMode(m.id)} />
                </div>
              ))}
            </div>
          </Card>

          {/* Difficulty (VS AI only) */}
          <AnimatePresence>
            {isVsAI && (
              <motion.div
                key="difficulty"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.28 }}
                style={{ overflow: 'hidden' }}
              >
                <Card>
                  <SectionTitle>AI Difficulty</SectionTitle>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {DIFFICULTIES.map(d => {
                      const active = difficulty === d.id
                      return (
                        <motion.button
                          key={d.id}
                          onClick={() => setDifficulty(d.id)}
                          whileTap={{ scale: 0.97 }}
                          style={{
                            appearance: 'none', textAlign: 'left', fontFamily: 'inherit',
                            flex: 1, padding: 14, borderRadius: 16,
                            background: '#fff',
                            border: active ? `2px solid ${BLUE}` : '2px solid transparent',
                            boxShadow: active ? '0 4px 12px rgba(0,113,227,0.16)' : '0 0 0 0.5px rgba(0,0,0,0.08)',
                            cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 6,
                            transition: 'all 140ms ease',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: active ? BLUE : INK }}>{d.label}</span>
                            <span style={{ padding: '2px 7px', borderRadius: 999, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.3, background: d.tagBg, color: d.tagColor }}>{d.tag}</span>
                          </div>
                          <span style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.35 }}>{d.desc}</span>
                        </motion.button>
                      )
                    })}
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Play Type */}
          <AnimatePresence>
            {!isVsAI && (
              <motion.div
                key="playtype"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.28 }}
                style={{ overflow: 'hidden' }}
              >
                <Card>
                  <SectionTitle>Play Type</SectionTitle>
                  <PlayTypeToggle value={playType} onChange={setPlayType} />
                  <AnimatePresence>
                    {playType === 'stake' && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.22 }}
                        style={{ marginTop: 12, overflow: 'hidden' }}
                      >
                        <StakeStepper value={stake} onStep={stepStake} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Trivia Category */}
          <Card>
            <SectionTitle hint={`${cats.length} selected`}>Trivia Category</SectionTitle>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {CATEGORIES.map(c => (
                <CategoryChip key={c} label={c} selected={cats.includes(c)} onClick={() => toggleCat(c)} />
              ))}
            </div>
          </Card>

          {/* CTA */}
          <div style={{ display: 'flex', gap: 12 }}>
            <motion.button
              onClick={handleCreate}
              disabled={matchmaking}
              whileHover={{ scale: matchmaking ? 1 : 1.015 }}
              whileTap={{ scale: matchmaking ? 1 : 0.985 }}
              style={{
                appearance: 'none', border: 'none', flex: 1,
                padding: '15px', background: matchmaking ? '#AEAEB2' : BLUE, color: '#fff',
                borderRadius: 14, fontSize: 16, fontWeight: 600,
                fontFamily: 'inherit', cursor: matchmaking ? 'not-allowed' : 'pointer',
                boxShadow: matchmaking ? 'none' : '0 4px 14px rgba(0,113,227,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'all 160ms ease',
              }}
            >
              {matchmaking ? (
                <>
                  <span style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid #fff', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
                  {isVsAI ? 'Starting match…' : 'Finding opponent…'}
                </>
              ) : (
                isVsAI ? 'Play vs AI' : 'Create Game'
              )}
            </motion.button>
            {!isVsAI && (
              <button style={{
                appearance: 'none', border: '1.5px solid rgba(0,0,0,0.10)',
                padding: '15px 24px', background: '#fff', color: INK,
                borderRadius: 14, fontSize: 15, fontWeight: 600,
                fontFamily: 'inherit', cursor: 'pointer',
              }}>
                Join with Code
              </button>
            )}
          </div>
          {isVsAI && (
            <p style={{ textAlign: 'center', fontSize: 12, color: MUTED, marginTop: -8 }}>
              Practice mode — no SOL required
            </p>
          )}
        </motion.div>

        {/* ── Sidebar ──────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.08 }}
          style={{ width: 280, flexShrink: 0, flexDirection: 'column', gap: 16 }}
          className="hidden lg:flex"
        >
          <Card>
            <div style={{ fontSize: 11, fontWeight: 700, color: GREEN, letterSpacing: 0.5, marginBottom: 10 }}>● LIVE</div>
            <div>
              <div style={{ fontSize: 12, color: MUTED, marginBottom: 4, fontWeight: 500 }}>Active matches right now</div>
              <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: -1, lineHeight: 1, color: INK, fontVariantNumeric: 'tabular-nums' }}>142</div>
            </div>
            <div style={{ height: 14 }} />
            <div>
              <div style={{ fontSize: 12, color: MUTED, marginBottom: 4, fontWeight: 500 }}>Total wagered today</div>
              <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: -1, lineHeight: 1, color: GREEN, fontVariantNumeric: 'tabular-nums' }}>
                24.5 <span style={{ fontSize: 14, fontWeight: 600 }}>SOL</span>
              </div>
            </div>
          </Card>

          <Card>
            <SectionTitle>Recent winners</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {RECENT_WINNERS.map((r, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 0',
                  borderTop: i ? '0.5px solid rgba(0,0,0,0.06)' : 'none',
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{r.addr}</span>
                    <span style={{ fontSize: 11, color: MUTED }}>{r.mode}</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: GREEN_DARK, fontVariantNumeric: 'tabular-nums' }}>{r.sol} SOL</span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <SectionTitle>Match Code</SectionTitle>
            <p style={{ fontSize: 12, color: MUTED, marginBottom: 10, lineHeight: 1.4 }}>
              Have a friend&apos;s code? Join their game directly.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                placeholder="MNDL-XXXX"
                style={{
                  flex: 1, padding: '9px 12px', borderRadius: 10, border: '1.5px solid rgba(0,0,0,0.10)',
                  background: '#F5F5F7', fontSize: 13, fontWeight: 600,
                  fontFamily: 'ui-monospace, monospace', color: INK, outline: 'none',
                }}
              />
              <button style={{
                appearance: 'none', border: 'none', padding: '9px 14px', background: INK,
                color: '#fff', borderRadius: 10, fontSize: 13, fontWeight: 600,
                fontFamily: 'inherit', cursor: 'pointer',
              }}>Join</button>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
