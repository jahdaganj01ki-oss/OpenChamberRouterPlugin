/**
 * Anmeldung ueber OAuth-Geraetefluss (Device Flow).
 *
 * Der Nutzer bekommt einen Code und bestaetigt ihn im Browser. Das passt zur
 * Architektur: die Seite ist sandboxed und kann keinen eigenen Browser oeffnen,
 * aber der Dienst darf beliebig viele Endpunkte ansprechen.
 *
 * Zwei Dinge unterscheiden die Anbieter und stehen deshalb unten:
 * - Copilot tauscht das GitHub-Token noch einmal gegen ein kurzlebiges um
 *   und braucht je nach Tarif einen anderen Weg (siehe `resolveCopilot`).
 * - Kiro hat keinen offenen Geraetefluss fuer Dritte; dort bleibt der Key.
 */

import { createHash } from 'node:crypto'

import { baseHeaders } from './http.ts'

export type OAuthState = 'pending' | 'done' | 'denied' | 'error'

export interface OAuthSession {
  id: string
  providerId: string
  state: OAuthState
  /** Was der Nutzer im Browser tun muss. */
  verificationUri?: string
  userCode?: string
  expiresAt?: number
  error?: string
  connectionId?: string
  /** Plan des Copilot-Kontos, falls ermittelt. */
  plan?: string

  // --- Innen, niemals nach aussen -----------------------------------------
  /** Der geheime Code. Gehoert nie in eine Antwort. */
  deviceCode?: string
  /** Wie oft der Dienst gefragt hat. */
  polls?: number
  /** Abstand zwischen zwei Abfragen in Millisekunden. Wird bei `slow_down` vergroessert. */
  intervalMs?: number
  /** Wann zuletzt beim Anbieter gefragt wurde. */
  lastPollAt?: number
  /** Verhindert, dass zwei gleichzeitige Abfragen zwei Konten anlegen. */
  polling?: boolean
  /**
   * Was der Anbieter zuletzt gesagt hat, in einem Satz.
   *
   * Ohne das war „wartet noch" alles, was man sah – auch wenn in Wahrheit
   * „zu schnell gefragt" die Ursache war. Diese Zeile macht den Unterschied
   * sichtbar, statt ihn zu vermuten.
   */
  lastEvent?: string
}

export interface DeviceFlowConfig {
  clientId: string
  deviceCodeUrl: string
  tokenUrl: string
  scope: string
}

export interface DeviceCredentials {
  deviceCode: string
  userCode: string
  verificationUri: string
  intervalSeconds: number
  expiresInSeconds: number
}

const jsonPost = async <T>(url: string, body: unknown, headers: Record<string, string> = {}): Promise<{ status: number; json: T }> => {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...baseHeaders(),
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      ...headers,
    },
    body: body instanceof URLSearchParams ? body.toString() : JSON.stringify(body),
  })
  return { status: res.status, json: (await res.json()) as T }
}

/**
 * Geraetefluss starten: der Dienst fragt den Code an, der Nutzer bestaetigt
 * ihn im Browser.
 */
export const startDeviceFlow = async (
  config: DeviceFlowConfig,
): Promise<DeviceCredentials> => {
  const res = await jsonPost<{
    device_code: string
    user_code: string
    verification_uri: string
    interval?: number
    expires_in: number
  }>(
    config.deviceCodeUrl,
    new URLSearchParams({ client_id: config.clientId, scope: config.scope }),
  )

  if (res.status !== 200) {
    throw new Error(
      `Anmeldung nicht moeglich (HTTP ${res.status}). Bitte den OAuth-Client pruefen.`,
    )
  }
  return {
    deviceCode: res.json.device_code,
    userCode: res.json.user_code,
    verificationUri: res.json.verification_uri,
    intervalSeconds: res.json.interval ?? 5,
    expiresInSeconds: res.json.expires_in,
  }
}

export interface TokenResponse {
  access_token?: string
  refresh_token?: string
  token_type?: string
  expires_in?: number
  scope?: string
  error?: string
  error_description?: string
  interval?: number
}

/**
 * Abstand nach einer `slow_down`-Meldung.
 *
 * Der Anbieter sagt, ab wann wieder gefragt werden darf. Wir nehmen das
 * Groessere aus seiner Vorgabe und unserem bisherigen Abstand – und einen
 * kleinen Rest obendrauf, damit wir nicht genau auf die Grenzepollen.
 */
