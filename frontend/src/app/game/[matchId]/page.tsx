'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from '@/components/ui/Toast'
import { getAIMove, type AIDifficulty } from '@/lib/ai'
import { sounds } from '@/lib/sounds'
import { WalletButton } from '@/components/wallet/WalletButton'
import { BottomTabBar } from '@/components/layout/BottomTabBar'
import { fetchTrivia, revealTrivia, WS_URL, type TriviaQuestion } from '@/lib/api'

// ── Design tokens ────────────────────────────────────────────────────
const BLUE       = '#0071E3'
const RED        = '#FF3B30'
const INK        = '#1D1D1F'
const MUTED      = '#6E6E73'
const FAINT      = '#AEAEB2'
const BG         = '#F5F5F7'
const GREEN      = '#34C759'
const GREEN_DARK = '#0A7A2D'
const ORANGE     = '#FF9500'

// ── Types ────────────────────────────────────────────────────────────
type CellValue  = 'X' | 'O' | null
type WinLine    = number[] | null
type GameWinner = 'X' | 'O' | 'draw'

interface Question {
  id: string
  question: string
  options: string[]
  correctIndex: number
  category: string
  timeLimit: number
}

type DisplayQuestion = { id: string; question: string; options: string[]; timeLimit: number }

// ── Local trivia pool (vs-AI) ─────────────────────────────────────────
const TRIVIA_POOL: Question[] = [
  { id: 'q1',  question: 'Which consensus mechanism does Solana use to order transactions?', options: ['Proof of Work', 'Proof of Stake', 'Proof of History', 'DPoS'], correctIndex: 2, category: 'Crypto & Web3', timeLimit: 20 },
  { id: 'q2',  question: "What is Solana's high-performance virtual machine called?", options: ['EVM', 'SVM', 'Wasm Runtime', 'LLVM'], correctIndex: 1, category: 'Crypto & Web3', timeLimit: 20 },
  { id: 'q3',  question: 'What does "TPS" stand for in blockchain?', options: ['Token Processing Speed', 'Transactions Per Second', 'Total Protocol Scale', 'Trust Proof System'], correctIndex: 1, category: 'Crypto & Web3', timeLimit: 20 },
  { id: 'q4',  question: 'What is a Program Derived Address (PDA) on Solana?', options: ['A wallet owned by a program', 'An address with no private key, derived from seeds', 'A temporary pending address', 'An address for NFT metadata'], correctIndex: 1, category: 'Crypto & Web3', timeLimit: 25 },
  { id: 'q5',  question: 'Which framework writes Solana programs in Rust?', options: ['Hardhat', 'Truffle', 'Anchor', 'Foundry'], correctIndex: 2, category: 'Crypto & Web3', timeLimit: 20 },
  { id: 'q6',  question: 'What is the smallest unit of SOL?', options: ['Wei', 'Satoshi', 'Lamport', 'Gwei'], correctIndex: 2, category: 'Crypto & Web3', timeLimit: 15 },
  { id: 'q7',  question: 'In what year was the Bitcoin whitepaper published?', options: ['2006', '2007', '2008', '2009'], correctIndex: 2, category: 'Crypto & Web3', timeLimit: 20 },
  { id: 'q8',  question: 'Which planet is known as the Red Planet?', options: ['Venus', 'Jupiter', 'Mars', 'Saturn'], correctIndex: 2, category: 'Science', timeLimit: 15 },
  { id: 'q9',  question: 'What is the chemical symbol for gold?', options: ['Go', 'Gd', 'Au', 'Ag'], correctIndex: 2, category: 'Science', timeLimit: 15 },
  { id: 'q10', question: 'Approximately how fast does light travel in a vacuum?', options: ['150,000 km/s', '300,000 km/s', '450,000 km/s', '600,000 km/s'], correctIndex: 1, category: 'Science', timeLimit: 20 },
  { id: 'q11', question: 'What is the atomic number of hydrogen?', options: ['1', '2', '4', '8'], correctIndex: 0, category: 'Science', timeLimit: 15 },
  { id: 'q12', question: 'In which year did World War II end?', options: ['1943', '1944', '1945', '1946'], correctIndex: 2, category: 'History', timeLimit: 15 },
  { id: 'q13', question: 'Who was the first President of the United States?', options: ['John Adams', 'Benjamin Franklin', 'Thomas Jefferson', 'George Washington'], correctIndex: 3, category: 'History', timeLimit: 15 },
  { id: 'q14', question: 'In what city was the Eiffel Tower built?', options: ['Rome', 'Berlin', 'London', 'Paris'], correctIndex: 3, category: 'History', timeLimit: 15 },
  { id: 'q15', question: 'What does CPU stand for?', options: ['Core Processing Unit', 'Central Processing Unit', 'Computer Power Unit', 'Central Program Utility'], correctIndex: 1, category: 'General Knowledge', timeLimit: 15 },
  { id: 'q16', question: 'What does HTML stand for?', options: ['HyperText Markup Language', 'HighText Machine Language', 'Hyper Transfer Markup Logic', 'HyperText Modern Layout'], correctIndex: 0, category: 'General Knowledge', timeLimit: 15 },
  { id: 'q17', question: 'What is the binary representation of decimal 10?', options: ['0101', '1001', '1010', '1100'], correctIndex: 2, category: 'General Knowledge', timeLimit: 20 },
  { id: 'q18', question: 'What is the value of π rounded to 2 decimal places?', options: ['3.12', '3.14', '3.16', '3.18'], correctIndex: 1, category: 'Math', timeLimit: 15 },
  { id: 'q19', question: 'What is 7 × 8?', options: ['48', '54', '56', '64'], correctIndex: 2, category: 'Math', timeLimit: 10 },
  { id: 'q20', question: 'What is the square root of 144?', options: ['10', '11', '12', '14'], correctIndex: 2, category: 'Math', timeLimit: 15 },
  { id: 'q21', question: 'What is 2 to the power of 10?', options: ['512', '1000', '1024', '2048'], correctIndex: 2, category: 'Math', timeLimit: 20 },
  { id: 'q22', question: 'What is the capital city of Japan?', options: ['Osaka', 'Kyoto', 'Tokyo', 'Hiroshima'], correctIndex: 2, category: 'General Knowledge', timeLimit: 15 },
  { id: 'q23', question: 'Which is the largest ocean on Earth?', options: ['Atlantic', 'Indian', 'Arctic', 'Pacific'], correctIndex: 3, category: 'General Knowledge', timeLimit: 15 },
  { id: 'q24', question: 'How many continents are there on Earth?', options: ['5', '6', '7', '8'], correctIndex: 2, category: 'General Knowledge', timeLimit: 15 },
  { id: 'q25', question: 'Which gas do plants absorb during photosynthesis?', options: ['Oxygen', 'Nitrogen', 'Carbon Dioxide', 'Hydrogen'], correctIndex: 2, category: 'Science', timeLimit: 15 },
  { id: 'q26', question: 'How many bones are in the adult human body?', options: ['186', '196', '206', '216'], correctIndex: 2, category: 'Science', timeLimit: 20 },
  { id: 'q27', question: 'Which ancient wonder was in Alexandria, Egypt?', options: ['The Colossus', 'The Lighthouse', 'The Mausoleum', 'The Hanging Gardens'], correctIndex: 1, category: 'History', timeLimit: 20 },
  { id: 'q28', question: 'How many possible winning combinations in 3×3 Tic Tac Toe?', options: ['6', '8', '10', '12'], correctIndex: 1, category: 'General Knowledge', timeLimit: 20 },
  { id: 'q29', question: 'What programming language writes native Solana programs?', options: ['Go', 'Rust', 'C++', 'TypeScript'], correctIndex: 1, category: 'Crypto & Web3', timeLimit: 15 },
  { id: 'q30', question: 'Which year was Solana launched?', options: ['2018', '2019', '2020', '2021'], correctIndex: 2, category: 'Crypto & Web3', timeLimit: 20 },
  { id: 'q31', question: 'What is 15% of 200?', options: ['20', '25', '30', '35'], correctIndex: 2, category: 'Math', timeLimit: 15 },
  { id: 'q32', question: 'What is the next prime number after 13?', options: ['14', '15', '17', '19'], correctIndex: 2, category: 'Math', timeLimit: 15 },
  { id: 'q33', question: 'What is the sum of angles in a triangle?', options: ['90°', '120°', '180°', '360°'], correctIndex: 2, category: 'Math', timeLimit: 10 },
  { id: 'q34', question: 'What is 5³?', options: ['15', '25', '100', '125'], correctIndex: 3, category: 'Math', timeLimit: 10 },
  { id: 'pc1', question: 'Which movie features the quote "I\'ll be back"?', options: ['RoboCop', 'Die Hard', 'The Terminator', 'Predator'], correctIndex: 2, category: 'Pop Culture', timeLimit: 15 },
  { id: 'pc2', question: 'In which TV show would you find the character Walter White?', options: ['Dexter', 'Ozark', 'Breaking Bad', 'Better Call Saul'], correctIndex: 2, category: 'Pop Culture', timeLimit: 15 },
  { id: 'pc3', question: 'What platform made short-form vertical videos mainstream globally?', options: ['Instagram', 'Snapchat', 'TikTok', 'YouTube Shorts'], correctIndex: 2, category: 'Pop Culture', timeLimit: 15 },
  { id: 'pc4', question: 'Which artist released the album "Renaissance" in 2022?', options: ['Rihanna', 'Beyoncé', 'Adele', 'Taylor Swift'], correctIndex: 1, category: 'Pop Culture', timeLimit: 15 },
  { id: 'pc5', question: 'What is the highest-grossing video game franchise of all time?', options: ['Call of Duty', 'Grand Theft Auto', 'Pokémon', 'Mario'], correctIndex: 2, category: 'Pop Culture', timeLimit: 20 },
  { id: 'pc6', question: 'Which superhero is known as the "Merc with a Mouth"?', options: ['Spider-Man', 'Deadpool', 'Wolverine', 'Cable'], correctIndex: 1, category: 'Pop Culture', timeLimit: 15 },
]

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// ── Game logic helpers ────────────────────────────────────────────────
function generateWinLines(size: number): number[][] {
  const lines: number[][] = []
  for (let r = 0; r < size; r++)
    for (let c = 0; c <= size - 3; c++)
      lines.push([r*size+c, r*size+c+1, r*size+c+2])
  for (let c = 0; c < size; c++)
    for (let r = 0; r <= size - 3; r++)
      lines.push([r*size+c, (r+1)*size+c, (r+2)*size+c])
  for (let r = 0; r <= size - 3; r++)
    for (let c = 0; c <= size - 3; c++)
      lines.push([r*size+c, (r+1)*size+c+1, (r+2)*size+c+2])
  for (let r = 0; r <= size - 3; r++)
    for (let c = 2; c < size; c++)
      lines.push([r*size+c, (r+1)*size+c-1, (r+2)*size+c-2])
  return lines
}

