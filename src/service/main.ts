/**
 * Lokaler Routing-Service.
 *
 * Der Host startet diesen Prozess auf 127.0.0.1 und setzt
 * OPENCHAMBER_SERVICE_PORT. Die Seite spricht ihn nur ueber
 * host.serviceRequest() an und sieht weder Port noch Token.
 *
 * Hier liegen die Geheimnisse. Die Seite bekommt nie ein Secret zu sehen,
 * nur den Zustand ohne Geheimnisanteil.
 */

import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'

import { readLocalCredentials } from './local-credentials.ts'
import { join } from 'node:path'

import { adapters, adapterFor, type Adapter } from './adapters.ts'
import { baseHeaders } from './http.ts'
import { anreichern } from './model-meta.ts'
import {
  copilotDeviceFlow,
  geminiPkceFlow,
  generatePkce,
  pkceAuthUrl,
  exchangePkcCode,
  grokDeviceFlow,
  pollDecision,
  pollDeviceFlow,
  type PkceFlowConfig,
  resolveCopilot,
  startDeviceFlow,
  type OAuthSession,
} from './oauth.ts'
import { verarbeiteAntwort } from './oauth-session.ts'
import { oauthAdapterFor, oauthAdapters, renewCopilot, renewGrok, freshToken } from './oauth-adapters.ts'
import type {
  AccountStrategy,
  Connection,
  ConnectionStatus,
  ModelInfo,
  ProviderRuntime,
  Quota,
  ServiceState,
} from '../shared/contract.ts'

const VERSION = '0.2.0'

/**
 * Laufende Anmeldungen. Sie leben nur im Arbeitsspeicher: ein Neustart des
 * Dienstes beendet eine laufende Anmeldung, das ist in Ordnung – der Nutzer
 * faengt dann einfach neu an.
 */
const sessions = new Map<string, OAuthSession>()

/** PKCE-Token, die der Callback-Server empfangen hat (nur im Speicher). */
const pkceTokens = new Map<
  string,
  { accessToken: string; refreshToken?: string; expiresAt: number }
>()

/** Anbieter, bei denen wir den Geraetefluss selbst fahren. */
const deviceFlowFor = (providerId: string) => {
  if (providerId === 'copilot') return copilotDeviceFlow
  if (providerId === 'grok-cli') return grokDeviceFlow
  return undefined
}

/** PKCE-Flows: brauchen einen lokalen Callback-Server statt Device-Polling. */
const pkceFlowFor = (providerId: string) => {
  if (providerId === 'gemini-cli') return geminiPkceFlow
  return undefined
}

/**
 * Startet einen lokalen Callback-Server für den PKCE Flow.
 *
 * Der Server lauscht auf `127.0.0.1:port` und fängt den Authorization-Code
 * ab, den Google nach der Browser-Anmeldung sendet. Nach dem Tausch
 * gegen Tokens wird die Session auf `done` gesetzt.
 *
 * Der Server wird automatisch nach dem ersten Callback oder nach einem
 * Timeout (30 Sekunden) wieder geschlossen.
 */
const startPkceCallback = (
  flow: PkceFlowConfig,
  pkce: { codeVerifier: string; codeChallenge: string },
  sessionId: string,
): void => {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    if (url.pathname !== '/callback') {
      res.writeHead(404)
      res.end('Not found')
      return
    }

    const code = url.searchParams.get('code')
    const error = url.searchParams.get('error')

    if (error) {
      const errDesc = url.searchParams.get('error_description') ?? error
      sessions.set(sessionId, {
        ...sessions.get(sessionId)!,
        state: 'denied',
        error: errDesc,
        lastEvent: `Anmeldung abgelehnt: ${errDesc}`,
      })
      res.writeHead(400)
      res.end('Anmeldung abgelehnt.')
      server.close()
      return
    }

    if (code) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end('Anmeldung erfolgreich! Fenster kann geschlossen werden.')

      // Asynchron Token-Tausch (ausserhalb des Response-Streams)
      void (async () => {
        try {
          const token = await exchangePkcCode(flow, code, pkce.codeVerifier)

          pkceTokens.set(sessionId, {
            accessToken: token.accessToken,
            refreshToken: token.refreshToken,
            expiresAt: token.expiresAt,
          })

          sessions.set(sessionId, {
            ...sessions.get(sessionId)!,
            state: 'done',
            deviceCode: undefined,
            lastEvent: 'Token erhalten, Konto wird angelegt...',
          })
          // Speichere den Token-Status für die Session
          await save()
        } catch (err) {
          sessions.set(sessionId, {
            ...sessions.get(sessionId)!,
            state: 'error',
            error: err instanceof Error ? err.message : String(err),
            lastEvent: `Token-Tausch fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`,
          })
          await save()
        } finally {
          server.close()
        }
      })()
    } else {
      res.writeHead(400)
      res.end('Kein Code erhalten.')
      server.close()
    }
  })

  const port = Number(new URL(flow.redirectUri).port)
  server.listen(port, '127.0.0.1')

  // Timeout: Schließe nach 30 Sekunden, wenn kein Callback kommt.
  setTimeout(() => {
    if (!server.listening) return
    server.close()
  }, 30_000)
}
const DEFAULT_STRATEGY: AccountStrategy = 'round-robin'