/**
 * Kleinster Abstand, den wir je halten.
 *
 * GitHub nennt zwar ein eigenes Intervall, aber unter fuenf Sekunden ist
 * sinnlos – und ein zu kurzer Abstand kostet den ganzen Vorgang.
 */
export const MIN_POLL_INTERVAL_MS = 5000

export const nextInterval = (current: number, demandedSeconds: number): number =>
  Math.max(current, demandedSeconds * 1000, MIN_POLL_INTERVAL_MS) + 1000

export type PollDecision = 'fragen' | 'zu-frueh' | 'warten'

/**
 * Darf der Dienst jetzt beim Anbieter fragen?
 *
 * Getrennt von der Route, weil genau hier der Fehler passiert war: es wurde
 * alle drei Sekunden gefragt, der Anbieter wollte fuenf, und `slow_down`
 * sah in der Oberflaeche genauso aus wie „wartet noch". Dass hier der
 * Dienst entscheidet und nicht die Oberflaeche, ist der Kern der Reparatur –
 * ein zu schneller Client kann den Vorgang jetzt nicht mehr zerstoeren.
 */
export const pollDecision = (
  session: {
    state?: string
    deviceCode?: string
    intervalMs?: number
    lastPollAt?: number
    polling?: boolean
  },
  now: number,
): PollDecision => {
  if (session.state !== 'pending') return 'warten'
  if (!session.deviceCode) return 'warten'
  // Zwei Abfragen gleichzeitig wuerden zwei Konten anlegen.
  if (session.polling) return 'warten'
  if (
    session.lastPollAt !== undefined &&
    now - session.lastPollAt < (session.intervalMs ?? 5000)
  ) {
    return 'zu-frueh'
  }
  return 'fragen'
}

/**
 * Antwort auf eine Abfrage, ausdruecklich unterschieden.
 *
 * Frueher gab diese Funktion `null` zurueck, und zwar bei *drei* verschiedenen
 * Antworten des Anbieters: noch nicht bestaetigt, zu schnell abgefragt, und
 * Transportstoerung. In der Oberflaeche sah das alles gleich aus – „warte
 * noch". Genau daran ist eine Anmeldung hängen geblieben, ohne dass man
 * sagen konnte, woran. Jetzt ist jede Antwort unterscheidbar.
 */
export type PollResult =
  /** Der Nutzer hat noch nicht bestaetigt. Alles normal. */
  | { kind: 'pending' }
  /** Zu oft abgefragt. Der Anbieter will einen groesseren Abstand. */
  | { kind: 'slow-down'; intervalSeconds: number }
  /** Fertig – hier steht das Token. */
  | { kind: 'token'; token: TokenResponse }
  /** Endgueltig abgelehnt, mit dem Grund des Anbieters. */
  | { kind: 'denied'; reason: string }

/**
 * Einmal nach dem Token fragen.
 */
export const pollDeviceFlow = async (
  config: DeviceFlowConfig,
  deviceCode: string,
): Promise<PollResult> => {
  const res = await jsonPost<TokenResponse>(
    config.tokenUrl,
    new URLSearchParams({
      client_id: config.clientId,
      device_code: deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    }),
  )

  const body = res.json
  if (body.error === 'authorization_pending') return { kind: 'pending' }
  if (body.error === 'slow_down') {
    // Laut Anbieter zaehlt das neue Intervall ab jetzt fuer *alle* weiteren
    // Abfragen. Deshalb wird es hier zurueckgegeben und nicht geraten.
    return { kind: 'slow-down', intervalSeconds: body.interval ?? 5 }
  }
  if (body.error) {
    // `access_denied` heisst: der Nutzer hat abgelehnt. Das ist kein Fehler
    // des Dienstes und soll auch nicht so gemeldet werden.
    if (body.error === 'access_denied') {
      return { kind: 'denied', reason: 'Die Anmeldung wurde abgelehnt.' }
    }
    return {
      kind: 'denied',
      reason: body.error_description ?? `Anmeldung fehlgeschlagen: ${body.error}`,
    }
  }
  if (!body.access_token) {
    // Kein Fehler, aber auch kein Token. Nie als Erfolg durchwinken.
    return { kind: 'pending' }
  }
  return { kind: 'token', token: body }
}

