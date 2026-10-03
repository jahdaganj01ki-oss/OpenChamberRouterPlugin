/**
 * Pro Provider: wohin der Service zeigt, wie er den Schlussel setzt und wie er
 * die Modelliste abruft.
 *
 * Bewusst schmal gehalten. Ein Adapter beantwortet genau drei Fragen:
 * Basis-URL, welche Header ein Aufruf braucht, und wo die Modelle stehen.
 */

import type { AuthKind, ModelInfo } from '../shared/contract.ts'
import { baseHeaders, bearer } from './http.ts'
import { gatewayAdapters, mediaAdapters } from './gateways.ts'

export interface Adapter {
  id: string
  /** Basis-URL des OpenAI-kompatiblen Endpunkts fuer den spaelten Proxy. */
  baseUrl: string
  auth: AuthKind
  /** Header, die der Proxy einem Upstream-Request hinzufuegt. */
  headers?: (secret: string) => Record<string, string>
  /** Holt die verfuegbare Modelliste. `secret` darf leer sein. */
  listModels?: (secret: string) => Promise<ModelInfo[]>
}

const json = async <T>(res: Response): Promise<T> => {
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
  return (await res.json()) as T
}


/** OpenRouter-Listenformat: pricing als String je 1M Token. */
interface OpenRouterModels {
  data: Array<{
    id: string
    name?: string
    context_length?: number
    architecture?: { input_modalities?: string[] }
    pricing?: { prompt?: string; completion?: string }
  }>
}

const num = (value: string | undefined): number | undefined => {
  if (value === undefined) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

const modalities = (list: string[] | undefined): ModelInfo['inputModalities'] => {
  const out: ModelInfo['inputModalities'] = ['text']
  if (list?.includes('image')) out.push('image')
  if (list?.includes('audio')) out.push('audio')
  return out
}

/** Medien-Dienste haben keine OpenAI-Liste; sie kommen ohne `listModels` aus. */
const mediaBase: Record<string, Adapter> = Object.fromEntries(
  Object.values(mediaAdapters).map((a) => [a.id, { ...a, listModels: undefined }]),
)

/**
 * Alle Anbieter, die der Dienst bedienen kann. Reihenfolge bestimmt nichts –
 * `gateways.ts` hat Vorrang vor den eigens hier beschriebenen, weil hier nur
 * die wenigen Sonderfaelle stehen.
 */
export const adapters: Record<string, Adapter> = {
  ...gatewayAdapters,
  ...mediaBase,

  openrouter: {
    id: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    auth: 'api-key',
    headers: (secret) => ({
      ...bearer(secret),
      'HTTP-Referer': 'https://openchamber.dev',
      'X-Title': 'OpenChamber Router',
    }),
    // Ohne Schluessel oeffentlich abrufbar – damit laesst sich die Kette
    // ohne Konto testen.
    listModels: async () => {
      const body = await json<OpenRouterModels>(
        await fetch('https://openrouter.ai/api/v1/models', { headers: baseHeaders() }),
      )
      return body.data.map((m) => ({
        upstreamId: m.id,
        label: m.name ?? m.id,
        contextWindow: m.context_length,
        inputModalities: modalities(m.architecture?.input_modalities),
        pricing: {
          promptPer1M: num(m.pricing?.prompt),
          completionPer1M: num(m.pricing?.completion),
          free: m.pricing?.prompt === '0',
        },
      }))
    },
  },

  anthropic: {
    id: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    auth: 'api-key',
    headers: (secret) => ({
      'x-api-key': secret,
      'anthropic-version': '2023-06-01',
    }),
    listModels: async (secret) => {
      if (!secret) throw new Error('Kein API-Schluessel hinterlegt')
      const body = await json<{
        data: Array<{
          id: string
          display_name: string
          context_window?: number
        }>
      }>(
        await fetch('https://api.anthropic.com/v1/models?limit=100', {
          headers: {
            ...baseHeaders(),
            'x-api-key': secret,
            'anthropic-version': '2023-06-01',
          },
        }),
      )
      return body.data.map((m) => ({
        upstreamId: m.id,
        label: m.display_name,
        contextWindow: m.context_window,
        inputModalities: ['text', 'image'] as ModelInfo['inputModalities'],
      }))
    },
  },

  together: {
    id: 'together',
    baseUrl: 'https://api.together.xyz/v1',
    auth: 'api-key',
    headers: bearer,
    listModels: async (secret) => {
      if (!secret) throw new Error('Kein API-Schluessel hinterlegt')
      const body = await json<
        Array<{
          id: string
          context_length?: number
          pricing?: { input_per_million?: number; output_per_million?: number }
        }>
      >(
        await fetch('https://api.together.xyz/v1/models', {
          headers: bearer(secret),
        }),
      )
      return body.map((m) => ({
        upstreamId: m.id,
        label: m.id,
        contextWindow: m.context_length,
        inputModalities: ['text'] as ModelInfo['inputModalities'],
        pricing: {
          promptPer1M: m.pricing?.input_per_million,
          completionPer1M: m.pricing?.output_per_million,
          free: m.pricing?.input_per_million === 0,
        },
      }))
    },
  },

  ollama: {
    id: 'ollama',
    baseUrl: 'http://127.0.0.1:11434/v1',
    auth: 'local',
    listModels: async () => {
      const body = await json<{ models: Array<{ name: string }> }>(
        await fetch('http://127.0.0.1:11434/api/tags', { headers: baseHeaders() }),
      )
      return body.models.map((m) => ({
        upstreamId: m.name,
        label: m.name,
        inputModalities: ['text'] as ModelInfo['inputModalities'],
      }))
    },
  },
}

export const adapterFor = (providerId: string): Adapter | undefined =>
  adapters[providerId]
