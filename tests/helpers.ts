import * as anchor from "@coral-xyz/anchor"
import { Program, BN } from "@coral-xyz/anchor"
import {
  PublicKey,
  Keypair,
  SystemProgram,
  LAMPORTS_PER_SOL,
  Connection,
} from "@solana/web3.js"
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token"
import * as crypto from "crypto"
import * as fs from "fs"
import * as path from "path"

export const PROGRAM_ID = new PublicKey("HjvqXdSKcKt6YtVEYSryx7sH6RqiKNNFZsMdECT4LhM3")
export const GAME_SEED = Buffer.from("game")
export const ESCROW_SEED = Buffer.from("escrow")

const idlPath = path.resolve(__dirname, "../idl/mind_duel.json")
export const IDL = JSON.parse(fs.readFileSync(idlPath, "utf-8"))

export function loadProgram(provider: anchor.AnchorProvider): Program {
  return new Program(IDL, PROGRAM_ID, provider)
}

export function deriveGamePDA(playerOne: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([GAME_SEED, playerOne.toBuffer()], PROGRAM_ID)
}

export function deriveEscrowPDA(gamePDA: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([ESCROW_SEED, gamePDA.toBuffer()], PROGRAM_ID)
}

export function answerHash(answerIndex: number, nonce: Buffer): Buffer {
  const preimage = Buffer.alloc(33)
  preimage[0] = answerIndex
  nonce.copy(preimage, 1)
  return crypto.createHash("sha256").update(preimage).digest()
}

export async function airdrop(
  connection: Connection,
  pubkey: PublicKey,
  sol: number,
): Promise<void> {
  const sig = await connection.requestAirdrop(pubkey, sol * LAMPORTS_PER_SOL)
  const latest = await connection.getLatestBlockhash()
  await connection.confirmTransaction(
    { signature: sig, ...latest },
    "confirmed",
  )
}

export async function commitAndReveal(
  program: Program,
  gamePDA: PublicKey,
  player: Keypair | anchor.Wallet,
  cell: number,
  answerIndex = 0,
): Promise<void> {
  const nonce = crypto.randomBytes(32)
  const hash = answerHash(answerIndex, nonce)
  const isKeypair = "secretKey" in player
  const playerPubkey = isKeypair ? (player as Keypair).publicKey : (player as anchor.Wallet).publicKey

  const commitBuilder = program.methods
    .commitAnswer(Array.from(hash), cell)
    .accounts({ player: playerPubkey, game: gamePDA })
  if (isKeypair) commitBuilder.signers([player as Keypair])
  await commitBuilder.rpc()

  const revealBuilder = program.methods
    .revealAnswer(answerIndex, Array.from(nonce))
    .accounts({ player: playerPubkey, game: gamePDA })
  if (isKeypair) revealBuilder.signers([player as Keypair])
  await revealBuilder.rpc()
}

export function getAtaSync(mint: PublicKey, owner: PublicKey, allowOffCurve = false): PublicKey {
  return getAssociatedTokenAddressSync(mint, owner, allowOffCurve)
}

export const TOKEN_PROGRAM = TOKEN_PROGRAM_ID
export const ATA_PROGRAM = ASSOCIATED_TOKEN_PROGRAM_ID

export { BN, SystemProgram, LAMPORTS_PER_SOL }
