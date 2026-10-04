/**
 * Lokale Credential-Reader für IDE-Provider.
 *
 * Diese Provider speichern ihre Zugangsdaten nicht im Klartext in einer
 * Konfigurationsdatei, sondern in den Standard-Orten ihrer jeweiligen CLI:
 *
 * - kiro:     `~/.aws/credentials` (AWS) + `~/.kiro/settings/cli.json` + env
 * - windsurf: `~/.codeium/windsurf/installation_id` + env `CODEIUM_API_KEY`
 * - qoder:    `~/.qoder/` + env `DASHSCOPE_API_KEY` / `QODER_API_KEY`
 * - workbuddy: env `WORKBUDDY_API_KEY` + custom model config
 * - iflow: env `IFLOW_API_KEY` + ~/.iflow/settings.json (OpenAI-kompatibel)
 * - lmstudio: Lokaler Server (http://localhost:1234/v1), keine Auth nötig
 * - omniroute: env `OMNIROUTE_API_KEY` + lokaler Proxy (http://localhost:20128/v1)
 *
 * Jeder Reader versucht mehrere Quellen in Reihenfolge der Priorität:
 * 1. Umgebungsvariable (explizit am schärfsten)
 * 2. Lokale Konfigurationsdatei
 * 3. Fallback auf eine Standard-Basis-URL, falls der Provider sie kennt
 *
 * Das Ergebnis ist entweder `{ apiKey, baseUrl? }` oder `null`, wenn nichts
 * gefunden wurde – dann kann der Nutzer manuell einen API-Schlüssel hinterlegen.
 */

import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

export interface LocalCredential {
  /** API-Schlüssel oder Token. */
  apiKey: string
  /** Überschreibt die Standard-Basis-URL, falls der Provider eine hat. */
  baseUrl?: string
  /** Region, falls relevant (z. B. für AWS). */
  region?: string
  /** Woher das Credential stammt – für Diagnose. */
  source: string
}

/**
 * Versucht, eine Datei zu lesen; gibt `null` zurück, wenn sie nicht existiert
 * oder nicht lesbar ist (statt den Prozess abzuschießen).
 */
const tryReadFile = async (path: string): Promise<string | null> => {
  try {
    return await readFile(path, 'utf-8')
  } catch {
    return null
  }
}

/**
 * Liest eine AWS-Credentials-Datei (INI-Format) und extrahiert den Schlüssel
 * für das angegebene Profil (oder das Standardprofil).
 */
const readAwsCredential = async (
  profile: string | null,
): Promise<LocalCredential | null> => {
  const credFile = join(homedir(), '.aws', 'credentials')
  const configFile = join(homedir(), '.aws', 'config')

  // 1. Prüfe Umgebungsvariablen (höchste Priorität)
  const envKey = process.env.AWS_ACCESS_KEY_ID
  const envSecret = process.env.AWS_SECRET_ACCESS_KEY
  if (envKey && envSecret) {
    return {
      apiKey: envKey,
      region: process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION,
      source: 'env AWS_ACCESS_KEY_ID',
    }
  }

  // 2. Lese credentials-Datei
  const content = await tryReadFile(credFile)
  if (content) {
    const section = profile ? `[${profile}]` : '[default]'
    const lines = content.split('\n')
    let inSection = false
    let foundKey: string | undefined = undefined
    let foundRegion: string | undefined = undefined

    for (const line of lines) {
      if (line.startsWith('[')) {
        inSection = line.trim() === section
        continue
      }
      if (!inSection) continue
      const match = line.match(/^\s*(\w+)\s*=\s*(.+)$/)
      if (match) {
        const key = match[1] ?? ''
        const value = match[2]?.trim() ?? ''
        if (key === 'aws_access_key_id') foundKey = value
        if (key === 'aws_secret_access_key') foundKey = foundKey ? `${foundKey}:${value}` : value
        if (key === 'region') foundRegion = value
      }
    }

    if (foundKey) {
      // Region aus config-Datei ergänzen, falls nicht in credentials
      if (!foundRegion) {
        const configContent = await tryReadFile(configFile)
        if (configContent) {
          const configLines = configContent.split('\n')
          let configInSection = false
          for (const line of configLines) {
            if (line.startsWith('[')) {
              configInSection = line.trim() === section
              continue
            }
            if (!configInSection) continue
            const match = line.match(/^\s*region\s*=\s*(.+)$/)
            if (match) foundRegion = match[1]?.trim()
          }
        }
      }

      return {
        apiKey: foundKey,
        region: foundRegion,
        source: `AWS ${section}-Profil`,
      }
    }
  }

  // 3. Lese KIRO_API_KEY Umgebungsvariable
  if (process.env.KIRO_API_KEY) {
    return {
      apiKey: process.env.KIRO_API_KEY,
      source: 'env KIRO_API_KEY',
    }
  }

  return null
}