interface StoredConnection extends Connection {
  /** Geheimnis des Accounts. Bleibt hier, kommt nie in eine Antwort. */
  secret: string
  /**
   * Woher das Secret stammt – wichtig für `local` Provider, die ihr
   * Credential aus einer lokalen Datei gelesen haben. Wird nicht im
   * Proxy verwendet, nur für Diagnose und UI-Hinweis.
   */
  authSource?: string
  /**
   * Zustaende aus einer Anmeldung. Bei OAuth genuegt ein einzelner Schluessel
   * nicht: der Dienst braucht Host, Plan und Ablaufzeit, sonst kann er den
   * Zugang nicht erneuern.
   */
  oauth?: {
    /** Langfristiges Token zum Erneuern (bei Copilot: das GitHub-Token). */
    refreshToken?: string
    /** Kurzlebiges Token fuer die API. */
    accessToken?: string
    /** Host aus der Antwort des Anbieters, nicht geraten. */
    apiHost?: string
    plan?: string
    expiresAt?: number
  }
}

interface Stored {
  globalStrategy: AccountStrategy
  providers: Record<
    string,
    { strategy: AccountStrategy | null; connections: StoredConnection[]; models: ModelInfo[] }
  >
  /** Zaehler fuer Round-Robin je Provider. */
  cursors: Record<string, number>
}

const dataDir = join(homedir(), '.openchamber-router')
const stateFile = join(dataDir, 'state.json')

const empty = (): Stored => ({
  globalStrategy: DEFAULT_STRATEGY,
  providers: {},
  cursors: {},
})

let state: Stored = empty()

const load = async (): Promise<void> => {
  try {
    const raw = await readFile(stateFile, 'utf8')
    const parsed = JSON.parse(raw) as Stored
    if (parsed && typeof parsed === 'object' && parsed.providers) {
      state = { ...empty(), ...parsed }
    }
  } catch {
    // Erster Start oder kaputte Datei: mit leerem Zustand weitermachen.
    state = empty()
  }
}

const save = async (): Promise<void> => {
  await mkdir(dataDir, { recursive: true })
  await writeFile(stateFile, JSON.stringify(state, null, 2), 'utf8')
}


/**
 * Anbieter auflösen – inklusive derer, die ueber eine Anmeldung kommen.
 */
const findAdapter = (providerId: string) => adapterFor(providerId) ?? oauthAdapterFor(providerId)

const slot = (providerId: string) => {
  const existing = state.providers[providerId]
  if (existing) return existing
  const created = { strategy: null, connections: [], models: [] }
  state.providers[providerId] = created
  return created
}

/** Antwortform ohne Geheimnisse. */
const publicRuntime = (providerId: string): ProviderRuntime => {
  const entry = state.providers[providerId]
  return {
    providerId,
    strategy: entry?.strategy ?? null,
    connections: (entry?.connections ?? []).map(({ secret: _secret, ...rest }) => rest),
    models: entry?.models ?? [],
  }
}

const publicState = (port: number): ServiceState => ({
  ok: true,
  version: VERSION,
  port,
  providers: Object.fromEntries(
    Object.keys(state.providers).map((id) => [id, publicRuntime(id)]),
  ),
  globalStrategy: state.globalStrategy,
})

/**
 * Wählt die nächste Verbindung nach der Strategie des Providers.
 *
 * `manual` heißt: immer die erste gesunde Verbindung in Prioritätssordnung –
 * der Nutzer sortiert also von Hand. `failover` nimmt ebenfalls die erste,
 * markiert sie aber bei Fehlern als ungesund. `round-robin` zählt weiter,
 * fällt aber auf die erste zurück, wenn nur eine übrig ist.
 *
 * `quota-aware` wählt die Verbindung mit der höchsten verbleibenden Quote.
 * Wenn die Quote unbekannt ist, fällt sie zurück auf round-robin – eine
 * erzwonnene Nummer ist schlimmer als eine faire Rotation.
 */
