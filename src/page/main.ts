/**
 * Extension page: Anbieter-Katalog und Detailseite je Anbieter.
 *
 * Die Seite laeuft sandboxed. Sie darf weder Netz noch Platte. Alles geht ueber
 * `host.serviceRequest()` an den lokalen Service; die OpenCode-Konfiguration
 * schreibt sie selbst ueber `host.writeFile`, weil genau dafuer die
 * filesystem-Freigabe im Manifest steht.
 */

import { connectHost } from '@openchamber/sdk'
import { applyHostReady, type ButtonHandle } from '@openchamber/sdk/ui'

import { clearNode, el, ensureStyle, setText, spacer } from '../ui/dom.ts'
import {
  addBadge,
  addBanner,
  addButton,
  addEmpty,
  addSelfSwitch,
  addToggle,
  addSearchField,
  addSelect,
  addSpinner,
  addTextField,
} from '../ui/kit.ts'
import { openCodeId, readConfig, registerIntoOpenCode } from './config.ts'
import { formatFenster } from '../shared/format.ts'

import {
  categoriesInOrder,
  providers,
  type Category,
  type Provider,
} from '../providers/catalog.ts'
import {
  isApiError,
  type AccountStrategy,
  type Connection,
  type ModelInfo,
  type ProviderRuntime,
  type ServiceState,
} from '../shared/contract.ts'

const host = connectHost()

// ---------------------------------------------------------------------------
// Service-Client
// ---------------------------------------------------------------------------

type Reply<T> = { ok: true; data: T } | { ok: false; error: string; detail?: string }

