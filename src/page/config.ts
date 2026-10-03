/**
 * Lesen und Schreiben der OpenCode-Konfiguration.
 *
 * OpenChamber gibt der Seite ueber `contributes.filesystem` genau diese beiden
 * Pfade frei. `host.writeFile` schreibt atomar, ein Leser sieht also nie eine
 * halbe Datei.
 */

import type { HostClient } from '@openchamber/sdk'

import type { Provider } from '../providers/catalog.ts'
import type { ModelInfo } from '../shared/contract.ts'

export const CONFIG_CANDIDATES = [
  '~/.config/opencode/opencode.json',
  '~/.config/opencode/opencode.jsonc',
] as const

/**
 * Entfernt Kommentare und haengende Kommas, ohne Strings zu treffen.
 * OpenCode erlaubt in `opencode.jsonc` beides.
 */
export const stripJsonc = (input: string): string => {
  let out = ''
  let i = 0
  let quote: string | null = null
  while (i < input.length) {
    const ch = input[i]
    if (quote) {
      out += ch
      if (ch === '\\') {
        out += input[i + 1] ?? ''
        i += 2
        continue
      }
      if (ch === quote) quote = null
      i += 1
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      out += ch
      i += 1
      continue
    }
    if (ch === '/' && input[i + 1] === '/') {
      while (i < input.length && input[i] !== '\n') i += 1
      continue
    }
    if (ch === '/' && input[i + 1] === '*') {
      i += 2
      while (i < input.length && !(input[i] === '*' && input[i + 1] === '/')) i += 1
      i += 2
      continue
    }
    out += ch
    i += 1
  }
  return out.replace(/,(\s*[}\]])/g, '$1')
}

export interface LoadedConfig {
  path: string
  config: Record<string, unknown>
  existed: boolean
}

export const readConfig = async (host: HostClient): Promise<LoadedConfig> => {
  for (const path of CONFIG_CANDIDATES) {
    try {
      // `readFile` wirft bei fehlender Datei (NOT_FOUND) und liefert sonst
      // genau `{ content }` – es gibt kein `kind`-Feld, danach zu suchen wuerde
      // jeden Zugriff als Fehler behandeln und die Konfiguration ueberschreiben.
      const file = await host.readFile(path)
      if (typeof file.content !== 'string') continue
      const text = file.content.trim()
      const parsed: Record<string, unknown> = text
        ? (JSON.parse(stripJsonc(text)) as Record<string, unknown>)
        : {}
      return { path, config: parsed, existed: true }
    } catch {
      // Naechster Kandidat.
    }
  }
  return { path: CONFIG_CANDIDATES[0], config: {}, existed: false }
}

export const writeConfig = async (
  host: HostClient,
  loaded: LoadedConfig,
): Promise<void> => {
  await host.writeFile(loaded.path, `${JSON.stringify(loaded.config, null, 2)}\n`)
}

/** OpenCode-Provider-ID, unter der der Router erscheint. */
export const openCodeId = (provider: Provider): string => `ocr-${provider.id}`

/**
 * OpenCode-Eintrag fuer ein Modell.
 *
 * Zwei Faelle, an denen man leicht scheitert – beide am echten CLI gemessen,
 * nicht aus dem Handbuch uebernommen:
 *
 * 1. `limit` braucht **beide** Felder, `context` und `output`. Fehlt eins,
 *    lehnt OpenCode die *gesamte* Konfiguration ab und startet nicht mehr.
 *    Deshalb gibt es hier entweder ein vollstaendiges `limit` oder gar keins.
 *    Ohne `limit` zeigt der Picker einen Ersatzwert von 200.000 – das war der
 *    Fehler, den der Nutzer gemeldet hat.
 *
 * 2. `attachment` allein schaltet **keinen** Bildeingang frei. Gemessen:
 *    `attachment: true` ergibt `capabilities.attachment = true`, aber
 *    `input.image = false`. Erst `modalities.input` mit `"image"` tut es.
 *    Beides wird geschrieben, weil sie unterschiedliche Zwecke haben.
 *
 * Was der Anbieter nicht weiss, wird weggelassen statt geraten. Eine erfundene
 * Zahl ist beim Planen schlimmer als eine fehlende.
 */
export const openCodeModelEntry = (m: ModelInfo): Record<string, unknown> => {
  const entry: Record<string, unknown> = { name: m.label }

  const context = typeof m.contextWindow === 'number' && m.contextWindow > 0 ? m.contextWindow : undefined
  const output = typeof m.outputWindow === 'number' && m.outputWindow > 0 ? m.outputWindow : undefined

  // Nur wenn beide da sind. Sonst faellt OpenCode die ganze Datei.
  if (context !== undefined && output !== undefined) {
    entry.limit = { context, output }
  }

  const kannBild = m.inputModalities?.includes('image') === true
  if (kannBild) {
    entry.attachment = true
    entry.modalities = { input: m.inputModalities }
  } else if (m.inputModalities?.includes('audio')) {
    entry.modalities = { input: m.inputModalities }
  }

  return entry
}

/**
 * Schreibt den Anbieter als OpenAI-kompatiblen Provider in die Konfiguration.
 * Ab da zeigt der Modelpicker die Modelle, und OpenCode spricht den lokalen
 * Proxy an – ohne dort ein Geheimnis hinterlegen zu muessen.
 */
export const registerIntoOpenCode = async (
  host: HostClient,
  provider: Provider,
  selected: readonly ModelInfo[],
  port: number,
): Promise<{ path: string; count: number }> => {
  const loaded = await readConfig(host)
  const block = (loaded.config.provider ?? {}) as Record<string, unknown>

  block[openCodeId(provider)] = {
    npm: '@ai-sdk/openai-compatible',
    name: `${provider.name} (Router)`,
    options: { baseURL: `http://127.0.0.1:${port}/proxy/${provider.id}/v1` },
    models: Object.fromEntries(
      selected.map((m) => [m.upstreamId, openCodeModelEntry(m)]),
    ),
  }

  loaded.config.provider = block
  await writeConfig(host, loaded)
  return { path: loaded.path, count: selected.length }
}
