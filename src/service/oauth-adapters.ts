/**
 * Adapter, deren Zugang aus einer Anmeldung kommt statt aus einem Schluessel.
 *
 * Der Unterschied ist nicht kosmetisch: das Token gilt oft nur Minuten. Der
 * Dienst holt deshalb vor jedem Aufruf ein frisches, wenn das alte nah am
 * Ablauf ist, und merkt sich das Ergebnis.
 */

import type { ModelInfo } from '../shared/contract.ts'
import type { Adapter } from './adapters.ts'
import { baseHeaders } from './http.ts'
import {
  COPILOT_EDITOR_HEADERS,
  GROK_BASE_URL,
  listCopilotModels,
  listGrokModels,
  resolveCopilot,
  GEMINI_CLIENT_ID,
  geminiPkceFlow,
  exchangePkcCode,
  renewGemini,
} from './oauth.ts'

/** Was der Dienst zu einer Verbindung gespeichert hat. */
export interface OauthState {
  refreshToken?: string
  accessToken?: string
  apiHost?: string
  plan?: string
  expiresAt?: number
}

/**
 * Frisches Token holen, wenn das alte gleich ablaeuft.
 *
 * Bewusst mit 60 Sekunden Vorlauf: ein Token im Proxy zu erneuern heisst, den
 * Aufruf zu wiederholen, und das merkt der Nutzer als Fehler.
 */
export const freshToken = async (
  state: OauthState | undefined,
  renew: (refreshToken: string) => Promise<OauthState>,
): Promise<OauthState> => {
  const current = state ?? {}
  const valid = (current.expiresAt ?? 0) - Date.now() > 60_000
  if (valid && current.accessToken) return current
  if (!current.refreshToken) return current
  const next = await renew(current.refreshToken)
  return { ...current, ...next }
}

/** GitHub-Token gegen ein Copilot-Token tauschen, Tarif wird mitgenommen. */
export const renewCopilot = async (githubToken: string): Promise<OauthState> => {
  const access = await resolveCopilot(githubToken)
  return {
    refreshToken: githubToken,
    accessToken: access.token,
    apiHost: access.apiHost,
    plan: access.plan,
    expiresAt: access.expiresAt,
  }
}

/**
 * Erneuert ein abgelaufenes Grok-CLI-Token.
 *
 * Der Device-Flow liefert ein `refresh_token`, das für die Erneuerung
 * verwendet wird. Anders als Copilot braucht Grok keinen zweistufigen Tausch –
 * das Token geht direkt an die API.
 */
export const renewGrok = async (refreshToken: string): Promise<OauthState> => {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: 'b1a00492-073a-47ea-816f-4c329264a828',
  })

  const res = await fetch('https://auth.x.ai/oauth/token', {
    method: 'POST',
    headers: {
      ...baseHeaders(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  if (!res.ok) throw new Error(`Grok-Token-Erneuerung fehlgeschlagen (HTTP ${res.status}).`)
  const token = (await res.json()) as {
    access_token: string
    refresh_token?: string
    expires_in?: number
    token_type?: string
  }

  return {
    refreshToken: token.refresh_token ?? refreshToken,
    accessToken: token.access_token,
    plan: 'grok',
    expiresAt: Date.now() + (token.expires_in ?? 3600) * 1000,
  }
}

const copilotAdapter: Adapter = {
  id: 'copilot',
  baseUrl: 'https://api.githubcopilot.com',
  auth: 'oauth',
  headers: (token) => ({
    ...baseHeaders(),
    Authorization: `Bearer ${token}`,
    ...COPILOT_EDITOR_HEADERS,
  }),
  listModels: async (secret) => {
    // `secret` traegt hier das GitHub-Token; der Dienst reicht es weiter.
    const access = await resolveCopilot(secret)
    const ids = await listCopilotModels(access)
    return ids.map<ModelInfo>((id) => ({
      upstreamId: id,
      label: id,
      inputModalities: ['text'],
    }))
  },
}

/**
 * Grok-CLI-Adapter. Der Device-Flow liefert ein Token, das direkt als
 * Bearer-Token an die xAI-API verwendet wird – kein Token-Tausch nötig.
 */
const grokAdapter: Adapter = {
  id: 'grok-cli',
  baseUrl: GROK_BASE_URL,
  auth: 'oauth',
  headers: (token) => ({
    ...baseHeaders(),
    Authorization: `Bearer ${token}`,
  }),
  listModels: async (secret) => {
    const access = await resolveGrok(secret)
    const ids = await listGrokModels(access.accessToken!)
    return ids.map<ModelInfo>((id) => ({
      upstreamId: id,
      label: id,
      inputModalities: ['text'],
    }))
  },
}

/**
 * Löst ein frisches Grok-Token auf, erneuert es bei Bedarf.
 *
 * Wird von `grokAdapter.listModels` und dem Proxy-Forwarding aufgerufen.
 */
const resolveGrok = async (refreshToken: string): Promise<OauthState> => {
  return freshToken(
    { refreshToken },
    (token) => renewGrok(token),
  )
}

/**
 * Google Gemini CLI: PKCE Authorization Code Flow.
 *
 * Google hat das OAuth am 18.06.2026 eingestellt — neue Anmeldungen können
 * mit `access_denied` scheitern. Bestehende Refresh-Tokens funktionieren
 * weiterhin. Der Adapter erneuert Tokens automatisch.
 */
const geminiAdapter: Adapter = {
  id: 'gemini-cli',
  baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  auth: 'oauth',
  headers: (token) => ({
    ...baseHeaders(),
    Authorization: `Bearer ${token}`,
    'x-goog-api-version': '2',
  }),
  listModels: async (secret) => {
    // `secret` ist hier das Refresh-Token; der Dienst erneuert es.
    const state = await freshToken(
      { refreshToken: secret },
      (refresh) =>
        renewGemini(refresh).then((t) => ({
          accessToken: t.accessToken,
          refreshToken: t.refreshToken,
          expiresAt: t.expiresAt,
        })),
    )
    const token = state.accessToken
    if (!token) throw new Error('Kein gültiges Gemini-Token hinterlegt')
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
      headers: {
        ...baseHeaders(),
        Authorization: `Bearer ${token}`,
      },
    })
    if (!res.ok) throw new Error(`Gemini-Modelle nicht lesbar (HTTP ${res.status}).`)
    const body = (await res.json()) as { model?: Array<{ name: string; displayName?: string }> }
    return (body.model ?? []).map<ModelInfo>((m) => ({
      upstreamId: m.name,
      label: m.displayName ?? m.name,
      inputModalities: ['text'],
    }))
  },
}

/**
 * Gemini PKCE Token-Status: erweitert OauthState um code_verifier
 * für den Fall, dass der Service selbst den Exchange macht.
 */
export interface GeminiPkceState extends OauthState {
  codeVerifier?: string
  exchangeCode?: string
}

export const oauthAdapters: Record<string, Adapter> = {
  copilot: copilotAdapter,
  'grok-cli': grokAdapter,
  'gemini-cli': geminiAdapter,
}

export const oauthAdapterFor = (providerId: string): Adapter | undefined =>
  oauthAdapters[providerId]