const call = async <T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<Reply<T>> => {
  const result = await host.serviceRequest({
    method,
    path,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  let parsed: unknown = null
  try {
    parsed = result.body ? JSON.parse(result.body) : null
  } catch {
    parsed = null
  }
  if (result.status >= 200 && result.status < 300 && !isApiError(parsed)) {
    return { ok: true, data: parsed as T }
  }
  const failure = isApiError(parsed) ? parsed : { error: `HTTP ${result.status}` }
  return { ok: false, error: failure.error, detail: failure.detail }
}

const callText = async <T>(
  method: 'GET' | 'POST',
  path: string,
  body: unknown,
): Promise<Reply<T>> => call<T>(method, path, body)


// ---------------------------------------------------------------------------
// Seiten-Zustand
// ---------------------------------------------------------------------------

type Route =
  | { view: 'catalog' }
  | { view: 'detail'; providerId: string }

interface Diagnostics {
  service: boolean
  storage: boolean
  configRead: boolean
  configPath: string
  proxyReachable: boolean
  notes: string[]
}

/** Anbieter, die der Dienst bedienen kann – kommt aus /adapters. */
let readyProviders = new Set<string>()
let modelListing = new Set<string>()
/** Anbieter, bei denen der Dienst den Geraetefluss selbst faehrt. */
let oauthProviders = new Set<string>()

let route: Route = { view: 'catalog' }
let state: ServiceState | null = null
let diagnostics: Diagnostics = {
  service: false,
  storage: false,
  configRead: false,
  configPath: '-',
  proxyReachable: false,
  notes: [],
}

const providerById = (id: string): Provider | undefined =>
  providers.find((p) => p.id === id)

const runtimeOf = (id: string): ProviderRuntime | undefined => state?.providers[id]

/**
 * Eigenes CSS fuer Raster und Zeilen, die die UI-Kit nicht abdeckt.
 * Muss vor `ensureStyle` stehen.
 */
const EXTRA_CSS = `
.ocr-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 8px; }
.ocr-provider {
  display: flex; flex-direction: column; gap: 4px; align-items: flex-start;
  padding: 11px 12px; border-radius: 9px; cursor: pointer; text-align: left;
  border: 1px solid rgba(127,127,127,0.22); background: rgba(127,127,127,0.07);
  color: inherit; font: inherit; width: 100%;
}
.ocr-provider:hover { background: rgba(127,127,127,0.13); }
.ocr-provider-name { display: flex; align-items: center; gap: 7px; font-weight: 560; font-size: 13px; width: 100%; }
.ocr-provider-id { font-size: 11px; opacity: 0.5; font-family: ui-monospace, monospace; }
.ocr-card { padding: 14px; border-radius: 10px; border: 1px solid rgba(127,127,127,0.2); background: rgba(127,127,127,0.05); }
.ocr-conn { display: flex; gap: 10px; align-items: center; padding: 10px; border-radius: 8px; border: 1px solid rgba(127,127,127,0.2); }
.ocr-model { display: flex; gap: 10px; align-items: center; justify-content: space-between; padding: 7px 9px; border-radius: 7px; }
.ocr-model:hover { background: rgba(127,127,127,0.09); }
.ocr-model-meta { display: flex; gap: 8px; align-items: center; font-size: 11px; opacity: 0.7; white-space: nowrap; }
`

// ---------------------------------------------------------------------------
// Diagnose
// ---------------------------------------------------------------------------

/**
 * Stand des Dienstes, den diese Seite erwartet.
 *
 * Der Host startet den Dienst einmal und behält ihn danach – neu bauen allein
 * tauscht ihn nicht aus. Ohne diese Prüfung redet eine neue Seite mit einem
 * alten Dienst, und was dabei herauskommt, sieht aus wie ein Fehler der
 * Anmeldung, obwohl es nur ein alter Stand ist. Genau das ist passiert:
 * die Statuszeile zeigte den Fallback-Text, weil der alte Dienst kein
 * `lastEvent` kennt.
 */
const EXPECTED_SERVICE_VERSION = '0.2.0'

/** Welchen Stand diese Seite fährt. Wird beim Bauen eingesetzt. */
const buildId = (): string =>
  typeof __BUILD_ID__ === 'undefined' ? 'unbekannt' : __BUILD_ID__

const runDiagnostics = async (): Promise<void> => {
  const notes: string[] = []

  // Alles hier kann scheitern: fehlende Freigabe, noch nicht gestarteter
  // Dienst, abgelehnter Dateizugriff. Nichts davon darf die Seite leeren
  // lassen – der Dienst meldet sich erst, wenn der Host ihn gestartet hat.
  let serviceOk = false
  notes.push(`Seite: Build ${buildId()}.`)
  try {
    const reply = await call<ServiceState>('GET', '/state')
    if (reply.ok) {
      state = reply.data
      serviceOk = true
      notes.push(`Dienst laeuft, Version ${state.version}, Port ${state.port}.`)
      if (state.version !== EXPECTED_SERVICE_VERSION) {
        notes.push(
          `Der Dienst ist aelter als die Seite (Dienst ${state.version}, ` +
            `Seite erwartet ${EXPECTED_SERVICE_VERSION}). Bitte OpenChamber ` +
            `vollstaendig neu starten – erst dann laeuft der neue Stand. ` +
            `Eine Anmeldung gegen den alten Dienst bleibt bei „warte noch" ` +
            `stehen, ohne dass etwas kaputt ist.`,
        )
      }
    } else {      notes.push(`Dienst antwortet nicht: ${reply.error}`)
    }
  } catch (error) {
    notes.push(`Dienst nicht erreichbar: ${describe(error)}`)
  }

  // Welche Anbieter der Dienst kann. Ohne das zeigt der Katalog alle als
  // gleichwertig, und jeder Klick auf einen ungebauten endet in einem Fehler.
  try {
    const reply = await call<{
      ready: string[]
      oauth?: string[]
      models: Record<string, boolean>
    }>('GET', '/adapters')

    if (reply.ok) {
      readyProviders = new Set(reply.data.ready)
      modelListing = new Set(
        Object.entries(reply.data.models)
          .filter(([, can]) => can)
          .map(([id]) => id),
      )
      // Ohne diese Zeile bleibt die Menge leer und der Anmeldeblock
      // erscheint nie – ohne Fehlermeldung, weil ein leeres Set gueltig ist.
      oauthProviders = new Set(reply.data.oauth ?? [])

      notes.push(
        `${readyProviders.size} von ${providers.length} Anbietern bedient, ` +
          `${modelListing.size} davon mit Modulliste, ` +
          `${oauthProviders.size} mit Anmeldung.`,
      )

      // Selbstpruefung: der Katalog sagt OAuth fuer diese Anbieter, der
      // Dienst kann aber keinen Geraetefluss. Das faellt sonst erst auf,
      // wenn jemand auf "Anmeldung starten" klickt und eine Fehlermeldung
      // statt eines Fensters bekommt.
      const ohneFluss = [...oauthProviders].filter((id) => !readyProviders.has(id))
      if (ohneFluss.length > 0) {
        notes.push(
          `Anmeldung angekündigt, aber kein Adapter vorhanden: ${ohneFluss.join(', ')}`,
        )
      }
    }
  } catch (error) {
    notes.push(`Adapterliste nicht lesbar: ${describe(error)}`)
  }

  let storageOk = false
  try {
    await host.storage.set('ocr.probe', 'ok')
    storageOk = (await host.storage.get('ocr.probe')) === 'ok'
    await host.storage.delete('ocr.probe')
  } catch (error) {
    notes.push(`Speicher nicht freigegeben: ${describe(error)}`)
  }

  let configRead = false
  try {
    const config = await readConfig(host)
    configRead = config.existed
    diagnostics.configPath = config.path
  } catch (error) {
    notes.push(`Konfiguration nicht lesbar: ${describe(error)}`)
  }

  diagnostics = {
    service: serviceOk,
    storage: storageOk,
    configRead,
    configPath: diagnostics.configPath,
    proxyReachable: serviceOk,
    notes,
  }
}

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

// ---------------------------------------------------------------------------
// Darstellung
// ---------------------------------------------------------------------------

const root = document.getElementById('root')
if (!root) throw new Error('Kein #root.')

ensureStyle('ocr-page', EXTRA_CSS)

/**
 * Letzte Sicherung: eine leere Seite laesst sich nicht zuordnen. Jeder Fehler
 * und jede unbehandelte Zusage landet deshalb sichtbar in der Seite.
 */
const showFatal = (what: string, detail: unknown): void => {
  if (!root) return
  const text = detail instanceof Error ? detail.message : String(detail)
  const node = el('div')
  node.style.cssText =
    'padding:10px 12px;border-radius:8px;font-size:13px;margin-bottom:14px;' +
    'background:rgba(200,60,60,0.14);border:1px solid rgba(200,60,60,0.4)'
  node.textContent = `${what}: ${text}`
  root.prepend(node)
}

window.addEventListener('error', (event) => {
  showFatal('Fehler in der Seite', event.error ?? event.message)
})

window.addEventListener('unhandledrejection', (event) => {
  showFatal('Unbehandelte Zusage', event.reason)
})

const heading = (text: string, size: 'lg' | 'md' = 'lg'): HTMLElement => {
  const node = el('h2')
  node.textContent = text
  node.style.fontSize = size === 'lg' ? '20px' : '15px'
  node.style.fontWeight = '650'
  node.style.margin = size === 'lg' ? '0 0 4px' : '0 0 10px'
  return node
}

const sub = (text: string): HTMLElement => {
  const node = el('p')
  node.textContent = text
  node.style.margin = '0'
  node.style.fontSize = '13px'
  node.style.opacity = '0.68'
  return node
}

const section = (...children: Array<Node | null>): HTMLElement => {
  const node = el('section')
  node.style.marginBottom = '28px'
  for (const child of children) if (child) node.append(child)
  return node
}

const card = (...children: Array<Node | null>): HTMLElement => {
  const node = el('div', 'ocr-card')
  for (const child of children) if (child) node.append(child)
  return node
}

const banner = (text: string, tone: 'error' | 'success' | 'neutral'): HTMLElement => {
  const node = el('div')
  node.dataset.tone = tone
  node.style.cssText =
    'padding:10px 12px;border-radius:8px;font-size:13px;margin-bottom:14px;' +
    'background:rgba(127,127,127,0.12);border:1px solid rgba(127,127,127,0.25)'
  node.textContent = text
  return node
}

// --- Katalog ----------------------------------------------------------------

const providerCard = (provider: Provider, runtime: ProviderRuntime | undefined): HTMLElement => {
  const button = el('button', 'ocr-provider')
  button.type = 'button'

  const name = el('div', 'ocr-provider-name')
  const count = runtime?.connections.length ?? 0
  const nameText = el('span')
  nameText.textContent = provider.name
  name.append(nameText)
  if (count > 0) {
    addBadge(name, { label: `${count} Konto`, tone: 'success' })
  } else if (readyProviders.has(provider.id)) {
    addBadge(name, { label: 'bereit', tone: 'info' })
  } else {
    addBadge(name, { label: 'geplant', tone: 'neutral' })
  }

  const id = el('div', 'ocr-provider-id')
  id.textContent = provider.id

  button.append(name, id)

  button.addEventListener('click', () => {
    route = { view: 'detail', providerId: provider.id }
    void paint()
  })

  return button
}

const renderCatalog = (): HTMLElement => {
  const wrap = el('div')

  wrap.append(
    section(
      heading('Anbieter'),
      sub(
        `${providers.length} Anbieter in ${categoriesInOrder().length} Kategorien. ` +
          'Ein Klick oeffnet die Detailseite zum Verwalten der Konten und Modelle.',
      ),
    ),
  )

  for (const category of categoriesInOrder()) {
    const members = providers.filter((p) => p.category === category.id)
    if (members.length === 0) continue

    const head = el('div')
    head.style.cssText = 'display:flex;align-items:center;gap:8px;margin:0 0 10px'
    const title = heading(category.label, 'md')
    title.style.margin = '0'
    const count = el('span')
    count.style.cssText = 'font-size:12px;opacity:0.55'
    count.textContent = `${members.length}`
    head.append(title, count)

    const grid = el('div', 'ocr-grid')
    for (const provider of members) {
      grid.append(providerCard(provider, runtimeOf(provider.id)))
    }

    wrap.append(section(head, grid))
  }

  return wrap
}

// --- Detailseite ------------------------------------------------------------

const STRATEGIES: Array<{ id: AccountStrategy; label: string; hint: string }> = [
  { id: 'manual', label: 'Manuell', hint: 'Kein automatischer Wechsel' },
  { id: 'failover', label: 'Bei Fehler', hint: 'Wechsel bei 401/402/429/5xx' },
  { id: 'round-robin', label: 'Round Robin', hint: 'Rotation pro Anfrage' },
  { id: 'quota-aware', label: 'Kontingent', hint: 'Erschöpfte Konten meiden' },
]

const connectionRow = (
  runtime: ProviderRuntime,
  connection: Connection,
  onChanged: () => void,
): HTMLElement => {
  const wrap = el('div', 'ocr-conn')

  const left = el('div')
  left.style.cssText = 'display:flex;flex-direction:column;gap:4px;min-width:0;flex:1'

  const title = el('div')
  title.style.cssText = 'display:flex;align-items:center;gap:8px'
  const name = el('span')
  name.style.fontWeight = '560'
  name.textContent = connection.label
  const tone =
    connection.status === 'active'
      ? 'success'
      : connection.status === 'error'
        ? 'error'
        : connection.status === 'locked'
          ? 'warning'
          : 'neutral'
  title.append(name)
  addBadge(title, { label: connection.status, tone })
  addBadge(title, { label: connection.auth, tone: 'neutral' })

  const detail = el('div')
  detail.style.cssText = 'font-size:12px;opacity:0.65'
  detail.textContent = connection.lastError
    ? `Letzter Fehler: ${connection.lastError}`
    : connection.lastUsedAt
      ? `Zuletzt genutzt ${new Date(connection.lastUsedAt).toLocaleString('de-DE')}`
      : 'Noch nicht genutzt'

  // Quota-Anzeige, falls bekannt
  const quotaInfo = connection.quota
  if (quotaInfo && (quotaInfo.used !== undefined || quotaInfo.limit !== undefined)) {
    const quotaText = el('div')
    quotaText.style.cssText = 'font-size:11px;opacity:0.55;margin-top:2px'
    const remaining =
      quotaInfo.limit !== undefined && quotaInfo.used !== undefined
        ? quotaInfo.limit - quotaInfo.used
        : 'unbekannt'
    const resetStr = quotaInfo.resetsAt
      ? ` · Reset: ${new Date(quotaInfo.resetsAt).toLocaleTimeString('de-DE')}`
      : ''
    quotaText.textContent = `Quota: ${remaining} von ${quotaInfo.limit ?? '?'} verbleibend${resetStr}`
    if (quotaInfo.exhausted) {
      quotaText.textContent += ' (erschöpft)'
    }
    detail.append(quotaText)
  }

  left.append(title, detail)

  const actions = el('div')
  actions.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap'

  // Prioritäts-Buttons: für die `manual`-Strategie, die die
  // Verbindung mit der niedrigsten Priorität wählt.
  const connIndex = runtime.connections.indexOf(connection)
  if (connIndex > 0) {
    addButton(actions, {
      label: '↑',
      variant: 'ghost',
      size: 'sm',
      onClick: () => {
        void (async () => {
          const swapWith = runtime.connections[connIndex - 1]
          if (!swapWith) return
          await call('PATCH', `/connections/${connection.id}`, { priority: swapWith.priority })
          await call('PATCH', `/connections/${swapWith.id}`, { priority: connection.priority })
          state = await refreshState()
          onChanged()
        })()
      },
    })
  }
  if (connIndex < runtime.connections.length - 1) {
    addButton(actions, {
      label: '↓',
      variant: 'ghost',
      size: 'sm',
      onClick: () => {
        void (async () => {
          const swapWith = runtime.connections[connIndex + 1]
          if (!swapWith) return
          await call('PATCH', `/connections/${connection.id}`, { priority: swapWith.priority })
          await call('PATCH', `/connections/${swapWith.id}`, { priority: connection.priority })
          state = await refreshState()
          onChanged()
        })()
      },
    })
  }

  addButton(actions, {
    label: 'Testen',
    variant: 'outline',
    size: 'sm',
    onClick: () => {
      void (async () => {
        const reply = await call<{ ok: boolean; detail?: string; runtime: ProviderRuntime }>(
          'POST',
          `/connections/${connection.id}/test`,
        )
        if (reply.ok) {
          state = await refreshState()
          onChanged()
        }
      })()
    },
  })

  addSelfSwitch(actions, {
    label: '',
    checked: connection.status === 'active',
    onChange: (checked) => {
      void (async () => {
        await call('PATCH', `/connections/${connection.id}`, {
          status: checked ? 'active' : 'disabled',
        })
        state = await refreshState()
        onChanged()
      })()
    },
  })

  addButton(actions, {
    label: 'Entfernen',
    variant: 'ghost',
    size: 'sm',
    onClick: () => {
      void (async () => {
        await call('DELETE', `/connections/${connection.id}`)
        state = await refreshState()
        onChanged()
      })()
    },
  })

  wrap.append(left, actions)
  void runtime
  return wrap
}

const refreshState = async (): Promise<ServiceState | null> => {
  const reply = await call<ServiceState>('GET', '/state')
  if (reply.ok) state = reply.data
  return state
}

// ---------------------------------------------------------------------------
// Laufende Anmeldung – bewusst ausserhalb der Seite
// ---------------------------------------------------------------------------

/**
 * Was der Dienst ueber eine offene Anmeldung meldet.
 */
interface SessionAnswer {
  sessionId?: string
  providerId?: string
  state?: string
  userCode?: string
  verificationUri?: string
  error?: string
  plan?: string
  lastEvent?: string
  polls?: number
  intervalMs?: number
  expiresAt?: number
}

/**
 * Die laufende Anmeldung gehoert nicht in die Seite.
 *
 * Grund: der Nutzer bestaetigt im Browser, also in einem anderen Fenster. Was
 * die Seite in dieser Zeit anzeigt, ist Zufall – je nachdem, ob der Browser
 * den Vordergrund geraubt hat, wird ein Timer verlangsamt oder gar nicht
 * mehr ausgefuehrt. Bei einer Kette aus `setTimeout` reicht ein einziger
 * ausgelassener Takt, und die Anmeldung bleibt fuer immer bei „warte noch"
 * stehen, obwohl der Dienst sie längst abgeschlossen hat. Genau das ist
 * passiert.
 *
 * Deshalb: der Zustand liegt hier, der Takt ist ein `setInterval` statt einer
 * Kette, und beim Zurueckkommen in dieses Fenster wird sofort nachgesehen.
 */
interface LoginWatch {
  providerId: string
  sessionId: string
  /** Letzte Antwort des Dienstes, fuer die Anzeige. */
  last: SessionAnswer
  /** Zu der Zeit wurde zuletzt gefragt. */
  lastAskedAt: number
  /** Wann aufgegeben wird. */
  deadline: number
  /** Wie oft schon gefragt wurde – macht ein haengendes Fenster sichtbar. */
  polls: number
}

let watch: LoginWatch | null = null
let takt: number | null = null

/**
 * Genau ein Zuhoerer: es gibt immer nur eine Detailseite, und jeder Neuaufbau
 * meldet sich neu. Eine Menge wuerde hier abgelaufene Knoten festhalten –
 * und bei jedem Takt anrufen, was mit der Zeit langsamer wird.
 */
let horcher: ((a: SessionAnswer) => void) | null = null

/**
 * Fenster lesbar machen.
 *
 * Sonst steht bei einem Modell mit 1.048.576 Tokens einfach „1049k", und bei
 * einem mit 4.096 „4k". Gerade die runden Werte sind die interessanten –
 * 1M, 2M, 256k – und genau die sieht man in dieser Schreibweise nicht.
 */
const loginAntwort = (a: SessionAnswer): string => {
  if (a.state === 'done') {
    return a.plan ? `Angemeldet. Tarif: ${a.plan}.` : 'Angemeldet.'
  }
  if (a.state === 'pending') {
    // Der Code steht hier ausdruecklich auch in der Zeile und nicht nur in
    // der Box darunter. Das Browserfenster liegt ueber der Seite – wer ihn
    // nicht wegschieben will, muss den Code trotzdem ablesen koennen. Und
    // faellt die Box einmal aus, ist es trotzdem lesbar.
    const code = a.userCode ? `  ·  Code ${a.userCode}` : ''
    return `${a.lastEvent ?? 'Warte auf Bestätigung im Browser…'}${code}`
  }
  return a.error ?? 'Anmeldung fehlgeschlagen.'
}

const taktStoppen = (): void => {
  if (takt !== null) {
    window.clearInterval(takt)
    takt = null
  }
}

const anmeldeHoerer = (fn: (a: SessionAnswer) => void): void => {
  horcher = fn
  if (watch) fn(watch.last)
}

/** Nachfragen, ob etwas fertig geworden ist. Einmal, ohne Kettenschleife. */
const frageEinmal = async (): Promise<void> => {
  if (!watch) return
  const laufend = watch
  const antwort = await call<SessionAnswer>(
    'GET',
    `/oauth/status?session=${laufend.sessionId}`,
  )

  // In der Zwischenzeit wurde neu gestartet: diese Antwort gehoert zu einer
  // alten Anmeldung und darf nichts mehr aendern.
  if (watch !== laufend) return

  laufend.polls += 1
  laufend.lastAskedAt = Date.now()

  if (!antwort.ok) {
    laufend.last = {
      ...laufend.last,
      lastEvent: `Abfrage fehlgeschlagen: ${antwort.error}`,
    }
  } else {
    laufend.last = antwort.data
  }

  // Der Dienst ist aelter als die Seite: er kennt weder `polls` noch
  // `lastEvent`. Weiterfragen wuerde nur wieder „warte noch" zeigen – das ist
  // genau der Zustand aus dem Fehlerbericht. Lieber sofort sagen, was los
  // ist, und aufhoeren, als ewig zu warten.
  if (
    laufend.last.state === 'pending' &&
    laufend.last.polls === undefined &&
    laufend.last.lastEvent === undefined
  ) {
    laufend.last = {
      ...laufend.last,
      state: 'error',
      error:
        `Der Dienst ist aelter als die Seite. Bitte OpenChamber ` +
        `vollstaendig neu starten und die Anmeldung wiederholen.`,
    }
  }

  const fertig = laufend.last.state !== 'pending'
  horcher?.(watch.last)

  if (fertig) {
    watch = null
    taktStoppen()
    await refreshState()
  }
}

const taktStarten = (): void => {
  if (takt !== null) return
  // Fester Takt statt selbst nachsetzender Kette: ein einzelner
  // ausgelassener Takt darf nichts anderen ueberleben.
  takt = window.setInterval(() => {
    if (!watch) {
      taktStoppen()
      return
    }
    const abstand = watch.last.intervalMs ?? 5000
    if (Date.now() - watch.lastAskedAt < abstand) return
    if (Date.now() > watch.deadline) {
      watch = null
      taktStoppen()
      horcher?.({ state: 'error', error: 'Zeit abgelaufen. Bitte neu anmelden.' })
      return
    }
    void frageEinmal()
  }, 1000)
}

// Wer aus dem Browser zurueckkommt, soll nicht erst den naechsten Takt
// abwarten muessen – das ist genau der Moment, in dem die Anmeldung fertig
// geworden ist.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && watch) {
      watch.lastAskedAt = 0
      void frageEinmal()
    }
  })
}