const pickConnection = (providerId: string): StoredConnection | null => {
  const entry = state.providers[providerId]
  const healthy = (entry?.connections ?? [])
    .filter((c) => c.status === 'active')
    .sort((a, b) => a.priority - b.priority)
  if (healthy.length === 0) return null

  const strategy = entry?.strategy ?? state.globalStrategy

  if (strategy === 'quota-aware') {
    // Verbindungen mit bekannter, nicht erschöpfter Quote zuerst.
    const withQuota = healthy.filter((c) => c.quota && !c.quota.exhausted)
    if (withQuota.length > 0) {
      // Sortiere nach verbleibender Quote (limit - used), absteigend.
      // Verbindungen ohne `used` oder `limit` rutschen ans Ende.
      return (
        withQuota
          .map((c) => ({
            conn: c,
            remaining:
              c.quota && c.quota.used !== undefined && c.quota.limit !== undefined
                ? c.quota.limit - c.quota.used
                : -1,
          }))
          .sort((a, b) => b.remaining - a.remaining)[0]?.conn ??
        healthy[0] ??
        null
      )
    }
    // Alle Quotas unbekannt oder erschöpft: auf round-robin zurückfallen.
  }

  if (strategy === 'round-robin' && healthy.length > 1) {
    const cursor = state.cursors[providerId] ?? 0
    state.cursors[providerId] = cursor + 1
    return healthy[cursor % healthy.length] ?? null
  }
  return healthy[0] ?? null
}

const setStatus = (
  providerId: string,
  connectionId: string,
  status: ConnectionStatus,
  error?: string,
  quota?: Quota,
): void => {
  const entry = state.providers[providerId]
  const found = entry?.connections.find((c) => c.id === connectionId)
  if (!found) return
  found.status = status
  if (error) found.lastError = error
  if (quota) found.quota = quota
  if (status === 'active') found.lastUsedAt = new Date().toISOString()
}

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

/** Fehler, die auf ein Konto hindeuten und nicht auf einen Aufruf. */
const accountError = (status: number): boolean =>
  status === 401 || status === 402 || status === 403 || status === 429

/**
 * Extrahiert Quota-Informationen aus HTTP-Response-Headern.
 *
 * Standard-Rate-Limit-Header (RFC 8291):
 *   x-ratelimit-remaining: verbleibende Aufrufe
 *   x-ratelimit-limit:     Gesamtlimit
 *   x-ratelimit-reset:     Unix-Zeitstempel des Zurücksetzungszeitpunkts
 *
 * Nicht alle Anbieter senden alle Header. Fehlende Werte bedeuten
 * "unbekannt", nicht "unbegrenzt" – das wird bewusst getrennt gehalten.
 */
const extractQuota = (headers: Headers): Quota | undefined => {
  const remaining = headers.get('x-ratelimit-remaining')
  const limit = headers.get('x-ratelimit-limit')
  const reset = headers.get('x-ratelimit-reset')

  if (!remaining && !limit && !reset) return undefined

  let used: number | undefined
  if (limit !== null) {
    const lim = Number(limit)
    const rem = remaining !== null ? Number(remaining) : undefined
    if (Number.isFinite(lim) && Number.isFinite(rem ?? 0)) {
      used = lim - rem!
    }
  }

  let resetsAt: string | undefined
  if (reset !== null) {
    const ts = Number(reset)
    if (Number.isFinite(ts)) {
      resetsAt = new Date(ts * 1000).toISOString()
    }
  }

  return {
    used,
    limit: limit !== null ? Number(limit) : undefined,
    resetsAt,
    exhausted: remaining !== null && Number(remaining) <= 0,
  }
}

const readBody = async (req: import('node:http').IncomingMessage): Promise<string> => {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}

