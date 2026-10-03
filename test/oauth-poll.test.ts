/**
 * Der Takt der Anmelde-Abfrage.
 *
 * Ausgangspunkt ist ein Fehler, der wochenlang unbemerkt blieb: die Seite
 * fragte alle drei Sekunden, GitHub wollte fünf. GitHub antwortete darauf mit
 * `slow_down`, und weil diese Antwort genauso aussah wie „wartet noch", stand
 * die Oberfläche ewig auf Warten – ohne Hinweis, dass der Dienst zu ungeduldig
 * war.
 *
 * Zwei Dinge werden hier festgehalten:
 * - Der Dienst entscheidet, nicht die Oberfläche. Ein zu schneller Client
 *   darf den Vorgang nicht mehr zerstören.
 * - Jede Antwort des Anbieters ist unterscheidbar. „langsam" und „wartet"
 *   dürfen nicht dasselbe aussehen.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { nextInterval, pollDecision } from '../src/service/oauth.ts'

const SITZUNG = {
  state: 'pending',
  deviceCode: 'geheim',
  intervalMs: 5000,
}

test('die erste Abfrage darf sofort gehen', () => {
  assert.equal(pollDecision(SITZUNG, 1_000), 'fragen')
})

test('zu frueh fragen wird abgefangen', () => {
  // Genau die Seite von vorhin: drei Sekunden statt fuenf.
  assert.equal(pollDecision({ ...SITZUNG, lastPollAt: 10_000 }, 13_000), 'zu-frueh')
})

test('nach dem Abstand darf wieder gefragt werden', () => {
  assert.equal(pollDecision({ ...SITZUNG, lastPollAt: 10_000 }, 15_000), 'fragen')
})

test('eine laufende Abfrage blockiert die naechste', () => {
  // Zwei parallele Abfragen wuerden zwei Konten anlegen.
  assert.equal(
    pollDecision({ ...SITZUNG, polling: true, lastPollAt: 10_000 }, 30_000),
    'warten',
  )
})

test('eine fertige Anmeldung wird nicht weiter abgefragt', () => {
  for (const state of ['done', 'error', 'denied']) {
    assert.equal(pollDecision({ ...SITZUNG, state }, 99_000), 'warten', state)
  }
})

test('ohne deviceCode wird nicht gefragt', () => {
  assert.equal(pollDecision({ state: 'pending' }, 99_000), 'warten')
})

test('ein zu schneller Client kann den Vorgang nicht zerstoeren', () => {
  // Die Oberfläche fragt stur alle drei Sekunden. Der Dienst darf den
  // Anbieter trotzdem hoechstens alle fuenf Sekunden fragen – das ist der
  // eigentliche Fehler, der behoben wurde.
  let letzteAnfrage: number | undefined
  let echteAbfragen = 0
  const abstand = 5_000
  const jetzt = (t: number): void => {
    const s = { ...SITZUNG, intervalMs: abstand, lastPollAt: letzteAnfrage }
    if (pollDecision(s, t) === 'fragen') {
      echteAbfragen += 1
      letzteAnfrage = t
    }
  }

  for (let t = 0; t <= 30_000; t += 3_000) jetzt(t)

  // 31 Sekunden bei 3-Sekunden-Takten wuerden 11 Abfragen sein.
  assert.ok(
    echteAbfragen <= 31_000 / abstand + 1,
    `zu viele Abfragen an den Anbieter: ${echteAbfragen}`,
  )
  assert.ok(echteAbfragen >= 5, `es wurde gar nicht gefragt: ${echteAbfragen}`)
})

test('slow_down vergroessert den Abstand, verkleiner ihn aber nie', () => {
  // Der Anbieter verlangt mehr.
  assert.ok(nextInterval(5000, 10) > 5000)
  // Er verlangt weniger als wir bereits halten – wir bleiben trotzdem sicher.
  assert.ok(nextInterval(20_000, 5) >= 20_000)
  // Nie schneller als fünf Sekunden, auch wenn jemand eins sagt.
  assert.ok(nextInterval(0, 1) >= 5000, 'mindestens fuenf Sekunden')
})

test('der Anbieter darf den Takt nur verlangsamen', () => {
  let abstand = 5000
  abstand = nextInterval(abstand, 5)
  const nachErster = abstand
  abstand = nextInterval(abstand, 1)
  assert.ok(abstand >= nachErster, 'Takt wurde schneller gestellt')
})
