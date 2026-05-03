import Fastify from 'fastify'
import cors from '@fastify/cors'
import { triviaRoutes } from './routes/trivia.js'
import { matchRoutes } from './routes/match.js'

const app = Fastify({ logger: true })

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') ?? [
  'http://localhost:3000',
  'https://mindduel.app',
]

await app.register(cors, {
  origin: ALLOWED_ORIGINS,
  methods: ['GET', 'POST', 'DELETE'],
})

await app.register(triviaRoutes, { prefix: '/api' })
await app.register(matchRoutes,  { prefix: '/api' })

app.get('/health', async () => ({
  status: 'ok',
  timestamp: Date.now(),
  version: '0.1.0',
}))

// Leaderboard — static mock until on-chain indexer is ready
app.get('/api/leaderboard', async (request) => {
  const { period = 'alltime' } = (request.query ?? {}) as { period?: string }
  const entries = [
    { rank: 1, address: '9fXk...c2aB', wins: 142, losses: 38, solEarned: 12.4, winRate: 79 },
    { rank: 2, address: 'a1Yr...7dQp', wins: 128, losses: 44, solEarned: 9.8,  winRate: 74 },
    { rank: 3, address: '3fMn...a9Lz', wins: 121, losses: 51, solEarned: 8.1,  winRate: 70 },
    { rank: 4, address: 'bEf2...04Kw', wins: 117, losses: 55, solEarned: 7.6,  winRate: 68 },
    { rank: 5, address: '44Xp...8eCv', wins: 99,  losses: 61, solEarned: 5.2,  winRate: 62 },
  ]
  return { period, entries }
})

const port = Number(process.env.PORT ?? 3001)
try {
  await app.listen({ port, host: '0.0.0.0' })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
