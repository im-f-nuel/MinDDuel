import { Connection, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { AnchorProvider, Program, BN, type Idl, type Wallet } from '@coral-xyz/anchor'
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  getAccount,
} from '@solana/spl-token'
import IDL from '@/idl/mind_duel.json'
import {
  PROGRAM_ID,
  TREASURY_ADDRESS,
  MOCK_USDC_MINT,
  USDC_DECIMALS,
  BACKEND_URL,
} from './constants'

export type { Wallet as AnchorWallet }

const PROGRAM_PUBKEY = new PublicKey(PROGRAM_ID)
const GAME_SEED      = Buffer.from('game')
const ESCROW_SEED    = Buffer.from('escrow')
const HINT_SEED      = Buffer.from('hint')

export interface AnchorClient {
  program: Program
  provider: AnchorProvider
}

export function buildAnchorClient(wallet: Wallet, connection: Connection): AnchorClient {
  const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' })
  const program  = new Program(IDL as Idl, PROGRAM_PUBKEY, provider)
  return { program, provider }
}

export function findGamePDA(playerOne: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([GAME_SEED, playerOne.toBuffer()], PROGRAM_PUBKEY)
}

export function findEscrowPDA(game: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([ESCROW_SEED, game.toBuffer()], PROGRAM_PUBKEY)
}

export function findHintLedgerPDA(game: PublicKey, player: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([HINT_SEED, game.toBuffer(), player.toBuffer()], PROGRAM_PUBKEY)
}

export function solToLamports(sol: number): BN {
  return new BN(Math.round(sol * LAMPORTS_PER_SOL))
}

export function usdcToBaseUnits(usdc: number): BN {
  return new BN(Math.round(usdc * 10 ** USDC_DECIMALS))
}

export function modeToAnchorVariant(modeId: string): Record<string, Record<string, never>> {
  switch (modeId) {
    case 'shifting': return { shiftingBoard: {} }
    case 'scaleup':  return { scaleUp: {} }
    case 'blitz':    return { blitz: {} }
    default:         return { classic: {} }
  }
}

// ── SOL flow ────────────────────────────────────────────────────────

export async function initializeGame(
  client: AnchorClient,
  playerOne: PublicKey,
  stakeSOL: number,
  modeId: string,
): Promise<string> {
  const [game]   = findGamePDA(playerOne)
  const [escrow] = findEscrowPDA(game)
  return client.program.methods
    .initializeGame(solToLamports(stakeSOL), modeToAnchorVariant(modeId) as never)
    .accounts({ playerOne, game, escrow, systemProgram: SystemProgram.programId })
    .rpc()
}

export async function joinGame(
  client: AnchorClient,
  playerTwo: PublicKey,
  playerOnePubkey: PublicKey,
): Promise<string> {
  const [game]   = findGamePDA(playerOnePubkey)
  const [escrow] = findEscrowPDA(game)
  return client.program.methods
    .joinGame()
    .accounts({ playerTwo, game, escrow, systemProgram: SystemProgram.programId })
    .rpc()
}

export async function commitAnswer(
  client: AnchorClient,
  player: PublicKey,
  playerOnePubkey: PublicKey,
  answerHash: Uint8Array,
  cellIndex: number,
): Promise<string> {
  const [game] = findGamePDA(playerOnePubkey)
  return client.program.methods
    .commitAnswer(Array.from(answerHash), cellIndex)
    .accounts({ player, game })
    .rpc()
}

export async function revealAnswer(
  client: AnchorClient,
  player: PublicKey,
  playerOnePubkey: PublicKey,
  answerIndex: number,
  nonce: Uint8Array,
): Promise<string> {
  const [game] = findGamePDA(playerOnePubkey)
  return client.program.methods
    .revealAnswer(answerIndex, Array.from(nonce))
    .accounts({ player, game })
    .rpc()
}

export async function settleGame(
  client: AnchorClient,
  playerOnePubkey: PublicKey,
  playerTwoPubkey: PublicKey,
): Promise<string> {
  const [game]   = findGamePDA(playerOnePubkey)
  const [escrow] = findEscrowPDA(game)
  const treasury = new PublicKey(TREASURY_ADDRESS)
  return client.program.methods
    .settleGame()
    .accounts({
      game,
      escrow,
      playerOne: playerOnePubkey,
      playerTwo: playerTwoPubkey,
      treasury,
      systemProgram: SystemProgram.programId,
    })
    .rpc()
}

// ── Mock USDC flow ──────────────────────────────────────────────────

