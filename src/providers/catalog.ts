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
    note: "Googles Bildmodell (gemini-2.5-flash-image). Wird über die Gemini-API erreicht: https://generativelanguage.googleapis.com/v1beta. Ebenfalls als fal-ai/nano-banana-2 über fal.ai verfügbar.",
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
    note: "Unified OpenAI-compatible endpoint at https://api.kilo.ai/api/gateway. Access 500+ models. Authenticated via KILOCODE_API_KEY or KILO_GATEWAY_API_KEY.",
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
    note: "Cloudflare Workers AI & AI Gateway. API-Key Format: \"account_id:api_token\". Modelle tragen das @cf/-Präfix.",
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
    note: "Nace.AI: Enterprise-SLM-Plattform mit OpenAI-kompatibler API unter https://api.nace.ai/v1; kostenloser API-Key für den Einstieg erhältlich.",
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
    auth: "local",
    note: "AWS Kiro IDE. Lokale Credential-Reader: aws profile (~/.aws/credentials), KIRO_API_KEY env, oder kiro login (AWS Builder ID/IAM). Der Service scannt automatisch.",
  },
  {
    id: "windsurf",
    name: "Windsurf",
    category: "ide",
    auth: "local",
    note: "Codeium Windsurf Editor. Lokale Credential-Reader: CODEIUM_API_KEY / WINDSURF_API_KEY env, oder ~/.codeium/windsurf/. Unterstützt auch manuelle API-Keys (Anthropic, OpenAI, etc.).",
  },
  {
    id: "qoder",
    name: "Qoder",
    category: "ide",
    auth: "local",
    note: "Alibaba Qoder IDE. Lokale Credential-Reader: DASHSCOPE_API_KEY / QODER_API_KEY env, ~/.qoder/settings.json, oder Alibaba Cloud CLI-Konfiguration. Unterstützt Token Plan, Coding Plan, Pay-as-you-go.",
  },
  {
    id: "workbuddy",
    name: "WorkBuddy",
    category: "ide",
    auth: "local",
    note: "WorkBuddy AI (Tencent). Lokale Credential-Reader: WORKBUDDY_API_KEY env, TENCENT_SECRET_ID/TENCENT_SECRET_KEY, oder ~/.workbuddy/models.json. Unterstützt OAuth (Google/GitHub) und API-Key-Anbieter.",
  },

  // --- OAuth-Anbieter ------------------------------------------------------
  {
    id: "gemini-cli",
    name: "Gemini CLI",
    category: "oauth",
    auth: "oauth",
    note: "**Eingestellt**: Google hat das Gemini CLI OAuth am 18.06.2026 eingestellt. Die Integration folgt dem Muster von opencode-gemini-auth (PKCE Authorization Code Flow). Neue Anmeldungen scheitern möglicherweise mit 'access_denied'.",
  },
  {
    id: "copilot",
    name: "GitHub Copilot",
    category: "oauth",
    auth: "oauth",
    note: "RFC 8628 Device Flow via auth.github.com. Client-ID der offiziellen Copilot CLI. Token wird gegen Copilot-JWT getauscht, dann als Bearer an https://api.githubcopilot.com/v1 verwendet.",
  },
  {
    id: "copilot-api",
    name: "GitHub Copilot (API-Key)",
    category: "api-key",
    auth: "api-key",
    note: "OpenAI-kompatible API unter https://api.githubcopilot.com/v1. Bearer = GitHub PAT mit copilot-Scope.",
  },
  {
    id: "grok-cli",
    name: "Grok CLI",
    category: "oauth",
    auth: "oauth",
    note: "RFC 8628 Device Flow über https://auth.x.ai. Client-ID der Grok-CLI. Token wird als Bearer an https://api.x.ai/v1 verwendet.",
  },
  {
    id: "continue",
    name: "Continue",
    category: "local",
    auth: "local",
    note: "Open-Source-Editor-Erweiterung (VS Code/JetBrains), BYOC-first. Nutzt OpenAI-kompatible API-Endpunkte, die lokal konfiguriert werden.",
  },
  {
    id: "roocode",
    name: "Roo Code",
    category: "local",
    auth: "local",
    note: "VS-Code-Erweiterung, eingestellt am 15.05.2026. Repository archiviert. Nachfolger: Roomote (roo).",
  },
  {
    id: "kilocode",
    name: "Kilo Code",
    category: "ide",
    auth: "api-key",
    note: "Cline-basierte Editor-Erweiterung. Nutzt das Kilo Gateway unter https://api.kilo.ai/api/gateway oder lokale Provider.",
  },
  {
    id: "roo",
    name: "Roo (Roomote)",
    category: "local",
    auth: "local",
    note: "CLI-Variante der Roo-Code-/Kilo-Code-Familie. Nutzt OpenAI-kompatible Endpoints, lokal konfiguriert.",
  },
  {
    id: "hermes",
    name: "Hermes Agent",
    category: "local",
    auth: "local",
    note: "Nous Research Agent-Plattform. Lokale OpenAI-kompatible API (http://localhost:8000/v1); nutzt standardmäßig OPENROUTER_API_KEY.",
  },
  {
    id: "openclaw",
    name: "OpenClaw",
    category: "local",
    auth: "local",
    note: "Lokaler AI-Gateway (Peter Steinberger). OAuth für ChatGPT/Claude CLI, API-Key für externe Provider. Basis-URL: http://localhost.",
  },
  {
    id: "jcode",
    name: "JCode",
    category: "local",
    auth: "local",
    note: "Quelloffener Rust-Terminal-Agent. Nutzt lokale Modelle oder externe OpenAI-kompatible APIs.",
  },
  {
    id: "pi",
    name: "Pi",
    category: "local",
    auth: "local",
    note: "Pi Coding Agent. Server-Mode mit OpenAI-kompatiblen Endpunkten. Konfiguration in ~/.pi/.",
  },
  {
    id: "iflow",
    name: "iFlow",
    category: "local",
    auth: "local",
    note: "iFlow CLI (iflow-ai). Lokale Credential-Reader: IFLOW_API_KEY env → ~/.iflow/settings.json. Auth-Typen: 'iflow' (native iFlow-API) oder OpenAI-kompatibel (custom baseUrl + apiKey). Basis-URL: https://apis.iflow.cn/v1. Kostenloser Zugang zu chinesischen Modellen (Kimi K2, GLM-4.6, Qwen3).",
  },
  {
    id: "omniroute",
    name: "OmniRoute",
    category: "api-key",
    auth: "api-key",
    note: "Open-Source AI Gateway mit 352 Providern (90+ mit Free Tier) und 1200+ Modellen (Kimi, Claude, GPT, Gemini, GLM, DeepSeek, Qwen, Llama). Läuft lokal (http://localhost:20128/v1) oder über Cheaper Inference. OpenAI-kompatibel. API-Key aus Dashboard. Perfekt für kostenlose Modelle ohne individuelle API-Keys.",
  },
  {
    id: "lmstudio",
    name: "LM Studio",
    category: "local",
    auth: "local",
    note: "Desktop-App für lokale LLM-Modelle (Llama, Qwen, DeepSeek, Mistral, Phi). OpenAI-kompatible REST-API auf http://localhost:1234/v1. Kein API-Key erforderlich - vollständig lokal.",
  },
  {
    id: "puter",
    name: "Puter",
    category: "api-key",
    auth: "api-key",
    note: "Open-Source-Cloud-Betriebssystem mit Gateway zu 500+ Modellen. Auth-Token im Dashboard erstellen. Basis-URL: https://api.puter.com/v1.",
  },

  // --- Web Cookie Providers ------------------------------------------------
  {
    id: "grok-web",
    name: "Grok Web",
    category: "web-cookie",
    auth: "cookie",
    note: "Grok über Claude.ai-Web-Session. Cookies manuell aus dem Browser kopieren (Entwicklerwerkzeuge → Application → Cookies).",
  },
  {
    id: "claude-web",
    name: "Claude Web",
    category: "web-cookie",
    auth: "cookie",
    note: "Claude.ai über Web-Session. Session-Cookies aus claude.ai manuell kopieren. Nutzt die Anthropic-kompatible interne API.",
  },

  // --- Gateway & Free-Credit Providers -------------------------------------------
  {
    id: "omniroute",
    name: "OmniRoute",
    category: "api-key",
    auth: "api-key",
    note: "Open-Source AI Gateway (352 Provider, 90+ Free Tier). Lauft lokal (http://localhost:20128/v1) oder ueber Cheaper Inference. OpenAI-kompatibel. 1200+ Modelle inkl. Kimi, Claude, GPT, Gemini, GLM, DeepSeek, Qwen. 200 req/day kostenlos, keine Kreditkarte erforderlich.",
  },
  {
    id: "lmstudio",
    name: "LM Studio",
    category: "local",
    auth: "local",
    note: "Desktop-App fuer lokale LLM-Modelle (Llama, Qwen, DeepSeek, Mistral, Phi). OpenAI-kompatible REST-API auf http://localhost:1234/v1. Kein API-Key erforderlich - vollstaendig lokal.",
  },
  {
    id: "requesty",
    name: "Requesty",
    category: "api-key",
    auth: "api-key",
    note: "AI Gateway mit 200 req/day Free Tier, 600+ Modelle. OpenAI-kompatibel, API-Key aus Dashboard. Free Models inkl. DeepSeek V4, Qwen3, Gemma, Llama.",
  },
  {
    id: "github-models",
    name: "GitHub Models",
    category: "api-key",
    auth: "api-key",
    note: "150K Tokens/Monat kostenlos. OpenAI-kompatibel. Auth: GitHub Token (GITHUB_TOKEN). Modelle: GPT-4o, GPT-4.1, Claude, Llama, Qwen, DeepSeek.",
  },
  {
    id: "nvidia-nim",
    name: "NVIDIA NIM",
    category: "api-key",
    auth: "api-key",
    note: "80+ kostenlose Modelle (DeepSeek, Kimi K2.6, GLM-5.3, MiniMax M2.5). API-Key aus build.nvidia.com. OpenAI-kompatibel.",
  },
  {
    id: "freellm",
    name: "FreeLLM",
    category: "api-key",
    auth: "api-key",
    note: "Open-Source-Gateway: eine OpenAI-kompatible Endpoint fuer 34+ kostenlose LLM-Provider. Base URL: https://freellmapi.co/api/v1. 34 Provider inkl. DeepSeek, Qwen, Llama, Gemma.",
  },
  {
    id: "eden-ai",
    name: "Eden AI",
    category: "api-key",
    auth: "api-key",
    note: "500+ AI-Modelle ueber eine API. Free Credits bei Registrierung. OpenAI-kompatibel via /v3/chat/completions.",
  },
  // --- Search Providers ----------------------------------------------------
  {
    id: "searxng",
    name: "SearXNG",
    category: "search",
    auth: "none",
    note: "Selbst gehostete Meta-Suchmaschine; ohne Auth nutzbar, sofern selbst betrieben.",
  },
  // --- Free-Credit Gateway Providers -------------------------------------------
  {
    id: "xkiro",
    name: "xKiro AI",
    category: "api-key",
    auth: "api-key",
    note: "105+ Modelle, 5M Tokens/Tag gratis. OpenAI-kompatibel. Modelle: DeepSeek, Claude, ChatGPT, Gemini, Qwen, Llama. Keine Kreditkarte erforderlich.",
  },
  {
    id: "apinex",
    name: "APInex",
    category: "api-key",
    auth: "api-key",
    note: "Kostenlose OpenAI-kompatible API mit Code 'T4GFQTSX' bei Registrierung. Modelle: OpenAI, Anthropic, Gemini, DeepSeek, Moonshot, Zhipu, xAI. Keine Kreditkarte erforderlich.",
  },
  {
    id: "seekai",
    name: "SeekAI",
    category: "api-key",
    auth: "api-key",
    note: "$200 Free Credits bei Registrierung, GPT-6 Astra, Claude Fable 5.1. OpenAI-kompatibel, $20/dag Check-in Bonus. Keine Kreditkarte erforderlich.",
  },
  {
    id: "vyceai",
    name: "Vyce AI",
    category: "api-key",
    auth: "api-key",
    note: "$50 Signup + $10/dag Check-in Bonus. OpenAI-kompatibel, 105+ Modelle. Keine Kreditkarte erforderlich.",
  },
  {
    id: "freemodel",
    name: "FreeModel",
    category: "api-key",
    auth: "none",
    note: "Open-Source Free-Model-Pool. OpenAI Responses + Anthropic Messages kompatibel. Keine Auth erforderlich.",
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