const json = (res: import('node:http').ServerResponse, status: number, body: unknown): void => {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

const fail = (res: import('node:http').ServerResponse, status: number, error: string, detail?: string): void => {
  json(res, status, { error, detail })
}

const parse = <T>(raw: string): T | null => {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

const main = async (): Promise<void> => {
  await load()

  const port = Number(process.env.OPENCHAMBER_SERVICE_PORT ?? 0)

  const server = createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1')
      const path = url.pathname
      const method = req.method ?? 'GET'

      // Der Host pollt das, bevor er den Service als bereit markiert.
      if (path === '/health') return json(res, 200, { ok: true, version: VERSION })

      if (path === '/state' && method === 'GET') {
        return json(res, 200, publicState(port))
      }

      // --- Verfuegbarkeit ---------------------------------------------------
      // Die Seite braucht das, um zwischen "funktioniert" und "geplant" zu
      // unterscheiden. Sonst liefert jeder Klick auf einen noch nicht
      // gebauten Anbieter nur einen Fehler.
      if (path === '/adapters' && method === 'GET') {
        const all: Record<string, Adapter> = { ...adapters, ...oauthAdapters }
        return json(res, 200, {
          ready: Object.keys(all),
          oauth: Object.keys(oauthAdapters),
          models: Object.fromEntries(
            Object.values(all).map((a) => [a.id, Boolean(a.listModels)]),
          ),
        })
      }

      // --- Strategie --------------------------------------------------------
      if (path === '/strategy' && method === 'GET') {
        return json(res, 200, { global: state.globalStrategy })
      }
      if (path === '/strategy' && method === 'PUT') {
        const body = parse<{ global?: AccountStrategy; providerId?: string; strategy?: AccountStrategy | null }>(
          await readBody(req),
        )
        if (!body) return fail(res, 400, 'BAD_BODY', 'Kein gueltiges JSON.')
        if (body.global) state.globalStrategy = body.global
        if (body.providerId) slot(body.providerId).strategy = body.strategy ?? null
        await save()
        return json(res, 200, publicState(port))
      }

      // --- Verbindungen ----------------------------------------------------
      if (path === '/connections' && method === 'GET') {
        const providerId = url.searchParams.get('provider') ?? ''
        return json(res, 200, publicRuntime(providerId))
      }

      if (path === '/connections' && method === 'POST') {
        const body = parse<{ providerId?: string; label?: string; secret?: string; auth?: Connection['auth'] }>(
          await readBody(req),
        )
        if (!body?.providerId) return fail(res, 400, 'BAD_BODY', 'providerId fehlt.')
        const adapter = findAdapter(body.providerId)
        if (!adapter) {
          return fail(res, 400, 'NO_ADAPTER', `Kein Adapter fuer ${body.providerId}.`)
        }
        const entry = slot(body.providerId)

        // Für lokale Provider: versuche, Credentials aus lokalen Dateien zu lesen.
        // Wenn der Nutzer manuell einen Secret eingibt, hat das Vorrang.
        let secret = body.secret ?? ''
        let localSource: string | undefined
        if (adapter.auth === 'local' && !secret) {
          const creds = await readLocalCredentials(body.providerId)
          if (creds && creds.apiKey) {
            secret = creds.apiKey
            localSource = creds.source
          }
        }

        const created: StoredConnection = {
          id: randomUUID(),
          providerId: body.providerId,
          label: body.label?.trim() || `Account ${entry.connections.length + 1}`,
          auth: body.auth ?? adapter.auth,
          status: 'active',
          priority: entry.connections.length,
          secret,
          ...(localSource ? { authSource: localSource } : {}),
        }
        entry.connections.push(created)
        await save()
        const runtime = publicRuntime(body.providerId)
        // Gib das Credential-Quell-Label zurück, falls automatisch gelesen.
        return json(res, 201, {
          ...runtime,
          ...(localSource ? { authSource: localSource } : {}),
        })
      }

      const connMatch = /^\/connections\/([0-9a-f-]+)$/.exec(path)
      if (connMatch) {
        const connectionId = connMatch[1] ?? ""
        const found = Object.values(state.providers)
          .flatMap((p) => p.connections)
          .find((c) => c.id === connectionId)
        if (!found) return fail(res, 404, 'NOT_FOUND', 'Verbindung unbekannt.')

        if (method === 'DELETE') {
          const entry = slot(found.providerId)
          entry.connections = entry.connections.filter((c) => c.id !== connectionId)
          entry.connections.forEach((c, index) => {
            c.priority = index
          })
          await save()
          return json(res, 200, publicRuntime(found.providerId))
        }

        if (method === 'PATCH') {
          const body = parse<Partial<Pick<StoredConnection, 'label' | 'status' | 'priority' | 'secret'>>>(
            await readBody(req),
          )
          if (!body) return fail(res, 400, 'BAD_BODY', 'Kein gueltiges JSON.')
          if (typeof body.label === 'string') found.label = body.label
          if (typeof body.status === 'string') found.status = body.status as ConnectionStatus
          if (typeof body.priority === 'number') found.priority = body.priority
          if (typeof body.secret === 'string') found.secret = body.secret
          await save()
          return json(res, 200, publicRuntime(found.providerId))
        }
      }

      // --- Modelle ---------------------------------------------------------
      if (path === '/models' && method === 'GET') {
        const providerId = url.searchParams.get('provider') ?? ''
        const adapter = findAdapter(providerId)
        if (!adapter) return fail(res, 400, 'NO_ADAPTER', `Kein Adapter fuer ${providerId}.`)
        if (!adapter.listModels) {
          return fail(res, 400, 'NO_DISCOVERY', `${providerId} kann Modelle nicht auflisten.`)
        }
        const connection = pickConnection(providerId)
        try {
          const roh = await adapter.listModels(connection?.secret ?? '')

          // Viele Anbieter nennen nur die Haelfte: DeepInfra liefert 183
          // Modelle ohne ein einziges Kontextfenster. Ohne Ausgabelaenge kann
          // OpenCode aber kein `limit` annehmen – es verlangt beide Felder und
          // lehnt sonst die ganze Konfiguration ab. Also hier auffuellen.
          const ang = await anreichern(dataDir, roh)

          const models: ModelInfo[] = roh.map((m, i) => {
            const meta = ang.models[i]
            const modalities = m.inputModalities ?? []
            const kannBild = modalities.includes('image') || meta?.attachment === true
            return {
              ...m,
              contextWindow: meta?.context ?? m.contextWindow,
              outputWindow: meta?.output ?? m.outputWindow,
              inputModalities: kannBild
                ? modalities.includes('image')
                  ? modalities
                  : [...modalities, 'image']
                : modalities,
            }
          })

          // Ein Abruf ist eine Suche, kein Speichern. Die Auswahl gehoert
          // ausschliesslich ueber PUT hierher – sonst waeren nach dem ersten
          // "Fetch Models" alle Modelle als gewaehlt markiert.
          const selected = slot(providerId).models.map((m) => m.upstreamId)
          return json(res, 200, {
            providerId,
            models,
            alreadySelected: selected,
            connectionUsed: connection?.label ?? null,
            meta: {
              quelle: ang.quelle,
              ergaenzt: ang.ergaenzt,
              unvollstaendig: ang.unvollstaendig,
            },
          })
        } catch (error) {
          return fail(res, 502, 'FETCH_FAILED', error instanceof Error ? error.message : String(error))
        }
      }

      // Modellauswahl speichern.
      if (path === '/models' && method === 'PUT') {
        const body = parse<{ providerId?: string; models?: ModelInfo[] }>(await readBody(req))
        if (!body?.providerId || !Array.isArray(body.models)) {
          return fail(res, 400, 'BAD_BODY', 'providerId oder models fehlt.')
        }
        slot(body.providerId).models = body.models
        await save()
        return json(res, 200, publicRuntime(body.providerId))
      }

      // --- Verbindung testen ----------------------------------------------
      const testMatch = /^\/connections\/([0-9a-f-]+)\/test$/.exec(path)
      if (testMatch && method === 'POST') {
        const connectionId = testMatch[1] ?? ""
        const found = Object.values(state.providers)
          .flatMap((p) => p.connections)
          .find((c) => c.id === connectionId)
        if (!found) return fail(res, 404, 'NOT_FOUND', 'Verbindung unbekannt.')
        const adapter = findAdapter(found.providerId)
        if (!adapter?.listModels) {
          return fail(res, 400, 'NO_DISCOVERY', 'Provider kann nicht getestet werden.')
        }
        try {
          const models = await adapter.listModels(found.secret)
          setStatus(found.providerId, connectionId, 'active')
          await save()
          return json(res, 200, {
            ok: true,
            models: models.length,
            runtime: publicRuntime(found.providerId),
          })
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error)
          setStatus(found.providerId, connectionId, 'error', detail)
          await save()
          return json(res, 200, {
            ok: false,
            detail,
            runtime: publicRuntime(found.providerId),
          })
        }
      }

      // --- Proxy-Ziel fuer OpenCode ---------------------------------------
      // Die Seite registriert OpenCode-Provider ueber host.writeFile; dieser
      // Endpunkt liefert nur die Basis-URL, damit beide Seiten dieselbe Zahl
      // benutzen.
      if (path === '/proxy' && method === 'GET') {
        const providerId = url.searchParams.get('provider') ?? ''
        const adapter = findAdapter(providerId)
        if (!adapter) return fail(res, 400, 'NO_ADAPTER', `Kein Adapter fuer ${providerId}.`)
        return json(res, 200, { providerId, baseUrl: adapter.baseUrl, auth: adapter.auth })
      }

      // --- Anmeldung (OAuth-Geraetefluss) -----------------------------------
      if (path === '/oauth/start' && method === 'POST') {
        const body = parse<{ providerId?: string; label?: string }>(await readBody(req))
        if (!body?.providerId) return fail(res, 400, 'BAD_BODY', 'providerId fehlt.')

        // PKCE Authorization Code Flow (z.B. Google Gemini CLI).
        // Statt eines User-Codes starten wir einen lokalen Callback-Server
        // und geben die Auth-URL zurück – der Nutzer öffnet sie im Browser.
        const pkceFlow = pkceFlowFor(body.providerId)
        if (pkceFlow) {
          try {
            const pkce = generatePkce()
            const authUrl = pkceAuthUrl(pkceFlow, pkce)
            const sessionId = randomUUID()

            sessions.set(sessionId, {
              id: sessionId,
              providerId: body.providerId,
              state: 'pending',
              verificationUri: authUrl,
              lastEvent: 'Öffne die URL im Browser, bestätige die Anmeldung.',
            })

            // Lokalen Callback-Server starten (fängt den Code nach Redirect ab)
            startPkceCallback(pkceFlow, pkce, sessionId)

            return json(res, 201, {
              sessionId,
              verificationUri: authUrl,
              userCode: undefined,
              pkce: true,
            })
          } catch (error) {
            return fail(res, 502, 'OAUTH_START_FAILED', describeError(error))
          }
        }

        const flow = deviceFlowFor(body.providerId)
        if (!flow) {
          return fail(
            res,
            400,
            'NO_OAUTH',
            `${body.providerId} hat keinen Geraetefluss fuer Dritte. Nimm einen API-Schluessel.`,
          )
        }

        try {
          const started = await startDeviceFlow(flow)
          const id = randomUUID()
          sessions.set(id, {
            id,
            providerId: body.providerId,
            state: 'pending',
            verificationUri: started.verificationUri,
            userCode: started.userCode,
            expiresAt: Date.now() + started.expiresInSeconds * 1000,
            deviceCode: started.deviceCode,
            // Der Anbieter gibt den Mindestabstand mit. Wir halten ihn uns,
            // statt einen festen Wert zu raten: zu schnelles Fragen laesst
            // GitHub den Vorgang mit `slow_down` beantworten.
            intervalMs: started.intervalSeconds * 1000,
            polls: 0,
            lastEvent: 'Code ausgegeben. Es wird auf die Bestätigung gewartet.',
          })
          return json(res, 201, {
            sessionId: id,
            verificationUri: started.verificationUri,
            userCode: started.userCode,
            intervalMs: started.intervalSeconds * 1000,
          })
        } catch (error) {
          return fail(res, 502, 'OAUTH_START_FAILED', describeError(error))
        }
      }

      /**
       * Holt eine offene Anmeldung zu einem Anbieter.
       *
       * Nötig, weil die Oberfläche ihre Abfragekette unterbrechen kann: Wer zum
       * Bestätigen in den Browser wechselt, kommt in ein Fenster, in dem der
       * Timer nicht mehr zuverlässig läuft. Ohne diese Abfrage wüsste die Seite
       * nach der Rückkehr nicht, was aus der Anmeldung geworden ist, und
       * zeigte weiter „warte noch".
       */
      if (path === '/oauth/session' && method === 'GET') {
        const providerId = url.searchParams.get('provider') ?? ''
        const offen = [...sessions.values()]
          .filter((s) => s.providerId === providerId && s.state === 'pending')
          .sort((a, b) => (b.expiresAt ?? 0) - (a.expiresAt ?? 0))[0]

        if (!offen) {
          return json(res, 200, { session: null })
        }
        const { deviceCode: _d, intervalMs: _i, ...rest } = offen
        return json(res, 200, { session: { ...rest, sessionId: offen.id, intervalMs: offen.intervalMs } })
      }

      if (path === '/oauth/status' && method === 'GET') {
        const id = url.searchParams.get('session') ?? ''
        const session = sessions.get(id)
        if (!session) return fail(res, 404, 'NOT_FOUND', 'Anmeldung unbekannt oder abgelaufen.')

        // Abgelaufen aufraeumen, damit die Liste nicht wächst.
        if (session.expiresAt && Date.now() > session.expiresAt && session.state === 'pending') {
          session.state = 'error'
          session.error = 'Zeit abgelaufen. Bitte neu anmelden.'
        }

        // PKCE Flow: Token wird asynchron über Callback-Server empfangen.
        // Sobald state === 'done' ist, liegen die Tokens in pkceTokens vor.
        if (session.state === 'done' && pkceTokens.has(id)) {
          const pkceToken = pkceTokens.get(id)!
          pkceTokens.delete(id)

          // Verbindung anlegen
          const entry = slot(session.providerId)
          const connection: StoredConnection = {
            id: randomUUID(),
            providerId: session.providerId,
            label: `Google (${session.plan ?? 'OAuth'})`,
            auth: 'oauth',
            status: 'active',
            priority: entry.connections.length,
            secret: pkceToken.accessToken,
            oauth: {
              refreshToken: pkceToken.refreshToken ?? '',
            },
          }
          entry.connections.push(connection)
          sessions.delete(id)
          await save()

          return json(res, 200, {
            ok: true,
            connectionId: connection.id,
            label: connection.label,
          })
        }

        const flow = deviceFlowFor(session.providerId)
        // Die Entscheidung liegt beim Dienst, nicht bei der Oberflaeche:
        // ein zu schneller Client darf den Vorgang nicht zerstoeren.
        const entscheidung = pollDecision(session, Date.now())

        if (entscheidung === 'fragen' && flow && session.deviceCode) {
          session.polling = true
          session.lastPollAt = Date.now()
          session.polls = (session.polls ?? 0) + 1

            try {
              const antwort = await pollDeviceFlow(flow, session.deviceCode)

              // Die Antwort verarbeiten – dieselbe Funktion, die getestet ist.
              await verarbeiteAntwort(session, antwort, async (s, token) => {
                // Erst den Tarif erfahren, damit die Oberflaeche sagen kann, ob ein
                // Tausch noetig war. Das ist nur eine Angabe: schlaegt die Probe fehl,
                // ist die Anmeldung trotzdem gueltig.
                let plan: string | undefined
                let endgueltig = token.access_token ?? ''
                let note: string | undefined
                try {
                  const zugang = await resolveCopilot(endgueltig)
                  plan = zugang.plan
                  // Business/Enterprise: das Sitzungstoken ist das brauchbare.
                  endgueltig = zugang.token
                } catch (probeFehler) {
                  note = `Tarif unbekannt: ${describeError(probeFehler)}`
                }

                const entry = slot(s.providerId)
                const connection: StoredConnection = {
                  id: randomUUID(),
                  providerId: s.providerId,
                  label: `GitHub (${plan ?? 'OAuth'})`,
                  auth: 'oauth',
                  status: 'active',
                  priority: entry.connections.length,
                  secret: endgueltig,
                  oauth: {
                    refreshToken: token.refresh_token ?? endgueltig,
                  },
                }
                entry.connections.push(connection)
                await save()
                return { id: connection.id, label: plan, note }
              })
            } catch (error) {
            session.state = 'error'
            session.error = describeError(error)
            session.lastEvent = session.error
          } finally {
            session.polling = false
          }
        } else if (entscheidung === 'zu-frueh') {
          // Kein Fehler, nur zu frueh gefragt. Der naechste Versuch
          // passiert automatisch, deshalb bleibt der Zustand `pending`.
          session.lastEvent =
            `Abfrage vorzeitig abgefangen (${session.polls} Abfragen).`
        }

        const {
          deviceCode: _deviceCode,
          polling: _polling,
          lastPollAt: _lastPollAt,
          ...answer
        } = session
        return json(res, 200, { ...answer, sessionId: session.id, intervalMs: session.intervalMs })
      }

      // --- Proxy fuer OpenCode --------------------------------------------
      // OpenCode zeigt hierher. Der Service haelt die Keys, waehlt die
      // Verbindung nach der Strategie und leitet weiter.
      const proxyMatch = /^\/proxy\/([a-z0-9-]+)\/v1\/(.*)$/.exec(path)
      if (proxyMatch) {
        const providerId = proxyMatch[1] ?? ""
        const rest = proxyMatch[2] ?? ""
        const adapter = findAdapter(providerId)
        if (!adapter) return fail(res, 400, 'NO_ADAPTER', `Kein Adapter fuer ${providerId}.`)

        if (rest === 'models' && method === 'GET') {
          const connection = pickConnection(providerId)
          // Ohne nutzbares Konto keine Modelle anbieten: sonst zeigt der
          // Picker Modelle, deren Aufrufe gleich scheitern.
          if (!connection) {
            return fail(res, 503, 'NO_CONNECTION', `Kein aktives Konto fuer ${providerId}.`)
          }
          const entry = state.providers[providerId]
          return json(res, 200, {
            object: 'list',
            data: (entry?.models ?? []).map((m) => ({
              id: m.upstreamId,
              object: 'model',
              owned_by: providerId,
              context_length: m.contextWindow ?? null,
            })),
          })
        }

        const connection = pickConnection(providerId)
        if (!connection) {
          return fail(res, 503, 'NO_CONNECTION', `Kein aktives Konto fuer ${providerId}.`)
        }

        // Anmeldungen laufen oft nach Minuten ab. Lieber vorher erneuern, als
        // den Aufruf wiederholen zu muessen – das merkt der Nutzer als Fehler.
        if (connection.oauth) {
          const renewer =
          providerId === 'copilot'
            ? renewCopilot
            : providerId === 'grok-cli'
              ? renewGrok
              : undefined
          if (renewer && connection.oauth.refreshToken) {
            try {
              const next = await freshToken(connection.oauth, renewer)
              connection.oauth = next
              connection.secret = next.accessToken ?? connection.secret
              await save()
            } catch (error) {
              setStatus(providerId, connection.id, 'error', describeError(error))
              await save()
              return fail(
                res,
                401,
                'OAUTH_EXPIRED',
                `Anmeldung nicht mehr gueltig: ${describeError(error)}`,
              )
            }
          }
        }

        // Bei Copilot steht der Host in der Antwort, nicht in der Basis-URL.
        const target =
          connection.oauth?.apiHost && providerId === 'copilot'
            ? connection.oauth.apiHost
            : adapter.baseUrl
        const upstream = `${target}/${rest}`
        const headers: Record<string, string> = {
          'content-type': 'application/json',
          // Ohne eigenen User-Agent antworten manche Anbieter mit 404.
          ...baseHeaders(),
          ...(adapter.headers?.(connection.secret) ?? {}),
        }
        const raw = method === 'GET' ? undefined : await readBody(req)

        let response: Response
        try {
          response = await fetch(upstream, {
            method,
            headers,
            body: method === 'GET' ? undefined : raw,
          })
        } catch (error) {
          return fail(res, 502, 'UPSTREAM_UNREACHABLE', error instanceof Error ? error.message : String(error))
        }

        // Ein Konto, das nicht mehr zahlt oder nicht mehr darf, wird still
        // gesperrt, damit der naechste Aufruf ein anderes nimmt.
        // Quota-Header werden ausgewertet, damit die Strategie sie nutzen kann.
        const quota = extractQuota(response.headers)
        if (quota?.exhausted) {
          // 429 mit leerer Quota: das Konto ist erschoepft, nicht defekt.
          // Es bleibt "active", aber die quota-aware-Strategie meidet es.
          setStatus(providerId, connection.id, 'active', undefined, quota)
          await save()
        } else if (accountError(response.status)) {
          setStatus(providerId, connection.id, 'locked', `Upstream ${response.status}`, quota)
          await save()
        } else if (response.ok) {
          setStatus(providerId, connection.id, 'active', undefined, quota)
          await save()
        }

        const payload = await response.text()
        res.writeHead(response.status, {
          'content-type': response.headers.get('content-type') ?? 'application/json; charset=utf-8',
          'content-length': Buffer.byteLength(payload),
        })
        res.end(payload)
        return
      }

      return fail(res, 404, 'NOT_FOUND', `${method} ${path}`)
    })().catch((error: unknown) => {
      fail(res, 500, 'INTERNAL', error instanceof Error ? error.message : String(error))
    })
  })

  // Nur auf Loopback lauschen. Der Host setzt den Port.
  server.listen(port, '127.0.0.1', () => {
    const address = server.address()
    const actual = typeof address === 'object' && address ? address.port : port
    process.stdout.write(`openchamber-router service bereit auf 127.0.0.1:${actual}\n`)
  })
}

void main()

export { adapters }