const anmeldungStarten = (
  provider: Provider,
  onChanged: () => void,
): void => {
  void (async () => {
    const reply = await call<{
      sessionId: string
      verificationUri: string
      userCode: string
      intervalMs?: number
      pkce?: boolean
    }>('POST', '/oauth/start', { providerId: provider.id })

    if (!reply.ok) {
      horcher?.({
        state: 'error',
        error: `Anmeldung nicht möglich: ${reply.error}`,
      })
      return
    }

    const isPkce = reply.data.pkce === true

    watch = {
      providerId: provider.id,
      sessionId: reply.data.sessionId,
      last: {
        state: 'pending',
        userCode: reply.data.userCode,
        verificationUri: reply.data.verificationUri,
        lastEvent: isPkce
          ? 'Öffne die URL im Browser, bestätige die Anmeldung. Warte auf Callback.'
          : 'Warte auf Bestätigung im Browser…',
        intervalMs: reply.data.intervalMs ?? 2000,
        expiresAt: Date.now() + 15 * 60_000,
      },
      lastAskedAt: 0,
      deadline: Date.now() + 15 * 60_000,
      polls: 0,
    }
    horcher?.(watch.last)
    // PKCE Flows polten immer noch – der Service aktualisiert den Status, wenn
    // der Callback-Server den Code empfangen hat.
    taktStarten()
    void onChanged()

    // Erst jetzt der Browser: vorher waere das Fenster weg, bevor der
    // Nutzer den Code sehen kann.
    await host.openUrl(reply.data.verificationUri).catch(() => {})
  })()
}

