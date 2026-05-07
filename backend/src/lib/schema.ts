import { pgTable, text, real, integer, bigint, index } from 'drizzle-orm/pg-core'

/**
 * MindDuel matches table.
 * Source of truth is on-chain Solana — this DB caches state for fast
 * leaderboard / history queries the frontend needs.
 */
export const matches = pgTable('matches', {
  matchId:     text('match_id').primaryKey(),
  joinCode:    text('join_code').notNull().unique(),
  playerOne:   text('player_one').notNull(),
  playerTwo:   text('player_two'),
  mode:        text('mode').notNull(),
  stake:       real('stake').notNull(),
  currency:    text('currency').notNull(), // 'sol' | 'usdc'
  status:      text('status').notNull(),   // 'waiting' | 'active' | 'finished'
  winner:      text('winner'),             // pubkey of winner, null = draw or unfinished
  pot:         real('pot'),
  fee:         real('fee'),
  onChainSig:  text('on_chain_sig'),       // settle transaction signature
  createdAt:   bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt:   bigint('updated_at', { mode: 'number' }).notNull(),
  finishedAt:  bigint('finished_at', { mode: 'number' }),
}, (table) => ({
  byPlayerOne:  index('idx_matches_p1').on(table.playerOne),
  byPlayerTwo:  index('idx_matches_p2').on(table.playerTwo),
  byStatus:     index('idx_matches_status').on(table.status),
  byCreatedAt:  index('idx_matches_created').on(table.createdAt),
}))

export type Match       = typeof matches.$inferSelect
export type MatchInsert = typeof matches.$inferInsert

/**
 * Matchmaking queue — players waiting for opponent.
 * Persisted so server restart doesn't drop the queue.
 */
export const queue = pgTable('queue', {
  playerId:  text('player_id').primaryKey(),
  mode:      text('mode').notNull(),
  stake:     real('stake').notNull(),
  currency:  text('currency').notNull(),
  joinedAt:  bigint('joined_at', { mode: 'number' }).notNull(),
})

export type QueueEntry  = typeof queue.$inferSelect
