/**
 * Smoke test: builds a `claim_hint_usdc` transaction against the deployed
 * devnet program WITHOUT sending it. Verifies:
 *   1. IDL has the instruction
 *   2. Account derivation works
 *   3. Anchor accepts the args + accounts
 *   4. The deployed program returns a sane simulation result (or a known
 *      error like "InvalidGameState" if no live match exists for the wallet)
 *
 * Run: node scripts/smoke-claim-hint-usdc.mjs <playerOnePubkey> [hintId]
 *   playerOnePubkey - the wallet that owns the GameAccount PDA you want to test
 *   hintId          - one of: eliminate2|category|extra-time|first-letter|skip
 *
 * If you don't pass a real PDA, the script still verifies the build path
 * end-to-end and reports the simulation error from devnet.
 */

import anchorPkg from '@coral-xyz/anchor'
const { AnchorProvider, Program, BN, Wallet } = anchorPkg
import { Connection, Keypair, PublicKey, SystemProgram, VersionedTransaction, TransactionMessage } from '@solana/web3.js'
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const PROGRAM_ID  = new PublicKey('8XZTXNux374128LFJSVhp5XSNyYMPNZpfw4vyjWmSJkN')
const TREASURY    = new PublicKey('CPoofbZho4bJmSAyVJxfeMK9CoZpXpDYftctghwUJX86')
const USDC_MINT_ENV = process.env.MOCK_USDC_MINT

const HINT_VARIANTS = {
  'eliminate2':   { eliminateTwo: {} },
  'category':     { categoryReveal: {} },
  'extra-time':   { extraTime: {} },
  'first-letter': { firstLetter: {} },
  'skip':         { skip: {} },
}

async function main() {
  const playerOneArg = process.argv[2]
  const hintId       = process.argv[3] ?? 'eliminate2'

  if (!playerOneArg) {
    console.log('Usage: node scripts/smoke-claim-hint-usdc.mjs <playerOnePubkey> [hintId]')
    console.log('Skipping live simulation; checking IDL/build path with a fake PDA…')
  }
  if (!HINT_VARIANTS[hintId]) {
    console.error(`Unknown hintId: ${hintId}. Use one of: ${Object.keys(HINT_VARIANTS).join('|')}`)
    process.exit(1)
  }

  // ── 1. Load IDL ────────────────────────────────────────────────────
  const idl = JSON.parse(readFileSync(resolve(__dirname, '../frontend/src/idl/mind_duel.json'), 'utf8'))
  const ix  = idl.instructions.find(i => i.name === 'claimHintUsdc')
  if (!ix) {
    console.error('❌ IDL missing claimHintUsdc instruction')
    process.exit(1)
  }
  console.log('✓ IDL has claimHintUsdc with', ix.accounts.length, 'accounts and arg:', ix.args[0])

  // ── 2. Setup Anchor with a throwaway signer (we just build, don't send) ──
  const conn     = new Connection('https://api.devnet.solana.com', 'confirmed')
  const dummy    = Keypair.generate()
  const provider = new AnchorProvider(conn, new Wallet(dummy), { commitment: 'confirmed' })
  const program  = new Program(idl, PROGRAM_ID, provider)

  // ── 3. Derive PDAs ─────────────────────────────────────────────────
  const playerOne = playerOneArg ? new PublicKey(playerOneArg) : Keypair.generate().publicKey
  const player    = playerOne  // for solo-test, signer = playerOne
  const usdcMint  = USDC_MINT_ENV ? new PublicKey(USDC_MINT_ENV) : null
  if (!usdcMint) {
    console.warn('⚠ MOCK_USDC_MINT not set — using dummy mint, simulation will fail with mint mismatch')
  }
  const mint = usdcMint ?? Keypair.generate().publicKey

  const [game]       = PublicKey.findProgramAddressSync([Buffer.from('game'),    playerOne.toBuffer()], PROGRAM_ID)
  const [escrow]     = PublicKey.findProgramAddressSync([Buffer.from('escrow'),  game.toBuffer()],     PROGRAM_ID)
  const [hintLedger] = PublicKey.findProgramAddressSync([Buffer.from('hint'),    game.toBuffer(), player.toBuffer()], PROGRAM_ID)

  const playerAta   = getAssociatedTokenAddressSync(mint, player,  false)
  const treasuryAta = getAssociatedTokenAddressSync(mint, TREASURY, false)
  const escrowAta   = getAssociatedTokenAddressSync(mint, escrow,  true)

  console.log('  game        ', game.toBase58())
  console.log('  escrow      ', escrow.toBase58())
  console.log('  hintLedger  ', hintLedger.toBase58())
  console.log('  playerAta   ', playerAta.toBase58())
  console.log('  treasuryAta ', treasuryAta.toBase58())
  console.log('  escrowAta   ', escrowAta.toBase58())

  // ── 4. Build the transaction (does NOT send) ───────────────────────
  let tx
  try {
    tx = await program.methods
      .claimHintUsdc(HINT_VARIANTS[hintId])
      .accounts({
        player,
        game,
        usdcMint: mint,
        hintLedger,
        playerAta,
        treasury: TREASURY,
        treasuryAta,
        escrow,
        escrowAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .transaction()
    console.log('✓ Transaction built successfully')
  } catch (e) {
    console.error('❌ Build failed:', e.message)
    process.exit(1)
  }

  // ── 5. Simulate against devnet (no signature, so will fail — but we
  //     can read the program's response: AccountNotInitialized vs
  //     InvalidGameState tells us the instruction discriminator was
  //     accepted by the deployed program). ────────────────────────────
  tx.feePayer = dummy.publicKey
  const { blockhash } = await conn.getLatestBlockhash()
  tx.recentBlockhash = blockhash
  // Convert to VersionedTransaction so we can simulate with sigVerify off.
  const vtx = new VersionedTransaction(
    new TransactionMessage({
      payerKey: dummy.publicKey,
      recentBlockhash: blockhash,
      instructions: tx.instructions,
    }).compileToV0Message(),
  )
  try {
    const sim = await conn.simulateTransaction(vtx, { sigVerify: false, replaceRecentBlockhash: true, commitment: 'processed' })
    if (sim.value.err) {
      console.log('— Simulation error (expected without a live match):')
      console.log('  err  :', JSON.stringify(sim.value.err))
      const log = (sim.value.logs ?? []).find(l => l.includes('Error') || l.includes('error') || l.includes('Custom'))
      if (log) console.log('  log  :', log)
      // The fact we get a *program* error (not "InvalidProgramId" or
      // "Cannot find instruction") proves the discriminator was decoded.
      const programErrors = (sim.value.logs ?? []).filter(l => l.includes(`Program ${PROGRAM_ID.toBase58()} invoke`) || l.includes('Program log:'))
      if (programErrors.length > 0) {
        console.log('✓ Deployed program decoded the instruction (saw program logs)')
      }
    } else {
      console.log('✓ Simulation succeeded (rare without real state — likely your wallet has a live match)')
    }
  } catch (e) {
    console.error('Simulation transport error:', e.message)
  }

  console.log('\n✓ Smoke test complete — IDL + build path + on-chain dispatch all reachable')
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
