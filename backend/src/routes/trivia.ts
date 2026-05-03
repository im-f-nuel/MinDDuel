import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

const querySchema = z.object({
  category: z.enum(['web3', 'general', 'science', 'history']).default('general'),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
})

// Static seed questions — replace with Open Trivia DB fetch + caching
const QUESTIONS = [
  {
    id: 'q_sol_1',
    question: 'Which consensus mechanism does Solana use to order transactions?',
    options: ['Proof of Work', 'Proof of Stake', 'Proof of History', 'Delegated PoS'],
    correctIndex: 2,
    category: 'web3',
    difficulty: 'medium',
    timeLimit: 30,
  },
  {
    id: 'q_sol_2',
    question: 'What is the native token of the Solana blockchain?',
    options: ['ETH', 'SOL', 'SRM', 'RAY'],
    correctIndex: 1,
    category: 'web3',
    difficulty: 'easy',
    timeLimit: 20,
  },
  {
    id: 'q_sol_3',
    question: 'What does PDA stand for in Solana development?',
    options: ['Program Derived Account', 'Public Derived Address', 'Program Data Address', 'Public Data Account'],
    correctIndex: 0,
    category: 'web3',
    difficulty: 'hard',
    timeLimit: 30,
  },
] as const

export async function triviaRoutes(app: FastifyInstance) {
  app.get('/trivia', async (request, reply) => {
    const result = querySchema.safeParse(request.query)
    if (!result.success) {
      return reply.status(400).send({ error: 'Invalid query params' })
    }
    const { difficulty } = result.data
    const filtered = QUESTIONS.filter(q => q.difficulty === difficulty)
    const question = filtered[Math.floor(Math.random() * filtered.length)]
    // Return without correctIndex to prevent client-side spoiling
    const { correctIndex: _, ...safe } = question
    return safe
  })

  app.post('/trivia/verify', async (request, reply) => {
    const body = z.object({ id: z.string(), answerIndex: z.number().int().min(0).max(3) }).safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: 'Invalid body' })
    const q = QUESTIONS.find(q => q.id === body.data.id)
    if (!q) return reply.status(404).send({ error: 'Question not found' })
    // In production, commit-reveal is handled on-chain; this is a dev-only shortcut
    return { correct: body.data.answerIndex === q.correctIndex }
  })
}
