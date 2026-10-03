/**
 * Adapter fuer die Standard-Gateways.
 *
 * Alle nutzen dieselbe Form: OpenAI-kompatibles `/models` mit Bearer-Token,
 * Antwort nach `OpenAI-Listenformat`. Deshalb ein gemeinsamer Baustein statt
 * 30 fast gleicher Funktionen.
 *
 * Die Liste folgt dem Katalog: Provider, die es als OpenAI-kompatiblen
 * Dienst geben, aber einen eigenen Aufruf brauchen, stehen weiter unten in
 * `adapters.ts`.
 */

import type { AuthKind, ModelInfo } from '../shared/contract.ts'
import type { Adapter } from './adapters.ts'
import { baseHeaders, bearer } from './http.ts'

interface OpenAiListModel {
  id: string
  context_length?: number
  context_window?: number
  max_completion_tokens?: number
  max_output_tokens?: number
  top_provider?: { max_completion_tokens?: number }
  pricing?: { prompt?: string; completion?: string; input_per_million?: number; output_per_million?: number }
  architecture?: { input_modalities?: string[] }
}

const num = (value: string | number | undefined): number | undefined => {
  if (value === undefined) return undefined
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

/**
 * Antwortlaenge, wie der Anbieter sie meldet.
 *
 * OpenRouter nennt sie nicht am Modell, sondern unter `top_provider` – dort
 * steht, wieviel der *von dir gewaehlte* Anbieter schafft. Das ist die Zahl,
 * die OpenCode braucht: sie ist die tatsaechliche Obergrenze, nicht die
 * theoretische des Modells.
 */
const outputTokens = (m: OpenAiListModel): number | undefined =>
  num(m.max_completion_tokens ?? m.max_output_tokens ?? m.top_provider?.max_completion_tokens)

const toModel = (m: OpenAiListModel): ModelInfo => {
  const prompt = num(m.pricing?.prompt ?? m.pricing?.input_per_million)
  const completion = num(m.pricing?.completion ?? m.pricing?.output_per_million)
  const modalities: ModelInfo['inputModalities'] = ['text']
  if (m.architecture?.input_modalities?.includes('image')) modalities.push('image')
  if (m.architecture?.input_modalities?.includes('audio')) modalities.push('audio')
  return {
    upstreamId: m.id,
    label: m.id,
    contextWindow: m.context_length ?? m.context_window,
    outputWindow: outputTokens(m),
    inputModalities: modalities,
    pricing: { promptPer1M: prompt, completionPer1M: completion, free: prompt === 0 },
  }
}

/**
 * OpenAI-kompatibles `/models` mit Bearer.
 *
 * Ohne Schluessel wird ohne Authorization-Header versucht: mehrere Gateways
 * nennen ihre Modelle oeffentlich. Erst wenn die Antwort 401 sagt, ist der
 * Schluessel wirklich noetig – dann wird das auch so gemeldet.
 */
const openaiModels =
  (baseUrl: string) =>
  async (secret: string): Promise<ModelInfo[]> => {
    const res = await fetch(`${baseUrl}/models`, {
      headers: secret ? bearer(secret) : baseHeaders(),
    })
    if (res.status === 401 || res.status === 403) {
      throw new Error('Kein API-Schluessel hinterlegt (401 vom Anbieter)')
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
    const body = (await res.json()) as { data?: OpenAiListModel[] } | OpenAiListModel[]
    const list = Array.isArray(body) ? body : (body.data ?? [])
    return list.map(toModel)
  }

/**
 * Gateways, die ohne Schluessel oeffentlich ihre Modelle nennen. Praktisch,
 * um die Kette ohne Konto zu pruefen.
 */

const api = (id: string, baseUrl: string, auth: AuthKind = 'api-key'): Adapter => ({
  id,
  baseUrl,
  auth,
  headers: auth === 'api-key' ? bearer : undefined,
  listModels: openaiModels(baseUrl),
})

/**
 * Bewusst NICHT verdrahtet:
 * - `lambda` – die Inference-API wird eingestellt (Stand 29.05.2026);
 *   `api.lambda.ai` loest nicht mehr auf.
 * - `nscale` – keine belegbare oeffentliche Basis-URL gefunden.
 *
 * Statt zu raten bleiben sie hier weg. Ein toter Adapter ist schlimmer als
 * keiner: er liefert eine Basis-URL, an der jeder Aufruf scheitert.
 */
export const gatewayAdapters: Record<string, Adapter> = {
  // Router und Gateways mit OpenAI-kompatiblem /models
  orcarouter: api('orcarouter', 'https://api.orcarouter.ai/v1'),
  tokenharbor: api('tokenharbor', 'https://api.tokenharbor.ai/v1'),
  'vercel-ai-gateway': api('vercel-ai-gateway', 'https://ai-gateway.vercel.sh/v1'),
  bai: api('bai', 'https://api.b.ai/v1'),
  agnes: api('agnes', 'https://apihub.agnes-ai.com/v1'),
  siliconflow: api('siliconflow', 'https://api.siliconflow.cn/v1'),
  deepinfra: api('deepinfra', 'https://api.deepinfra.com/v1/openai'),
  hyperbolic: api('hyperbolic', 'https://api.hyperbolic.xyz/v1'),
  novita: api('novita', 'https://api.novita.ai/v3/openai'),
  'arcee-ai': api('arcee-ai', 'https://api.arcee.ai/v1'),
  nebius: api('nebius', 'https://api.studio.nebius.ai/v1'),
  'chutes-ai': api('chutes-ai', 'https://llm.chutes.ai/v1'),
  featherless: api('featherless', 'https://api.featherless.ai/v1'),
  'friendli-ai': api('friendli-ai', 'https://api.friendli.ai/serverless/v1'),
  baseten: api('baseten', 'https://inference.baseten.co/v1'),
  cerebras: api('cerebras', 'https://api.cerebras.ai/v1'),
  groq: api('groq', 'https://api.groq.com/openai/v1'),
  'xai': {
    ...api('xai', 'https://api.x.ai/v1'),
    headers: (secret) => bearer(secret),
  },
  // DNS loest auf, aber die Verbindung bricht ab. Ohne belegte Route kein
  // automatischer Modellabruf.
  'kilo-gateway': {
    id: 'kilo-gateway',
    baseUrl: 'https://gateway.kilo.ai/v1',
    auth: 'api-key',
    headers: bearer,
  },

  // Direkte Modell-Dienste
  mistral: {
    id: 'mistral',
    baseUrl: 'https://api.mistral.ai/v1',
    auth: 'api-key',
    headers: bearer,
    listModels: async (secret) => {
      if (!secret) throw new Error('Kein API-Schluessel hinterlegt')
      const res = await fetch('https://api.mistral.ai/v1/models', { headers: bearer(secret) })
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
      const body = (await res.json()) as {
        data?: Array<{
          id: string
          capabilities?: { context_length?: number; max_output_tokens?: number }
        }>
      }
      return (body.data ?? []).map((m) => ({
        upstreamId: m.id,
        label: m.id,
        contextWindow: m.capabilities?.context_length,
        outputWindow: m.capabilities?.max_output_tokens,
        inputModalities: ['text'] as ModelInfo['inputModalities'],
      }))
    },
  },
  grok: api('grok', 'https://api.x.ai/v1'),
  'deepseek': api('deepseek', 'https://api.deepseek.com/v1'),
  'zhipu': api('zhipu', 'https://open.bigmodel.cn/api/paas/v4'),
  'qwen': api('qwen', 'https://dashscope.aliyuncs.com/compatible-mode/v1'),
  'moonshot': api('moonshot', 'https://api.moonshot.ai/v1'),
  'minimax': api('minimax', 'https://api.minimax.chat/v1'),
  'volcengine': api('volcengine', 'https://ark.cn-beijing.volces.com/api/v3'),
  'baichuan': api('baichuan', 'https://api.baichuan-ai.com/v1'),
  'inception': api('inception', 'https://api.inceptionai.com/v1'),
}

/**
 * Anbieter ohne belegbare `/models`-Route.
 *
 * Sie bleiben als Proxy-Ziel nutzbar – der Nutzer traegt die Modelle von Hand
 * ein. Eine erfundene Route waere schlimmer: „Fetch Models“ waere dann gruen
 * und liefe ins Leere.
 */
const noDiscovery = (id: string, baseUrl: string): Adapter => ({
  id,
  baseUrl,
  auth: 'api-key',
  headers: bearer,
})

Object.assign(gatewayAdapters, {
  'tokenharbor': noDiscovery('tokenharbor', 'https://api.tokenharbor.ai/v1'),
  'inception': noDiscovery('inception', 'https://api.inceptionai.com/v1'),
})

/** Medien-Dienste mit eigener Form – hier nur die Basis-URL fuer den Proxy. */
export const mediaAdapters: Record<string, Pick<Adapter, 'id' | 'baseUrl' | 'auth'>> = {
  assemblyai: { id: 'assemblyai', baseUrl: 'https://api.assemblyai.com/v2', auth: 'api-key' },
  deepgram: { id: 'deepgram', baseUrl: 'https://api.deepgram.com/v1', auth: 'api-key' },
  'black-forest-labs': {
    id: 'black-forest-labs',
    baseUrl: 'https://api.bfl.ai/v1',
    auth: 'api-key',
  },
}
