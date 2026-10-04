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

/**
 * Cookies als Header-Funktion.
 *
 * Cookie-Provider erhalten die Session-Cookies als `secret`. Wir packen sie
 * in einen `Cookie`-Header – das ist alles, was xAI/Grok braucht.
 */
const cookieHeaders = (cookies: string): Record<string, string> => ({
  ...baseHeaders(),
  Cookie: cookies,
})

/** Cookie-basierter Adapter ohne Discovery. */
const cookieApi = (id: string, baseUrl: string): Adapter => ({
  id,
  baseUrl,
  auth: 'cookie',
  headers: cookieHeaders,
})

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

/** Pollinations-API-Format (abweichend von OpenAI). */
interface PollinationsModel {
  name: string
  title?: string
  category?: string
  publisher?: string
  description?: string
  input_modalities?: string[]
  output_modalities?: string[]
  context_length?: number
  pricing?: {
    currency?: string
    promptTextTokens?: string
    completionTextTokens?: string
    promptCachedTokens?: string
  }
  paid_only?: boolean
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
  ovhcloud: api('ovhcloud', 'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1'),

  // Weitere OpenAI-kompatible API-Key-Anbieter
  'copilot-api': api('copilot-api', 'https://api.githubcopilot.com/v1'),
  dify: api('dify', 'https://api.dify.ai/v1'),
  nace: api('nace', 'https://api.nace.ai/v1'),
  'ollama-cloud': api('ollama-cloud', 'https://api.ollama.com/v1'),
  puter: api('puter', 'https://api.puter.com/v1'),
  // Kilo AI Gateway: einheitlicher Endpunkt für 500+ Modelle.
  // Basis-URL: https://api.kilo.ai/api/gateway (OpenAI-kompatibel).
  'kilo-gateway': api('kilo-gateway', 'https://api.kilo.ai/api/gateway'),
  kilocode: api('kilocode', 'https://api.kilo.ai/api/gateway'),