// ---------------------------------------------------------------------------
// xAI Grok CLI (RFC 8628 Device Code Flow)
// ---------------------------------------------------------------------------

/**
 * Client-ID des Grok-CLI-Clients.
 *
 * Das ist die öffentliche Client-ID, die auch die Grok-CLI-App verwendet;
 * stammt aus dem Quellcode von xai-org/grok-build. Sie ist für Desktop-OAuth
 * flows zugelassen.
 */
export const GROK_CLIENT_ID = 'b1a00492-073a-47ea-816f-4c329264a828'

export const grokDeviceFlow: DeviceFlowConfig = {
  clientId: GROK_CLIENT_ID,
  deviceCodeUrl: 'https://auth.x.ai/oauth2/device/code',
  tokenUrl: 'https://auth.x.ai/oauth/token',
  scope: 'openid profile email offline_access grok-cli:access api:access',
}

/**
 * Grok CLI Models-Endpunkt. Der Token, den der Device-Flow liefert, wird
 * direkt als Bearer-Token verwendet – es gibt keinen separaten Tausch.
 */
export const GROK_BASE_URL = 'https://api.x.ai/v1'

/**
 * Holt die Modellliste von xAI. Verwendet das Standard OpenAI-Format,
 * aber mit der Grok-spezifischen Client-ID und Scope.
 */
export const listGrokModels = async (token: string): Promise<string[]> => {
  const res = await fetch(`${GROK_BASE_URL}/models`, {
    headers: {
      ...baseHeaders(),
      Authorization: `Bearer ${token}`,
    },
  })
  if (!res.ok) throw new Error(`Grok-Modelle nicht lesbar (HTTP ${res.status}).`)
  const body = (await res.json()) as { data?: Array<{ id: string }> }
  return (body.data ?? []).map((m) => m.id)
}

// ---------------------------------------------------------------------------
// GitHub Copilot
// ---------------------------------------------------------------------------

/**
 * Client-ID des Copilot-Chat-Clients.
 *
 * Das ist die oeffentlich bekannte ID, die auch die Editoren benutzen; sie gehoert
 * nicht mir. Wer das nicht will, legt unter Settings -> Developers ein eigenes
 * GitHub-OAuth-App an und traegt dessen ID hier ein. Sonst laeuft die Anmeldung
 * ueber das Copilot-Programm, nicht ueber eine eigene App.
 */
export const COPILOT_CLIENT_ID = 'Iv1.b507a08c87ecfe98'

export const copilotDeviceFlow: DeviceFlowConfig = {
  clientId: COPILOT_CLIENT_ID,
  deviceCodeUrl: 'https://github.com/login/device/code',
  tokenUrl: 'https://github.com/login/oauth/access_token',
  scope: 'read:user copilot',
}

/**
 * Vier Header, ohne die Copilot die Anfrage ablehnt. `Copilot-Integration-Id`
 * ist nicht optional – ohne ihn wird die Anfrage abgewiesen.
 */
export const COPILOT_EDITOR_HEADERS: Record<string, string> = {
  'Editor-Version': 'vscode/1.104.1',
  'Editor-Plugin-Version': 'copilot-chat/0.26.7',
  'Copilot-Integration-Id': 'vscode-chat',
  'OpenAI-Intent': 'conversation-panel',
  'User-Agent': 'GitHubCopilotChat/0.26.7',
}

/**
 * Braucht dieses Konto den Token-Tausch?
 *
 * Das ist die Stelle, an der die meisten Anleitungen scheitern. Der
 * Tausch-Endpunkt antwortet bei Business, Enterprise und auf
 * Data-Residency-Mandanten mit 404 – auch bei einem vollstaendig gueltigen
 * Token. Ein 404 heisst also `falscher Tarif`, nicht `kaputtes Token`.
 * Deshalb wird die Regel vorher entschieden und nicht am Fehler geraten.
 */
export const copilotNeedsExchange = (plan: string, apiHost: string): boolean => {
  if (plan === 'individual') return false
  if (/(^|\.)ghe\.com$/.test(new URL(apiHost).hostname) || /\.ghe\./.test(apiHost)) return false
  return true
}

export interface CopilotAccess {
  token: string
  /** Host, an den die Anfragen gehen. Steht in der Antwort, ist nicht geraten. */
  apiHost: string
  plan: string
  expiresAt: number
}

