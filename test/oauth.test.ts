/**
 * Die Tarifregel von Copilot.
 *
 * An dieser Stelle entscheidet sich, ob der Token-Tausch überhaupt gebraucht
 * wird. Der Tausch-Endpunkt gibt bei Business, Enterprise und auf
 * Data-Residency-Mandanten 404 zurueck – auch bei gueltigem Token. Wer
 * stattdessen auf die Fehlermeldung reagiert, meldet jedem Business-Konto
 * faelschlich ein kaputtes Token.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { copilotNeedsExchange } from '../src/service/oauth.ts'

test('individual braucht keinen Tausch', () => {
  assert.equal(copilotNeedsExchange('individual', 'https://api.individual.githubcopilot.com'), false)
})

test('business braucht den Tausch', () => {
  assert.equal(copilotNeedsExchange('business', 'https://api.business.githubcopilot.com'), true)
})

test('enterprise braucht den Tausch', () => {
  assert.equal(copilotNeedsExchange('enterprise', 'https://api.enterprise.githubcopilot.com'), true)
})

test('data-residency (ghe.com) braucht keinen Tausch', () => {
  // Auf diesen Mandaten gibt es den Tausch-Endpunkt gar nicht.
  assert.equal(copilotNeedsExchange('business', 'https://api.ghe.com'), false)
  assert.equal(copilotNeedsExchange('enterprise', 'https://copilot.ghe.example.com'), false)
})

test('unbekannter Tarif wird behandelt wie business', () => {
  // Lieber ein Tauschversuch als ein gescheitertes Konto: der Tausch ist
  // billig, ein falsch abgewiesenes Konto nicht.
  assert.equal(copilotNeedsExchange('unknown', 'https://api.githubcopilot.com'), true)
  assert.equal(copilotNeedsExchange('', 'https://api.githubcopilot.com'), true)
})
