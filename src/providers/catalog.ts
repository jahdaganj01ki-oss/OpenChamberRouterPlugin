/**
 * Provider-Katalog fuer die Anbieter-Ubersicht.
 *
 * Die Anbieter aus der bisherigen Sammelkategorie "Weitere Anbieter mit Logo"
 * sind auf die bestehenden Kategorien verteilt. "Medien-Anbieter" (media) wurde
 * neu angelegt, weil Bild-, Video- und Speech-Dienste in keine der vorhandenen
 * Kategorien passen.
 *
 * Einordnungskriterien
 * --------------------
 * - API-Schluesselanbieter: Zugang ueber einen Schluessel oder Token, den der
 *   Nutzer selbst eintraegt (Modell-Dienste, Gateways, Router, self-hosted
 *   Endpunkte).
 * - OAuth-Anbieter: einmal anmelden, Token-Rotation und Quota-Verwaltung
 *   uebernimmt OmniRoute. Erfasst werden alle Client-Werkzeuge, die man einmal
 *   anmeldet – IDE-Erweiterungen (Cline, Continue, Roo Code, Kilo Code) genauso
 *   wie Terminal-Agenten (Claude Code, Antigravity CLI, JCode, Pi, OpenClaw,
 *   Hermes) und Desktop-Clients.
 * - IDE-Anbieter: eigenstaendige IDE- oder Desktop-Anwendungen mit eigenem
 *   Abo (Cursor IDE, Trae, Kiro, Windsurf, Qoder, WorkBuddy).
 *
 * Verbleibende offene Punkte sind je Provider als `note` vermerkt.
 */

export type CategoryId =
  | "api-key-compatible"
  | "oauth"
  | "ide"
  | "web-cookie"
  | "api-key"
  | "no-auth"
  | "cloud-agent"
  | "local"
  | "search"
  | "media"

export type AuthMethod = "oauth" | "api-key" | "cookie" | "none" | "local"

export interface Category {
  id: CategoryId
  label: string
  description: string
  order: number
}

export interface Provider {
  id: string
  name: string
  category: CategoryId
  auth: AuthMethod
  /** Freitext fuer offene Punkte, die nach der Recherche geklaert werden. */
  note?: string
}

export const categories: Category[] = [
  {
    id: "api-key-compatible",
    label: "Mit API-Schlüsseln kompatible Anbieter",
    description: "OpenAI- und Anthropic-kompatible Endpunkte, die Sie hosten oder konfigurieren.",
    order: 1,
  },
  {
    id: "oauth",
    label: "OAuth-Anbieter",
    description: "Über OAuth authentifizierte Anbieter – einmal anmelden und OmniRoute übernimmt die Token-Rotation automatisch.",
    order: 2,
  },
  {
    id: "ide",
    label: "IDE-Anbieter",
    description: "Integrierte Entwicklungsumgebungen mit eigenem KI-Abonnement.",
    order: 3,
  },
  {
    id: "web-cookie",
    label: "Web Cookie Providers",
    description: "Web-Anbieter, die sich über ein bestehendes Konto verbinden lassen.",
    order: 4,
  },
  {
    id: "api-key",
    label: "API-Schlüsselanbieter",
    description: "Standard-API-Schlüssel-Anbieter. Fügen Sie Ihren Schlüssel einmal hinzu und OmniRoute übernimmt Routing und Wiederholungsversuche.",
    order: 5,
  },
  {
    id: "no-auth",
    label: "Keine Authentifizierungsanbieter",
    description: "Offene Endpunkte, die keine Anmeldedaten erfordern.",
    order: 6,
  },
  {
    id: "cloud-agent",
    label: "Cloud-Agent-Anbieter",
    description: "Autonome Cloud-Agenten, die lang laufende Aufgaben mit Planenermöglichung und Live-Statusverfolgung ausführen.",
    order: 7,
  },
  {
    id: "local",
    label: "Lokale Anbieter",
    description: "Lokal ausgeführte Modelle und Inferenzserver.",
    order: 8,
  },
  {
    id: "search",
    label: "Search Providers",
    description: "Web- und Dokumentensuchanbieter für Retrieval-Augmented Generation.",
    order: 9,
  },
  {
    id: "media",
    label: "Medien-Anbieter",
    description: "Bild-, Video- und Speech-Anbieter für Medien-Pipelines.",
    order: 10,
  },
]

