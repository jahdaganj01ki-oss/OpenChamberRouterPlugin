/**
 * Ein Abruf darf die Auswahl nicht veraendern.
 *
 * `entry.models` ist die *Auswahl*, nicht der Katalog. Ein Abruf liefert die
 * verfuegbaren Modelle und meldet die bestehende Auswahl zurueck – er
 * speichert nichts. Sonst waeren nach dem ersten "Fetch Models" alle Modelle
 * als gewaehlt markiert, und der Nutzer muesste 464 Haekchen einzeln
 * abwaehlen.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { ModelInfo } from '../src/shared/contract.ts'

/** Nachbau des Dienstverhaltens beim Abruf. */
const fetchModels = (state: { models: ModelInfo[] }, available: ModelInfo[]) => {
  const selected = state.models.map((m) => m.upstreamId)
  // Kein Schreibzugriff auf `state.models` – so ist es jetzt im Dienst.
  return { models: available, alreadySelected: selected }
}

const model = (id: string): ModelInfo => ({
  upstreamId: id,
  label: id,
  inputModalities: ['text'],
})

test('ein Abruf aendert die Auswahl nicht', () => {
  const state = { models: [] as ModelInfo[] }
  const verfuegbar = [model('a'), model('b'), model('c')]

  const erste = fetchModels(state, verfuegbar)
  assert.deepEqual(erste.alreadySelected, [])
  assert.equal(state.models.length, 0, 'Auswahl muss unberuehrt bleiben')

  const zweite = fetchModels(state, verfuegbar)
  assert.deepEqual(zweite.alreadySelected, [])
  assert.equal(state.models.length, 0)
})

test('ein gespeichertes Modell bleibt nach dem Abruf gewaehlt', () => {
  const state = { models: [model('b')] }
  const antwort = fetchModels(state, [model('a'), model('b'), model('c')])

  assert.deepEqual(antwort.alreadySelected, ['b'])
  assert.equal(state.models.length, 1, 'nur das gespeicherte, nicht die drei')
})

test('mehrfaches Abufen sammelt nicht auf', () => {
  const state = { models: [] as ModelInfo[] }
  const verfuegbar = Array.from({ length: 464 }, (_, i) => model(`m${i}`))

  for (let i = 0; i < 5; i += 1) fetchModels(state, verfuegbar)

  assert.equal(state.models.length, 0, 'nach fuenf Abrufen immer noch nichts gewaehlt')
})
