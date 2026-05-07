import * as anchor from "@coral-xyz/anchor"
import { BN } from "@coral-xyz/anchor"
import {
  PublicKey,
  Keypair,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js"
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAccount,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token"
import { expect } from "chai"
import {
  loadProgram,
  deriveGamePDA,
  deriveEscrowPDA,
  airdrop,
  commitAndReveal,
} from "./helpers"

const TREASURY = Keypair.generate().publicKey
const USDC_DECIMALS = 6
const USDC_UNIT = 10 ** USDC_DECIMALS

describe("mind-duel smart contract", () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)
  const program = loadProgram(provider)
  const connection = provider.connection
  const payer = provider.wallet as anchor.Wallet

  before(async () => {
    // Ensure payer has SOL (test-validator gives 500k SOL by default to wallet)
    const bal = await connection.getBalance(payer.publicKey)
    if (bal < 10 * LAMPORTS_PER_SOL) {
      await airdrop(connection, payer.publicKey, 100)
    }
  })

  // ============== SOL FLOW ==============
  describe("SOL flow", () => {
    const playerOne = Keypair.generate()
    const playerTwo = Keypair.generate()
    let gamePDA: PublicKey
    let escrowPDA: PublicKey
    const stake = new BN(0.1 * LAMPORTS_PER_SOL)

    before(async () => {
      await airdrop(connection, playerOne.publicKey, 5)
      await airdrop(connection, playerTwo.publicKey, 5)
      ;[gamePDA] = deriveGamePDA(playerOne.publicKey)
      ;[escrowPDA] = deriveEscrowPDA(gamePDA)
    })

    it("rejects stake below minimum (0.01 SOL)", async () => {
      const tinyStake = new BN(0.001 * LAMPORTS_PER_SOL)
      const tinyPlayer = Keypair.generate()
      await airdrop(connection, tinyPlayer.publicKey, 1)
      const [tinyGame] = deriveGamePDA(tinyPlayer.publicKey)
      const [tinyEscrow] = deriveEscrowPDA(tinyGame)

      try {
        await program.methods
          .initializeGame(tinyStake, { classic: {} })
          .accounts({
            playerOne: tinyPlayer.publicKey,
            game: tinyGame,
            escrow: tinyEscrow,
            systemProgram: SystemProgram.programId,
          })
          .signers([tinyPlayer])
          .rpc()
        expect.fail("Should have rejected stake too low")
      } catch (err: any) {
        expect(err.error?.errorCode?.code).to.equal("StakeTooLow")
      }
    })

    it("initializes game and locks stake", async () => {
      await program.methods
        .initializeGame(stake, { classic: {} })
        .accounts({
          playerOne: playerOne.publicKey,
          game: gamePDA,
          escrow: escrowPDA,
          systemProgram: SystemProgram.programId,
        })
        .signers([playerOne])
        .rpc()

      const game = await program.account.gameAccount.fetch(gamePDA)
      expect(game.playerOne.toBase58()).to.equal(playerOne.publicKey.toBase58())
      expect(game.stakePerPlayer.toNumber()).to.equal(stake.toNumber())
      expect(game.potLamports.toNumber()).to.equal(stake.toNumber())
      expect(game.status).to.deep.equal({ waitingForPlayer: {} })
      expect(game.currency).to.deep.equal({ sol: {} })

      const escrowBal = await connection.getBalance(escrowPDA)
      expect(escrowBal).to.be.gte(stake.toNumber())
    })

    it("rejects settle while game is WaitingForPlayer", async () => {
      try {
        await program.methods
          .settleGame()
          .accounts({
            game: gamePDA,
            escrow: escrowPDA,
            playerOne: playerOne.publicKey,
            playerTwo: PublicKey.default,
            treasury: TREASURY,
            systemProgram: SystemProgram.programId,
          })
          .rpc()
        expect.fail("Should have rejected settle on inactive game")
      } catch (err: any) {
        expect(err.error?.errorCode?.code).to.equal("InvalidGameState")
      }
    })

    it("rejects player_one trying to join their own game", async () => {
      try {
        await program.methods
          .joinGame()
          .accounts({
            playerTwo: playerOne.publicKey,
            game: gamePDA,
            escrow: escrowPDA,
            systemProgram: SystemProgram.programId,
          })
          .signers([playerOne])
          .rpc()
        expect.fail("Should reject self-join")
      } catch (err: any) {
        expect(err.error?.errorCode?.code).to.equal("Unauthorized")
      }
    })

    it("player two joins, status flips to Active, pot doubles", async () => {
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
      expect(game.potLamports.toNumber()).to.equal(stake.toNumber() * 2)
    })

    it("rejects double-join", async () => {
      const intruder = Keypair.generate()
      await airdrop(connection, intruder.publicKey, 5)
      try {
        await program.methods
          .joinGame()
          .accounts({
            playerTwo: intruder.publicKey,
            game: gamePDA,
            escrow: escrowPDA,
            systemProgram: SystemProgram.programId,
          })
          .signers([intruder])
          .rpc()
        expect.fail("Should reject double-join")
      } catch (err: any) {
        expect(err.error?.errorCode?.code).to.equal("GameAlreadyFull")
      }
    })

    it("rejects out-of-turn commit", async () => {
      // It's player_one's turn — player_two tries to commit
      const dummyHash = new Array(32).fill(0)
      try {
        await program.methods
          .commitAnswer(dummyHash, 0)
          .accounts({ player: playerTwo.publicKey, game: gamePDA })
          .signers([playerTwo])
          .rpc()
        expect.fail("Should reject out-of-turn")
      } catch (err: any) {
        expect(err.error?.errorCode?.code).to.equal("NotYourTurn")
      }
    })

    it("rejects premature settle: no winner, board not full, no timeout", async () => {
      // P1 places one move at 4 — game definitely not over.
      await commitAndReveal(program, gamePDA, playerOne, 4)
      try {
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
        expect.fail("Should reject settle on incomplete game")
      } catch (err: any) {
        expect(err.error?.errorCode?.code).to.equal("GameStillActive")
      }
    })

    it("plays winning sequence: X wins diagonal 0-4-8, settles, winner paid", async () => {
      // After previous test: P1 has X at 4, it's P2's turn.
      // Continue: P2 cell 1 → P1 cell 0 → P2 cell 2 → P1 cell 8 (X wins 0-4-8 diagonal)
      await commitAndReveal(program, gamePDA, playerTwo, 1)
      await commitAndReveal(program, gamePDA, playerOne, 0)
      await commitAndReveal(program, gamePDA, playerTwo, 2)
      await commitAndReveal(program, gamePDA, playerOne, 8)

      const gameBeforeSettle = await program.account.gameAccount.fetch(gamePDA)
      expect(gameBeforeSettle.board[0]).to.deep.equal({ x: {} })
      expect(gameBeforeSettle.board[4]).to.deep.equal({ x: {} })
      expect(gameBeforeSettle.board[8]).to.deep.equal({ x: {} })

      const p1Before = await connection.getBalance(playerOne.publicKey)
      const treasuryBefore = await connection.getBalance(TREASURY)

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

      const p1After = await connection.getBalance(playerOne.publicKey)
      const treasuryAfter = await connection.getBalance(TREASURY)

      const pot = stake.toNumber() * 2
      const expectedFee = Math.floor((pot * 250) / 10_000) // 2.5%
      const expectedPrize = pot - expectedFee

      expect(p1After - p1Before).to.equal(expectedPrize)
      expect(treasuryAfter - treasuryBefore).to.equal(expectedFee)
    })

    it("rejects settle after Finished", async () => {
      try {
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
        expect.fail("Should reject double-settle")
      } catch (err: any) {
        expect(err.error?.errorCode?.code).to.equal("InvalidGameState")
      }
    })
  })

  // ============== USDC FLOW ==============
  describe("USDC flow", () => {
    const playerOne = Keypair.generate()
    const playerTwo = Keypair.generate()
    let mintAuth: Keypair
    let mint: PublicKey
    let p1Ata: PublicKey
    let p2Ata: PublicKey
    let escrowAta: PublicKey
    let treasuryAta: PublicKey
    let gamePDA: PublicKey
    let escrowPDA: PublicKey
    const stake = new BN(10 * USDC_UNIT) // 10 USDC

    before(async () => {
      await airdrop(connection, playerOne.publicKey, 5)
      await airdrop(connection, playerTwo.publicKey, 5)

      mintAuth = Keypair.generate()
      await airdrop(connection, mintAuth.publicKey, 5)

      mint = await createMint(
        connection,
        mintAuth,
        mintAuth.publicKey,
        null,
        USDC_DECIMALS,
      )

      p1Ata = await createAssociatedTokenAccount(connection, playerOne, mint, playerOne.publicKey)
      p2Ata = await createAssociatedTokenAccount(connection, playerTwo, mint, playerTwo.publicKey)

      await mintTo(connection, mintAuth, mint, p1Ata, mintAuth, 100 * USDC_UNIT)
      await mintTo(connection, mintAuth, mint, p2Ata, mintAuth, 100 * USDC_UNIT)

      ;[gamePDA] = deriveGamePDA(playerOne.publicKey)
      ;[escrowPDA] = deriveEscrowPDA(gamePDA)
      escrowAta = getAssociatedTokenAddressSync(mint, escrowPDA, true)
      treasuryAta = getAssociatedTokenAddressSync(mint, TREASURY, false)
    })

    it("initializes USDC game and transfers stake to escrow ATA", async () => {
      await program.methods
        .initializeGameUsdc(stake, { classic: {} })
        .accounts({
          playerOne: playerOne.publicKey,
          usdcMint: mint,
          game: gamePDA,
          escrow: escrowPDA,
          escrowAta,
          playerOneAta: p1Ata,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([playerOne])
        .rpc()

      const game = await program.account.gameAccount.fetch(gamePDA)
      expect(game.currency).to.deep.equal({ mockUsdc: {} })
      expect(game.stakePerPlayer.toNumber()).to.equal(stake.toNumber())

      const escrowAcc = await getAccount(connection, escrowAta)
      expect(Number(escrowAcc.amount)).to.equal(stake.toNumber())
    })

    it("rejects joinGame (SOL) on USDC-currency game", async () => {
      try {
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
        expect.fail("Should reject SOL join on USDC game")
      } catch (err: any) {
        expect(err.error?.errorCode?.code).to.equal("InvalidGameState")
      }
    })

    it("player two joins USDC game", async () => {
      await program.methods
        .joinGameUsdc()
        .accounts({
          playerTwo: playerTwo.publicKey,
          usdcMint: mint,
          game: gamePDA,
          escrow: escrowPDA,
          escrowAta,
          playerTwoAta: p2Ata,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([playerTwo])
        .rpc()

      const game = await program.account.gameAccount.fetch(gamePDA)
      expect(game.status).to.deep.equal({ active: {} })

      const escrowAcc = await getAccount(connection, escrowAta)
      expect(Number(escrowAcc.amount)).to.equal(stake.toNumber() * 2)
    })

    it("plays full game: O wins col 1-4-7, settles, USDC distributed", async () => {
      // P1 cell 0 → P2 cell 1 → P1 cell 2 → P2 cell 4 → P1 cell 8 → P2 cell 7 (O wins 1-4-7)
      await commitAndReveal(program, gamePDA, playerOne, 0)
      await commitAndReveal(program, gamePDA, playerTwo, 1)
      await commitAndReveal(program, gamePDA, playerOne, 2)
      await commitAndReveal(program, gamePDA, playerTwo, 4)
      await commitAndReveal(program, gamePDA, playerOne, 8)
      await commitAndReveal(program, gamePDA, playerTwo, 7)

      const game = await program.account.gameAccount.fetch(gamePDA)
      expect(game.board[1]).to.deep.equal({ o: {} })
      expect(game.board[4]).to.deep.equal({ o: {} })
      expect(game.board[7]).to.deep.equal({ o: {} })

      const p2Before = (await getAccount(connection, p2Ata)).amount

      await program.methods
        .settleGameUsdc()
        .accounts({
          game: gamePDA,
          usdcMint: mint,
          escrow: escrowPDA,
          escrowAta,
          playerOne: playerOne.publicKey,
          playerOneAta: p1Ata,
          playerTwo: playerTwo.publicKey,
          playerTwoAta: p2Ata,
          treasury: TREASURY,
          treasuryAta,
          payer: payer.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc()

      const finalGame = await program.account.gameAccount.fetch(gamePDA)
      expect(finalGame.status).to.deep.equal({ finished: {} })

      const p2After = (await getAccount(connection, p2Ata)).amount
      const treasuryAcc = await getAccount(connection, treasuryAta)

      const pot = stake.toNumber() * 2
      const expectedFee = Math.floor((pot * 250) / 10_000)
      const expectedPrize = pot - expectedFee

      expect(Number(p2After - p2Before)).to.equal(expectedPrize)
      expect(Number(treasuryAcc.amount)).to.equal(expectedFee)

      const escrowAcc = await getAccount(connection, escrowAta)
      expect(Number(escrowAcc.amount)).to.equal(0)
    })
  })

  // ============== CROSS-CURRENCY GUARDS ==============
  describe("cross-currency guards", () => {
    it("rejects joinGameUsdc on a SOL-currency game", async () => {
      const playerOne = Keypair.generate()
      const playerTwo = Keypair.generate()
      await airdrop(connection, playerOne.publicKey, 5)
      await airdrop(connection, playerTwo.publicKey, 5)

      const [gamePDA] = deriveGamePDA(playerOne.publicKey)
      const [escrowPDA] = deriveEscrowPDA(gamePDA)

      // Init SOL game
      await program.methods
        .initializeGame(new BN(0.05 * LAMPORTS_PER_SOL), { classic: {} })
        .accounts({
          playerOne: playerOne.publicKey,
          game: gamePDA,
          escrow: escrowPDA,
          systemProgram: SystemProgram.programId,
        })
        .signers([playerOne])
        .rpc()

      // Setup mint + ATAs for the USDC join attempt
      const mintAuth = Keypair.generate()
      await airdrop(connection, mintAuth.publicKey, 2)
      const mint = await createMint(connection, mintAuth, mintAuth.publicKey, null, USDC_DECIMALS)
      const p2Ata = await createAssociatedTokenAccount(connection, playerTwo, mint, playerTwo.publicKey)
      await mintTo(connection, mintAuth, mint, p2Ata, mintAuth, 100 * USDC_UNIT)
      const escrowAta = getAssociatedTokenAddressSync(mint, escrowPDA, true)

      try {
        await program.methods
          .joinGameUsdc()
          .accounts({
            playerTwo: playerTwo.publicKey,
            usdcMint: mint,
            game: gamePDA,
            escrow: escrowPDA,
            escrowAta,
            playerTwoAta: p2Ata,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([playerTwo])
          .rpc()
        expect.fail("Should reject USDC join on SOL game")
      } catch (err: any) {
        // Either currency mismatch (InvalidGameState) OR ATA doesn't exist yet (constraint failure)
        const code = err.error?.errorCode?.code ?? ""
        expect(code === "InvalidGameState" || code === "AccountNotInitialized" || code.includes("Constraint"))
          .to.equal(true, `Got error code: ${code} / ${err.message ?? err}`)
      }
    })
  })
})
