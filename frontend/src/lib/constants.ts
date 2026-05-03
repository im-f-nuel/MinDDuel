export const PROGRAM_ID = 'Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS'

export const RPC_ENDPOINT = {
  devnet:  'https://api.devnet.solana.com',
  mainnet: 'https://api.mainnet-beta.solana.com',
} as const

export const STAKE_TIERS = [
  {
    id: 'casual',
    label: 'Casual',
    min: 0.01,
    max: 0.1,
    color: '#34C759',
    description: 'Low risk, great for beginners',
  },
  {
    id: 'challenger',
    label: 'Challenger',
    min: 0.1,
    max: 1,
    color: '#0071E3',
    description: 'Balanced risk for serious players',
  },
  {
    id: 'high-stakes',
    label: 'High Stakes',
    min: 1,
    max: null,
    color: '#FF9500',
    description: 'Maximum risk, maximum reward',
  },
] as const

export const GAME_MODES = [
  {
    id: 'classic',
    label: 'Classic Duel',
    description: 'Standard 3×3 Tic Tac Toe. Answer to move.',
    tag: 'MVP',
    available: true,
  },
  {
    id: 'shifting',
    label: 'Shifting Board',
    description: 'Rows and columns shift every 3 rounds.',
    tag: 'Beta',
    available: false,
  },
  {
    id: 'scale-up',
    label: 'Scale Up',
    description: 'Board grows 3×3 → 4×4 → 5×5 as you answer.',
    tag: 'Beta',
    available: false,
  },
  {
    id: 'blitz',
    label: 'Blitz',
    description: '5-second answers. No mercy.',
    tag: 'Soon',
    available: false,
  },
  {
    id: 'vs-ai',
    label: 'vs AI',
    description: 'Play vs MindDuel AI. Perfect for practice.',
    tag: 'NEW',
    available: true,
  },
] as const

export const HINTS = [
  { id: 'eliminate2',   label: 'Eliminate 2',   price: 0.002, description: 'Remove 2 wrong answers' },
  { id: 'category',     label: 'Category',      price: 0.001, description: 'Reveal the question category' },
  { id: 'extra-time',   label: 'Extra Time',    price: 0.003, description: '+30 seconds on the clock' },
  { id: 'first-letter', label: 'First Letter',  price: 0.001, description: 'Reveal the first letter of the answer' },
  { id: 'skip',         label: 'Skip',          price: 0.005, description: 'Skip this question entirely' },
] as const

export const PLATFORM_FEE_BPS    = 250
export const TURN_TIMEOUT_SECONDS = 86400
export const BLITZ_TIMEOUT_SECONDS = 300