function requireUsdcMint(): PublicKey {
  if (!MOCK_USDC_MINT) {
    throw new Error('MOCK_USDC_MINT not configured. Run backend setup script and set NEXT_PUBLIC_MOCK_USDC_MINT.')
  }
  return new PublicKey(MOCK_USDC_MINT)
}

export function getUsdcAta(owner: PublicKey, allowOwnerOffCurve = true): PublicKey {
  return getAssociatedTokenAddressSync(requireUsdcMint(), owner, allowOwnerOffCurve)
}

export async function getUsdcBalance(
  connection: Connection,
  owner: PublicKey,
): Promise<number> {
  try {
    const ata = getUsdcAta(owner, false)
    const acc = await getAccount(connection, ata)
    return Number(acc.amount) / 10 ** USDC_DECIMALS
  } catch {
    return 0
  }
}

export class FaucetRateLimitError extends Error {
  constructor(message: string) { super(message); this.name = 'FaucetRateLimitError' }
}

export async function requestUsdcFaucet(walletPubkey: PublicKey): Promise<{ signature: string; amount: number }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('You are offline')
  }
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 15_000)
  let res: Response
  try {
    res = await fetch(`${BACKEND_URL}/api/faucet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: walletPubkey.toBase58() }),
      signal: ctrl.signal,
    })
  } catch (e: unknown) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error('Faucet request timed out')
    }
    throw new Error('Cannot reach faucet server')
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) {
    let detail = ''
    try {
      const body = await res.json() as { error?: string; detail?: string }
      detail = body.error ?? body.detail ?? ''
    } catch {
      detail = await res.text().catch(() => '')
    }
    if (res.status === 429) throw new FaucetRateLimitError(detail || 'Rate limited')
    throw new Error(detail || `Faucet failed (HTTP ${res.status})`)
  }
  return res.json()
}

export async function initializeGameUsdc(
  client: AnchorClient,
  playerOne: PublicKey,
  stakeUsdc: number,
  modeId: string,
): Promise<string> {
  const usdcMint = requireUsdcMint()
  const [game]   = findGamePDA(playerOne)
  const [escrow] = findEscrowPDA(game)
  const escrowAta    = getAssociatedTokenAddressSync(usdcMint, escrow, true)
  const playerOneAta = getAssociatedTokenAddressSync(usdcMint, playerOne, false)

  return client.program.methods
    .initializeGameUsdc(usdcToBaseUnits(stakeUsdc), modeToAnchorVariant(modeId) as never)
    .accounts({
      playerOne,
      usdcMint,
      game,
      escrow,
      escrowAta,
      playerOneAta,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc()
}

export async function joinGameUsdc(
  client: AnchorClient,
  playerTwo: PublicKey,
  playerOnePubkey: PublicKey,
): Promise<string> {
  const usdcMint = requireUsdcMint()
  const [game]   = findGamePDA(playerOnePubkey)
  const [escrow] = findEscrowPDA(game)
  const escrowAta    = getAssociatedTokenAddressSync(usdcMint, escrow, true)
  const playerTwoAta = getAssociatedTokenAddressSync(usdcMint, playerTwo, false)

  return client.program.methods
    .joinGameUsdc()
    .accounts({
      playerTwo,
      usdcMint,
      game,
      escrow,
      escrowAta,
      playerTwoAta,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc()
}

export async function settleGameUsdc(
  client: AnchorClient,
  payer: PublicKey,
  playerOnePubkey: PublicKey,
  playerTwoPubkey: PublicKey,
): Promise<string> {
  const usdcMint = requireUsdcMint()
  const [game]   = findGamePDA(playerOnePubkey)
  const [escrow] = findEscrowPDA(game)
  const treasury = new PublicKey(TREASURY_ADDRESS)
  const escrowAta     = getAssociatedTokenAddressSync(usdcMint, escrow, true)
  const playerOneAta  = getAssociatedTokenAddressSync(usdcMint, playerOnePubkey, false)
  const playerTwoAta  = getAssociatedTokenAddressSync(usdcMint, playerTwoPubkey, false)
  const treasuryAta   = getAssociatedTokenAddressSync(usdcMint, treasury, false)

  return client.program.methods
    .settleGameUsdc()
    .accounts({
      game,
      usdcMint,
      escrow,
      escrowAta,
      playerOne: playerOnePubkey,
      playerOneAta,
      playerTwo: playerTwoPubkey,
      playerTwoAta,
      treasury,
      treasuryAta,
      payer,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc()
}