/**
 * Anmeldung ueber Geraetefluss.
 *
 * Die Seite kann keinen Browser oeffnen; der Host kann es. Also: Code anzeigen,
 * Link anbieten, und warten, bis der Nutzer bestaetigt hat.
 */
const renderOauth = (
  provider: Provider,
  onChanged: () => void,
): HTMLElement => {
  const wrap = el('div')

  const status = el('div')
  status.style.cssText = 'font-size:13px;margin:10px 0 0;min-height:20px'

  const codeBox = el('div')
  codeBox.style.cssText =
    'display:none;margin-top:10px;padding:12px;border-radius:9px;' +
    'border:1px solid rgba(127,127,127,0.28);background:rgba(127,127,127,0.08)'

  const codeValue = el('div')
  codeValue.style.cssText =
    'font-family:ui-monospace,monospace;font-size:20px;letter-spacing:2px;' +
    'font-weight:600;margin-bottom:8px'

  const codeHint = el('div')
  codeHint.style.cssText = 'font-size:12px;opacity:0.72;margin-bottom:10px'

  const linkRow = el('div')
  linkRow.style.cssText = 'display:flex;gap:8px;align-items:center'

  const startButton = addButton(linkRow, {
    label: 'Anmeldung starten',
    onClick: () => {
      startButton.update({ loading: true })
      anmeldungStarten(provider, () => {
        startButton.update({ loading: false })
        onChanged()
      })
    },
  })

  anmeldeHoerer((a) => {
    setText(status, loginAntwort(a))

    if (a.state === 'pending' && a.userCode) {
      codeBox.style.display = 'block'
      setText(codeValue, a.userCode)
      setText(
        codeHint,
        a.verificationUri
          ? `Diesen Code bei ${a.verificationUri} eingeben und bestätigen. ` +
            'Die Seite wartet von selbst.'
          : 'Dieser Code wird im Browser bestätigt. Die Seite wartet von selbst.',
      )
    } else {
      codeBox.style.display = 'none'
    }
    startButton.update({
      loading: a.state === 'pending',
      disabled: a.state === 'pending',
    })
  })

  wrap.append(
    heading('Anmeldung', 'md'),
    sub(
      'Der Dienst meldet dich beim Anbieter an und hält das Token. ' +
        'Du bekommst einen Code, den du im Browser bestätigst – ' +
        'der Schlüssel bleibt im Dienst.',
    ),
    spacer(12),
    linkRow,
    status,
    codeBox,
  )
  // Ohne diese Zeile ist die Box leer: der Code wird zwar gesetzt, aber in
  // Knoten, die nirgends im Dokument haengen. Genau so ist es passiert – die
  // Box war sichtbar, der Code unsichtbar, und niemand hat es bemerkt, weil
  // das Setzen selbst keinen Fehler meldet.
  codeBox.append(codeValue, codeHint)

  // Gegenprobe: eine leere Box ist kein Zustand, den man dem Nutzer zumuten
  // sollte. Der Code wird im Browser gebraucht, und ein leeres Feld sieht aus
  // wie irgendein Fehler, den niemand zuordnen kann. Also laut sagen.
  if (codeBox.childElementCount === 0) {
    setText(status, 'Die Code-Anzeige ist nicht aufgebaut – Seite neu laden.')
  }

  // Kommt man zurueck, nachdem die Anmeldung schon lief, wird sie nicht
  // neu gestartet, sondern wieder aufgegriffen.
  if (watch?.providerId === provider.id) taktStarten()
  else {
    void (async () => {
      const alt = await call<{ session: SessionAnswer | null }>(
        'GET',
        `/oauth/session?provider=${provider.id}`,
      )
      if (alt.ok && alt.data.session?.state === 'pending' && alt.data.session.userCode) {
        const s = alt.data.session
        watch = {
          providerId: provider.id,
          sessionId: s.sessionId ?? '',
          last: { ...s, intervalMs: s.intervalMs },
          lastAskedAt: 0,
          deadline: s.expiresAt ?? Date.now() + 15 * 60_000,
          polls: 0,
        }
        horcher?.(watch.last)
        taktStarten()
      }
    })()
  }

  return wrap
}

