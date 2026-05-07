import type { FastifyInstance } from 'fastify'
import { getMatch } from '../lib/match-store.js'

type WsClient = { send: (data: string) => void; readyState: number }
type Role = 'player' | 'spectator'

interface RoomMember {
  socket: WsClient
  role:   Role
}

const rooms = new Map<string, Set<RoomMember>>()

function getRoom(matchId: string): Set<RoomMember> {
  let r = rooms.get(matchId)
  if (!r) { r = new Set(); rooms.set(matchId, r) }
  return r
}

function spectatorCount(matchId: string): number {
  let n = 0
  for (const m of rooms.get(matchId) ?? []) if (m.role === 'spectator') n++
  return n
}

function broadcastViewerCount(matchId: string) {
  const payload = JSON.stringify({ type: 'viewer_count', count: spectatorCount(matchId) })
  for (const m of rooms.get(matchId) ?? []) {
    if (m.socket.readyState === 1) m.socket.send(payload)
  }
}

function broadcastFromPlayer(matchId: string, payload: string, sender: WsClient) {
  // Player events go to ALL members (other players + spectators)
  for (const m of rooms.get(matchId) ?? []) {
    if (m.socket !== sender && m.socket.readyState === 1) m.socket.send(payload)
  }
}

export function broadcastToMatch(matchId: string, event: unknown) {
  const payload = JSON.stringify(event)
  for (const m of rooms.get(matchId) ?? []) {
    if (m.socket.readyState === 1) m.socket.send(payload)
  }
}

export async function wsRoutes(app: FastifyInstance) {
  app.get('/ws/:matchId', { websocket: true }, (connection, request) => {
    const { matchId } = request.params as { matchId: string }
    const url = (request.raw.url ?? '')
    const role: Role = url.includes('role=spectator') ? 'spectator' : 'player'
    const socket = connection.socket as unknown as WsClient

    const member: RoomMember = { socket, role }
    getRoom(matchId).add(member)

    // Send current state on connect
    void getMatch(matchId).then(match => {
      if (match) socket.send(JSON.stringify({ type: 'state', match }))
      socket.send(JSON.stringify({ type: 'viewer_count', count: spectatorCount(matchId) }))
    }).catch(() => {})

    // Tell everyone the viewer count changed
    broadcastViewerCount(matchId)

    ;(connection.socket as unknown as { on: (event: string, cb: (data: unknown) => void) => void }).on('message', (raw) => {
      // Spectators are read-only — drop their messages silently.
      if (role === 'spectator') return
      try {
        broadcastFromPlayer(matchId, raw!.toString(), socket)
      } catch {}
    })

    ;(connection.socket as unknown as { on: (event: string, cb: () => void) => void }).on('close', () => {
      const room = rooms.get(matchId)
      if (!room) return
      room.delete(member)
      if (room.size === 0) {
        rooms.delete(matchId)
      } else {
        broadcastViewerCount(matchId)
      }
    })
  })
}
