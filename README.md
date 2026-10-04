# OpenChamber Router

Anbieter-Katalog mit Multi-Account-Routing für OpenChamber 2.1.0 (OpenCode 2.0.21).

## Aufbau

Die Extension besteht aus zwei Teilen, weil eine Extension allein keine
Modell-Aufrufe abfangen kann:

| Teil | Ort | Aufgabe |
| --- | --- | --- |
| Seite | `page/`, `panel/` | Katalog, Detailseite, Verbindungen, Modellauswahl |
| Dienst | `service/` | hält die Schlüssel, wählt das Konto, leitet weiter |

Die Seite läuft sandboxed: kein Netz, keine Platte. Sie spricht den Dienst über
`host.serviceRequest()` an. Die echten Geheimnisse liegen nur im Dienst und
verlassen ihn nie — Antworten an die Seite führen kein `secret`-Feld.

OpenCode bekommt keinen Schlüssel. Es spricht den lokalen Proxy an:

```
http://127.0.0.1:<port>/proxy/<anbieter>/v1
```

## Bauen

```bash
npm install
npm run build
```

`npm run build` macht **erst den Typecheck** und baut nur, wenn er sauber ist.
Das ist Absicht: die UI-Kit gibt Komponenten zurück, die nur `update` und
`dispose` kennen. Ein erfundenes Feld wie `.el` fällt im gebündelten JS nicht auf,
sondern lässt die Seite zur Laufzeit leer — genau das ist zweimal passiert. `tsc`
sieht es sofort.

Erzeugt `page/main.js`, `panel/main.js`, `service/main.mjs`. Ein Ordner-Build
läuft direkt aus dem Ordner, also hier bauen und OpenChamber neu laden.

## Installieren

1. OpenChamber öffnen → **Settings → Extensions**
2. In das Feld den absoluten Pfad eintragen:
   `C:\Users\JahDaGanj\OpenChamberRouterPlugin`
3. **Add** → im Dialog die Berechtigungen bestätigen (**Allow and enable**)
4. Über der Sitzungsliste das Menü **Extension pages** öffnen →
   **OpenChamber Router**

Beim ersten Öffnen prüft die Seite selbst, ob Dienst, Speicher und
Konfigurationszugriff funktionieren; das Ergebnis steht unten auf der Seite.

**Nach jedem Bauen OpenChamber neu starten.** Der Dienst ist ein eigener
Prozess, den der Host einmal startet und dann behält — ein neues Bundle ersetzt
ihn nicht. Die Seite nennt unten ihren Build (`Seite: Build bc62861a`) und den
Dienst seine Version. Stimmen die nicht überein, läuft ein alter Stand, und
das sieht aus wie ein Fehler im neuen Code.

`npm run build` prüft sich zum Schluss selbst: Ist eine erzeugte Datei älter
als die Quellen, aus denen sie entstanden ist, bricht der Build ab. Das ist
kein theoretischer Fall — ein altes Bundle ohne eine einzige Zeile ist genau
so entstanden, und die Seite blieb an dieser Stelle leer, ohne jede
Fehlermeldung.

## Benutzung

**Katalog** — alle 44 Anbieter nach Kategorien gruppiert. Ein Klick öffnet die
Detailseite.

**Detailseite**
- *Account-Strategie*: globalen Standard übernehmen oder je Anbieter `Manuell`,
  `Bei Fehler`, `Round Robin`, `Kontingent`
- *Verbindungen*: beliebig viele Konten je Anbieter, einzeln testen, an- und
  abschalten, Priorität mit ↑/↓ ändern, entfernen; Quota-Anzeige pro Konto
- *Verfügbare Modelle*: **Fetch Models** lädt die Liste vom Anbieter. Danach
  filtern, suchen, auswählen und speichern. Beim Speichern wird der Anbieter als
  OpenCode-Provider registriert — die Modelle erscheinen im normalen Modelpicker.

## Fenster und Ausgabelänge

Jedes registrierte Modell bekommt ein `limit` mit **beiden** Werten:

```json
"models": {
  "thinkingmachines/inkling:free": {
    "name": "thinkingmachines: Inkling (free)",
    "limit": { "context": 1048576, "output": 262144 }
  }
}
```

