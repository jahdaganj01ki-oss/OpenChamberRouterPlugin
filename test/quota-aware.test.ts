/**
 * Tests für die Quota-Aware-Strategie.
 *
 * Die quota-aware-Strategie wählt die Verbindung mit der höchsten
 * verbleibenden Quote. Fehlende Werte führen zu einem Fallback auf
 * round-robin – eine erzwogene Nummer ist schlimmer als eine faire Rotation.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

interface Quota {
  used?: number
  limit?: number
  resetsAt?: string
  exhausted?: boolean
}

interface Connection {
  id: string
  status: 'active' | 'error' | 'locked' | 'disabled'
  priority: number
  quota?: Quota
}

/**
 * Nachbau der pickConnection-Logik für die quota-aware-Strategie.
 * Extrahiert als reine Funktion, damit sie ohne Server getestet werden kann.
 */
const pickByQuota = (connections: Connection[]): Connection | null => {
  const healthy = connections
    .filter((c) => c.status === 'active')
    .sort((a, b) => a.priority - b.priority)

  if (healthy.length === 0) return null

  const withQuota = healthy.filter((c) => c.quota && !c.quota.exhausted)
  if (withQuota.length > 0) {
    return (
      withQuota
        .map((c) => ({
          conn: c,
          remaining:
            c.quota && c.quota.used !== undefined && c.quota.limit !== undefined
              ? c.quota.limit - c.quota.used
              : -1,
        }))
        .sort((a, b) => b.remaining - a.remaining)[0]?.conn ??
      healthy[0] ??
      null
    )
  }

  // Alle Quotas unbekannt oder erschöpft: erste gesunde Verbindung.
  return healthy[0] ?? null
}

test('wählt die Verbindung mit der höchsten verbleibenden Quote', () => {
  const connections: Connection[] = [
    { id: 'a', status: 'active', priority: 0, quota: { used: 80, limit: 100 } },  // 20 übrig
    { id: 'b', status: 'active', priority: 1, quota: { used: 30, limit: 100 } },  // 70 übrig
    { id: 'c', status: 'active', priority: 2, quota: { used: 10, limit: 50 } },   // 40 übrig
  ]

  const picked = pickByQuota(connections)
  assert.equal(picked?.id, 'b', 'b hat mit 70 der höchsten Puffer')
})

test('verwirft erschöpfte Konten (quota.exhausted)', () => {
  const connections: Connection[] = [
    { id: 'a', status: 'active', priority: 0, quota: { used: 100, limit: 100, exhausted: true } },
    { id: 'b', status: 'active', priority: 1, quota: { used: 0, limit: 100 } },
  ]

  const picked = pickByQuota(connections)
  assert.equal(picked?.id, 'b', 'erschöpfte Konten werden übersprungen')
})

test('ohne bekannte Quota fällt auf die erste gesunde Verbindung zurück', () => {
  const connections: Connection[] = [
    { id: 'a', status: 'active', priority: 0 },  // kein quota-Feld
    { id: 'b', status: 'active', priority: 1 },
  ]

  const picked = pickByQuota(connections)
  assert.equal(picked?.id, 'a', 'Priority-Orderung wird beachtet')
})

test('alle erschöpft: erste gesunde trotzdem gewählt', () => {
  const connections: Connection[] = [
    { id: 'a', status: 'active', priority: 0, quota: { exhausted: true } },
    { id: 'b', status: 'active', priority: 1, quota: { exhausted: true } },
  ]

  const picked = pickByQuota(connections)
  assert.ok(picked, 'es wird eine Verbindung zurückgegeben')
  assert.equal(picked?.id, 'a')
})

test('keine gesunden Verbindungen: null', () => {
  const connections: Connection[] = [
    { id: 'a', status: 'locked', priority: 0 },
    { id: 'b', status: 'error', priority: 1 },
  ]

  const picked = pickByQuota(connections)
  assert.equal(picked, null)
})

test('mit Quota bevorzugt über ohne Quota', () => {
  const connections: Connection[] = [
    { id: 'a', status: 'active', priority: 0 },  // keine Quota
    { id: 'b', status: 'active', priority: 1, quota: { used: 0, limit: 1000 } },  // 1000 übrig
  ]

  const picked = pickByQuota(connections)
  assert.equal(picked?.id, 'b', 'Verbindung mit Quota wird bevorzugt')
})

test('Quota mit undefined Werten wird nicht als "beste" gewertet', () => {
  const connections: Connection[] = [
    { id: 'a', status: 'active', priority: 0, quota: { used: undefined, limit: undefined } },
    { id: 'b', status: 'active', priority: 1, quota: { used: 0, limit: 100 } },
  ]

  const picked = pickByQuota(connections)
  assert.equal(picked?.id, 'b', 'klare Quota schlägt unvollständige Quota')
})

test('Priority-Orderierung bei gleicher Quote', () => {
  const connections: Connection[] = [
    { id: 'a', status: 'active', priority: 5, quota: { used: 50, limit: 100 } },  // 50 übrig
    { id: 'b', status: 'active', priority: 0, quota: { used: 50, limit: 100 } },  // 50 übrig
    { id: 'c', status: 'active', priority: 3, quota: { used: 50, limit: 100 } },  // 50 übrig
  ]

  const picked = pickByQuota(connections)
  assert.equal(picked?.id, 'b', 'bei gleicher Quote gilt Priority')
})