/**
 * Liest den Qoder-API-Schlüssel aus Umgebungsvariablen oder der lokalen
 * Qoder-Konfiguration.
 */
const readQoderCredential = async (): Promise<LocalCredential | null> => {
  // 1. Umgebungsvariablen
  const envKeys = ['DASHSCOPE_API_KEY', 'QODER_API_KEY', 'BAILIAN_API_KEY']
  for (const envKey of envKeys) {
    if (process.env[envKey]) {
      return {
        apiKey: process.env[envKey]!,
        source: `env ${envKey}`,
      }
    }
  }

  // 2. Lokale Konfigurationsdatei (~/.qoder/settings.json)
  const settingsFile = join(homedir(), '.qoder', 'settings.json')
  const content = await tryReadFile(settingsFile)
  if (content) {
    try {
      const parsed = JSON.parse(content) as Record<string, unknown>
      // Prüfe auf API-Schlüssel in verschiedenen Feldern
      const apiKey =
        parsed.apiKey ||
        parsed.api_key ||
        parsed.token ||
        (parsed.provider as Record<string, unknown> | undefined)?.apiKey
      if (typeof apiKey === 'string' && apiKey.length > 0) {
        const baseUrl =
          typeof parsed.baseUrl === 'string'
            ? parsed.baseUrl
            : typeof parsed.base_url === 'string'
            ? parsed.base_url
            : undefined
        return {
          apiKey,
          baseUrl,
          source: '~/.qoder/settings.json',
        }
      }
    } catch {
      // Parse-Fehler – weiter mit nächsten Quelle
    }
  }

  // 3. Prüfe auf Alibaba Cloud CLI-Konfiguration
  const alibabaProfile = join(homedir(), '.alisetup', 'alibaba.json')
  const alibabaContent = await tryReadFile(alibabaProfile)
  if (alibabaContent) {
    try {
      const parsed = JSON.parse(alibabaContent) as Record<string, unknown>
      const accessKey = parsed.access_key_id
      const secretKey = parsed.access_key_secret
      if (typeof accessKey === 'string' && typeof secretKey === 'string') {
        return {
          apiKey: `${accessKey}:${secretKey}`,
          region: typeof parsed.region === 'string' ? parsed.region : undefined,
          source: '~/.alisetup/alibaba.json',
        }
      }
    } catch {
      // Parse-Fehler
    }
  }

  return null
}

/**
 * Liest den Codeium/Windsurf-API-Schlüssel aus Umgebungsvariablen oder
 * lokaler Konfiguration.
 */
const readWindsurfCredential = async (): Promise<LocalCredential | null> => {
  // 1. Umgebungsvariablen
  if (process.env.CODEIUM_API_KEY) {
    return {
      apiKey: process.env.CODEIUM_API_KEY,
      source: 'env CODEIUM_API_KEY',
    }
  }
  if (process.env.WINDSURF_API_KEY) {
    return {
      apiKey: process.env.WINDSURF_API_KEY,
      source: 'env WINDSURF_API_KEY',
    }
  }

  // 2. Lokale Konfiguration (~/.codeium/windsurf/)
  // Windsurf speichert die Session in einer SQLite-Datenbank oder
  // verschlüsselten Storage. Wir lesen die Installation-ID als Hinweis.
  const wsDir = join(homedir(), '.codeium', 'windsurf')

  // installation_id – eine UUID, kein API-Key
  const installId = await tryReadFile(join(wsDir, 'installation_id'))
  if (installId) {
    // Die Installation-ID allein reicht nicht für API-Aufrufe –
    // der Nutzer muss einen Service-Key oder API-Key manuell hinterlegen.
    return {
      apiKey: '',
      source: '~/.codeium/windsurf/installation_id (Service-Key erforderlich)',
    }
  }

  // 3. Prüfe auf Codeium CLI-Konfiguration (~/.codeium/cli.json)
  const cliConfig = await tryReadFile(join(homedir(), '.codeium', 'cli.json'))
  if (cliConfig) {
    try {
      const parsed = JSON.parse(cliConfig) as Record<string, unknown>
      const apiKey = parsed.api_key ?? parsed.apiKey
      if (typeof apiKey === 'string' && apiKey.length > 0) {
        return { apiKey, source: '~/.codeium/cli.json' }
      }
    } catch {
      // Parse-Fehler
    }
  }

  return null
}