Drei Dinge dazu, alle am echten OpenCode gemessen und nicht aus dem Handbuch
übernommen:

- **Ohne `limit` zeigt der Picker 200.000 – bei jedem Modell.** Das ist ein
  Ersatzwert, keine Angabe des Anbieters. Wer die Registrierung nur mit dem
  Namen schreibt, bekommt diese Zahl überall und hält sie für echt.
- **`limit` braucht `context` *und* `output`.** Fehlt eines, lehnt OpenCode die
  **gesamte** Konfiguration ab und startet nicht mehr:
  `Missing key provider…models.x.limit.output`. Es gibt deshalb ein
  vollständiges `limit` oder gar keines.
- **`attachment` allein schaltet keinen Bildeingang frei.** Gemessen:
  `attachment: true` ergibt `capabilities.attachment = true`, aber
  `input.image = false`. Erst `modalities.input` mit `"image"` tut es.

Viele Anbieter nennen nur die Hälfte: DeepInfra liefert 183 Modelle und bei
keinem ein Kontextfenster, Novita 121, ebenfalls ohne. Fehlende Angaben werden
deshalb aus **models.dev** ergänzt — der Quelle, aus der OpenCode selbst seine
Katalogdaten holt. Bei OpenRouter kommen so 463 von 465 Modellen vollständig
zusammen; die Herkunft steht unter der Modellliste, damit eine ergänzte Zahl
nicht als Anbieterangabe missverstanden wird.

Modelle ohne beide Werte bekommen kein `limit`. Sie tragen in der Liste das
Kennzeichen *Fenster unbekannt*, statt eine erfundene Zahl zu behaupten.

## Anmeldung

OAuth-Anbieter (GitHub Copilot, Grok CLI) werden über den RFC 8628
Gerätefluss verbunden, nicht über einen API-Schlüssel. Deshalb zeigen diese
kein Schlüsselfeld, sondern den Abschnitt *Anmeldung*.

Klick auf *Anmeldung starten*, Code im Browser bestätigen. Die Seite meldet
danach den Stand des Dienstes — nicht eine eigene Vermutung.

Drei Dinge, die den Ablauf robust machen:

- **Der Dienst bestimmt den Takt, nicht die Seite.** GitHub verlangt fünf
  Sekunden zwischen den Abfragen. Fragt die Seite schneller, fängt der Dienst
  das ab, statt GitHub den Vorgang mit `slow_down` beenden zu lassen.
- **Jede Antwort ist unterscheidbar.** *Noch offen*, *zu oft abgefragt* und
  *Anmeldung abgelehnt* sind drei verschiedene Meldungen. Vorher sahen alle
  drei gleich aus, und ein hängender Vorgang war nicht von einem langsamen zu
  unterscheiden.
- **Die Anmeldung überlebt einen Neuaufbau.** Wer zum Bestätigen in den Browser
  wechselt, kommt in ein Fenster, in dem Timer verlangsamt werden. Läuft die
  Anmeldung trotzdem, wird sie beim Zurückkommen wieder aufgegriffen statt neu
  gestartet.

