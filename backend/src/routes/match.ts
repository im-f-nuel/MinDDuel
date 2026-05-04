import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import {
  createMatch,
  joinByCode,
  getMatch,
  getMatchForPlayer,
  enqueue,
  dequeue,
  queueLength,
} from '../lib/match-store.js'

const createBodySchema = z.object({
  playerOne: z.string().min(1),
  mode: z.enum(['classic', 'shifting', 'scaleup', 'blitz', 'vs-ai']).default('classic'),
  stake: z.number().min(0).default(0),
})

const joinBodySchema = z.object({
  joinCode: z.string().regex(/^MNDL-[A-F0-9]{6}$/),
  playerTwo: z.string().min(1),
})

const queueBodySchema = z.object({
  playerId: z.string().min(1),
  mode: z.enum(['classic', 'shifting', 'scaleup', 'blitz']).default('classic'),
  stake: z.number().min(0).default(0.05),
})

const dequeueBodySchema = z.object({
  playerId: z.string().min(1),
})

export async function matchRoutes(app: FastifyInstance) {
  // POST /match/create  — create private match, get joinCode
  app.post('/match/create', async (request, reply) => {
    const parsed = createBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid body', details: parsed.error.flatten() })
    }

    const { playerOne, mode, stake } = parsed.data
    const match = createMatch(playerOne, mode, stake)

    return {
      matchId: match.matchId,
      joinCode: match.joinCode,
      status: match.status,
    }
  })

  // POST /match/join  — join a private match by joinCode
  app.post('/match/join', async (request, reply) => {
    const parsed = joinBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid body', details: parsed.error.flatten() })
    }

    const { joinCode, playerTwo } = parsed.data
    const match = joinByCode(joinCode, playerTwo)

    if (!match) {
      return reply.status(404).send({ error: 'Match not found, already started, or join code invalid' })
    }

    return {
      matchId: match.matchId,
      status: match.status,
      mode: match.mode,
      stake: match.stake,
    }
  })

  // GET /match/:matchId  — get current match state
  app.get('/match/:matchId', async (request, reply) => {
    const { matchId } = request.params as { matchId: string }
    const match = getMatch(matchId)

    if (!match) {
      return reply.status(404).send({ error: 'Match not found' })
    }

    return match
  })

  // POST /match/queue  — join matchmaking queue
  app.post('/match/queue', async (request, reply) => {
    const parsed = queueBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid body', details: parsed.error.flatten() })
    }

    const { playerId, mode, stake } = parsed.data
    const result = enqueue(playerId, mode, stake)

    return {
      ...result,
      queueLength: queueLength(),
    }
  })

  // DELETE /match/queue  — leave matchmaking queue
  app.delete('/match/queue', async (request, reply) => {
    const parsed = dequeueBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid body' })
    }

    dequeue(parsed.data.playerId)
    return { ok: true, queueLength: queueLength() }
  })

  // GET /match/queue/status  — how many players waiting
  app.get('/match/queue/status', async () => ({
    queueLength: queueLength(),
  }))

  // GET /match/player/:playerId  — find active match for a player (for matchmaking polling)
  app.get('/match/player/:playerId', async (request, reply) => {
    const { playerId } = request.params as { playerId: string }
    const match = getMatchForPlayer(playerId)
    if (!match) return reply.status(404).send({ error: 'No active match' })
    return { matchId: match.matchId, status: match.status }
  })
}
