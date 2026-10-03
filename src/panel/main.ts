/**
 * Schmale Leistenansicht neben dem Chat. Zeigt nur den Zustand und verweist
 * auf die grosse Seite; alles Interaktive passiert dort.
 */

import { connectHost } from '@openchamber/sdk'
import { applyHostReady } from '@openchamber/sdk/ui'

import { el, setText } from '../ui/dom.ts'
import type { ServiceState } from '../shared/contract.ts'

const host = connectHost()

const ask = async <T,>(path: string): Promise<T | null> => {
  const result = await host.serviceRequest({ method: 'GET', path })
  if (result.status !== 200) return null
  try {
    return JSON.parse(result.body) as T
  } catch {
    return null
  }
}

const root = document.getElementById('root')
if (!root) throw new Error('Kein #root im Panel.')

const status = el('div', 'ocr-panel')
status.style.padding = '12px 14px'
status.style.fontSize = '12px'
status.style.lineHeight = '1.5'

const headline = el('div')
headline.style.fontWeight = '600'
headline.style.marginBottom = '4px'

const body = el('div')
body.style.opacity = '0.75'

root.append(status)
status.append(headline, body)

const paint = (state: ServiceState | null): void => {
  if (!state) {
    setText(headline, 'Router-Dienst nicht erreichbar')
    setText(body, 'Der lokale Dienst laeuft noch nicht. Bitte die Seite im Menü "Extension pages" oeffnen.')
    return
  }
  const providers = Object.keys(state.providers)
  const connections = providers.reduce(
    (sum, id) => sum + (state.providers[id]?.connections.length ?? 0),
    0,
  )
  const models = providers.reduce(
    (sum, id) => sum + (state.providers[id]?.models.length ?? 0),
    0,
  )
  setText(headline, `${providers.length} Anbieter verbunden`)
  setText(
    body,
    `${connections} Konten · ${models} Modelle · Strategie: ${state.globalStrategy}`,
  )
}

const refresh = async (): Promise<void> => {
  paint(await ask<ServiceState>('/state'))
}

host.onReady((ctx) => {
  applyHostReady(ctx, document.documentElement)
  void refresh()
})

void refresh()
window.setInterval(() => void refresh(), 15_000)
