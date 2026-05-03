import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { QUESTIONS, getFiltered, pickRandom, type Category, type Difficulty } from '../data/questions.js'
import { createCommit, revealCommit } from '../lib/commit-reveal.js'

const VALID_CATEGORIES: Category[] = [
  'General Knowledge',
  'Crypto & Web3',
  'Science',
  'History',
  'Math',
  'Pop Culture',
]

const VALID_DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard']

const questionQuerySchema = z.object({
  categories: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
})

const revealBodySchema = z.object({
  sessionId: z.string().min(1),
  answerIndex: z.number().int().min(0).max(3),
})

export async function triviaRoutes(app: FastifyInstance) {
  // GET /trivia/question?categories=Math,Science&difficulty=medium
  // Returns question without correctIndex + commit hash for anti-cheat
  app.get('/trivia/question', async (request, reply) => {
    const parsed = questionQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid query params', details: parsed.error.flatten() })
    }

    const { categories: catsParam, difficulty } = parsed.data

    const cats: Category[] = catsParam
      ? (catsParam.split(',').map(s => s.trim()).filter(s => VALID_CATEGORIES.includes(s as Category)) as Category[])
      : []

    const diff = VALID_DIFFICULTIES.includes(difficulty as Difficulty) ? (difficulty as Difficulty) : undefined

    const pool = getFiltered(cats, diff)
    const source = pool.length >= 3 ? pool : QUESTIONS
    const q = pickRandom(source)

    const { sessionId, hash } = createCommit(q.id, q.correctIndex)

    return {
      sessionId,
      commitHash: hash,
      question: {
        id: q.id,
        question: q.question,
        options: q.options,
        category: q.category,
        difficulty: q.difficulty,
        timeLimit: q.timeLimit,
      },
    }
  })

  // POST /trivia/reveal  { sessionId, answerIndex }
  // Returns correct/wrong + reveals correctIndex
  app.post('/trivia/reveal', async (request, reply) => {
    const parsed = revealBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid body', details: parsed.error.flatten() })
    }

    const { sessionId, answerIndex } = parsed.data
    const result = revealCommit(sessionId, answerIndex)

    if (!result) {
      return reply.status(410).send({ error: 'Session expired or not found' })
    }

    return result
  })

  // GET /trivia/categories  — list available categories with question counts
  app.get('/trivia/categories', async () => {
    return VALID_CATEGORIES.map(cat => ({
      id: cat,
      label: cat,
      count: QUESTIONS.filter(q => q.category === cat).length,
    }))
  })

  // GET /trivia/stats
  app.get('/trivia/stats', async () => {
    return {
      total: QUESTIONS.length,
      byCategory: Object.fromEntries(
        VALID_CATEGORIES.map(cat => [cat, QUESTIONS.filter(q => q.category === cat).length])
      ),
      byDifficulty: Object.fromEntries(
        VALID_DIFFICULTIES.map(d => [d, QUESTIONS.filter(q => q.difficulty === d).length])
      ),
    }
  })
}