const renderDetail = (provider: Provider): HTMLElement => {
  const wrap = el('div')
  const runtime = runtimeOf(provider.id)

  // --- Kopf ---
  const backHost = el('div')
  addButton(backHost, {
    label: '← Zurueck zu Anbietern',
    variant: 'ghost',
    size: 'sm',
    onClick: () => {
      route = { view: 'catalog' }
      void paint()
    },
  })

  const title = heading(provider.name)
  const connected = runtime?.connections.length ?? 0
  const modelCount = runtime?.models.length ?? 0

  wrap.append(
    section(
      backHost,
      spacer(12),
      title,
      sub(
        `${connected} Konto/Konten · ${modelCount} ausgewählte Modelle · ID ${provider.id}`,
      ),
      provider.note ? sub(provider.note) : null,
    ),
  )

  // --- Strategie ---
  const strategyBox = el('div')
  addSelect(strategyBox, {
    label: 'Account-Strategie',
    value: runtime?.strategy ?? 'inherit',
    options: [
      { id: 'inherit', label: `Globalen Standard übernehmen (${state?.globalStrategy ?? 'round-robin'})` },
      ...STRATEGIES.map((s) => ({ id: s.id, label: `${s.label} — ${s.hint}` })),
    ],
    onChange: (id) => {
      void (async () => {
        await call('PUT', '/strategy', {
          providerId: provider.id,
          strategy: id === 'inherit' ? null : (id as AccountStrategy),
        })
        state = await refreshState()
        void paint()
      })()
    },
  })

  wrap.append(section(heading('Multi-Account-Routing', 'md'), strategyBox))

  // Strategie-Hinweis: erklärt, welche Verbindung ausgewählt wird.
  const activeStrategy = runtime?.strategy ?? state?.globalStrategy ?? 'round-robin'
  const stratHint = el('p')
  stratHint.style.cssText = 'font-size:12px;opacity:0.6;margin:0 0 14px'
  const stratLabels: Record<AccountStrategy, string> = {
    manual: 'Erste gesunde Verbindung (Prioritätssortierung)',
    failover: 'Erste gesunde Verbindung; deaktiviert bei Fehlern',
    'round-robin': 'Rotation pro Anfrage',
    'quota-aware': 'Verbindung mit höchster verbleibender Quote',
  }
  stratHint.textContent = `Strategie: ${stratLabels[activeStrategy] ?? activeStrategy}. Nutze ↑/↓ um die Priorität zu ändern.`
  wrap.append(stratHint)

  // --- Verbindungen ---
  const connBox = el('div')
  const listHost = el('div')
  listHost.style.cssText = 'display:flex;flex-direction:column;gap:8px;margin-bottom:12px'

  if (runtime && runtime.connections.length > 0) {
    for (const connection of runtime.connections) {
      listHost.append(connectionRow(runtime, connection, () => void paint()))
    }
  } else {
    addEmpty(listHost, {
      title: 'Noch kein Konto',
      body: 'Füge ein Konto hinzu. Es bleibt im lokalen Dienst; die Seite sieht den Schlüssel nie.',
    })
  }

  const form = card(heading('Verbindungen', 'md'), listHost, spacer(6))

  // Der Kit-Handle kennt nur `update`, nicht den aktuellen Wert. Deshalb
  // spiegeln wir die Eingaben hier.
  let labelValue = ''
  let secretValue = ''
  const labelField = addTextField(form, {
    label: 'Bezeichnung',
    value: '',
    placeholder: 'z. B. Privat',
    onChange: (value) => {
      labelValue = value
    },
  })
  // Ein Schluesselfeld bei einem Anbieter ohne Schluessel ist eine
  // Einladung, das Falsche einzugeben. Dann lieber gar keins – mit einem
  // Hinweis, wohin es stattdessen geht.
  const takesSecret =
    provider.auth !== 'none' && provider.auth !== 'oauth'
  const takesCookie = provider.auth === 'cookie'
  if (takesSecret && !takesCookie) {
    addTextField(form, {
      label: 'API-Schlüssel',
      value: '',
      placeholder: 'wird lokal gespeichert',
      password: true,
      onChange: (value) => {
        secretValue = value
      },
    })
    // Für lokale Provider: Hinweis, dass der Service Credentials aus
    // lokalen Dateien automatisch lesen kann.
    if (provider.auth === 'local') {
      const localHint = el('p')
      localHint.style.cssText = 'font-size:12px;opacity:0.6;margin:0 0 8px'
      localHint.textContent =
        'Lässt du das Feld leer, scannt der Service automatisch ' +
        'lokale Credentials (~/.aws/credentials, ~/.codeium/windsurf/, ~/.qoder/). ' +
        'Ein manueller Schlüssel hat Vorrang.'
      form.append(localHint)
    }
  } else if (takesCookie) {
    addTextField(form, {
      label: 'Cookies',
      value: '',
      placeholder: 'z. B. __Host-Stripe-key=...',
      password: true,
      onChange: (value) => {
        secretValue = value
      },
    })
    const cookieHint = el('p')
    cookieHint.style.cssText = 'font-size:12px;opacity:0.6;margin:0 0 8px'
    cookieHint.innerHTML =
      'Kopiere die Session-Cookies aus dem Browser (Entwicklerwerkzeuge' +
      ' → Application → Cookies). Der Schlüssel bleibt nur im lokalen Dienst.' +
      '<br><br>Alternativ: <code>npm run crawl-cookies -- ' + provider.id +
      '</code> startet einen Browser, der dir die Cookies automatisch extrahiert.'
    form.append(cookieHint)
  } else {
    const hinweis = el('p')
    hinweis.style.cssText = 'font-size:13px;opacity:0.75;margin:0 0 8px'
    hinweis.textContent =
      provider.auth === 'none'
        ? 'Dieser Anbieter braucht keine Anmeldedaten.'
        : 'Dieser Anbieter wird über eine Anmeldung verbunden, nicht über ' +
          'einen Schlüssel – siehe unten bei „Anmeldung".'
    form.append(hinweis)
  }
  const addHost = el('div')
  addHost.style.marginTop = '8px'
  addButton(addHost, {
    label: 'Hinzufügen',
    onClick: () => {
      void (async () => {
        const reply = await call<ProviderRuntime>('POST', '/connections', {
          providerId: provider.id,
          label: labelValue,
          secret: takesSecret ? secretValue : '',
        })
        if (!reply.ok) {
          await host.toast({ message: `Fehler: ${reply.error}`, kind: 'error' })
          return
        }
        labelValue = ''
        secretValue = ''
        labelField.update({ value: '' })
        state = await refreshState()
        void paint()
      })()
    },
  })
  form.append(addHost)
  connBox.append(form)
  wrap.append(section(connBox))

  // Ein Anbieter ohne Schluessel braucht eine Anmeldung. Fehlt die, darf der
  // Abschnitt nicht stillschweigend wegbleiben – genau so ist ein Fehler
  // wochenlang unbemerkt geblieben.
  if (provider.auth === 'oauth') {
    if (oauthProviders.has(provider.id)) {
      wrap.append(section(renderOauth(provider, () => void paint())))
    } else {
      wrap.append(
        section(
          heading('Anmeldung', 'md'),
          sub(
            `${provider.name} wird über eine Anmeldung verbunden. Der lokale ` +
              'Dienst kann das für diesen Anbieter aber noch nicht – bitte einen ' +
              'API-Schlüssel verwenden oder auf die Umsetzung warten.',
          ),
        ),
      )
    }
  }

  return wrap
}

