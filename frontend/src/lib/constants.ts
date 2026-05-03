export const PROGRAM_ID = 'Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS'

export const RPC_ENDPOINT = {
  devnet: 'https://api.devnet.solana.com',
  mainnet: 'https://api.mainnet-beta.solana.com',
}

export const STAKE_TIERS = [
  {
    id: 'casual',
    label: 'Casual',
    min: 0.01,
    max: 0.1,
    color: 'text-success',
    border: 'border-success/30',
    glow: 'hover:shadow-glow-success',
    badge: 'bg-success/10 text-success border-success/30',
    description: 'Low risk, great for beginners',
  },
  {
    id: 'challenger',
    label: 'Challenger',
    min: 0.1,
    max: 1,
    color: 'text-primary',
    border: 'border-primary/30',
    glow: 'hover:shadow-glow-violet',
    badge: 'bg-primary/10 text-primary-hover border-primary/30',
    description: 'Balanced risk for serious players',
  },
  {
    id: 'high-stakes',
    label: 'High Stakes',
    min: 1,
    max: null,
    color: 'text-accent',
    border: 'border-accent/30',
    glow: 'hover:shadow-glow-cyan',
    badge: 'bg-accent/10 text-accent border-accent/30',
    description: 'Maximum risk, maximum reward',
  },
] as const

export const GAME_MODES = [
  {
    id: 'classic',
    label: 'Classic Duel',
    iconId: 'grid',
    description: 'Standard 3×3 Tic Tac Toe. Answer to move.',
    tag: 'MVP',
    available: true,
  },
  {
    id: 'shifting',
    label: 'Shifting Board',
    iconId: 'shuffle',
    description: 'Rows and columns shift every 3 rounds.',
    tag: 'Beta',
    available: false,
  },
  {
    id: 'scale-up',
    label: 'Scale Up',
    iconId: 'maximize',
    description: 'Board grows 3×3 → 4×4 → 5×5 as you answer.',
    tag: 'Beta',
    available: false,
  },
  {
    id: 'blitz',
    label: 'Blitz',
    iconId: 'zap',
    description: '5-minute on-chain timer per turn. Fast or forfeit.',
    tag: 'Soon',
    available: false,
  },
  {
    id: 'vs-ai',
    label: 'vs AI',
    iconId: 'bot',
    description: 'Play vs MindDuel AI. Perfect for practice.',
    tag: 'NEW',
    available: true,
  },
] as const

export const HINTS = [
  { id: 'eliminate2', label: 'Eliminate 2', price: 0.002, iconId: 'scissors', description: 'Remove 2 wrong answers' },
  { id: 'category', label: 'Category', price: 0.001, iconId: 'tag', description: 'Reveal the question category' },
  { id: 'extra-time', label: 'Extra Time', price: 0.003, iconId: 'timer-plus', description: '+30 seconds on the clock' },
  { id: 'first-letter', label: 'First Letter', price: 0.001, iconId: 'type', description: 'Reveal the first letter' },
  { id: 'skip', label: 'Skip', price: 0.005, iconId: 'skip', description: 'Skip this question entirely' },
] as const

export const PLATFORM_FEE_BPS = 250

export const TURN_TIMEOUT_SECONDS = 86400
export const BLITZ_TIMEOUT_SECONDS = 300