  // Cloudflare Workers AI: der Account-ID ist Teil des API-Keys.
  // Format: "account_id:api_token" – der Dienst splittet und baut die URL.
  'cloudflare-workers-ai': {
    id: 'cloudflare-workers-ai',
    baseUrl: 'https://api.cloudflare.com/client/v4/accounts',
    auth: 'api-key',
    headers: (secret) => {
      const parts = secret.split(':')
      const token = parts.length > 1 ? parts.slice(1).join(':') : secret
      return bearer(token)
    },
    listModels: async (secret) => {
      const parts = secret.split(':')
      if (parts.length < 2) {
        throw new Error('Cloudflare-Account-ID fehlt. Format: "account_id:api_token"')
      }
      const accountId = parts[0]
      const cfBaseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1`
      const res = await fetch(`${cfBaseUrl}/models`, { headers: bearer(parts.slice(1).join(':')) })
      if (res.status === 401 || res.status === 403) {
        throw new Error('Kein gültiger Cloudflare-API-Token hinterlegt (401/403)')
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
      const body = (await res.json()) as { data?: OpenAiListModel[] }
      return (body.data ?? []).map(toModel)
    },
  },
  // Cloudflare (AI Gateway): ähnelt Workers AI, aber über den Gateway.
  // Der API-Key enthält ebenfalls account_id:api_token.
  cloudflare: {
    id: 'cloudflare',
    baseUrl: 'https://api.cloudflare.com/client/v4/accounts',
    auth: 'api-key',
    headers: (secret) => {
      const parts = secret.split(':')
      const token = parts.length > 1 ? parts.slice(1).join(':') : secret
      return bearer(token)
    },
    listModels: async (secret) => {
      const parts = secret.split(':')
      if (parts.length < 2) {
        throw new Error('Cloudflare-Account-ID fehlt. Format: "account_id:api_token"')
      }
      const accountId = parts[0]
      const cfBaseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1`
      const res = await fetch(`${cfBaseUrl}/models`, { headers: bearer(parts.slice(1).join(':')) })
      if (res.status === 401 || res.status === 403) {
        throw new Error('Kein gültiger Cloudflare-API-Token hinterlegt (401/403)')
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
      const body = (await res.json()) as { data?: OpenAiListModel[] }
      return (body.data ?? []).map(toModel)
    },
  },

  // Cookie-basierte Provider: die Session-Cookies werden manuell eingegeben.
  // Sie nutzen die gleiche API wie der OAuth-Zugriff, aber mit Cookies statt
  // Bearer-Token. Discovery ist nicht möglich, da Cookies keine /models-Liste
  // öffentlich preisgeben.
  'grok-web': cookieApi('grok-web', 'https://api.x.ai/v1'),
  'claude-web': cookieApi('claude-web', 'https://claude.ai'),

  // Pollinations: offenes KI-Gen-Modell mit Pollen-Währung statt USD.
  // Modelle sind ohne Auth erreichbar – ähnlich wie bei Featherless.
  pollinations: {
    id: 'pollinations',
    baseUrl: 'https://gen.pollinations.ai',
    auth: 'api-key',
    headers: bearer,
    listModels: async () => {
      const res = await fetch('https://gen.pollinations.ai/models', {
        headers: baseHeaders(),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
      const body = (await res.json()) as PollinationsModel[]
      return body
        .filter((m) => m.category === 'text' || m.category === 'embedding')
        .map((m): ModelInfo => {
          const prompt = num(m.pricing?.promptTextTokens)
          const completion = num(m.pricing?.completionTextTokens)
          return {
            upstreamId: m.name,
            label: m.title ?? m.name,
            contextWindow: m.context_length,
            inputModalities: (m.input_modalities?.includes('image')
              ? ['text', 'image']
              : ['text']) as ModelInfo['inputModalities'],
            pricing: {
              promptPer1M: prompt !== undefined ? prompt * 1_000_000 : undefined,
              completionPer1M: completion !== undefined ? completion * 1_000_000 : undefined,
              free: m.paid_only === false,
            },
          }
        })
    },
  },
  'mimo-free': api('mimo-free', 'https://api.xiaomimimo.com/v1'),
  agentrouter: api('agentrouter', 'https://api.agentrouter.dev/v1'),
  'deepseek-tui': api('deepseek-tui', 'https://api.deepseek.com/v1'),

  // --- IDE-Provider mit lokalen Credential-Readern ---------------------------
  // Diese Provider lesen ihre Zugangsdaten aus lokalen Konfigurationsdateien.
  // Der Service versucht zuerst, die Credentials lokal zu finden; der Nutzer
  // kann sie alternativ manuell als API-Key hinterlegen.
  //
  // Jeder Reader versucht mehrere Quellen: Umgebungsvariablen, lokale
  // Konfigurationsdateien, und ggf. AWS-Standard-Profile.
  kiro: {
    id: 'kiro',
    baseUrl: 'https://kiro.api.aws/v1',
    auth: 'local',
    headers: bearer,
    listModels: openaiModels('https://kiro.api.aws/v1'),
  },
  windsurf: {
    id: 'windsurf',
    baseUrl: 'https://server.codeium.com/api/v1',
    auth: 'local',
    headers: bearer,
    listModels: openaiModels('https://server.codeium.com/api/v1'),
  },
  qoder: {
    id: 'qoder',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    auth: 'local',
    headers: bearer,
    listModels: openaiModels('https://dashscope.aliyuncs.com/compatible-mode/v1'),
  },
  workbuddy: {
    id: 'workbuddy',
    baseUrl: 'https://api.workbuddy.ai/v1',
    auth: 'local',
    headers: bearer,
    listModels: openaiModels('https://api.workbuddy.ai/v1'),
  },
  // iFlow CLI: chinesisches KI-Startup mit Free-Tier (Kimi K2, GLM-4.6, Qwen3).
  // Konfiguration in ~/.iflow/settings.json, env IFLOW_API_KEY.
  iflow: {
    id: 'iflow',
    baseUrl: 'https://apis.iflow.cn/v1',
    auth: 'local',
    headers: bearer,
    listModels: openaiModels('https://apis.iflow.cn/v1'),
  },
  // OmniRoute: Open-Source AI Gateway mit 352 Providern (90+ mit Free Tier),
  // 1200+ Modellen (Kimi, Claude, GPT, Gemini, GLM, DeepSeek, Qwen, Llama).
  // Läuft lokal auf http://localhost:20128/v1 oder über Cheaper Inference hosted.
  // OpenAI-kompatibel, API-Key aus Dashboard. 90+ Provider mit kostenlosen
  // Tier-Limits - ideal für kostenlose Modelle ohne individuelle API-Keys.
  omniroute: {
    id: 'omniroute',
    baseUrl: 'http://localhost:20128/v1',
    auth: 'api-key',
    headers: bearer,
    listModels: openaiModels('http://localhost:20128/v1'),
  },
  // LM Studio: Desktop-App für lokale LLM-Modelle (Llama, Qwen, DeepSeek,
  // Mistral, Phi, etc.). Bietet OpenAI-kompatible REST-API auf
  // http://localhost:1234/v1. Kein API-Key erforderlich - vollständig lokal.
  lmstudio: {
    id: 'lmstudio',
    baseUrl: 'http://localhost:1234/v1',
    auth: 'local',
    headers: bearer,
    listModels: openaiModels('http://localhost:1234/v1'),
  },
  // Requesty: AI Gateway mit 200 req/day Free Tier, 600+ Modelle.
  // OpenAI-kompatibel, API-Key aus Dashboard. Ideal fuer kostenlose Modelle.
  requesty: {
    id: 'requesty',
    baseUrl: 'https://router.requesty.ai/v1',
    auth: 'api-key',
    headers: bearer,
    listModels: openaiModels('https://router.requesty.ai/v1'),
  },
  // GitHub Models: 150K Tokens/Monat kostenlos, OpenAI-kompatibel.
  // Auth: GitHub Token (GITHUB_TOKEN env).
  'github-models': {
    id: 'github-models',
    baseUrl: 'https://models.github.ai/v1',
    auth: 'api-key',
    headers: bearer,
    listModels: openaiModels('https://models.github.ai/v1'),
  },
  // NVIDIA NIM: 80+ kostenlose Modelle (DeepSeek, Kimi, GLM, MiniMax).
  // API-Key aus build.nvidia.com. OpenAI-kompatibel.
  'nvidia-nim': {
    id: 'nvidia-nim',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    auth: 'api-key',
    headers: bearer,
    listModels: openaiModels('https://integrate.api.nvidia.com/v1'),
  },
  // FreeLLMAPI: Eine OpenAI-kompatible Endpoint fuer 34+ kostenlose LLM-Provider.
  // Open-Source-Gateway. Base URL: https://freellmapi.co/api/v1
  'freellm': {
    id: 'freellm',
    baseUrl: 'https://freellmapi.co/api/v1',
    auth: 'api-key',
    headers: bearer,
    listModels: openaiModels('https://freellmapi.co/api/v1'),
  },
  // Eden AI: 500+ Modelle ueber eine API. Free Credits bei Registrierung.
  // OpenAI-kompatibel via /v3/chat/completions.
  'eden-ai': {
    id: 'eden-ai',
    baseUrl: 'https://api.edenai.run/v3',
    auth: 'api-key',
    headers: bearer,
    listModels: openaiModels('https://api.edenai.run/v3'),
  },
  // xKiro AI: 105+ Modelle, 5M Tokens/Tag kostenlos, OpenAI-kompatibel.
  // Zugriff auf DeepSeek, Claude, ChatGPT, Gemini und weitere.
  xkiro: {
    id: 'xkiro',
    baseUrl: 'https://api.xkiro.com/v1',
    auth: 'api-key',
    headers: bearer,
    listModels: openaiModels('https://api.xkiro.com/v1'),
  },
  // APInex: Kostenlose OpenAI-kompatible API mit Code T4GFQTSX.
  // Modelle: OpenAI, Anthropic, Gemini, DeepSeek, Moonshot, Zhipu, xAI.
  apinex: {
    id: 'apinex',
    baseUrl: 'https://apinex.bond/v1',
    auth: 'api-key',
    headers: bearer,
    listModels: openaiModels('https://apinex.bond/v1'),
  },
  // SeekAI: $200 Free Credits, GPT-6 Astra, Claude Fable 5.1.
  // OpenAI-kompatibel, 20 Tage Check-in Bonus ($20/dag).
  seekai: {
    id: 'seekai',
    baseUrl: 'https://api.seekai.cc/v1',
    auth: 'api-key',
    headers: bearer,
    listModels: openaiModels('https://api.seekai.cc/v1'),
  },
  // Vyce AI: $50 Signup + $10/dag Check-in Bonus.
  // OpenAI-kompatibel, 105+ Modelle.
  vyceai: {
    id: 'vyceai',
    baseUrl: 'https://api.vyceai.com/v1',
    auth: 'api-key',
    headers: bearer,
    listModels: openaiModels('https://api.vyceai.com/v1'),
  },
  // FreeModel: Open-Source Free-Model-Pool.
  // OpenAI Responses + Anthropic Messages kompatibel.
  freemodel: {
    id: 'freemodel',
    baseUrl: 'https://api.freemodel.dev',
    auth: 'none',
    headers: bearer,
    listModels: openaiModels('https://api.freemodel.dev'),
  },
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
  // Nanobanana: Googles Bildgenerierungsmodell (gemini-2.5-flash-image).
  // Wird über die Gemini-API mit API-Key erreicht.
  nanobanana: {
    id: 'nanobanana',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    auth: 'api-key',
  },
  // fal.ai: Bildgenerierungs-Plattform mit 1000+ Modellen.
  // fal und fal-ai sind dieselbe API, nur unterschiedliche Schreibweise.
  fal: { id: 'fal', baseUrl: 'https://api.fal.ai/v1', auth: 'api-key' },
  'fal-ai': { id: 'fal-ai', baseUrl: 'https://api.fal.ai/v1', auth: 'api-key' },
  // SearXNG: lokale/meta-Suchmaschine mit JSON-Such-API (keine Auth).
  // Wird als Media-/Search-Provider für Web-Suche verwendet.
  searxng: { id: 'searxng', baseUrl: 'https://searxng.com', auth: 'none' },
}