// ---------------------------------------------------------------------------
// Registrierung (Modelle in den OpenCode-Modelpicker)
// ---------------------------------------------------------------------------
// `registerIntoOpenCode` liegt in ./config.ts, damit die Konfigurationslogik
// ohne Browser getestet werden kann.

// ---------------------------------------------------------------------------
// Modell-Seite
// ---------------------------------------------------------------------------


const renderModels = (provider: Provider): HTMLElement => {
  const wrap = el('div')
  const runtime = runtimeOf(provider.id)

  const chosen = new Set((runtime?.models ?? []).map((m) => m.upstreamId))
  let fetched: ModelInfo[] = []
  let query = ''
  let onlyFree = false
  let onlyChosen = false

  /**
   * Auswahl leeren.
   *
   * Noetig, weil ein alter Stand aus dem Dienst kommen kann: dort koennen
   * Modelle gespeichert sein, die es beim Anbieter nicht mehr gibt. Ohne
   * diesen Weg waere man fest – nichts sichtbar, aber alles vorgewaehlt.
   */
  const clearSelection = (): void => {
    chosen.clear()
    updateSummary()
    renderList()
  }

  const listHost = el('div')
  listHost.style.cssText = 'display:flex;flex-direction:column;gap:6px'

  const renderList = (): void => {
    clearNode(listHost)
    const needle = query.trim().toLowerCase()
    const visible = fetched.filter((m) => {
      if (onlyFree && !m.pricing?.free) return false
      if (onlyChosen && !chosen.has(m.upstreamId)) return false
      if (!needle) return true
      return m.upstreamId.toLowerCase().includes(needle) || m.label.toLowerCase().includes(needle)
    })

    if (visible.length === 0) {
      addEmpty(listHost, {
        title: fetched.length === 0 ? 'Noch keine Modelle geladen' : 'Kein Treffer',
        body:
          fetched.length === 0
            ? '„Fetch Models“ lädt die Liste vom Anbieter.'
            : 'Filter zurücksetzen oder anders suchen.',
      })
      return
    }

    for (const model of visible) {
      const line = el('div', 'ocr-model')
      addToggle(line, {
        label: model.label,
        checked: chosen.has(model.upstreamId),
        description: model.upstreamId,
        onChange: (checked) => {
          if (checked) chosen.add(model.upstreamId)
          else chosen.delete(model.upstreamId)
          updateSummary()
        },
      })
      const meta = el('div', 'ocr-model-meta')
      if (model.pricing?.free) addBadge(meta, { label: 'kostenlos', tone: 'success' })
      if (model.contextWindow) {
        const ctx = el('span')
        ctx.textContent = `${formatFenster(model.contextWindow)} ctx`
        meta.append(ctx)
      }
      if (model.outputWindow) {
        const aus = el('span')
        aus.textContent = `${formatFenster(model.outputWindow)} out`
        meta.append(aus)
      }
      // Ohne beide Werte schreibt OpenCode kein `limit` – im Modelpicker steht
      // dann ein Ersatzwert, der aussieht wie eine Angabe des Anbieters. Der
      // Nutzer soll das hier sehen und nicht erst dort.
      if (!model.contextWindow || !model.outputWindow) {
        addBadge(meta, { label: 'Fenster unbekannt', tone: 'warning' })
      }
      if (model.inputModalities.includes('image')) {
        addBadge(meta, { label: 'Bild', tone: 'info' })
      }
      if (model.pricing?.promptPer1M !== undefined) {
        const price = el('span')
        price.textContent = `$${model.pricing.promptPer1M}/1M`
        meta.append(price)
      }
      listHost.append(line)
    }
  }

  const summary = el('span')
  summary.style.cssText = 'font-size:12px;opacity:0.7;margin-left:auto'

  // Erst nach dem Anlegen des Knopfes zu erreichen, daher hier vorbelegt.
  let saveButton: ButtonHandle | undefined

  /**
   * Speichern ist genau dann moeglich, wenn Modelle geholt wurden und
   * mindestens eines gewaehlt ist. Beides kann sich aendern, ohne dass die
   * Seite neu aufgebaut wird – deshalb wird hier nachgezogen.
   */
  const syncSaveButton = (): void => {
    saveButton?.update({ disabled: fetched.length === 0 || chosen.size === 0 })
  }

  const updateSummary = (): void => {
    setText(summary, `${chosen.size} von ${fetched.length} Modellen ausgewählt`)
    syncSaveButton()
  }

  const saveHost = el('div')
  const save = addButton(saveHost, {
    label: 'Auswahl speichern',
    disabled: true,
    onClick: () => {
      void (async () => {
        const selected = fetched.filter((m) => chosen.has(m.upstreamId))
        if (selected.length === 0) {
          await host.toast({
            message: 'Kein Modell ausgewählt – es gibt nichts zu registrieren.',
            kind: 'error',
          })
          return
        }
        const reply = await call<ProviderRuntime>('PUT', '/models', {
          providerId: provider.id,
          models: selected,
        })
        if (!reply.ok) {
          await host.toast({ message: `Fehler: ${reply.error}`, kind: 'error' })
          return
        }
        state = await refreshState()

        if (!state?.port) {
          await host.toast({ message: 'Kein Dienst-Port bekannt.', kind: 'error' })
          return
        }
        try {
          const written = await registerIntoOpenCode(host, provider, selected, state.port)

          // Zuruecklesen. Ein "Erfolg" ohne Inhalt ist schlimmer als ein
          // Fehler, weil man ihn erst beim naechsten Modellwechsel merkt.
          const back = await readConfig(host)
          const all = (back.config.provider ?? {}) as Record<
            string,
            { models?: Record<string, unknown> } | undefined
          >
          const landed = Object.keys(all[openCodeId(provider)]?.models ?? {}).length

          if (landed !== written.count) {
            await host.toast({
              message:
                `In ${written.path} stehen ${landed} statt ${written.count} Modelle. ` +
                'OpenCode liest die Datei moeglicherweise erst beim Neustart.',
              kind: 'error',
            })
            return
          }

          await host.toast({
            message:
              `${landed} Modelle als ${openCodeId(provider)} registriert. ` +
              'Falls sie im Modelpicker fehlen: OpenCode einmal neu starten.',
            kind: 'success',
          })
        } catch (error) {
          await host.toast({
            message: `Registrierung fehlgeschlagen: ${describe(error)}`,
            kind: 'error',
          })
        }
      })()
    },
  })

  const fetchHost = el('div')
  const fetchNote = el('p')
  fetchNote.style.cssText =
    'font-size:12px;opacity:0.7;margin:8px 0 0;display:none'
  const canList = modelListing.has(provider.id)
  const fetchButton = addButton(fetchHost, {
    label: 'Fetch Models',
    variant: 'outline',
    disabled: !canList,
    onClick: () => {
      void (async () => {
        fetchButton.update({ loading: true })
        const reply = await call<{
          models: ModelInfo[]
          meta?: { quelle: string; ergaenzt: number; unvollstaendig: number }
        }>('GET', `/models?provider=${provider.id}`)
        fetchButton.update({ loading: false })
        if (!reply.ok) {
          await host.toast({
            message: `Abruf fehlgeschlagen: ${reply.error}${reply.detail ? ` — ${reply.detail}` : ''}`,
            kind: 'error',
          })
          return
        }
        fetched = reply.data.models
        // Bereits gespeicherte Modelle bleiben gewaehlt.
        for (const m of runtime?.models ?? []) chosen.add(m.upstreamId)

        // Woher die Zahlen stammen. Ohne diesen Hinweis sieht eine ergaenzte
        // Fensterangabe aus wie eine Angabe des Anbieters – und genau diese
        // Verwechslung hat den Nutzer dazu gebracht, die Werte zu bezweifeln.
        const meta = reply.data.meta
        if (meta && meta.ergaenzt > 0) {
          setText(
            fetchNote,
            `${meta.ergaenzt} von ${fetched.length} Modellen haben vom Anbieter ` +
              `keine Fensterangabe gemacht; die Werte stammen aus models.dev.`,
          )
        }
        if (meta && meta.unvollstaendig > 0) {
          setText(
            fetchNote,
            `${fetchNote.textContent} ${meta.unvollstaendig} Modelle haben auch ` +
              `dort keine Angabe – für sie schreibt OpenCode keinen Ersatzwert ` +
              `und zeigt allgemein 200.000 an.`,
          )
        }
        fetchNote.style.display = fetchNote.textContent ? 'block' : 'none'

        updateSummary()
        renderList()
      })()
    },
  })

  const searchHost = el('div')
  searchHost.style.flex = '1'
  addSearchField(searchHost, {
    value: '',
    placeholder: 'Modelle filtern…',
    onChange: (value) => {
      query = value
      renderList()
    },
  })

  const filtersHost = el('div')
  addToggle(filtersHost, {
    label: 'Nur kostenlose',
    checked: false,
    onChange: (checked) => {
      onlyFree = checked
      renderList()
    },
  })
  addToggle(filtersHost, {
    label: 'Nur ausgewählte',
    checked: false,
    onChange: (checked) => {
      onlyChosen = checked
      renderList()
    },
  })

  const toolsRow = el('div')
  toolsRow.style.cssText = 'display:flex;gap:8px;align-items:center'

  const filters = el('div')
  filters.style.cssText = 'display:flex;gap:14px;align-items:center;margin:12px 0 8px'
  filters.append(filtersHost, toolsRow)

  const actions = el('div')
  actions.style.cssText = 'display:flex;gap:10px;align-items:center'
  actions.append(fetchHost, searchHost)

  if (!canList) {
    const why = el('p')
    why.style.cssText = 'font-size:13px;opacity:0.75;margin:10px 0 0'
    why.textContent = readyProviders.has(provider.id)
      ? `${provider.name} ist verbunden, kann aber die Modelliste nicht selbst abrufen. ` +
        'Trage die Modelle unten von Hand ein.'
      : `Für ${provider.name} ist noch kein Adapter gebaut. Konto anlegen und ` +
        'Modelle von Hand eintragen geht schon; „Fetch Models" folgt.'
    actions.after(why)
  }
  actions.after(fetchNote)

  saveButton = save

  const clearButton = addButton(toolsRow, {
    label: 'Alle abwählen',
    variant: 'ghost',
    size: 'sm',
    onClick: () => clearSelection(),
  })

  const saveRow = el('div')
  saveRow.style.cssText = 'display:flex;gap:10px;align-items:center;margin-top:14px'
  saveRow.append(toolsRow, saveHost)

  wrap.append(
    section(
      heading('Verfügbare Modelle'),
      sub(
        'Fetch Models lädt die Liste vom Anbieter. Danach auswählen und speichern — die Auswahl landet als OpenCode-Provider und erscheint im Modelpicker.',
      ),
      spacer(14),
      actions,
      filters,
      listHost,
      saveRow,
    ),
  )

  updateSummary()
  renderList()

  // Aus dem Dienst kann eine Auswahl kommen, die es hier nicht gibt – etwa
  // weil Modelle beim Anbieter verschwunden sind. Das muss man sagen,
  // sonst sucht der Nutzer ein unsichtbares Häkchen.
  const verwaist = [...chosen].filter(
    (id) => !fetched.some((m) => m.upstreamId === id),
  )
  if (fetched.length > 0 && verwaist.length > 0) {
    addBanner(listHost, {
      tone: 'warning',
      title: `${verwaist.length} gespeicherte Modelle sind nicht mehr im Angebot.`,
      body: 'Mit „Alle abwählen" und neuer Auswahl wird das bereinigt.',
    })
  }

  return wrap
}

