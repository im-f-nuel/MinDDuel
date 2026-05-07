import type { FastifyInstance } from 'fastify'
import { getMatch } from '../lib/match-store.js'

type WsClient = { send: (data: string) => void; readyState: number }
const rooms = new Map<string, Set<WsClient>>()

function broadcast(matchId: string, payload: string, sender: WsClient) {
  const room = rooms.get(matchId)
  if (!room) return
  for (const client of room) {
    if (client !== sender && client.readyState === 1) client.send(payload)
  }
}

export function broadcastToMatch(matchId: string, event: unknown) {
  const room = rooms.get(matchId)
  if (!room) return
  const payload = JSON.stringify(event)
  for (const client of room) {
    if (client.readyState === 1) client.send(payload)
  }
}

export async function wsRoutes(app: FastifyInstance) {
  app.get('/ws/:matchId', { websocket: true }, (connection, request) => {
    const { matchId } = request.params as { matchId: string }
    const socket = connection.socket as unknown as WsClient

    if (!rooms.has(matchId)) rooms.set(matchId, new Set())
    rooms.get(matchId)!.add(socket)

    void getMatch(matchId).then(match => {
      if (match) socket.send(JSON.stringify({ type: 'state', match }))
    }).catch(() => {})

    ;(connection.socket as unknown as { on: (event: string, cb: (data: unknown) => void) => void }).on('message', (raw) => {
      try {
        broadcast(matchId, raw!.toString(), socket)
      } catch {}
    })

    ;(connection.socket as unknown as { on: (event: string, cb: () => void) => void }).on('close', () => {
      rooms.get(matchId)?.delete(socket)
      if (rooms.get(matchId)?.size === 0) rooms.delete(matchId)
    })
  })
}
