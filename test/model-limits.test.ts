/**
 * Kontextfenster und Ausgabelaenge – die Zahlen, die im Modelpicker stehen.
 *
 * Ausgangspunkt ist ein Fehler, den der Nutzer gemeldet hat: bei OpenRouter
 * stand bei *jedem* Modell 200.000, obwohl die echten Werte zwischen 65.536
 * und 1.048.576 liegen. Ursache waren zwei Fehler hintereinander:
 *
 *  1. Die Registrierung schrieb nur den Namen und kein `limit`. Ohne `limit`
 *     zeigte der Picker einen Ersatzwert, der aussah wie eine Angabe des
 *     Anbieters.
 *  2. Der naechste Versuch – `limit` nur mit `context` – waere schlimmer
 *     gewesen: OpenCode verlangt `context` *und* `output` und lehnt dann die
 *     *gesamte* Konfiguration ab. OpenCode startet dann gar nicht mehr.
 *
 * Diese Tests halten beide Seiten fest: Anreicherung aus models.dev und die
 * Bedingung, unter der ein `limit` geschrieben werden darf.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { baueIndex, schluesselFuerTest } from '../src/service/model-meta.ts'
import { openCodeModelEntry } from '../src/page/config.ts'
import { formatFenster } from '../src/shared/format.ts'
import type { ModelInfo } from '../src/shared/contract.ts'

const modell = (teil: Partial<ModelInfo>): ModelInfo => ({
  upstreamId: 'x/y',
  label: 'x/y',
  inputModalities: ['text'],
  ...teil,
})

// ---------------------------------------------------------------------------
// Der OpenCode-Eintrag
// ---------------------------------------------------------------------------

test('beide Werte vorhanden: limit wird geschrieben', () => {
  const e = openCodeModelEntry(modell({ contextWindow: 262144, outputWindow: 32768 }))
  assert.deepEqual(e.limit, { context: 262144, output: 32768 })
})

test('nur Kontext: KEIN limit, sonst startet OpenCode nicht', () => {
  // Gemessen am echten CLI:
  //   "Missing key provider...models.x.limit.output"
  const e = openCodeModelEntry(modell({ contextWindow: 262144 }))
  assert.equal(e.limit, undefined, 'halbes limit ist ein Totalausfall')
})

test('nur Ausgabe: ebenfalls kein limit', () => {
  const e = openCodeModelEntry(modell({ outputWindow: 32768 }))
  assert.equal(e.limit, undefined)
})

test('gar keine Werte: kein limit', () => {
  assert.equal(openCodeModelEntry(modell({})).limit, undefined)
})

test('limit braucht beide Felder – das ist die OpenCode-Regel', () => {
  // Nachgebaut aus dem veroeffentlichten Schema:
  //   limit: { required: ["context", "output"], additionalProperties: false }
  for (const teil of [
    { contextWindow: 1048576, outputWindow: 65536 },
    { contextWindow: 65536, outputWindow: 8192 },
    { contextWindow: 200000, outputWindow: 16000 },
  ]) {
    const e = openCodeModelEntry(modell(teil))
    const limit = e.limit as Record<string, number>
    assert.ok('context' in limit && 'output' in limit, JSON.stringify(teil))
    assert.deepEqual(Object.keys(limit).sort(), ['context', 'output'])
  }
})

test('Nullwerte gelten als unbekannt', () => {
  for (const wert of [0, -1, undefined]) {
    const e = openCodeModelEntry(
      modell({ contextWindow: wert, outputWindow: wert as number | undefined }),
    )
    assert.equal(e.limit, undefined, `Wert ${wert} darf kein limit ergeben`)
  }
})

test('Bildeingang schaltet modalities UND attachment', () => {
  // Am echten CLI gemessen: `attachment` allein laesst `input.image` auf
  // false. Nur `modalities.input` schaltet den Bildeingang frei.
  const e = openCodeModelEntry(modell({ inputModalities: ['text', 'image'] }))
  assert.equal(e.attachment, true)
  assert.deepEqual((e.modalities as { input: string[] }).input, ['text', 'image'])
})

test('reines Textmodell bekommt keine Bild-Faehigkeit', () => {
  const e = openCodeModelEntry(modell({ inputModalities: ['text'] }))
  assert.equal(e.attachment, undefined)
  assert.equal(e.modalities, undefined)
})

test('Audio ohne Bild wird ebenfalls durchgereicht', () => {
  const e = openCodeModelEntry(modell({ inputModalities: ['text', 'audio'] }))
  assert.deepEqual((e.modalities as { input: string[] }).input, ['text', 'audio'])
  assert.equal(e.attachment, undefined, 'kein Bild, also auch kein attachment')
})

// ---------------------------------------------------------------------------
// Die Anreicherung aus models.dev
// ---------------------------------------------------------------------------

const KATALOG = {
  deepinfra: {
    models: {
      'deepseek-ai/DeepSeek-V3': {
        limit: { context: 262144, input: 192000, output: 128000 },
        modalities: { input: ['text'] },
      },
      'Qwen/Qwen3-235B-A22B': {
        limit: { context: 262144, output: 32768 },
        modalities: { input: ['text'] },
      },
    },
  },
  google: {
    models: {
      'gemini-2.5-pro': {
        limit: { context: 1048576, output: 65536 },
        modalities: { input: ['text', 'image', 'audio', 'video', 'pdf'] },
        attachment: true,
      },
    },
  },
}

test('der Index enthaelt die vollen Modellnamen', () => {
  const ix = baueIndex(KATALOG as never)
  assert.ok(ix.size > 0)
  assert.ok(ix.has('deepseek-ai/DeepSeek-V3'), 'genauer Name muss greifen')
  assert.ok(ix.has('gemini-2.5-pro'))
})

test('die Schluessel decken alle ueblichen Schreibweisen ab', () => {
  // Die Kennungen, die einem in der Praxis begegnen:
  const faelle: [string, boolean][] = [
    ['deepseek-ai/DeepSeek-V3', true],
    ['DeepSeek-V3', true],
    ['deepseek-ai/deepseek-v3', true], // Kataloge schreiben uneinheitlich
    ['deepseek-ai/DeepSeek-V3:free', true], // OpenRouter-Suffix
    ['qwen/qwen3-235b-a22b', true],
    ['Qwen3-235B-A22B', true],
    ['gemini-2.5-pro', true],
    ['gemini/2.5-pro', true],
    ['gpt-4o', false],
    ['llama-3.1-405b', false],
  ]

  const ix = baueIndex(KATALOG as never)
  for (const [id, treffer] of faelle) {
    const schluessel = schluesselFuerTest(id)
    const gefunden = schluessel.some((k) => ix.has(k))
    assert.equal(gefunden, treffer, `${id} -> ${gefunden}, erwartet ${treffer}`)
  }
})

test('ein praeziser Treffer schlaegt einen unscharfen', () => {
  // `gemini-2.5-pro` ist exakt getroffen; es darf nicht auf einen anderen
  // Namen ausweichen, nur weil der passt.
  const ix = baueIndex(KATALOG as never)
  const k = schluesselFuerTest('gemini-2.5-pro')
  const treffer = k.map((s) => ix.get(s)).find(Boolean)
  assert.equal(treffer?.context, 1048576)
  assert.equal(treffer?.output, 65536)
  assert.equal(treffer?.attachment, true)
})

// ---------------------------------------------------------------------------
// Die Anzeige
// ---------------------------------------------------------------------------

test('grosse Fenster werden lesbar, nicht zu Rauschen', () => {
  // Der Nutzerbericht zeigte durchgehend 200.000. Ohne lesbare Schreibweise
  // faellt der Unterschied zwischen 262k und 1M in der Oberflaeche sofort auf.
  assert.equal(formatFenster(1048576), '1.05M')
  assert.equal(formatFenster(2000000), '2M')
  assert.equal(formatFenster(262144), '262k')
  assert.equal(formatFenster(65536), '66k')
  assert.equal(formatFenster(131072), '131k')
  assert.equal(formatFenster(4096), '4.1k')
})

test('1000000 und 1048576 sind nicht dasselbe', () => {
  // Genau der Fall, der zur Meldung fuehrte: mit einer Nachkommastelle fallen
  // beide auf „1M". Zwei Modelle mit derselben Zahl sind der Fehler.
  assert.notEqual(formatFenster(1000000), formatFenster(1048576))
  assert.equal(formatFenster(1000000), '1M')
  assert.equal(formatFenster(1048576), '1.05M')
})

test('Sonderwerte werden nicht zu Unsinn', () => {
  assert.equal(formatFenster(0), '—')
  assert.equal(formatFenster(-1), '—')
  assert.equal(formatFenster(Number.NaN), '—')
  assert.equal(formatFenster(512), '512')
})

test('die Werte unterscheiden sich, wie sie sollen', () => {
  // Genau die Aussage, die der Nutzer getroffen hat: 22 Modelle, ueberall
  // derselbe Wert. Wenn hier zwei gleiche herauskommen, ist wieder etwas
  // verloren gegangen.
  const werte = [262144, 1048576, 65536, 1000000, 131072, 4096, 2000000].map(formatFenster)
  assert.equal(new Set(werte).size, werte.length, werte.join(' | '))
})