import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import websocket from '@fastify/websocket'
import { triviaRoutes } from './routes/trivia.js'
import { matchRoutes } from './routes/match.js'
import { wsRoutes } from './routes/ws.js'
import { faucetRoutes } from './routes/faucet.js'
import { statsRoutes } from './routes/stats.js'
import { getLiveStats, cleanupExpiredMatches } from './lib/match-store.js'

const app = Fastify({ logger: true })

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') ?? [
  'http://localhost:3000',
  'https://mindduel.app',
]

await app.register(cors, {
  origin: ALLOWED_ORIGINS,
  methods: ['GET', 'POST', 'DELETE'],
})

await app.register(websocket)
await app.register(triviaRoutes, { prefix: '/api' })
await app.register(matchRoutes,  { prefix: '/api' })
await app.register(faucetRoutes)
await app.register(statsRoutes, { prefix: '/api' })
await app.register(wsRoutes)

app.get('/health', async () => ({
  status: 'ok',
  timestamp: Date.now(),
  version: '0.1.0',
}))

// Live stats — derived from Postgres (Neon)
app.get('/api/stats', async () => {
  return await getLiveStats()
})

// Periodic cleanup of stale waiting matches (every 1 hour)
setInterval(async () => {
  try {
    const n = await cleanupExpiredMatches()
    if (n > 0) app.log.info(`Cleaned ${n} expired waiting matches`)
  } catch (e) {
    app.log.error({ err: String(e) }, 'cleanupExpiredMatches failed')
  }
}, 60 * 60 * 1000)

const port = Number(process.env.PORT ?? 3001)
try {
  await app.listen({ port, host: '0.0.0.0' })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