function checkWinner(board: CellValue[], size: number): number[] | null {
  for (const line of generateWinLines(size)) {
    const [a, b, c] = line
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return line
  }
  return null
}

function expandBoard(board: CellValue[], oldSize: number): CellValue[] {
  const newSize = oldSize + 1
  const next: CellValue[] = Array(newSize * newSize).fill(null)
  for (let r = 0; r < oldSize; r++)
    for (let c = 0; c < oldSize; c++)
      next[r * newSize + c] = board[r * oldSize + c]
  return next
}

function shiftBoardCells(board: CellValue[], shiftIdx: number, size: number): CellValue[] {
  const next = [...board]
  const target = shiftIdx % (size * 2)
  const right = shiftIdx % 2 === 0

  if (target < size) {
    const r = target
    const row = Array.from({ length: size }, (_, c) => next[r * size + c])
    if (right) {
      next[r * size] = row[size - 1]
      for (let c = 1; c < size; c++) next[r * size + c] = row[c - 1]
    } else {
      next[r * size + size - 1] = row[0]
      for (let c = 0; c < size - 1; c++) next[r * size + c] = row[c + 1]
    }
  } else {
    const col = target - size
    const column = Array.from({ length: size }, (_, r) => next[r * size + col])
    if (right) {
      next[col] = column[size - 1]
      for (let r = 1; r < size; r++) next[r * size + col] = column[r - 1]
    } else {
      next[(size - 1) * size + col] = column[0]
      for (let r = 0; r < size - 1; r++) next[r * size + col] = column[r + 1]
    }
  }
  return next
}

