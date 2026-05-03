import type { CellValue } from '@/components/game/BoardRenderer'

export type AIDifficulty = 'easy' | 'medium' | 'hard'

const WIN_LINES: [number, number, number][] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
]

function findWinningMove(board: CellValue[], mark: 'X' | 'O'): number | null {
  for (const [a, b, c] of WIN_LINES) {
    const vals = [board[a], board[b], board[c]]
    if (vals.filter(v => v === mark).length === 2 && vals.includes(null)) {
      return [a, b, c][vals.indexOf(null)]
    }
  }
  return null
}

function randomEmpty(board: CellValue[]): number {
  const empty = board.reduce<number[]>((acc, v, i) => (v === null ? [...acc, i] : acc), [])
  return empty[Math.floor(Math.random() * empty.length)]
}

function minimax(board: CellValue[], aiMark: 'X' | 'O', isMaximizing: boolean, depth: number): number {
  const playerMark: 'X' | 'O' = aiMark === 'X' ? 'O' : 'X'

  for (const [a, b, c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a] === aiMark ? 10 - depth : depth - 10
    }
  }
  if (board.every(c => c !== null)) return 0

  const mark = isMaximizing ? aiMark : playerMark
  let best = isMaximizing ? -Infinity : Infinity

  for (let i = 0; i < 9; i++) {
    if (board[i] !== null) continue
    const next = [...board] as CellValue[]
    next[i] = mark
    const score = minimax(next, aiMark, !isMaximizing, depth + 1)
    best = isMaximizing ? Math.max(best, score) : Math.min(best, score)
  }
  return best
}

export function getAIMove(board: CellValue[], aiMark: 'X' | 'O', difficulty: AIDifficulty = 'hard'): number {
  const empty = board.reduce<number[]>((acc, v, i) => (v === null ? [...acc, i] : acc), [])
  if (empty.length === 0) return -1

  // Easy: 70% random; Medium: 30% random
  if (difficulty === 'easy' && Math.random() < 0.70) return randomEmpty(board)
  if (difficulty === 'medium' && Math.random() < 0.30) return randomEmpty(board)

  // First move: prefer center, then random corner
  if (empty.length === 9) return 4
  if (empty.length === 8) {
    const corners = [0, 2, 6, 8].filter(i => board[i] === null)
    if (corners.length > 0) return corners[Math.floor(Math.random() * corners.length)]
    return 4
  }

  // Win if possible
  const win = findWinningMove(board, aiMark)
  if (win !== null) return win

  // Block player from winning
  const playerMark: 'X' | 'O' = aiMark === 'X' ? 'O' : 'X'
  const block = findWinningMove(board, playerMark)
  if (block !== null) return block

  // Full minimax for remaining moves
  let bestScore = -Infinity
  let bestMove = empty[0]

  for (const i of empty) {
    const next = [...board] as CellValue[]
    next[i] = aiMark
    const score = minimax(next, aiMark, false, 0)
    if (score > bestScore) {
      bestScore = score
      bestMove = i
    }
  }
  return bestMove
}
