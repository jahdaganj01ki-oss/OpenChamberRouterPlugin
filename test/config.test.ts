/**
 * Prueft die JSONC-Behandlung. Sie ist die fehleranfaelligste Stelle der
 * Konfigurationslogik: ein falsch entferntes Kommentarzeichen zerstoert die
 * OpenCode-Konfiguration.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { stripJsonc } from '../src/page/config.ts'

test('entfernt Zeilenkommentare', () => {
  // Weggeworfene Kommentare hinterlassen Leerraum. Der ist harmlos, also
  // zaehlt, dass die Datei noch parsebar ist – nicht die Zeichenzahl.
  assert.deepEqual(JSON.parse(stripJsonc('{\n  // weg\n  "a": 1\n}')), { a: 1 })
})

test('entfernt Blockkommentare', () => {
  assert.deepEqual(JSON.parse(stripJsonc('{ /* weg */ "a": 1 }')), { a: 1 })
})

test('entfernt haengende Kommas', () => {
  assert.deepEqual(JSON.parse(stripJsonc('{ "a": 1, }')), { a: 1 })
  assert.deepEqual(JSON.parse(stripJsonc('{ "a": [1, 2, ] }')), { a: [1, 2] })
})

test('laesst Kommentarzeichen in Strings unangetastet', () => {
  // Der wichtigste Fall: eine URL oder ein Pfad enthaelt "//".
  assert.equal(
    stripJsonc('{ "url": "https://openrouter.ai/api/v1" }'),
    '{ "url": "https://openrouter.ai/api/v1" }',
  )
  assert.equal(stripJsonc('{ "p": "a // b" }'), '{ "p": "a // b" }')
  assert.equal(stripJsonc('{ "p": "x /* y */ z" }'), '{ "p": "x /* y */ z" }')
})

test('behandelt escapten Backslash korrekt', () => {
  // Ein Pfad wie "C:\\Users" darf keinEscaping aufloesen.
  assert.equal(stripJsonc('{ "p": "C:\\\\Users" }'), '{ "p": "C:\\\\Users" }')
})

test('entfernt Kommentare nach Werten', () => {
  assert.deepEqual(
    JSON.parse(stripJsonc('{\n  "a": 1, // Kommentar\n  "b": 2\n}')),
    { a: 1, b: 2 },
  )
})

test('echte Konfiguration bleibt gueltiges JSON', () => {
  const input = `{
  // OpenChamber sichert das hier
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    /* Router */
    "ocr-openrouter": {
      "options": { "baseURL": "http://127.0.0.1:41234/proxy/openrouter/v1" },
    },
  },
}`
  const parsed = JSON.parse(stripJsonc(input))
  assert.equal(parsed.$schema, 'https://opencode.ai/config.json')
  assert.ok(parsed.provider['ocr-openrouter'].options.baseURL.includes('127.0.0.1'))
})
