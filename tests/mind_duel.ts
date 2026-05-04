import * as anchor from "@coral-xyz/anchor"
import { Program } from "@coral-xyz/anchor"
import { MindDuel } from "../target/types/mind_duel"
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js"
import { expect } from "chai"
import * as crypto from "crypto"

const GAME_SEED = Buffer.from("game")
const ESCROW_SEED = Buffer.from("escrow")
const TREASURY = new PublicKey("CPoofbZho4bJmSAyVJxfeMK9CoZpXpDYftctghwUJX86")

function deriveGamePDA(playerOne: PublicKey, programId: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [GAME_SEED, playerOne.toBuffer()],
    programId,
  )
}

function deriveEscrowPDA(gamePDA: PublicKey, programId: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [ESCROW_SEED, gamePDA.toBuffer()],
    programId,
  )
}

function buildAnswerHash(answerIndex: number, nonce: Buffer): Buffer {
  const preimage = Buffer.alloc(33)
  preimage[0] = answerIndex
  nonce.copy(preimage, 1)
  return crypto.createHash("sha256").update(preimage).digest()
}

describe("mind-duel", () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)
  const program = anchor.workspace.MindDuel as Program<MindDuel>

  const playerOne = provider.wallet as anchor.Wallet
  const playerTwo = anchor.web3.Keypair.generate()

  let gamePDA: PublicKey
  let escrowPDA: PublicKey

  before(async () => {
    ;[gamePDA] = deriveGamePDA(playerOne.publicKey, program.programId)
    ;[escrowPDA] = deriveEscrowPDA(gamePDA, program.programId)

    // Fund player two
    const sig = await provider.connection.requestAirdrop(
      playerTwo.publicKey,
      2 * LAMPORTS_PER_SOL,
    )
    await provider.connection.confirmTransaction(sig)
  })

  it("initializes a game and locks stake in escrow", async () => {
    const stake = new anchor.BN(0.1 * LAMPORTS_PER_SOL)

    await program.methods
      .initializeGame(stake, { classic: {} })
      .accounts({
        playerOne: playerOne.publicKey,
        game: gamePDA,
        escrow: escrowPDA,
        systemProgram: SystemProgram.programId,
      })
      .rpc()

    const game = await program.account.gameAccount.fetch(gamePDA)
    expect(game.playerOne.toBase58()).to.equal(playerOne.publicKey.toBase58())
    expect(game.stakePerPlayer.toNumber()).to.equal(stake.toNumber())
    expect(game.potLamports.toNumber()).to.equal(stake.toNumber())
    expect(game.status).to.deep.equal({ waitingForPlayer: {} })

    const escrowBalance = await provider.connection.getBalance(escrowPDA)
    expect(escrowBalance).to.be.gte(stake.toNumber())
  })

  it("player two joins and escrow doubles", async () => {
    const balanceBefore = await provider.connection.getBalance(escrowPDA)

    await program.methods
      .joinGame()
      .accounts({
        playerTwo: playerTwo.publicKey,
        game: gamePDA,
        escrow: escrowPDA,
        systemProgram: SystemProgram.programId,
      })
      .signers([playerTwo])
      .rpc()

    const game = await program.account.gameAccount.fetch(gamePDA)
    expect(game.playerTwo.toBase58()).to.equal(playerTwo.publicKey.toBase58())
    expect(game.status).to.deep.equal({ active: {} })

    const balanceAfter = await provider.connection.getBalance(escrowPDA)
    expect(balanceAfter).to.be.gt(balanceBefore)
  })

  it("commit and reveal answer — correct answer places piece", async () => {
    const nonce = crypto.randomBytes(32)
    const answerIndex = 0
    const cellIndex = 4 // center
    const hashBytes = buildAnswerHash(answerIndex, nonce)

    // Commit
    await program.methods
      .commitAnswer(Array.from(hashBytes) as unknown as number[], cellIndex)
      .accounts({
        player: playerOne.publicKey,
        game: gamePDA,
      })
      .rpc()

    let game = await program.account.gameAccount.fetch(gamePDA)
    expect(game.committedCell).to.equal(cellIndex)
    expect(Buffer.from(game.committedHash).some(b => b !== 0)).to.be.true

    // Reveal
    await program.methods
      .revealAnswer(answerIndex, Array.from(nonce) as unknown as number[])
      .accounts({
        player: playerOne.publicKey,
        game: gamePDA,
      })
      .rpc()

    game = await program.account.gameAccount.fetch(gamePDA)
    expect(game.committedHash.every(b => b === 0)).to.be.true
    // Cell 4 should be X
    expect(game.board[cellIndex]).to.deep.equal({ x: {} })
  })

  it("rejects wrong turn", async () => {
    // playerOne just played — it's playerTwo's turn now
    const nonce = crypto.randomBytes(32)
    const hashBytes = buildAnswerHash(1, nonce)

    try {
      await program.methods
        .commitAnswer(Array.from(hashBytes) as unknown as number[], 0)
        .accounts({
          player: playerOne.publicKey,
          game: gamePDA,
        })
        .rpc()
      expect.fail("Should have thrown NotYourTurn")
    } catch (err: unknown) {
      expect((err as { error?: { errorCode?: { code?: string } } }).error?.errorCode?.code).to.equal("NotYourTurn")
    }
  })

  it("settles game and pays winner", async () => {
    // playerTwo plays cells 0,1 → playerOne plays 4(done),7,8 to win via col 4-7?
    // Simpler: fast-forward by placing winning moves via commit-reveal
    // For test brevity: settle_game reads board and we already placed X at 4
    // Let's place enough for X to win: cells 0,4,8 diagonal
    const moves: Array<{ player: anchor.web3.Keypair | anchor.Wallet; cell: number; isOne: boolean }> = [
      // playerTwo turn: cell 0
      { player: playerTwo, cell: 0, isOne: false },
      // playerOne turn: cell 8
      { player: playerOne, cell: 8, isOne: true },
      // playerTwo turn: cell 1
      { player: playerTwo, cell: 1, isOne: false },
      // playerOne turn: cell 0 already taken, use 2
      // Actually let's use cell 2 for playerOne to get 8,4,2 → reversed diagonal 2-4-6? No.
      // 0,4,8 diagonal for X: X at 4 done. need 0 and 8.
      // playerTwo: 3 (block attempt), playerOne: 0 → wins 0,4,8
    ]

    // playerTwo: cell 3
    {
      const nonce = crypto.randomBytes(32)
      const hashBytes = buildAnswerHash(0, nonce)
      await program.methods.commitAnswer(Array.from(hashBytes) as unknown as number[], 3)
        .accounts({ player: playerTwo.publicKey, game: gamePDA }).signers([playerTwo]).rpc()
      await program.methods.revealAnswer(0, Array.from(nonce) as unknown as number[])
        .accounts({ player: playerTwo.publicKey, game: gamePDA }).signers([playerTwo]).rpc()
    }
    // playerOne: cell 0 → wins diagonal 0,4,8
    {
      const nonce = crypto.randomBytes(32)
      const hashBytes = buildAnswerHash(0, nonce)
      await program.methods.commitAnswer(Array.from(hashBytes) as unknown as number[], 0)
        .accounts({ player: playerOne.publicKey, game: gamePDA }).rpc()
      await program.methods.revealAnswer(0, Array.from(nonce) as unknown as number[])
        .accounts({ player: playerOne.publicKey, game: gamePDA }).rpc()
    }

    const p1BalBefore = await provider.connection.getBalance(playerOne.publicKey)

    await program.methods
      .settleGame()
      .accounts({
        game: gamePDA,
        escrow: escrowPDA,
        playerOne: playerOne.publicKey,
        playerTwo: playerTwo.publicKey,
        treasury: TREASURY,
        systemProgram: SystemProgram.programId,
      })
      .rpc()

    const game = await program.account.gameAccount.fetch(gamePDA)
    expect(game.status).to.deep.equal({ finished: {} })

    const p1BalAfter = await provider.connection.getBalance(playerOne.publicKey)
    expect(p1BalAfter).to.be.gt(p1BalBefore)
  })
})
