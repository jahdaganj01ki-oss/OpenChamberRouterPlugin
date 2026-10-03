/**
 * Prueft die Registrierung gegen eine Kopie der echten
 * opencode.jsonc. Die echte Datei wird nicht angefasst.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { homedir } from 'node:os'

import { readConfig, registerIntoOpenCode, stripJsonc } from '../src/page/config.ts'
import type { HostClient } from '@openchamber/sdk'
import type { Provider } from '../src/providers/catalog.ts'
import type { ModelInfo } from '../src/shared/contract.ts'

/**
 * Minimaler Ersatz fuer den Host: `~/` zeigt auf ein Temp-Verzeichnis.
 * Die Formen entsprechen dem SDK: `readFile` liefert `{ content }`, ohne `kind`.
 */
const fakeHost = (root: string) =>
  ({
    readFile: async (path: string) => {
      const real = path.replace(/^~\//, `${root}/`)
      return { content: await readFile(real, 'utf8') }
    },
    writeFile: async (path: string, content: string) => {
      const real = path.replace(/^~\//, `${root}/`)
      await writeFile(real, content, 'utf8')
      return { written: true as const }
    },
  }) as unknown as HostClient

const provider: Provider = {
  id: 'openrouter',
  name: 'OpenRouter',
  category: 'api-key',
  auth: 'api-key',
}

const models = [
  { upstreamId: 'anthropic/claude-sonnet-5.5', label: 'Claude Sonnet 5.5', inputModalities: ['text'] as ModelInfo['inputModalities'] },
  { upstreamId: 'apodex/apodex-1.1-mini:free', label: 'Apex Mini', inputModalities: ['text'] as ModelInfo['inputModalities'] },
]

test('liest und erweitert eine bestehende JSONC-Konfiguration', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ocr-cfg-'))
  await mkdir(join(root, '.config', 'opencode'), { recursive: true })

  // So sieht die Konfiguration auf diesem Rechner aus.
  const real = join(homedir(), '.config', 'opencode', 'opencode.jsonc')
  const content = (await readFile(real, 'utf8')) || '{\n  "$schema": "https://opencode.ai/config.json"\n}\n'
  await writeFile(join(root, '.config', 'opencode', 'opencode.jsonc'), content, 'utf8')

  const host = fakeHost(root)
  const result = await registerIntoOpenCode(host, provider, models, 41234)

  assert.equal(result.count, 2)
  assert.match(result.path, /opencode\.jsonc$/)

  const written = await readFile(join(root, '.config', 'opencode', 'opencode.jsonc'), 'utf8')
  const parsed = JSON.parse(written)

  // Bestehende Angaben muessen erhalten bleiben.
  assert.equal(parsed.$schema, 'https://opencode.ai/config.json')
  assert.equal(parsed.websearch?.provider ?? 'random', 'random')

  const block = parsed.provider['ocr-openrouter']
  assert.equal(block.npm, '@ai-sdk/openai-compatible')
  assert.equal(block.name, 'OpenRouter (Router)')
  assert.equal(block.options.baseURL, 'http://127.0.0.1:41234/proxy/openrouter/v1')
  assert.deepEqual(Object.keys(block.models), ['anthropic/claude-sonnet-5.5', 'apodex/apodex-1.1-mini:free'])
})

test('liest eine bestehende Konfiguration wirklich ein', async () => {
  // Regression: ein falscher Feldname im readFile-Ergebnis las jede Datei als
  // "nicht vorhanden" und haette die Konfiguration beim Speichern ersetzt.
  const root = await mkdtemp(join(tmpdir(), 'ocr-cfg4-'))
  await mkdir(join(root, '.config', 'opencode'), { recursive: true })
  await writeFile(
    join(root, '.config', 'opencode', 'opencode.jsonc'),
    '{\n  // Kommentar\n  "websearch": { "provider": "random" }\n}\n',
    'utf8',
  )

  const loaded = await readConfig(fakeHost(root))
  assert.equal(loaded.existed, true)
  assert.match(loaded.path, /opencode\.jsonc$/)
  assert.deepEqual(loaded.config, { websearch: { provider: 'random' } })
})

test('legt die Datei an, wenn keine existiert', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ocr-cfg2-'))
  await mkdir(join(root, '.config', 'opencode'), { recursive: true })

  const host = fakeHost(root)
  const result = await registerIntoOpenCode(host, provider, models, 41234)

  assert.match(result.path, /opencode\.json$/)
  const parsed = JSON.parse(await readFile(join(root, '.config', 'opencode', 'opencode.json'), 'utf8'))
  assert.ok(parsed.provider['ocr-openrouter'])
})

test('ersetzt einen bereits registrierten Router statt zu duplizieren', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ocr-cfg3-'))
  await mkdir(join(root, '.config', 'opencode'), { recursive: true })
  await writeFile(
    join(root, '.config', 'opencode', 'opencode.json'),
    JSON.stringify({ provider: { 'ocr-openrouter': { name: 'alt' } } }, null, 2),
    'utf8',
  )

  const host = fakeHost(root)
  await registerIntoOpenCode(host, provider, models, 41234)
  await registerIntoOpenCode(host, provider, models.slice(0, 1), 41234)
  const loaded = await readConfig(host)
  const file = await host.readFile(loaded.path)
  const parsed = JSON.parse(stripJsonc(file.content))

  assert.equal(Object.keys(parsed.provider).length, 1)
  assert.deepEqual(Object.keys(parsed.provider['ocr-openrouter'].models), ['anthropic/claude-sonnet-5.5'])
})