// ── WinLine overlay (dynamic) ─────────────────────────────────────────
function WinLineOverlay({ winLine, winner, boardSize }: { winLine: number[]; winner: GameWinner; boardSize: number }) {
  const color = winner === 'X' ? BLUE : RED
  const pct = 100 / boardSize
  const pts = winLine.map(idx => ({
    x: (idx % boardSize) * pct + pct / 2,
    y: Math.floor(idx / boardSize) * pct + pct / 2,
  }))
  const d = `M ${pts[0].x} ${pts[0].y} L ${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10, borderRadius: 24 }}>
      <motion.path d={d} stroke={color} strokeWidth="5" strokeLinecap="round" fill="none" vectorEffect="non-scaling-stroke"
        initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 0.9 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        style={{ filter: `drop-shadow(0 0 3px ${color}80)` }}
      />
    </svg>
  )
}

// ── Board cell ────────────────────────────────────────────────────────
function BoardCell({ value, isPending, isEmpty, isWin, isShifting, onClick }: {
  value: CellValue; isPending: boolean; isEmpty: boolean; isWin: boolean; isShifting: boolean; onClick: () => void
}) {
  const [hover, setHover] = useState(false)
  const winBg = value === 'X' ? '#E5F0FD' : '#FFE5E2'
  return (
    <motion.div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      layout
      animate={isShifting ? { scale: 0.92, opacity: 0.6 } : isWin ? { scale: 1.05 } : { scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      style={{
        borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: isWin ? winBg : isEmpty ? (hover && !isPending ? '#EEF4FF' : '#FAFAFA') : '#fff',
        border: isWin ? 'none' : isEmpty ? (isPending ? `1.5px solid ${BLUE}` : `1.5px solid ${hover ? BLUE + '40' : 'rgba(0,0,0,0.07)'}`) : 'none',
        boxShadow: isWin ? `0 4px 14px ${value === 'X' ? 'rgba(0,113,227,0.22)' : 'rgba(255,59,48,0.22)'}` : isEmpty ? (isPending ? `0 0 0 4px ${BLUE}1A` : 'none') : '0 1px 3px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.06)',
        cursor: isEmpty ? 'pointer' : 'default',
        transition: 'background 160ms ease, border-color 160ms ease',
        position: 'relative', zIndex: isWin ? 1 : 0,
      }}
    >
      {value && (
        <motion.span
          initial={{ scale: 0, rotate: -10 }} animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 360, damping: 20 }}
          style={{ fontSize: 'min(52px, 11vw)', fontWeight: 700, lineHeight: 1, letterSpacing: -1, color: value === 'X' ? BLUE : RED }}
        >
          {value}
        </motion.span>
      )}
    </motion.div>
  )
}

function PlayerChip({ color, label, addr, mark, active }: { color: string; label: string; addr: string; mark: 'X' | 'O'; active: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px 7px 7px', background: '#fff', borderRadius: 999, boxShadow: active ? `0 0 0 2px ${color}, 0 4px 12px ${color}22` : '0 0 0 0.5px rgba(0,0,0,0.08)', transition: 'all 200ms ease' }}>
      <div style={{ width: 28, height: 28, borderRadius: 14, background: color === BLUE ? '#E5F0FD' : '#FFE5E2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color }}>{mark}</div>
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
        <span style={{ fontSize: 10, color: MUTED, fontWeight: 600, letterSpacing: 0.3 }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{addr}</span>
      </div>
    </div>
  )
}

function HintPill({ label, cost, icon, onClick, disabled }: { label: string; cost: string; icon: string; onClick: () => void; disabled: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ appearance: 'none', border: 'none', background: '#fff', borderRadius: 999, padding: '6px 11px 6px 7px', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.06)', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1, fontFamily: 'inherit', transition: 'all 140ms ease' }}>
      <span style={{ width: 22, height: 22, borderRadius: 11, background: '#F5F5F7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9.5, fontWeight: 700, color: BLUE, fontVariantNumeric: 'tabular-nums' }}>{icon}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: INK }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: MUTED, fontVariantNumeric: 'tabular-nums' }}>{cost} SOL</span>
    </button>
  )
}

function AnswerBtn({ label, letterLabel, state, onClick, eliminated }: { label: string; letterLabel: string; state: 'default' | 'selected' | 'correct' | 'wrong'; onClick: () => void; eliminated: boolean }) {
  const colorMap = {
    default:  { bg: '#F5F5F7', border: 'transparent', color: INK,       circleBg: '#fff',  circleColor: MUTED },
    selected: { bg: '#E5F0FD', border: BLUE,          color: BLUE,      circleBg: BLUE,    circleColor: '#fff' },
    correct:  { bg: '#E8F7EE', border: GREEN,         color: GREEN_DARK, circleBg: GREEN,  circleColor: '#fff' },
    wrong:    { bg: '#FDECEB', border: RED,           color: '#A81C13', circleBg: RED,     circleColor: '#fff' },
  }
  const c = colorMap[state]
  return (
    <button onClick={onClick} disabled={eliminated} style={{ appearance: 'none', border: `1.5px solid ${c.border}`, background: c.bg, color: c.color, opacity: eliminated ? 0.32 : 1, padding: '12px 14px', borderRadius: 14, fontSize: 14, fontWeight: 600, textAlign: 'left', cursor: eliminated ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 10, transition: 'all 140ms ease', textDecoration: eliminated ? 'line-through' : 'none', width: '100%' }}>
      <span style={{ width: 22, height: 22, borderRadius: 11, background: c.circleBg, color: c.circleColor, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: state === 'default' ? '0 0 0 0.5px rgba(0,0,0,0.08)' : 'none' }}>
        {state === 'correct' ? '✓' : state === 'wrong' ? '✕' : letterLabel}
      </span>
      <span style={{ flex: 1 }}>{label}</span>
    </button>
  )
}

// ── TriviaCard — controlled ───────────────────────────────────────────
function TriviaCard({ question, selectedIdx, correctIdx, onPickAnswer, onTimeout, disabled, eliminated, timeKey }: {
  question: DisplayQuestion
  selectedIdx: number | null
  correctIdx: number | null
  onPickAnswer: (i: number) => void
  onTimeout: () => void
  disabled: boolean
  eliminated: number[]
  timeKey: number
}) {
  const [timeLeft, setTimeLeft] = useState(question.timeLimit)
  const revealed = correctIdx !== null

  useEffect(() => { setTimeLeft(question.timeLimit) }, [question.id, timeKey, question.timeLimit])

  useEffect(() => {
    if (disabled || revealed) return
    if (timeLeft <= 0) { onTimeout(); return }
    const id = setTimeout(() => setTimeLeft(t => t - 1), 1000)
    return () => clearTimeout(id)
  }, [timeLeft, disabled, revealed, onTimeout])

  function pick(i: number) {
    if (selectedIdx !== null || eliminated.includes(i) || disabled) return
    onPickAnswer(i)
  }

  const timerPct = Math.max(0, Math.min(100, (timeLeft / question.timeLimit) * 100))
  const urgent = timeLeft <= 5

  return (
    <div style={{ background: '#fff', borderRadius: 20, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: MUTED, letterSpacing: 0.5 }}>ANSWER TO CLAIM CELL</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: urgent ? RED : MUTED, fontVariantNumeric: 'tabular-nums' }}>{timeLeft.toFixed(0)}s</span>
      </div>
      <div style={{ height: 4, background: '#F2F2F7', borderRadius: 999, overflow: 'hidden', marginBottom: 14 }}>
        <div style={{ width: `${timerPct}%`, height: '100%', background: urgent ? RED : BLUE, transition: 'width 0.9s linear, background 200ms ease', borderRadius: 999 }} />
      </div>
      <p style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.35, color: INK, margin: '0 0 14px', letterSpacing: -0.3 }}>{question.question}</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {question.options.map((opt, i) => {
          let state: 'default' | 'selected' | 'correct' | 'wrong' = 'default'
          if (revealed) {
            if (i === correctIdx) state = 'correct'
            else if (i === selectedIdx) state = 'wrong'
          } else if (i === selectedIdx) state = 'selected'
          return <AnswerBtn key={i} label={opt} letterLabel={String.fromCharCode(65 + i)} state={state} onClick={() => pick(i)} eliminated={eliminated.includes(i)} />
        })}
      </div>
      {selectedIdx !== null && !revealed && (
        <div style={{ marginTop: 10, textAlign: 'center', fontSize: 12, color: BLUE }}>Checking…</div>
      )}
    </div>
  )
}

// ── Mode badge ────────────────────────────────────────────────────────
const MODE_META: Record<string, { label: string; color: string; bg: string }> = {
  classic:  { label: 'Classic',        color: INK,        bg: '#F5F5F7' },
  shifting: { label: 'Shifting Board', color: '#7C3AED',  bg: '#EDE9FE' },
  scaleup:  { label: 'Scale Up',       color: '#A81C13',  bg: '#FDECEB' },
  blitz:    { label: '⚡ Blitz',       color: '#8A5A00',  bg: '#FFF4E0' },
  'vs-ai':  { label: 'vs AI',          color: BLUE,       bg: '#E5F0FD' },
}

// ── Mode event banner ─────────────────────────────────────────────────
function ModeBanner({ msg }: { msg: string }) {
  return (
    <motion.div
      key={msg}
      initial={{ opacity: 0, y: -12, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 360, damping: 28 }}
      style={{ position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)', zIndex: 60, background: INK, color: '#fff', padding: '10px 20px', borderRadius: 999, fontSize: 14, fontWeight: 700, letterSpacing: -0.2, boxShadow: '0 8px 24px rgba(0,0,0,0.18)', whiteSpace: 'nowrap' }}
    >
      {msg}
    </motion.div>
  )
}

// ── Leaderboard (static sidebar) ──────────────────────────────────────
const LEADERBOARD = [
  { rank: 1, addr: '0x9f…c2', wins: 142, sol: '+12.4' },
  { rank: 2, addr: '0xa1…7d', wins: 128, sol: '+9.8' },
  { rank: 3, addr: '0x3f…a9', wins: 121, sol: '+8.1', opponent: true },
  { rank: 4, addr: '0xbe…04', wins: 117, sol: '+7.6' },
  { rank: 5, addr: '0x44…8e', wins: 99,  sol: '+5.2', you: true },
]

// ── Game Over Modal ───────────────────────────────────────────────────
function GameOverModal({ winner, isVsAI, myMark }: { winner: GameWinner; isVsAI: boolean; myMark: 'X' | 'O' }) {
  const iWon  = winner === myMark
  const isDraw = winner === 'draw'
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.38)', backdropFilter: 'blur(8px)' }}>
      <motion.div initial={{ scale: 0.82, y: 24, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.06 }} style={{ width: '100%', maxWidth: 360, background: '#fff', borderRadius: 24, padding: 32, textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
        <div style={{ width: 88, height: 88, borderRadius: 44, background: iWon ? '#E8F7EE' : isDraw ? '#E5F0FD' : '#FDECEB', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
          <div style={{ width: 64, height: 64, borderRadius: 32, background: iWon ? GREEN : isDraw ? BLUE : RED, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 8px 24px ${iWon ? 'rgba(52,199,89,0.32)' : isDraw ? 'rgba(0,113,227,0.28)' : 'rgba(255,59,48,0.28)'}` }}>
            {iWon ? (<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><path d="M8 16.5L13.5 22L24 11" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/></svg>)
              : isDraw ? (<span style={{ fontSize: 28, color: '#fff', fontWeight: 700 }}>=</span>)
              : (<svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M8 8L20 20M20 8L8 20" stroke="#fff" strokeWidth="3.5" strokeLinecap="round"/></svg>)}
          </div>
        </div>
        <h2 style={{ fontSize: 32, fontWeight: 700, letterSpacing: -1, margin: '0 0 6px', color: INK }}>{iWon ? 'You Won!' : isDraw ? "It's a Draw!" : 'You Lost'}</h2>
        <p style={{ fontSize: 14, color: MUTED, margin: '0 0 24px', lineHeight: 1.4 }}>
          {iWon ? '+0.095 SOL sent to your wallet' : isDraw ? 'Pot split 50/50' : isVsAI ? 'The AI was too strong this time' : 'Better luck next time'}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <a href="/lobby" style={{ display: 'block' }}>
            <button style={{ appearance: 'none', border: 'none', width: '100%', padding: '14px', background: BLUE, color: '#fff', borderRadius: 14, fontSize: 15, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,113,227,0.25)' }}>Play Again</button>
          </a>
          <a href={`/result?r=${iWon ? 'win' : isDraw ? 'draw' : 'lose'}`} style={{ display: 'block' }}>
            <button style={{ appearance: 'none', border: '1.5px solid rgba(0,0,0,0.10)', width: '100%', padding: '13px', background: '#fff', color: INK, borderRadius: 14, fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>View Result</button>
          </a>
        </div>
      </motion.div>
    </motion.div>
  )
}

interface LogEntry { q: string; correct: boolean; time: number }

// ── Main Page ─────────────────────────────────────────────────────────
export default function GamePage({ params }: { params: { matchId: string } }) {
  const toast = useToast()

  const [isVsAI, setIsVsAI]         = useState(false)
  const [myMark, setMyMark]         = useState<'X' | 'O'>('X')
  const [difficulty, setDifficulty] = useState<AIDifficulty>('hard')
  const [isLoading, setIsLoading]   = useState(true)
  const [gameModeStr, setGameModeStr] = useState('classic')

  // Board state — dynamic size
  const [boardSize, setBoardSize]         = useState(3)
  const [board, setBoard]                 = useState<CellValue[]>(Array(9).fill(null))
  const [currentPlayer, setCurrentPlayer] = useState<'X' | 'O'>('X')
  const [winLine, setWinLine]             = useState<WinLine>(null)
  const [winner, setWinner]               = useState<GameWinner | null>(null)

  // Trivia state
  const [pendingCell, setPendingCell]       = useState<number | null>(null)
  const [questionIndex, setQuestionIndex]   = useState(0)
  const [eliminated, setEliminated]         = useState<number[]>([])
  const [timeKey, setTimeKey]               = useState(0)
  const [triviaSelectedIdx, setTriviaSelectedIdx] = useState<number | null>(null)
  const [triviaCorrectIdx, setTriviaCorrectIdx]   = useState<number | null>(null)
  const [apiQuestion, setApiQuestion]       = useState<TriviaQuestion | null>(null)
  const [apiSessionId, setApiSessionId]     = useState<string | null>(null)
  const [triviaFetching, setTriviaFetching] = useState(false)

  // Mode-specific state
  const [isShifting, setIsShifting] = useState(false)
  const [modeMsg, setModeMsg]       = useState('')

  const gameOver = winner !== null

  // Refs for sync access in closures
  const boardRef         = useRef(board)
  const boardSizeRef     = useRef(3)
  const gameModeRef      = useRef('classic')
  const roundCountRef    = useRef(0)
  const shiftCountRef    = useRef(0)
  const activePoolRef    = useRef<Question[]>(TRIVIA_POOL)
  const matchLogRef      = useRef<LogEntry[]>([])
  const questionStartRef = useRef<number>(Date.now())
  const wsRef            = useRef<WebSocket | null>(null)

  useEffect(() => { boardRef.current = board }, [board])

  const localQ = activePoolRef.current[questionIndex % activePoolRef.current.length]
  const displayQ: DisplayQuestion = isVsAI || !apiQuestion ? localQ : apiQuestion

  // Blitz: force 5s time limit
  const effectiveQ: DisplayQuestion = gameModeStr === 'blitz'
    ? { ...displayQ, timeLimit: 5 }
    : displayQ

  // ── Config + WS setup ───────────────────────────────────────────────
  useEffect(() => {
    const vsAI = sessionStorage.getItem('mddVsAI') === '1'
    const diff = (sessionStorage.getItem('mddDifficulty') ?? 'hard') as AIDifficulty
    const mark = (sessionStorage.getItem('mddMyMark') ?? 'X') as 'X' | 'O'
    const mode = sessionStorage.getItem('mddMode') ?? 'classic'

    setIsVsAI(vsAI)
    setDifficulty(diff)
    setMyMark(mark)
    setGameModeStr(mode)
    gameModeRef.current = mode

    const savedCats = JSON.parse(sessionStorage.getItem('mddCategories') ?? '[]') as string[]
    const filtered = savedCats.length > 0
      ? TRIVIA_POOL.filter(q => savedCats.includes(q.category))
      : TRIVIA_POOL
    activePoolRef.current = shuffle([...(filtered.length >= 5 ? filtered : TRIVIA_POOL)])

    const t = setTimeout(() => {
      setIsLoading(false)
      const modeLabel = MODE_META[mode]?.label ?? mode
      toast(vsAI ? `You play as X — AI plays as O [${modeLabel}]` : `Match found — you play as ${mark} [${modeLabel}]`, 'info')
    }, 900)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // WS for PvP
  useEffect(() => {
    if (isLoading) return
    const isPvP = !isVsAI && !params.matchId.startsWith('vs-ai-')
    if (!isPvP) return

    const ws = new WebSocket(`${WS_URL}/ws/${params.matchId}`)
    wsRef.current = ws

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'board_updated') {
          if (msg.board) { setBoard(msg.board); boardRef.current = msg.board }
          if (msg.boardSize) { setBoardSize(msg.boardSize); boardSizeRef.current = msg.boardSize }
          if (msg.nextPlayer) setCurrentPlayer(msg.nextPlayer)
          if (msg.winLine) setWinLine(msg.winLine)
          if (msg.winner) setWinner(msg.winner)
          setTriviaSelectedIdx(null); setTriviaCorrectIdx(null)
          setApiQuestion(null); setApiSessionId(null)
          setEliminated([]); setPendingCell(null)
          setQuestionIndex(i => i + 1); setTimeKey(k => k + 1)
        } else if (msg.type === 'state' && msg.match) {
          setBoard(msg.match.board); setCurrentPlayer(msg.match.currentPlayer)
        }
      } catch {}
    }

    return () => { ws.close(); wsRef.current = null }
  }, [isLoading, isVsAI, params.matchId])

  useEffect(() => { questionStartRef.current = Date.now() }, [timeKey])

  // Sound + save on game over
  useEffect(() => {
    if (!winner) return
    if (winner === myMark) sounds.win()
    else if (winner !== 'draw') sounds.lose()

    const modeId  = sessionStorage.getItem('mddMode') ?? 'classic'
    const modeMap: Record<string, string> = { classic: 'Classic Duel', shifting: 'Shifting Board', scaleup: 'Scale Up', blitz: 'Blitz', 'vs-ai': 'vs AI' }
    const stake = parseFloat(sessionStorage.getItem('mddStake') ?? '0.05')
    const matchResult = { result: winner === myMark ? 'win' : winner === 'draw' ? 'draw' : 'lose', opponent: isVsAI ? 'MindDuel AI' : '0x3f…a9', mode: modeMap[modeId] ?? modeId, isVsAI, stake, log: matchLogRef.current }
    sessionStorage.setItem('mddLastMatch', JSON.stringify(matchResult))

    const stored = JSON.parse(localStorage.getItem('mddHistory') ?? '[]')
    const entry = { id: Date.now().toString(), timestamp: Date.now(), result: matchResult.result, opponent: matchResult.opponent, mode: matchResult.mode, isVsAI, stake, questions: matchLogRef.current.length, correct: matchLogRef.current.filter(l => l.correct).length }
    localStorage.setItem('mddHistory', JSON.stringify([entry, ...stored].slice(0, 50)))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winner])

  // AI move
  useEffect(() => {
    if (!isVsAI || currentPlayer !== 'O' || gameOver || isLoading) return
    if (boardRef.current.every(c => c !== null)) return
    const id = setTimeout(() => {
      const move = getAIMove(boardRef.current, 'O', difficulty, boardSizeRef.current)
      if (move === -1) return
      const next = [...boardRef.current] as CellValue[]
      next[move] = 'O'
      const win = checkWinner(next, boardSizeRef.current)
      sounds.place()
      setBoard(next)
      boardRef.current = next
      if (win) { setWinLine(win); setWinner('O') }
      else if (next.every(c => c !== null)) {
        if (gameModeRef.current === 'scaleup' && boardSizeRef.current < 5) {
          triggerExpand(next)
        } else {
          setWinner('draw')
        }
      } else {
        setCurrentPlayer('X'); setQuestionIndex(i => i + 1); setEliminated([]); setTimeKey(k => k + 1)
        roundCountRef.current += 1
        checkShift()
      }
    }, 1200 + Math.random() * 800)
    return () => clearTimeout(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVsAI, currentPlayer, gameOver, isLoading, difficulty])

  function sendWsEvent(event: unknown) {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(event))
    }
  }

  function triggerExpand(currentBoard: CellValue[]) {
    const oldSize = boardSizeRef.current
    const newSize = oldSize + 1
    const expanded = expandBoard(currentBoard, oldSize)
    boardSizeRef.current = newSize
    setBoardSize(newSize)
    setBoard(expanded)
    boardRef.current = expanded
    setModeMsg(`⬆ Board expanded to ${newSize}×${newSize}!`)
    setTimeout(() => setModeMsg(''), 2200)
    // continue game
    setCurrentPlayer(p => p === 'X' ? 'O' : 'X')
    setQuestionIndex(i => i + 1)
    setEliminated([])
    setTimeKey(k => k + 1)
    setPendingCell(null)
  }

  function checkShift() {
    if (gameModeRef.current !== 'shifting') return
    if (roundCountRef.current % 3 !== 0) return
    shiftCountRef.current += 1
    const shifted = shiftBoardCells([...boardRef.current], shiftCountRef.current, boardSizeRef.current)
    setIsShifting(true)
    setTimeout(() => {
      setBoard(shifted)
      boardRef.current = shifted
      setIsShifting(false)
      setModeMsg('↔ Board shifted!')
      setTimeout(() => setModeMsg(''), 1800)
    }, 350)
  }

  function advanceTurn(place: boolean, cell: number) {
    const currentSize = boardSizeRef.current
    const mode = gameModeRef.current

    if (place) {
      sounds.place()
      const nextBoard = [...boardRef.current] as CellValue[]
      nextBoard[cell] = currentPlayer
      const win = checkWinner(nextBoard, currentSize)
      setBoard(nextBoard)
      boardRef.current = nextBoard
      setPendingCell(null)

      if (win) {
        setWinLine(win)
        setWinner(currentPlayer)
        if (!isVsAI) sendWsEvent({ type: 'board_updated', board: nextBoard, boardSize: currentSize, nextPlayer: null, winner: currentPlayer, winLine: win })
        return
      }

      if (nextBoard.every(c => c !== null)) {
        if (mode === 'scaleup' && currentSize < 5) {
          triggerExpand(nextBoard)
          if (!isVsAI) sendWsEvent({ type: 'board_updated', board: expandBoard(nextBoard, currentSize), boardSize: currentSize + 1, nextPlayer: currentPlayer === 'X' ? 'O' : 'X', winner: null, winLine: null })
          return
        }
        setWinner('draw')
        if (!isVsAI) sendWsEvent({ type: 'board_updated', board: nextBoard, boardSize: currentSize, nextPlayer: null, winner: 'draw', winLine: null })
        return
      }

      // Scale Up: expand when enough pieces placed
      if (mode === 'scaleup') {
        const placed = nextBoard.filter(c => c !== null).length
        const shouldExpand = (currentSize === 3 && placed >= 4) || (currentSize === 4 && placed >= 10)
        if (shouldExpand && currentSize < 5) {
          const expanded = expandBoard(nextBoard, currentSize)
          const newSize = currentSize + 1
          boardSizeRef.current = newSize
          setBoardSize(newSize)
          setBoard(expanded)
          boardRef.current = expanded
          setModeMsg(`⬆ Board expanded to ${newSize}×${newSize}!`)
          setTimeout(() => setModeMsg(''), 2200)
          const nextPlayer: 'X' | 'O' = currentPlayer === 'X' ? 'O' : 'X'
          setCurrentPlayer(nextPlayer)
          setQuestionIndex(i => i + 1); setEliminated([]); setTimeKey(k => k + 1)
          roundCountRef.current += 1
          if (!isVsAI) sendWsEvent({ type: 'board_updated', board: expanded, boardSize: newSize, nextPlayer, winner: null, winLine: null })
          return
        }
      }
    } else {
      setPendingCell(null)
    }

    const nextPlayer: 'X' | 'O' = currentPlayer === 'X' ? 'O' : 'X'
    setCurrentPlayer(nextPlayer)
    setQuestionIndex(i => i + 1)
    setEliminated([])
    setTimeKey(k => k + 1)
    roundCountRef.current += 1

    if (!isVsAI) {
      sendWsEvent({ type: 'board_updated', board: boardRef.current, boardSize: boardSizeRef.current, nextPlayer, winner: null, winLine: null })
    }

    checkShift()
  }

  async function handleCellClick(i: number) {
    if (gameOver || board[i] || pendingCell !== null || currentPlayer !== myMark) return
    setPendingCell(i)

    if (!isVsAI) {
      setTriviaFetching(true)
      try {
        const savedCats = JSON.parse(sessionStorage.getItem('mddCategories') ?? '[]') as string[]
        const trivia = await fetchTrivia(savedCats)
        setApiQuestion(trivia.question)
        setApiSessionId(trivia.sessionId)
      } catch {
        toast('Failed to load question', 'error')
        setPendingCell(null)
      }
      setTriviaFetching(false)
    }
  }

  const handlePickAnswer = useCallback(async (idx: number) => {
    if (pendingCell === null) return
    const elapsed = parseFloat(((Date.now() - questionStartRef.current) / 1000).toFixed(1))
    setTriviaSelectedIdx(idx)

    let correct: boolean
    let correctIndex: number

    if (isVsAI || !apiSessionId) {
      correct = idx === localQ.correctIndex
      correctIndex = localQ.correctIndex
    } else {
      try {
        const result = await revealTrivia(apiSessionId, idx)
        correct = result.correct
        correctIndex = result.correctIndex
      } catch {
        setTriviaSelectedIdx(null)
        toast('Error checking answer — try again', 'error')
        return
      }
    }

    setTriviaCorrectIdx(correctIndex)
    matchLogRef.current = [...matchLogRef.current, { q: displayQ.question.slice(0, 45), correct, time: elapsed }]
    if (correct) sounds.correct()
    else sounds.wrong()

    setTimeout(() => {
      toast(correct ? 'Correct! Move placed.' : 'Wrong answer — turn lost.', correct ? 'success' : 'error')
      setTriviaSelectedIdx(null); setTriviaCorrectIdx(null)
      setApiQuestion(null); setApiSessionId(null)
      advanceTurn(correct, pendingCell)
    }, 900)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCell, localQ, apiSessionId, isVsAI, displayQ])

  const handleTimeout = useCallback(() => {
    const elapsed = parseFloat(((Date.now() - questionStartRef.current) / 1000).toFixed(1))
    matchLogRef.current = [...matchLogRef.current, { q: displayQ.question.slice(0, 45), correct: false, time: elapsed }]
    sounds.timeout()
    toast("Time's up! Turn forfeited.", 'warning')
    setTriviaSelectedIdx(null); setTriviaCorrectIdx(null)
    setApiQuestion(null); setApiSessionId(null)
    if (pendingCell !== null) advanceTurn(false, pendingCell)
    else { setCurrentPlayer(p => (p === 'X' ? 'O' : 'X')); setQuestionIndex(i => i + 1); setEliminated([]); setTimeKey(k => k + 1); roundCountRef.current += 1; checkShift() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCell, displayQ])

  function useEliminate() {
    if (!isVsAI) { toast('Hint not available in PvP mode', 'info'); return }
    const wrong = localQ.options.map((_, i) => i).filter(i => i !== localQ.correctIndex && !eliminated.includes(i))
    if (wrong.length < 2) return
    const picks = wrong.sort(() => Math.random() - 0.5).slice(0, 2)
    setEliminated(prev => [...prev, ...picks])
    toast('2 wrong answers removed', 'info')
  }

  const isMyTurn   = currentPlayer === myMark && !gameOver
  const isAITurn   = isVsAI && currentPlayer === 'O' && !gameOver
  const isOppTurn  = !isVsAI && currentPlayer !== myMark && !gameOver
  const boardDisabled = gameOver || pendingCell !== null || isAITurn || isOppTurn || isShifting

  const turnText = isShifting ? 'Board is shifting…'
    : isMyTurn ? (pendingCell !== null ? 'Answer to claim cell' : 'Your turn — select a cell')
    : isAITurn ? 'AI is thinking…'
    : 'Opponent\'s turn'

  const modeMeta = MODE_META[gameModeStr] ?? MODE_META.classic
  const stake = typeof window !== 'undefined' ? parseFloat(sessionStorage.getItem('mddStake') ?? '0.05') : 0.05

  return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: "var(--font-inter), 'Inter', system-ui, sans-serif", color: INK, display: 'flex', flexDirection: 'column' }}>

      <AnimatePresence>
        {gameOver && winner && <GameOverModal winner={winner} isVsAI={isVsAI} myMark={myMark} />}
      </AnimatePresence>

      <AnimatePresence>
        {modeMsg && <ModeBanner msg={modeMsg} />}
      </AnimatePresence>

      <AnimatePresence>
        {isLoading && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', inset: 0, zIndex: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: BG, gap: 16 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', border: `3px solid ${BLUE}`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
            <p style={{ fontSize: 15, fontWeight: 500, color: MUTED }}>Connecting to match…</p>
            <p style={{ fontSize: 12, color: FAINT, fontFamily: 'ui-monospace, monospace' }}>{params.matchId}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <nav className="glass-nav" style={{ height: 64, flexShrink: 0 }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 20px', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: INK, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 11, height: 11, borderRadius: 6, background: BLUE, boxShadow: `4px 0 0 ${RED}`, transform: 'translateX(-2px)' }} />
            </div>
            <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: -0.4 }}>MindDuel</span>
            <span style={{ padding: '3px 9px', borderRadius: 999, background: modeMeta.bg, color: modeMeta.color, fontSize: 11, fontWeight: 700, letterSpacing: 0.3 }}>{modeMeta.label}</span>
            {boardSize > 3 && (
              <span style={{ padding: '3px 9px', borderRadius: 999, background: '#FDECEB', color: '#A81C13', fontSize: 11, fontWeight: 700, letterSpacing: 0.3 }}>{boardSize}×{boardSize}</span>
            )}
          </div>
          <WalletButton />
        </div>
      </nav>

      <div className="game-layout" style={{ flex: 1, display: 'flex', overflow: 'hidden', maxWidth: 1280, margin: '0 auto', width: '100%' }}>

        {/* ── Board panel ───────────────────────────────────────────── */}
        <div className="game-board-panel" style={{ flex: '0 0 60%', padding: '28px 40px', display: 'flex', flexDirection: 'column', borderRight: '0.5px solid rgba(0,0,0,0.06)' }}>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <PlayerChip color={BLUE} label="YOU" addr="0x44…8e" mark={myMark} active={currentPlayer === myMark} />
              <span style={{ fontSize: 12, fontWeight: 600, color: FAINT, letterSpacing: 1 }}>VS</span>
              <PlayerChip color={RED} label={isVsAI ? 'AI' : 'OPPONENT'} addr={isVsAI ? 'MindDuel AI' : '0x3f…a9'} mark={myMark === 'X' ? 'O' : 'X'} active={currentPlayer !== myMark} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {!isVsAI && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: '#fff', borderRadius: 999, boxShadow: '0 0 0 0.5px rgba(0,0,0,0.08)' }}>
                  <span style={{ fontSize: 12, color: MUTED, fontWeight: 500 }}>Wager</span>
                  <span style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{stake.toFixed(2)} SOL</span>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px', background: isVsAI ? '#F5F5F7' : '#E8F7EE', borderRadius: 999 }}>
                <span style={{ fontSize: 12, color: isVsAI ? MUTED : GREEN_DARK, fontWeight: 600, opacity: 0.75 }}>{isVsAI ? 'Practice' : 'Pot'}</span>
                <span style={{ fontSize: 16, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: isVsAI ? MUTED : GREEN_DARK, letterSpacing: -0.3 }}>{isVsAI ? 'Free' : (stake * 2).toFixed(2) + ' SOL'}</span>
              </div>
            </div>
          </div>

          {/* Shifting Board: round progress */}
          {gameModeStr === 'shifting' && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#7C3AED', letterSpacing: 0.3 }}>SHIFT IN</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#7C3AED' }}>{3 - (roundCountRef.current % 3)} turns</span>
              </div>
              <div style={{ height: 3, background: '#EDE9FE', borderRadius: 999, overflow: 'hidden' }}>
                <motion.div
                  animate={{ width: `${((roundCountRef.current % 3) / 3) * 100}%` }}
                  transition={{ duration: 0.3 }}
                  style={{ height: '100%', background: '#7C3AED', borderRadius: 999 }}
                />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
            <motion.div animate={{ scale: [1, 1.02, 1] }} transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: isShifting ? ORANGE : isMyTurn ? BLUE : isAITurn ? MUTED : '#E5E5EA', color: (isMyTurn || isAITurn || isShifting) ? '#fff' : INK, padding: '10px 18px', borderRadius: 999, boxShadow: isMyTurn ? `0 6px 20px ${BLUE}40` : isShifting ? `0 6px 20px ${ORANGE}40` : 'none', fontSize: 14, fontWeight: 600, letterSpacing: -0.2, transition: 'background 300ms ease' }}
            >
              <span style={{ width: 7, height: 7, borderRadius: 4, background: '#fff', opacity: isMyTurn || isAITurn || isShifting ? 1 : 0.4, boxShadow: isMyTurn ? '0 0 0 4px rgba(255,255,255,0.28)' : 'none' }} />
              {turnText}
            </motion.div>
          </div>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'relative', width: 'min(460px, 100%)', aspectRatio: '1 / 1' }}>
              <motion.div
                animate={isShifting ? { scale: 0.97, opacity: 0.75 } : { scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
                style={{ position: 'absolute', inset: 0, background: '#fff', borderRadius: 24, boxShadow: `0 2px 8px rgba(0,0,0,0.06), 0 0 0 0.5px ${isShifting ? ORANGE : 'rgba(0,0,0,0.05)'}`, padding: 14, overflow: 'hidden', display: 'grid', gridTemplateColumns: `repeat(${boardSize}, 1fr)`, gridTemplateRows: `repeat(${boardSize}, 1fr)`, gap: boardSize === 3 ? 10 : boardSize === 4 ? 8 : 6, transition: 'box-shadow 300ms ease' }}
              >
                {board.map((cell, i) => (
                  <BoardCell key={i} value={cell} isPending={i === pendingCell && !cell} isEmpty={!cell} isWin={winLine?.includes(i) ?? false} isShifting={isShifting} onClick={() => !boardDisabled && handleCellClick(i)} />
                ))}
              </motion.div>
              <AnimatePresence>
                {winLine && winner && winner !== 'draw' && <WinLineOverlay winLine={winLine} winner={winner} boardSize={boardSize} />}
              </AnimatePresence>
            </div>
          </div>

          <AnimatePresence>
            {pendingCell !== null && !gameOver && (
              <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} style={{ textAlign: 'center', fontSize: 13, color: BLUE, fontWeight: 600, marginTop: 14 }}>
                Cell {pendingCell + 1} selected — answer to claim
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* ── Right: Trivia + Power-ups + Leaderboard ───────────────── */}
        <div className="game-right-panel" style={{ flex: 1, padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 16, overflow: 'hidden' }}>

          <AnimatePresence mode="wait">
            {isAITurn ? (
              <motion.div key="ai" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ type: 'spring', stiffness: 320, damping: 28 }} style={{ background: '#fff', borderRadius: 20, padding: '28px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 56, height: 56, borderRadius: 28, background: '#E5F0FD', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>🤖</div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 16, fontWeight: 600, color: INK, marginBottom: 10 }}>AI is thinking…</p>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                    {[0, 1, 2].map(i => (<motion.span key={i} animate={{ opacity: [0.2, 1, 0.2] }} transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.22 }} style={{ width: 8, height: 8, borderRadius: 4, background: BLUE, display: 'inline-block' }} />))}
                  </div>
                </div>
                <p style={{ fontSize: 12, color: MUTED }}>Calculating optimal move…</p>
              </motion.div>

            ) : isOppTurn ? (
              <motion.div key="opp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ type: 'spring', stiffness: 320, damping: 28 }} style={{ background: '#fff', borderRadius: 20, padding: '32px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[0, 1, 2].map(i => (<motion.span key={i} animate={{ opacity: [0.2, 0.9, 0.2] }} transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.28 }} style={{ width: 10, height: 10, borderRadius: 5, background: FAINT, display: 'inline-block' }} />))}
                </div>
                <p style={{ fontSize: 15, fontWeight: 600, color: MUTED }}>Opponent&apos;s turn</p>
                <p style={{ fontSize: 12, color: FAINT, fontFamily: 'ui-monospace, monospace' }}>Waiting for their answer…</p>
              </motion.div>

            ) : !gameOver ? (
              <motion.div key={`trivia-${questionIndex}`} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ type: 'spring', stiffness: 320, damping: 28, delay: 0.05 }}>
                {triviaFetching ? (
                  <div style={{ background: '#fff', borderRadius: 20, padding: '40px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', border: `3px solid ${BLUE}`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                    <p style={{ fontSize: 13, color: MUTED }}>Loading question…</p>
                  </div>
                ) : (
                  <TriviaCard
                    question={effectiveQ}
                    selectedIdx={triviaSelectedIdx}
                    correctIdx={triviaCorrectIdx}
                    onPickAnswer={handlePickAnswer}
                    onTimeout={handleTimeout}
                    disabled={pendingCell === null}
                    eliminated={eliminated}
                    timeKey={timeKey}
                  />
                )}
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Power-ups */}
          {!gameOver && (
            <div style={{ background: '#fff', borderRadius: 20, padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, letterSpacing: 0.5, marginBottom: 10, padding: '0 2px' }}>POWER-UPS</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <HintPill label="Eliminate 2" cost="0.002" icon="50/50" onClick={useEliminate} disabled={eliminated.length > 0 || pendingCell === null} />
                <HintPill label="Skip" cost="0.005" icon="↷" onClick={() => {
                  toast('Question skipped', 'info')
                  if (pendingCell !== null) advanceTurn(false, pendingCell)
                  else { setCurrentPlayer(p => p === 'X' ? 'O' : 'X'); setQuestionIndex(i => i + 1); setTimeKey(k => k + 1); roundCountRef.current += 1; checkShift() }
                }} disabled={pendingCell === null} />
                <HintPill label="Extra Time" cost="0.003" icon="+8s" onClick={() => toast('Extra time added', 'info')} disabled={pendingCell === null} />
              </div>
            </div>
          )}

          {/* Live Leaderboard */}
          <div style={{ background: '#fff', borderRadius: 20, padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.05)', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Live Leaderboard</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: GREEN, background: '#E8F7EE', padding: '2px 6px', borderRadius: 6, letterSpacing: 0.3 }}>LIVE</span>
              </div>
              <a href="/leaderboard" style={{ fontSize: 12, color: MUTED, cursor: 'pointer', textDecoration: 'none' }}>View all →</a>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              {LEADERBOARD.map(p => (
                <div key={p.rank} style={{ display: 'flex', alignItems: 'center', padding: (p as { you?: boolean }).you ? '9px 8px' : '9px 4px', borderTop: p.rank !== 1 ? '0.5px solid rgba(0,0,0,0.06)' : 'none', background: (p as { you?: boolean }).you ? '#F5F9FF' : 'transparent', borderRadius: (p as { you?: boolean }).you ? 10 : 0 }}>
                  <span style={{ width: 22, fontSize: 12, fontWeight: 700, color: p.rank <= 3 ? INK : FAINT, fontVariantNumeric: 'tabular-nums' }}>{p.rank}</span>
                  <div style={{ width: 24, height: 24, borderRadius: 12, marginRight: 10, background: (p as { opponent?: boolean }).opponent ? '#FFE5E2' : (p as { you?: boolean }).you ? '#E5F0FD' : '#F2F2F7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: (p as { opponent?: boolean }).opponent ? RED : (p as { you?: boolean }).you ? BLUE : MUTED }}>
                    {(p as { opponent?: boolean }).opponent ? 'O' : (p as { you?: boolean }).you ? 'X' : ''}
                  </div>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: (p as { you?: boolean }).you ? BLUE : INK }}>
                    {p.addr}{(p as { you?: boolean }).you && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 600, color: BLUE, background: '#E5F0FD', padding: '1px 5px', borderRadius: 4, letterSpacing: 0.3 }}>YOU</span>}
                  </span>
                  <span style={{ fontSize: 12, color: MUTED, marginRight: 14, fontVariantNumeric: 'tabular-nums' }}>{p.wins}W</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: GREEN_DARK, fontVariantNumeric: 'tabular-nums' }}>{p.sol}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <BottomTabBar active="play" />
    </div>
  )
}
