/**
 * Vertrag zwischen der Extension-Seite (Sandbox) und dem lokalen Service.
 *
 * Die Seite darf nichts vom Netzwerk und nichts von der Platte sehen. Alles
 * Laeuft durch `host.serviceRequest()` zum Service; der Service haelt die
 * Secrets und spricht mit den Anbietern.
 */

export type AccountStrategy =
  | 'manual'
  | 'failover'
  | 'round-robin'
  | 'quota-aware'

export type ConnectionStatus =
  | 'active'
  | 'error'
  | 'locked'
  | 'disabled'

export type AuthKind =
  | 'api-key'
  | 'oauth'
  | 'cookie'
  | 'local'
  | 'none'

export interface Quota {
  used?: number
  limit?: number
  resetsAt?: string
  exhausted?: boolean
}

export interface Connection {
  id: string
  providerId: string
  label: string
  auth: AuthKind
  status: ConnectionStatus
  priority: number
  lastUsedAt?: string
  lastError?: string
  quota?: Quota
}

export interface ModelInfo {
  upstreamId: string
  label: string
  contextWindow?: number
  /**
   * Maximale Antwortlaenge.
   *
   * Steht hier, weil OpenCode daraus `limit.output` macht – und weil ein
   * falscher oder fehlender Wert sich unmittelbar auf das Ergebnis auswirkt:
   * zu klein abgeschnittene Antworten, zu gross Blocklisting.
   */
  outputWindow?: number
  inputModalities: ('text' | 'image' | 'audio')[]
  pricing?: {
    promptPer1M?: number
    completionPer1M?: number
    free?: boolean
  }
  builtin?: boolean
}

export interface ProviderRuntime {
  providerId: string
  /** `null` heisst: die globale Vorgabe des Hosts verwenden. */
  strategy: AccountStrategy | null
  connections: Connection[]
  models: ModelInfo[]
}

export interface ServiceState {
  ok: true
  version: string
  port: number
  providers: Record<string, ProviderRuntime>
  globalStrategy: AccountStrategy
}

export interface ApiError {
  error: string
  detail?: string
}

/** Envelope fuer Antworten, die ok nicht direkt auf true setzen. */
export type ServiceReply<T> = T | ApiError

export const isApiError = (value: unknown): value is ApiError =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as ApiError).error === 'string'
