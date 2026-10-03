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
  listCopilotModels,
  resolveCopilot,
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

export const oauthAdapters: Record<string, Adapter> = {
  copilot: copilotAdapter,
}

export const oauthAdapterFor = (providerId: string): Adapter | undefined =>
  oauthAdapters[providerId]