// ---------------------------------------------------------------------------
// Diagnose
// ---------------------------------------------------------------------------

const renderDiagnostics = (): HTMLElement => {
  const box = el('div')
  const checks: Array<[string, boolean]> = [
    ['Lokaler Dienst erreichbar', diagnostics.service],
    ['Speicher lesbar/schreibbar', diagnostics.storage],
    [`OpenCode-Konfiguration (${diagnostics.configPath})`, diagnostics.configRead],
  ]
  for (const [label, ok] of checks) {
    const line = el('div')
    line.style.cssText = 'display:flex;gap:8px;align-items:center'
    addBadge(line, { label: ok ? 'ok' : 'fehlt', tone: ok ? 'success' : 'error' })
    const text = el('span')
    text.style.fontSize = '13px'
    text.textContent = label
    line.append(text)
    box.append(line)
  }
  for (const note of diagnostics.notes) {
    const line = el('div')
    line.style.cssText = 'font-size:12px;opacity:0.6;margin-top:6px'
    line.textContent = note
    box.append(line)
  }
  return box
}

// ---------------------------------------------------------------------------
// Zeichnen
// ---------------------------------------------------------------------------

const paint = async (): Promise<void> => {
  // `void paint()` schluckt Rejections. Deshalb hier selbst abfangen und den
  // Fehler anzeigen – eine leere Seite waere nicht zuordenbar.
  try {
    if (!state) await runDiagnostics()
    clearNode(root)

    const provider = route.view === 'detail' ? providerById(route.providerId) : undefined

    if (route.view === 'detail' && provider) {
      root.append(renderDetail(provider))
      root.append(renderModels(provider))
      root.append(section(heading('Diagnose', 'md'), renderDiagnostics()))
      return
    }

    root.append(renderCatalog())
    root.append(section(heading('Diagnose', 'md'), renderDiagnostics()))

    if (!state) {
      addSpinner(root, { label: 'Dienst wird geprüft…' })
    }
  } catch (error) {
    clearNode(root)
    root.append(
      banner(`Die Seite konnte nicht aufgebaut werden: ${describe(error)}`, 'error'),
    )
  }
}

host.onReady((ctx) => {
  applyHostReady(ctx, document.documentElement)
  void paint()
})

void paint()
