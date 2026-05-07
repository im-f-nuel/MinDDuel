import type { FastifyInstance } from 'fastify'
import { getLeaderboard, getHistoryForPlayer, finishMatch, getMatch } from '../lib/match-store.js'
import { awardBadgesAfterMatch, listBadgesForPlayer, getBadgeMeta, type BadgeType } from '../lib/badges.js'
import { findBracketByMatchId, recordTournamentMatchResult } from '../lib/tournament-store.js'
import { z } from 'zod'

const finishBodySchema = z.object({
  matchId:    z.string().min(1),
  winner:     z.string().nullable(),
  pot:        z.number().min(0),
  fee:        z.number().min(0),
  onChainSig: z.string().nullable().optional(),
})

export async function statsRoutes(app: FastifyInstance) {
  // GET /api/leaderboard  — top players by wins (real, derived from finished matches)
  app.get('/leaderboard', async (request) => {
    const { period = 'alltime', limit } = (request.query ?? {}) as { period?: string; limit?: string }
    const lim = Math.min(50, Math.max(1, Number(limit) || 25))
    const rows = await getLeaderboard(lim)
    return {
      period,
      entries: rows.map((r, i) => ({
        rank:      i + 1,
        address:   r.address,
        wins:      r.wins,
        matches:   r.matches,
        losses:    r.matches - r.wins,
        solEarned: r.solEarned,
        usdcEarned:r.usdcEarned,
        winRate:   r.winRate,
      })),
    }
  })

  // GET /api/history/:player  — match history for a wallet address
  app.get('/history/:player', async (request, reply) => {
    const { player } = request.params as { player: string }
    if (!player || player.length < 4) {
      return reply.status(400).send({ error: 'Invalid player address' })
    }
    const limit = Math.min(100, Math.max(1, Number((request.query as { limit?: string }).limit) || 50))
    const rows = await getHistoryForPlayer(player, limit)
    return { player, count: rows.length, matches: rows }
  })

  // POST /api/match/finish  — frontend reports settle outcome so DB stays in sync.
  // (No auth — devnet trust model. On-chain is the source of truth; this endpoint
  // only powers leaderboard/history queries.)
  app.post('/match/finish', async (request, reply) => {
    const parsed = finishBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid body', details: parsed.error.flatten() })
    }
    const { matchId, winner, pot, fee, onChainSig } = parsed.data
    await finishMatch(matchId, winner, pot, fee, onChainSig ?? null)

    // Award badges if there's a winner. Mint happens fire-and-forget.
    let earned: string[] = []
    if (winner) {
      const match = await getMatch(matchId)
      const currency = (match?.currency ?? 'sol') as 'sol' | 'usdc'
      earned = await awardBadgesAfterMatch({ player: winner, matchPot: pot, currency })
    }

    // If this match is part of a tournament bracket, propagate the winner up.
    if (winner) {
      const bracket = await findBracketByMatchId(matchId)
      if (bracket) {
        await recordTournamentMatchResult({ bracketId: bracket.bracketId, winner })
      }
    }
    return { ok: true, earnedBadges: earned }
  })

  // GET /api/badges/:player — list a player's badges (DB-backed)
  app.get('/badges/:player', async (request, reply) => {
    const { player } = request.params as { player: string }
    if (!player || player.length < 4) {
      return reply.status(400).send({ error: 'Invalid player address' })
    }
    const rows = await listBadgesForPlayer(player)
    return {
      player,
      count: rows.length,
      badges: rows.map(b => {
        const meta = getBadgeMeta(b.type as BadgeType)
        return {
          id:        b.id,
          type:      b.type,
          name:      meta?.name ?? b.type,
          symbol:    meta?.symbol ?? '',
          description: meta?.description ?? '',
          image:     meta?.image ?? '',
          mintAddr:  b.mintAddr,
          txSig:     b.txSig,
          earnedAt:  b.earnedAt,
          status:    b.mintAddr ? 'minted' : 'pending',
        }
      }),
    }
  })
}