/**
 * Liest WorkBuddy-API-Schlüssel aus Umgebungsvariablen oder Konfigurationsdateien.
 */
const readWorkbuddyCredential = async (): Promise<LocalCredential | null> => {
  // 1. Umgebungsvariablen
  if (process.env.WORKBUDDY_API_KEY) {
    return {
      apiKey: process.env.WORKBUDDY_API_KEY,
      source: 'env WORKBUDDY_API_KEY',
    }
  }

  // 2. Lokale Konfiguration
  // WorkBuddy speichert Custom-Model-Konfiguration in JSON-Dateien.
  const wbDir = join(homedir(), '.workbuddy')
  const configFile = await tryReadFile(join(wbDir, 'models.json'))
  if (configFile) {
    try {
      const parsed = JSON.parse(configFile) as {
        models?: Array<{ apiKey?: string; url?: string }>
      }
      const firstWithKey = parsed.models?.find((m) => m.apiKey)
      if (firstWithKey) {
        return {
          apiKey: firstWithKey.apiKey!,
          baseUrl: firstWithKey.url,
          source: '~/.workbuddy/models.json',
        }
      }
    } catch {
      // Parse-Fehler
    }
  }

  // 3. Prüfe auf Tencent Cloud Credentials (WorkBuddy ist Tencent-Produkt)
  const tencentKey = process.env.TENCENT_SECRET_ID
  const tencentSecret = process.env.TENCENT_SECRET_KEY
  if (tencentKey && tencentSecret) {
    return {
      apiKey: `${tencentKey}:${tencentSecret}`,
      source: 'env TENCENT_SECRET_ID',
    }
  }

  return null
}

/**
 * Liest iFlow-API-Schlüssel aus Umgebungsvariablen oder der lokalen
 * Konfiguration. iFlow CLI unterstützt mehrere Auth-Typen:
 * - `selectedAuthType: "iflow"` → native iFlow-API mit `apiKey`
 * - OpenAI-kompatibel → `apiKey` + `baseUrl` für einen externen Provider
 *
 * Die Konfiguration liegt in `~/.iflow/settings.json`.
 */
const readIfloCredential = async (): Promise<LocalCredential | null> => {
  // 1. Umgebungsvariable
  if (process.env.IFLOW_API_KEY) {
    const baseUrl = process.env.IFLOW_BASE_URL
    return {
      apiKey: process.env.IFLOW_API_KEY,
      baseUrl,
      source: 'env IFLOW_API_KEY',
    }
  }

  // 2. Lokale Konfigurationsdatei (~/.iflow/settings.json)
  const settingsFile = join(homedir(), '.iflow', 'settings.json')
  const content = await tryReadFile(settingsFile)
  if (content) {
    try {
      const parsed = JSON.parse(content) as Record<string, unknown>
      // Der Auth-Typ bestimmt, ob der Key für iFlow oder einen
      // OpenAI-kompatiblen Provider gedacht ist. In beiden Fällen
      // ist `apiKey` der Schlüssel.
      const authType = parsed.selectedAuthType ?? 'iflow'
      const apiKey = parsed.apiKey ?? parsed.api_key
      if (typeof apiKey === 'string' && apiKey.length > 0) {
        const baseUrl =
          typeof parsed.baseUrl === 'string'
            ? parsed.baseUrl
            : undefined
        const source =
          authType === 'iflow'
            ? '~/.iflow/settings.json (iflow-auth)'
            : '~/.iflow/settings.json (openai-compatible)'
        return { apiKey, baseUrl, source }
      }
    } catch {
      // Parse-Fehler – weiter mit nächsten Quelle
    }
  }

  return null
}

