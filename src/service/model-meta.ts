/**
 * Modelldaten von models.dev – der Quelle, die OpenCode selbst benutzt.
 *
 * Warum das noetig ist: viele Anbieter geben in ihrer eigenen
 * `/models`-Antwort nur einen Teil der Angaben. DeepInfra liefert 183 Modelle
 * und bei *keinem* ein Kontextfenster; Novita liefert 121, ebenfalls ohne.
 * models.dev kennt dieselben Modelle mit Fenster und Ausgabelaenge.
 *
 * Warum das dringend noetig ist: OpenCodes Schema verlangt in `limit` sowohl
 * `context` als auch `output`. Fehlt eines, lehnt OpenCode die **gesamte**
 * Konfiguration ab und startet gar nicht mehr. Ein halb geschriebenes `limit`
 * ist also schlimmer als gar keines.
 *
 * Hier wird deshalb nichts erfunden: was models.dev nicht weiss, bleibt leer –
 * und der Aufrufer schreibt dann kein `limit`, sondern OpenCodes eigenen
 * Ersatzwert. Falsche Zahlen waeren schlimmer als keine.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

export interface ModelMeta {
  context?: number
  output?: number
  modalities?: string[]
  attachment?: boolean
  reasoning?: boolean
}

export interface Anreicherung {
  models: ModelMeta[]
  /** Wie viele Modelle bekamen mindestens eine Angabe. */
  ergaenzt: number
  /** Wie viele blieben unvollstaendig – die bekommen kein `limit`. */
  unvollstaendig: number
  quelle: 'models.dev' | 'nicht erreichbar'
}

const KATALOG_URL = 'https://models.dev/api.json'
const CACHE_ALT_MS = 24 * 60 * 60 * 1000

/** Alles ausser Buchstaben und Ziffern entfernen, Kleinschreibung. */
const dicht = (id: string): string => id.toLowerCase().replace(/[^a-z0-9]/g, '')

/** `qwen/qwen3-235b:free` -> `qwen3235b` – Praefix und Suffix weg. */
const normalisieren = (id: string): string => {
  const ohnePraefix = id.split('/').pop() ?? id
  return dicht(ohnePraefix)
}

/**
 * Alle moeglichen Schluessel zu einer Modell-ID, in der Reihenfolge, in der
 * sie geprueft werden. Je spezifischer, desto weiter vorn – ein Treffer auf
 * den vollen Namen ist verlaesslicher als einer auf dem abgeschnittenen.
 *
 * Die Variante „vollstaendig, nur Trenner weg" ist wichtig und war zuerst
 * nicht dabei: `gemini/2.5-pro` wurde als `25pro` einsortiert, der Katalog
 * fuehrt es aber als `gemini-2.5-pro` und damit als `gemini25pro`. Nach dem
 * Abschneiden des Praefixes bleiben bei Namen, die mit Ziffern beginnen,
 * sinnlos Reste stehen.
 */
const schluessel = (id: string): string[] => {
  const ohneSuffix = id.split(':')[0] ?? id
  const kandidaten = [
    id,
    dicht(id),
    ohneSuffix,
    dicht(ohneSuffix),
    normalisieren(ohneSuffix),
  ]
  return kandidaten.filter((v, i, a) => v.length > 0 && a.indexOf(v) === i)
}

/** Nur fuer Tests: die Schluessel einer Modell-ID einsehen. */
export const schluesselFuerTest = schluessel

type Index = Map<string, ModelMeta>

let index: Index | null = null
let geladenAm = 0
let ladeversuch = 0

/**
 * Baut den Index aus der models.dev-Antwort.
 *
 * Ausgelagert und rein, damit sich das ohne Netz pruefen laesst.
 */
