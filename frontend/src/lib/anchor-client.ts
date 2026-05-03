import { Connection, PublicKey } from '@solana/web3.js'
import { AnchorProvider, Program } from '@coral-xyz/anchor'
import { PROGRAM_ID } from './constants'

export interface GameAccount {
  playerOne: PublicKey
  playerTwo: PublicKey
  board: (number | null)[]
  currentPlayer: number
  status: 'waiting' | 'active' | 'finished'
  winner: PublicKey | null
  escrowLamports: bigint
  pot: bigint
  answerHash: number[] | null
}

export interface AnchorClient {
  program: Program
  provider: AnchorProvider
}

export function buildAnchorClient(
  wallet: Parameters<typeof AnchorProvider>[1],
  connection: Connection,
): AnchorClient {
  // Requires IDL — run `anchor build` to generate target/idl/mind_duel.json
  // Then: import IDL from '../../target/idl/mind_duel.json'
  // const program = new Program(IDL as Idl, new PublicKey(PROGRAM_ID), provider)
  const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' })
  throw new Error(
    `Anchor IDL not yet generated — run 'anchor build' then import target/idl/mind_duel.json. Provider: ${provider.publicKey?.toBase58() ?? 'none'}`,
  )
}

export function findGamePDA(playerOne: PublicKey, playerTwo: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('game'), playerOne.toBuffer(), playerTwo.toBuffer()],
    new PublicKey(PROGRAM_ID),
  )
}

export function findHintLedgerPDA(game: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('hint_ledger'), game.toBuffer()],
    new PublicKey(PROGRAM_ID),
  )
}