Nach der Anmeldung nennt die Seite den ermittelten Tarif. Bei *individual*
geht das GitHub-Token direkt; bei *business*/*enterprise* wird es gegen ein
kurzlebiges Sitzungstoken getauscht.

**Grok CLI** verwendet denselben Gerätefluss über `auth.x.ai` mit der
Client-ID `b1a00492-073a-47ea-816f-4c329264a828`. Die Scopes sind
`grok-cli:access` und `api:access`. Token werden automatisch erneuert.

**Gemini CLI** (Google OAuth) ist wegen der Einstellung durch Google am
18.06.2026 markiert — neue Anmeldungen scheitern mit `access_denied`.

**Cookie-Provider** (Grok Web, Claude Web) erhalten die Session-Cookies
aus dem Browser (Handkopie oder `npm run crawl-cookies -- <provider>`). Sie
nutzen die gleiche API wie der OAuth-Zugriff.

**IDE-Provider** (Kiro, Windsurf, Qoder, WorkBuddy) lesen ihre Credentials
aus lokalen Konfigurationsdateien. Der Service scannt bei Verbindungserstellung
automatisch:

| Provider | Quellen (Priorität) | Basis-URL |
|---|---|---|
| Kiro | `KIRO_API_KEY` env → `~/.aws/credentials` | `https://kiro.api.aws/v1` |
| Windsurf | `CODEIUM_API_KEY` env → `~/.codeium/windsurf/` | `https://server.codeium.com/api/v1` |
| Qoder | `DASHSCOPE_API_KEY` env → `~/.qoder/settings.json` | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| WorkBuddy | `WORKBUDDY_API_KEY` env → `~/.workbuddy/models.json` | `https://api.workbuddy.ai/v1` |

Ein manuell eingegebener API-Schlüssel hat Vorrang vor der automatischen
Suche. Lässt du das Feld leer, nutzt der Service das lokal gefundene Credential.

## Strategien

| Strategie | Verhalten | Wechseln |
| --- | --- | --- |
| `manual` | immer die erste gesunde Verbindung (nach Priorität); ↑/↓ ändert die Reihenfolge | Prioritäts-Buttons |
| `failover` | erste Verbindung; bei 401/402/403/429 gilt sie als gesperrt | Automatisch |
| `round-robin` | Rotation pro Anfrage | Automatisch |
| `quota-aware` | Verbindung mit der höchsten verbleibenden Quote; fällt auf Round Robin zurück, wenn Quotes unbekannt | Automatisch |

**Strategie wechseln:** über den *Account-Strategie*-Dropdown auf der Detailseite.
Die globale Vorgabe lässt sich in den Einstellungen überschreiben.

**Priorität ändern:** Die ↑/↓-Buttons in der Verbindungsliste ändern die
Priorät für die `manual`-Strategie. Die erste gesunde Verbindung (niedrigste
Prioritätszahl) wird ausgewählt.

**Quota-Anzeige:** Bei `quota-aware` wird die verbleibende Quote pro Konto
angezeigt. Erschöpfte Konten werden mit `(erschöpft)` markiert und von der
Strategie automatisch übersprungen.

## Zustand

`~/.openchamber-router/state.json` — Verbindungen, Schlüssel, Auswahl. Wird
beim Entfernen der Extension nicht mitgelöscht.

## Tests

```bash
npm test
```

Nutzt `node --test` (Bun-Binary auf Windows inkompatibel).

Deckt die JSONC-Behandlung (Kommentare in Strings dürfen nicht angerührt
werden) und die Registrierung gegen eine Kopie der echten `opencode.jsonc` ab.

Der Anmelde-Teil ist bewusst hart getestet, weil dort zwei Fehler wochenlang
unbemerkt blieben: der Takt der Abfrage und der Moment, in dem aus einer
offenen Anmeldung ein Konto wird. Beides ist in `test/oauth-poll.test.ts` und
`test/oauth-session.test.ts` von Hand durchgespielt, nicht gegen GitHub.

`test/model-limits.test.ts` haelt die Bedingung fest, unter der ein `limit`
ueberhaupt geschrieben werden darf. Sie ist strenger als sie aussieht: ein
halbes `limit` ist kein Schönheitsfehler, sondern lässt OpenCode gar nicht
starten.

## Stand

Phase 0 (Spike) und die Anbieter-Adapter sind fertig und geprueft.

**Verifiziert gegen die echten APIs** – 61 von 72 Adaptern, ohne
Fehler:

- **9 ohne Konto nutzbar**, die Modelliste lässt sich sofort ansehen:
  Featherless (22 092), OpenRouter (464), Vercel AI Gateway (405),
  OrcaRouter (205), DeepInfra (185), Novita (121), Chutes (14), Friendli (7),
  Pollinations (687)
- **30 verlangen sauber einen API-Key** und melden 401 statt zu raten
- Round Robin wechselt nachweisbar zwischen zwei Konten
- Failover weicht einem deaktivierten Konto aus
- Quota-Aware wählt die Verbindung mit der höchsten verbleibenden Quote,
  fällt auf Round Robin zurück, wenn Quotes unbekannt
- Der Proxy liefert ohne aktives Konto `503`, damit im Modelpicker keine
  Modelle erscheinen, deren Aufrufe scheitern
- Geheimnisse verlassen den Dienst nicht (kein `secret`-Feld in Antworten)
- Die Registrierung schreibt `ocr-<anbieter>` in die OpenCode-Konfiguration,
  ohne bestehende Eintraege zu ueberschreiben

**OAuth-Adapter** (RFC 8628 Gerätefluss):
- GitHub Copilot: Tarif-Erkennung (individual/business/enterprise), Token-ErNEUerung
- Grok CLI: über `auth.x.ai`, Scopes `grok-cli:access` + `api:access`, Token-Erneuerung

**Lokale Credential-Reader** für IDE-Provider:
- Kiro: `KIRO_API_KEY` env → AWS Credentials (`~/.aws/credentials`) → Kiro-Settings
- Windsurf: `CODEIUM_API_KEY` env → `~/.codeium/windsurf/`
- Qoder: `DASHSCOPE_API_KEY` / `QODER_API_KEY` env → `~/.qoder/settings.json` → Alibaba Cloud CLI
- WorkBuddy: `WORKBUDDY_API_KEY` env → `~/.workbuddy/models.json` → Tencent Cloud Credentials

**Cookie-Provider:** Grok Web (manuell), Claude Web (manuell + `npm run crawl-cookies`)

**Neue API-Key-Provider:** Dify, NACE, Ollama Cloud, AgentRouter, Cloudflare
  Workers AI, Cloudflare, OVHcloud, DeepSeek-TUI, Mimo Free, Pollinations

**Media-Provider:** Nanobanana, Fal, Fal.ai, SearXNG (lokale Such-API)

**GitHub Actions:** Build, Typecheck und Tests laufen via `.github/workflows/build.yml`

**Bewusst nicht verdrahtet**, statt eine erfundene URL auszuliefern:

- `lambda` – die Inference-API wird eingestellt (Stand 29.05.2026)
- `nscale` – keine belegbare oeffentliche Basis-URL
- `kilo-gateway`, `tokenharbor`, `inception` – als Proxy-Ziel nutzbar, aber ohne
  belegte `/models`-Route, also keine automatische Modulliste

Anbieter und ihre Basis-URLs ansehen:

```bash
npm run list:adapters
```

**Free-Credit Provider (2026) - 22 neu implementiert:**

| Provider | Free Credits | Modelle | API-kompatibel |
|----------|-------------|---------|----------------|
| **AgentRouter** | $100-200 | GPT-5, Claude, DeepSeek, Qwen | ✅ OpenAI |
| **OmniRoute/Gateway** | 200 req/day | 1200+ (Kimi, Claude, GPT, Gemini) | ✅ OpenAI |
| **xKiro** | 5M Tokens/dag | 105+ Modelle | ✅ OpenAI |
| **SeekAI** | $200 | GPT-6 Astra, Claude Fable 5.1 | ✅ OpenAI |
| **Vyce AI** | $50 + $10/dag | 105+ Modelle | ✅ OpenAI |
| **Requesty** | 200 req/day | 600+ Modelle | ✅ OpenAI |
| **NVIDIA NIM** | Free (80 models) | DeepSeek, Kimi K2.6, GLM | ✅ OpenAI |
| **GitHub Models** | 150K tok/mo | GPT-4o, GPT-4.1, Claude | ✅ OpenAI |
| **LM Studio** | Local (gratis) | Llama, Qwen, DeepSeek | ✅ OpenAI |
| **FreeLLMAPI** | Free (34 providers) | DeepSeek, Qwen, Llama | ✅ OpenAI |
| **APInex** | Free (Code: T4GFQTSX) | 34+ Provider | ✅ OpenAI |
| **FreeModel** | Free | OpenAI/Anthropic compat | ✅ |
| **iFlow** | $5 + 2.5M tok | Kimi K2, GLM-4.6, Qwen3 | ✅ OpenAI |
| **Eden AI** | Free credits | 500+ Modelle | ✅ OpenAI |

**Bereits integriert:** OpenRouter (Free Models), TokenHarbor ($5), OpenAI ($5),
Google Gemini (Unlimited), Anthropic ($5), DeepSeek (Unlimited), Mistral (Unlimited),
Groq (Unlimited), Together AI ($100), xAI/Grok ($25 + $150/mo)

**Noch offen:** Continue, Roocode, Roo, Hermes, OpenClaw, Jcode, Pi (lokal-disk
Credential-Reader für Legacy-IDEs); Playground, manuelle Modell-Eingabe.