export const baueIndex = (katalog: Record<string, { models?: Record<string, ModelMeta> }>): Index => {
  const gebaut: Index = new Map()
  for (const anbieter of Object.values(katalog)) {
    for (const [id, m] of Object.entries(anbieter.models ?? {})) {
      const limit = (m as ModelMeta & { limit?: { context?: number; output?: number } }).limit
      const eintrag: ModelMeta = {
        context: limit?.context ?? m.context,
        output: limit?.output ?? m.output,
        modalities: m.modalities ?? m.modalities,
        attachment: m.attachment,
        reasoning: m.reasoning,
      }
      if (eintrag.context === undefined && eintrag.output === undefined) continue
      // Spezifischere Treffer zuerst: der volle Name gewinnt gegen den
      // abgeschnittenen, unabhaengig von der Reihenfolge im Katalog.
      for (const k of schluessel(id)) {
        if (!gebaut.has(k)) gebaut.set(k, eintrag)
      }
    }
  }
  return gebaut
}

const frisch = (): boolean => Date.now() - geladenAm < CACHE_ALT_MS

const holeIndex = async (cacheDir: string): Promise<Index | null> => {
  if (index && frisch()) return index

  const datei = join(cacheDir, 'models-dev.json')
  try {
    const roh = await readFile(datei, 'utf8')
    const katalog = JSON.parse(roh) as Record<string, { models?: Record<string, ModelMeta> }>
    index = baueIndex(katalog)
    geladenAm = Date.now()
    return index
  } catch {
    // Kein Cache: holen.
  }

  // Nicht bei jedem Modellversuch neu fragen. Ohne Netz ist models.dev
  // namlich unerreichbar, und ein einzelner Nutzer ohne Internet wuerde sonst
  // bei jedem Klick eine Sekunde warten.
  if (Date.now() - ladeversuch < 60_000) return index

  ladeversuch = Date.now()
  try {
    const res = await fetch(KATALOG_URL, {
      headers: { Accept: 'application/json', 'User-Agent': 'openchamber-router/0.2.0' },
    })
    if (!res.ok) return index
    const roh = await res.text()
    await mkdir(cacheDir, { recursive: true })
    await writeFile(datei, roh, 'utf8')
    index = baueIndex(JSON.parse(roh) as Record<string, { models?: Record<string, ModelMeta> }>)
    geladenAm = Date.now()
    return index
  } catch {
    return index
  }
}

/** Nur fuer Tests: eingebaute Indexdaten benutzen. */
export const setzeIndexFuerTest = (neu: Index | null): void => {
  index = neu
  geladenAm = neu ? Date.now() : 0
}

/**
 * Fuellt Context, Ausgelaenge und Faehigkeiten auf, wo der Anbieter schweigt.
 */
export const anreichern = async (
  cacheDir: string,
  modelle: readonly { upstreamId: string; contextWindow?: number; outputWindow?: number }[],
): Promise<Anreicherung> => {
  const ix = await holeIndex(cacheDir)
  if (!ix) {
    return {
      models: modelle.map((m) => ({
        context: m.contextWindow,
        output: m.outputWindow,
      })),
      ergaenzt: 0,
      unvollstaendig: modelle.filter(
        (m) => m.contextWindow === undefined || m.outputWindow === undefined,
      ).length,
      quelle: 'nicht erreichbar',
    }
  }

  let ergaenzt = 0
  let unvollstaendig = 0

  const models = modelle.map((m) => {
    let treffer: ModelMeta | undefined
    for (const k of schluessel(m.upstreamId)) {
      const t = ix.get(k)
      if (t) {
        treffer = t
        break
      }
    }

    const context = m.contextWindow ?? treffer?.context
    const output = m.outputWindow ?? treffer?.output
    const verbessert =
      (m.contextWindow === undefined && context !== undefined) ||
      (m.outputWindow === undefined && output !== undefined)
    if (verbessert) ergaenzt += 1

    // Ohne beide Werte kein `limit`: OpenCode verlangt beide und lehnt sonst
    // die ganze Konfiguration ab.
    if (context === undefined || output === undefined) unvollstaendig += 1

    return {
      context,
      output,
      modalities: treffer?.modalities,
      attachment: treffer?.attachment,
      reasoning: treffer?.reasoning,
    }
  })

  return { models, ergaenzt, unvollstaendig, quelle: 'models.dev' }
}