/**
 * Liest LM Studio-Konfiguration. LM Studio läuft als lokaler Server
 * (standardmäßig http://localhost:1234/v1) und benötigt keinen API-Key.
 * Optional: LMSTUDIO_BASE_URL-Umgebungsvariable für benutzerdefinierte URL.
 */
const readLmstudioCredential = async (): Promise<LocalCredential | null> => {
  // LM Studio benötigt keinen API-Key - es ist ein lokaler Server.
  // Wir geben einen Dummy-Key zurück, da das Gateway-Auth-System einen erwartet.
  const baseUrl = process.env.LMSTUDIO_BASE_URL ?? 'http://localhost:1234/v1'
  return {
    apiKey: 'lmstudio-local',
    baseUrl,
    source: 'local LM Studio server',
  }
}

/**
 * Liest OmniRoute-Konfiguration. OmniRoute ist ein Open-Source-AI-Gateway,
 * das lokal läuft (standardmäßig http://localhost:20128/v1) oder über
 * Cheaper Inference gehostet wird. Benötigt einen API-Key aus dem Dashboard.
 */
const readOmnirouteCredential = async (): Promise<LocalCredential | null> => {
  // Versuche API-Key aus Umgebungsvariable
  if (process.env.OMNIROUTE_API_KEY) {
    return {
      apiKey: process.env.OMNIROUTE_API_KEY,
      baseUrl: process.env.OMNIROUTE_BASE_URL ?? 'http://localhost:20128/v1',
      source: 'env OMNIROUTE_API_KEY',
    }
  }

  // Standardmäßig: lokaler OmniRoute-Server ohne Key
  return {
    apiKey: 'omniroute-local',
    baseUrl: 'http://localhost:20128/v1',
    source: 'local OmniRoute server',
  }
}

/**
 * Dispatcher: Liest lokale Credentials für einen gegebenen Provider.
 *
 * Gibt `null` zurück, wenn keine Credentials gefunden wurden – dann
 * kann der Nutzer manuell einen API-Schlüssel hinterlegen.
 */
export const readLocalCredentials = async (
  providerId: string,
): Promise<LocalCredential | null> => {
  switch (providerId) {
    case 'kiro':
      return readKiroCredential()

    case 'windsurf':
      return readWindsurfCredential()

    case 'qoder':
      return readQoderCredential()

    case 'workbuddy':
      return readWorkbuddyCredential()

    case 'iflow':
      return readIfloCredential()

    case 'lmstudio':
      return readLmstudioCredential()

    case 'omniroute':
      return readOmnirouteCredential()

    default:
      return null
  }
}

/** Kiro-spezifischer Reader – AWS + Kiro API Key. */
const readKiroCredential = async (): Promise<LocalCredential | null> => {
  // 1. Prüfe Umgebungsvariable
  if (process.env.KIRO_API_KEY) {
    return {
      apiKey: process.env.KIRO_API_KEY,
      source: 'env KIRO_API_KEY',
    }
  }

  // 2. Prüfe lokale config.json (VS Code Settings)
  // Kiro ist VS Code-basiert – sucht nach settings.json
  const kiroSettings = [
    join(homedir(), '.kiro', 'settings', 'cli.json'),
    join(homedir(), '.kiro', 'settings', 'settings.json'),
  ]
  for (const file of kiroSettings) {
    const content = await tryReadFile(file)
    if (content) {
      try {
        const parsed = JSON.parse(content) as Record<string, unknown>
        // VS Code settings.json speichert manchmal den API-Key
        const apiKey =
          parsed.kiroApiKey ??
          parsed['kiro.apiKey']
        if (apiKey) {
          return {
            apiKey: String(apiKey),
            source: file.replace(homedir(), '~'),
          }
        }
      } catch {
        // Parse-Fehler – weiter
      }
    }
  }

  // 3. AWS Credentials als Fallback (Kiro nutzt Bedrock)
  const awsCred = await readAwsCredential(process.env.AWS_PROFILE ?? null)
  if (awsCred) {
    // AWS-Zugangsdaten im Format "access_key:secret_key"
    return awsCred
  }

  return null
}