/**
 * Aus dem GitHub-Token die actually brauchbare Zugangsberechtigung machen.
 *
 * Der Ablauf haengt am Tarif, und das ist der Teil, an dem die meisten
 * Anleitungen scheitern:
 * - `individual`: das GitHub-Token reicht direkt.
 * - `business`/`enterprise`: der Tausch-Endpunkt liefert erst das Sitzungstoken.
 * - `*.ghe.com`: es gibt keinen Tausch, das Token geht direkt an den Host.
 */
export const resolveCopilot = async (githubToken: string): Promise<CopilotAccess> => {
  const res = await fetch('https://api.github.com/copilot_internal/user', {
    headers: {
      ...baseHeaders(),
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${githubToken}`,
      'X-GitHub-Api-Version': '2026-03-10',
    },
  })

  if (res.status === 401 || res.status === 403) {
    // 401 heisst hier fast immer: es wurde nie angemeldet. Wer ein Konto
    // per API-Key-Feld anlegt, hat aber gar kein GitHub-Token – die Meldung
    // wuerde ihm die Schuld fuer etwas geben, das er nicht getan hat.
    const grund = githubToken.trim().length === 0
      ? 'Es ist kein GitHub-Token hinterlegt. Bitte über „Anmeldung" anmelden.'
      : githubToken.startsWith('ghp_')
        ? 'Klassische GitHub-PATs werden von Copilot nicht unterstützt. ' +
          'Bitte über „Anmeldung" anmelden.'
        : 'Kein Copilot-Sitzplatz für dieses Konto (401).'
    throw new Error(grund)
  }
  if (!res.ok) {
    throw new Error(`Copilot-Konto nicht lesbar (HTTP ${res.status}).`)
  }

  const body = (await res.json()) as {
    copilot_plan?: string
    endpoints?: { api?: string }
  }
  const plan = body.copilot_plan ?? 'unknown'
  const apiHost = `https://${body.endpoints?.api ?? 'api.githubcopilot.com'}`

  // Data-Residency und Individual brauchen keinen Tausch.
  if (!copilotNeedsExchange(plan, apiHost)) {
    return { token: githubToken, apiHost, plan, expiresAt: Date.now() + 25 * 60_000 }
  }

  const exchanged = await jsonPost<{ token?: string; expires_at?: number }>(
    'https://api.github.com/copilot_internal/v2/token',
    '',
    {
      Authorization: `token ${githubToken}`,
      ...COPILOT_EDITOR_HEADERS,
    },
  )

  if (exchanged.status !== 200 || !exchanged.json.token) {
    throw new Error(
      `Token-Tausch fehlgeschlagen (HTTP ${exchanged.status}). ` +
        'Bei Business/Enterprise kann das am Tarif liegen – ' +
        'dann hilft nur die Kuerzel-URL direkt aus dem Copilot-Programm.',
    )
  }

  return {
    token: exchanged.json.token,
    apiHost,
    plan,
    expiresAt: (exchanged.json.expires_at ?? Math.floor(Date.now() / 1000) + 1800) * 1000,
  }
}

/** Modellliste von Copilot. Braucht die vier Editor-Header. */
export const listCopilotModels = async (access: CopilotAccess): Promise<string[]> => {
  const res = await fetch(`${access.apiHost}/models`, {
    headers: {
      ...baseHeaders(),
      Authorization: `Bearer ${access.token}`,
      ...COPILOT_EDITOR_HEADERS,
    },
  })
  if (!res.ok) throw new Error(`Copilot-Modelle nicht lesbar (HTTP ${res.status}).`)
  const body = (await res.json()) as {
    data?: Array<{ id: string; name?: string; capabilities?: { family?: string } }>
  }
  return (body.data ?? []).map((m) => m.id)
}

// ---------------------------------------------------------------------------
// Google Gemini CLI (PKCE Authorization Code Flow)
// ---------------------------------------------------------------------------

/**
 * Client-ID der Gemini-CLI.
 *
 * Stammt aus dem Quellcode der Gemini CLI (google-gemini/node-cli).
 * Google hat das OAuth am 18.06.2026 eingestellt — neue Anmeldungen können
 * mit `access_denied` scheitern. Bestehende Refresh-Tokens funktionieren
 * weiterhin.
 */
export const GEMINI_CLIENT_ID = '326832006528-8tbl2lo9okmvcpjeo6n6l7j2s9qk8b3n.apps.googleusercontent.com'

/**
 * PKCE Authorization Code Flow Konfiguration für Google.
 *
 * Im Gegensatz zum Device Flow benötigt PKCE einen lokalen Callback-Server
 * oder manuelle Code-Eingabe. Der Service startet hier einen lokalen Server
 * auf `127.0.0.1` und lauscht auf den Callback.
 */
export interface PkceFlowConfig {
  clientId: string
  authUrl: string
  tokenUrl: string
  redirectUri: string
  scope: string
}

export const geminiPkceFlow: PkceFlowConfig = {
  clientId: GEMINI_CLIENT_ID,
  authUrl: 'https://accounts.google.com/o/oauth2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  redirectUri: 'http://127.0.0.1:8478/callback',
  scope: 'openid email profile https://www.googleapis.com/auth/cloud-platform',
}

/** Generiert einen zufälligen String für PKCE. */
const randStr = (len: number): string =>
  crypto
    .getRandomValues(new Uint8Array(len))
    .reduce((s, b) => s + b.toString(16).padStart(2, '0'), '')

/** Base64URL-Encoding ohne Padding. Akzeptiert ArrayBuffer oder Uint8Array. */
const b64url = (buf: ArrayBuffer | Uint8Array): string => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

/**
 * Erzeugt PKCE-Parameter (code_verifier + code_challenge).
 *
 * `code_challenge` ist der SHA-256-Hash von `code_verifier`, base64URL-codiert.
 */
export const generatePkce = (): {
  codeVerifier: string
  codeChallenge: string
  codeChallengeMethod: 'S256'
} => {
  const verifier = randStr(32)
  // SHA-256-Hash für PKCE (S256-Methode)
  const hash = createHash('sha256').update(verifier).digest()
  return {
    codeVerifier: verifier,
    codeChallenge: b64url(hash),
    codeChallengeMethod: 'S256',
  }
}

/** Baut die Auth-URL für den PKCE Flow. */
export const pkceAuthUrl = (config: PkceFlowConfig, pkce: {
  codeVerifier: string
  codeChallenge: string
  codeChallengeMethod: 'S256'
}): string => {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: config.scope,
    access_type: 'offline',
    prompt: 'consent',
    code_challenge: pkce.codeChallenge,
    code_challenge_method: pkce.codeChallengeMethod,
  })
  return `${config.authUrl}?${params.toString()}`
}

/**
 * Tauscht den Authorization-Code gegen Tokens.
 *
 * Wird nach dem Redirect vom lokalen Callback-Server aufgerufen.
 */
export const exchangePkcCode = async (
  config: PkceFlowConfig,
  code: string,
  codeVerifier: string,
): Promise<{ accessToken: string; refreshToken?: string; expiresAt: number }> => {
  const body = new URLSearchParams({
    client_id: config.clientId,
    code,
    code_verifier: codeVerifier,
    redirect_uri: config.redirectUri,
    grant_type: 'authorization_code',
  })

  const res = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      ...baseHeaders(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as {
      error?: string
      error_description?: string
    }
    throw new Error(
      `Token-Tausch fehlgeschlagen (HTTP ${res.status}): ${err.error_description ?? err.error ?? res.statusText}`,
    )
  }

  const token = (await res.json()) as {
    access_token: string
    refresh_token?: string
    expires_in?: number
  }

  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: Date.now() + (token.expires_in ?? 3600) * 1000,
  }
}

/** Erneuert ein Google-Refresh-Token. */
export const renewGemini = async (refreshToken: string): Promise<{
  accessToken: string
  refreshToken?: string
  expiresAt: number
}> => {
  const body = new URLSearchParams({
    client_id: GEMINI_CLIENT_ID,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  })

  const res = await fetch(geminiPkceFlow.tokenUrl, {
    method: 'POST',
    headers: {
      ...baseHeaders(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as {
      error?: string
      error_description?: string
    }
    throw new Error(
      `Gemini-Token-Erneuerung fehlgeschlagen (HTTP ${res.status}): ${err.error_description ?? err.error ?? res.statusText}`,
    )
  }

  const token = (await res.json()) as {
    access_token: string
    refresh_token?: string
    expires_in?: number
  }

  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? refreshToken,
    expiresAt: Date.now() + (token.expires_in ?? 3600) * 1000,
  }
}
