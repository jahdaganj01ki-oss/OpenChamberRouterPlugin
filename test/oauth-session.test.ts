/**
 * Der Moment, in dem aus einer offenen Anmeldung ein Konto wird.
 *
 * Bis hierher war alles messbar: der Dienst stellte Fragen, GitHub antwortete
 * „wartet noch". Dieser Schritt ist nie beobachtet worden – der Nutzer hat
 * bestaetigt, es kam ein Token, und danach ist nichts passiert, ohne dass
 * jemand wusste warum. Darum wird er hier von Hand durchgespielt.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { verarbeiteAntwort, type Anlegen } from '../src/service/oauth-session.ts'
import type { OAuthSession } from '../src/service/oauth.ts'

const sitzung = (): OAuthSession => ({
  id: 's1',
  providerId: 'copilot',
  state: 'pending',
  deviceCode: 'geheim',
  intervalMs: 5000,
  polls: 3,
})

/** Zaehlt, wie oft ein Konto angelegt wurde – und liefert eine Id. */
const anlegenZaehler = (label?: string, note?: string) => {
  const aufrufe: OAuthSession[] = []
  const fn: Anlegen = async (s, token) => {
    aufrufe.push({ ...s })
    assert.ok(token.access_token, 'das Token muss weitergegeben werden')
    return { id: 'k1', label, note }
  }
  return { fn, aufrufe }
}

test('ein Token legt genau ein Konto an und meldet Erfolg', async () => {
  const s = sitzung()
  const { fn, aufrufe } = anlegenZaehler('individual')

  await verarbeiteAntwort(
    s,
    { kind: 'token', token: { access_token: 'gho_abc' } },
    fn,
  )

  assert.equal(aufrufe.length, 1, 'genau ein Konto')
  assert.equal(s.state, 'done')
  assert.equal(s.connectionId, 'k1')
  assert.equal(s.plan, 'individual')
  assert.match(s.lastEvent ?? '', /Angemeldet/)
  assert.match(s.lastEvent ?? '', /individual/)
})

test('nach dem Erfolg wird der geheime Code verworfen', async () => {
  const s = sitzung()
  const { fn } = anlegenZaehler('business')
  await verarbeiteAntwort(
    s,
    { kind: 'token', token: { access_token: 'gho_abc' } },
    fn,
  )
  assert.equal(s.deviceCode, undefined, 'deviceCode muss weg')
})

test('ein ungeklaerter Tarif geht nicht verloren', async () => {
  // Genau die Realitaet aus dem Alltag: die Anmeldung klappt, aber der Tarif
  // laesst sich nicht ermitteln. Das darf nicht als vollstaendiger Erfolg
  // dastehen, ohne dass jemand den Vorbehalt sieht.
  const s = sitzung()
  const { fn } = anlegenZaehler(undefined, 'Tarif unbekannt: 401')

  await verarbeiteAntwort(
    s,
    { kind: 'token', token: { access_token: 'gho_abc' } },
    fn,
  )

  assert.equal(s.state, 'done', 'die Anmeldung ist trotzdem gueltig')
  assert.match(s.lastEvent ?? '', /Tarif unbekannt/)
})

test('scheitert das Anlegen, ist es ein Fehler und kein Erfolg', async () => {
  const s = sitzung()
  const fn: Anlegen = async () => ({ error: 'Konto konnte nicht angelegt werden.' })

  await verarbeiteAntwort(
    s,
    { kind: 'token', token: { access_token: 'gho_abc' } },
    fn,
  )

  assert.equal(s.state, 'error')
  assert.equal(s.connectionId, undefined, 'keine haengende Konto-Id')
  assert.match(s.error ?? '', /Konto konnte nicht angelegt werden/)
})

test('eine Ablehnung ist kein Fehler, sondern eine Entscheidung', async () => {
  const s = sitzung()
  const { fn, aufrufe } = anlegenZaehler()

  await verarbeiteAntwort(
    s,
    { kind: 'denied', reason: 'Die Anmeldung wurde abgelehnt.' },
    fn,
  )

  assert.equal(s.state, 'denied')
  assert.equal(aufrufe.length, 0, 'aus einer Ablehnung wird kein Konto')
})

test('warten aendert den Zustand nicht', async () => {
  const s = sitzung()
  const { fn, aufrufe } = anlegenZaehler()
  await verarbeiteAntwort(s, { kind: 'pending' }, fn)

  assert.equal(s.state, 'pending')
  assert.equal(aufrufe.length, 0)
  assert.match(s.lastEvent ?? '', /Noch offen/)
  assert.match(s.lastEvent ?? '', /3/, 'die Zahl der Abfragen ist sichtbar')
})

test('zu oft gefragt verlangsamt, statt zu scheitern', async () => {
  const s = sitzung()
  const { fn, aufrufe } = anlegenZaehler()

  await verarbeiteAntwort(s, { kind: 'slow-down', intervalSeconds: 10 }, fn)

  assert.equal(s.state, 'pending', 'kein Fehler daraus machen')
  assert.ok((s.intervalMs ?? 0) > 5000, 'der Abstand ist groesser geworden')
  assert.equal(aufrufe.length, 0)
  assert.match(s.lastEvent ?? '', /Zu oft abgefragt/)
})

test('zwei gleichzeitige Antworten legen nicht zwei Konten an', async () => {
  // Der Dienst sperrt das ueber `polling`. Geprueft wird hier die zweite
  // Haelfte: eine fertige Sitzung darf nicht noch einmal angelegt werden.
  const s = sitzung()
  const { fn, aufrufe } = anlegenZaehler('individual')
  const antwort = { kind: 'token', token: { access_token: 'gho_abc' } } as const

  await verarbeiteAntwort(s, antwort, fn)
  await verarbeiteAntwort(s, antwort, fn)

  assert.equal(aufrufe.length, 2, 'die Funktion kennt die Sperre nicht')
  // Genau deshalb entscheidet der Dienst vorher und ruft sie nur einmal auf.
  const { pollDecision } = await import('../src/service/oauth.ts')
  assert.equal(
    pollDecision(s, Date.now()),
    'warten',
    'eine fertige Sitzung wird nicht mehr abgefragt',
  )
})
