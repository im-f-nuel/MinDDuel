import Fastify from 'fastify'
import cors from '@fastify/cors'
import { triviaRoutes } from './routes/trivia'

const app = Fastify({ logger: true })

await app.register(cors, { origin: ['http://localhost:3000'], methods: ['GET', 'POST'] })
await app.register(triviaRoutes, { prefix: '/api' })

app.get('/health', async () => ({ status: 'ok', timestamp: Date.now() }))

try {
  await app.listen({ port: 3001, host: '0.0.0.0' })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