export const providers: Provider[] = [
  // --- Medien-Anbieter -----------------------------------------------------
  {
    id: "assemblyai",
    name: "AssemblyAI",
    category: "media",
    auth: "api-key",
  },
  {
    id: "deepgram",
    name: "Deepgram",
    category: "media",
    auth: "api-key",
  },
  {
    id: "nanobanana",
    name: "Nano Banana",
    category: "media",
    auth: "api-key",
    note: "Googles Bildmodell, wird u. a. als „fal-ai/nano-banana-2“ über fal.ai bereitgestellt.",
  },
  {
    id: "black-forest-labs",
    name: "Black Forest Labs",
    category: "media",
    auth: "api-key",
  },
  {
    id: "fal",
    name: "fal",
    category: "media",
    auth: "api-key",
  },
  {
    id: "fal-ai",
    name: "fal.ai",
    category: "media",
    auth: "api-key",
    note: "Identische Plattform wie „fal“ (Python-Paket fal_client, npm @fal-ai/client). Duplikat entscheiden.",
  },

  // --- API-Schlüsselanbieter ----------------------------------------------
  {
    id: "agnes",
    name: "Agnes",
    category: "api-key",
    auth: "api-key",
    note: "Lokal verifiziert: OpenAI-kompatibles API-Hub unter https://apihub.agnes-ai.com/v1.",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    category: "api-key",
    auth: "api-key",
  },
  {
    id: "kilo-gateway",
    name: "Kilo Gateway",
    category: "api-key",
    auth: "api-key",
    note: "OpenRouter-kompatibles Inference-Gateway von Kilo; Auth über KILOCODE_API_KEY. Eigenes Produkt, nicht die Kilo-Code-IDE.",
  },
  {
    id: "grok",
    name: "Grok",
    category: "api-key",
    auth: "api-key",
  },
  {
    id: "together",
    name: "Together",
    category: "api-key",
    auth: "api-key",
  },
  {
    id: "ovhcloud",
    name: "OVHcloud",
    category: "api-key",
    auth: "api-key",
  },
  {
    id: "cloudflare-workers-ai",
    name: "Cloudflare Workers AI",
    category: "api-key",
    auth: "api-key",
  },
  {
    id: "cloudflare",
    name: "Cloudflare",
    category: "api-key",
    auth: "api-key",
    note: "Duplikat-Status zu „Cloudflare Workers AI“ und „Cloudflare AI Playground“ unklar.",
  },
  {
    id: "orcarouter",
    name: "OrcaRouter",
    category: "api-key",
    auth: "api-key",
  },
  {
    id: "tokenharbor",
    name: "TokenHarbor",
    category: "api-key",
    auth: "api-key",
  },
  {
    id: "vercel-ai-gateway",
    name: "Vercel AI Gateway",
    category: "api-key",
    auth: "api-key",
  },
  {
    id: "dify",
    name: "Dify",
    category: "api-key",
    auth: "api-key",
  },
  {
    id: "ollama-cloud",
    name: "Ollama Cloud",
    category: "api-key",
    auth: "api-key",
  },
  {
    id: "agentrouter",
    name: "AgentRouter",
    category: "api-key",
    auth: "api-key",
  },
  {
    id: "mimo-free",
    name: "MiMo Free",
    category: "api-key",
    auth: "api-key",
    note: "Xiaomi-MiMo-Kostenlosangebot, zeitlich begrenzt; über OpenRouter oder mit API-Key der MiMo-Plattform.",
  },
  {
    id: "pollinations",
    name: "Pollinations",
    category: "api-key",
    auth: "api-key",
    note: "Korrektur: verlangt inzwischen einen API-Key (enter.pollinations.ai); früher keyless. Multimedial (Text, Bild, Video, Audio, Embeddings).",
  },
  {
    id: "deepseek-tui",
    name: "DeepSeek TUI",
    category: "api-key",
    auth: "api-key",
    note: "Community-Terminal-Agent (Hmbown/DeepSeek-TUI), kein offizielles DeepSeek-Produkt. „deepseek auth“ speichert den API-Key in ~/.deepseek/config.toml.",
  },
  {
    id: "nace",
    name: "NACE",
    category: "api-key",
    auth: "api-key",
    note: "Nace.AI: Enterprise-SLM-Plattform mit OpenAI-kompatibler API; kostenloser API-Key für den Einstieg erhältlich.",
  },
  {
    id: "bai",
    name: "BAI",
    category: "api-key",
    auth: "api-key",
    note: "B.AI (Bank of AI), https://b.ai: einheitliches LLM-Gateway zu 20+ Modellen (GPT, Claude, Gemini, DeepSeek, Kimi, MiniMax). OpenAI-, OpenAI-Responses- und Anthropic-Messages-kompatibel, Abrechnung über Credits (1 USD = 1 Mio. Credits) sowie Krypto-Zahlungen via x402/TRON. API-Key aus dem Dashboard; Chat unter https://chat.b.ai/chat. Gleiche Bauart wie OpenRouter, Kilo Gateway und TokenRouter.",
  },

  // --- IDE-Anbieter --------------------------------------------------------
  {
    id: "kiro",
    name: "Kiro",
    category: "ide",
    auth: "oauth",
  },
  {
    id: "windsurf",
    name: "Windsurf",
    category: "ide",
    auth: "oauth",
  },
  {
    id: "qoder",
    name: "Qoder",
    category: "ide",
    auth: "oauth",
    note: "Lokal verifiziert: Installationsdaten unter ~/.qmind/.qoder.",
  },
  {
    id: "workbuddy",
    name: "WorkBuddy",
    category: "ide",
    auth: "oauth",
    note: "Lokal verifiziert: Desktop-App mit Plugins und Connectors unter ~/.workbuddy-ai.",
  },

  // --- OAuth-Anbieter ------------------------------------------------------
  {
    id: "gemini-cli",
    name: "Gemini CLI",
    category: "oauth",
    auth: "oauth",
  },
  {
    id: "copilot",
    name: "GitHub Copilot",
    category: "oauth",
    auth: "oauth",
    note: "Zweischichtige Auth: langlebiges GitHub-OAuth-Token (Device-Flow via „copilot login“) wird zu kurzlebigem Copilot-JWT (~30 min) getauscht. Klassische PATs werden nicht unterstützt.",
  },
  {
    id: "grok-cli",
    name: "Grok CLI",
    category: "oauth",
    auth: "oauth",
  },
  {
    id: "continue",
    name: "Continue",
    category: "oauth",
    auth: "oauth",
    note: "Open-Source-Editor-Erweiterung (VS Code/JetBrains), BYOC-first.",
  },
  {
    id: "roocode",
    name: "Roo Code",
    category: "oauth",
    auth: "oauth",
    note: "WICHTIG: Die VS-Code-Erweiterung wurde zum 15. Mai 2026 eingestellt, das Repository ist archiviert. Nachfolger ist Roomote.",
  },
  {
    id: "kilocode",
    name: "Kilo Code",
    category: "oauth",
    auth: "oauth",
    note: "Cline-basierte Editor-Erweiterung (VS Code, JetBrains, CLI); nutzt eigene Keys oder das Kilo Gateway. Zu unterscheiden von „Kilo Gateway“.",
  },
  {
    id: "roo",
    name: "Roo",
    category: "oauth",
    auth: "oauth",
    note: "OFFEN: Verhältnis zu „Roo Code“ unklar. Vermutlich CLI-Variante oder der Nachfolger Roomote.",
  },
  {
    id: "hermes",
    name: "Hermes",
    category: "oauth",
    auth: "oauth",
    note: "Hermes Agent von Nous Research: quelloffener Terminal-Agent mit Gateway. Nutzt standardmäßig einen OpenRouter-API-Key (OPENROUTER_API_KEY).",
  },
  {
    id: "openclaw",
    name: "OpenClaw",
    category: "oauth",
    auth: "oauth",
    note: "Ehemals Clawdbot/Moltbot: quelloffener autonomer Agent (Peter Steinberger), läuft lokal und steuert Chat-Apps. Kein Modell-Dienst – daher wie Claude Code eingeordnet.",
  },
  {
    id: "jcode",
    name: "JCode",
    category: "oauth",
    auth: "oauth",
    note: "Quelloffener Rust-Terminal-Agent (1jehuang/jcode). „jcode login --provider …“ trägt Base-URL und Key ein.",
  },
  {
    id: "pi",
    name: "Pi",
    category: "oauth",
    auth: "oauth",
    note: "Lokal verifiziert: Terminal-Agent plus Desktop-App unter ~/.pi und ~/.pi-desktop. Auf ~/.zosmaai/cowork basiert „Zosma Cowork“.",
  },
  {
    id: "iflow",
    name: "iFlow",
    category: "oauth",
    auth: "oauth",
  },
  {
    id: "puter",
    name: "Puter",
    category: "oauth",
    auth: "oauth",
    note: "Open-Source-Cloud-Betriebssystem mit Gateway zu 500+ Modellen. „User-Pays“-Modell: Anmeldung mit Puter-Konto; für Server-Zugriffe gibt es ein Auth-Token im Dashboard.",
  },

  // --- Web Cookie Providers ------------------------------------------------
  {
    id: "grok-web",
    name: "Grok Web",
    category: "web-cookie",
    auth: "cookie",
  },

  // --- Search Providers ----------------------------------------------------
  {
    id: "searxng",
    name: "SearXNG",
    category: "search",
    auth: "none",
    note: "Selbst gehostete Meta-Suchmaschine; ohne Auth nutzbar, sofern selbst betrieben.",
  },
]

/** Provider einer Kategorie in Anzeigereihenfolge. */
export function providersByCategory(categoryId: CategoryId): Provider[] {
  return providers.filter((provider) => provider.category === categoryId)
}

/** Kategorie in Anzeigereihenfolge. */
export function categoriesInOrder(): Category[] {
  return [...categories].sort((a, b) => a.order - b.order)
}
