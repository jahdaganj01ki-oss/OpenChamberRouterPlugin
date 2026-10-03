# HANDOFF — Android-App: GitHub-Repository-IDE mit integrierter Codespaces-Umgebung

> **Für die übernehmende KI:** Lies dieses Dokument vollständig, bevor du Code
> schreibst. Abschnitt 3 enthält Befunde, die nicht im Auftrag stehen und die
> Architektur entscheiden. Abschnitt 13 ist ein bindender Ehrlichkeitsvertrag.
> Es existiert **null** Implementierungscode zu diesem Projekt — du fängst bei
> Null an.

---

## 0. Lage in einem Satz

Eine native Android-App (Kotlin/Compose) bauen, in der ein Nutzer sich bei GitHub
anmeldet, ein Repository auswählt oder erstellt, einen Codespace verwaltet und
VS-Code **in einer eingebetteten WebView** bearbeitet, plus Integration von
Coding-Agenten (Cline/Kilo Code) und eine installierbare APK.

**Stand:** Machbarkeitsanalyse abgeschlossen. Kein Code geschrieben. Kein APK.
Sie übernimmst die komplette Umsetzung.

**Wo der Code hin soll:** in ein **neues, eigenes Repository**, nicht in das
OpenChamber-Router-Projekt (das ist ein anderes Vorhaben). Lege es an, klon es
in den Codespace, und arbeite dort.

**Vorgesehene Fortsetzungsumgebung:** GitHub Codespace, Modell „Space Bunny
Free". Nutzer: Windows, `C:\Users\<user>\AppData\Local\Temp` als Temp-Verzeichnis,
deutschsprachige Oberfläche und deutschsprachige Dokumentation/Kommentare sind
erwünscht (der Nutzer kommuniziert auf Deutsch).

---

## 1. Die ursprüngliche Anforderung (vollständig, unverändert)

### 1. GitHub-Authentifizierung

Implementiere eine sichere GitHub-Anmeldung mit OAuth 2.0 oder GitHub Device Flow.

Die App muss ermöglichen:

- Anmeldung mit einem GitHub-Konto
- Abmeldung
- Wechsel zu einem anderen GitHub-Konto
- vollständiges Entfernen lokaler Sitzungsdaten beim Kontowechsel
- Anzeige des aktuell angemeldeten Accounts
- sichere Speicherung von Tokens, zum Beispiel im Android Keystore
- niemals Speicherung von Zugriffstokens im Klartext
- Anforderung ausschließlich der notwendigen GitHub-Berechtigungen

Nach der Anmeldung soll die App über die GitHub API auf folgende Funktionen zugreifen können:

- Repositories des Benutzers auflisten
- vorhandenes Repository auswählen
- neues Repository erstellen
- Repository-Namen, Beschreibung und Sichtbarkeit festlegen
- optional einen Default-Branch auswählen

### 2. Repository-Auswahl und Erstellung

Nach erfolgreicher Anmeldung soll der Nutzer zwischen zwei Optionen wählen können:

#### Vorhandenes Repository verwenden

- Liste aller verfügbaren Repositories anzeigen
- Such- und Filterfunktion bereitstellen
- Repository auswählen
- Standard-Branch oder einen anderen Branch auswählen

#### Neues Repository erstellen

Der Nutzer soll folgende Daten eingeben können:

- Repository-Name
- optionale Beschreibung
- öffentlich oder privat
- optional: Repository mit README initialisieren
- optional: `.gitignore`-Vorlage auswählen
- optional: Lizenz auswählen

Nach der Erstellung soll das Repository automatisch ausgewählt und für die Entwicklungsumgebung vorbereitet werden.

### 3. GitHub-Codespaces-Integration

Das ausgewählte Repository soll in einem GitHub Codespace geöffnet werden.

Wichtig:

- Der Codespace darf nicht einfach in einer externen Browser-App geöffnet werden.
- Die Benutzeroberfläche soll innerhalb der Android-App angezeigt werden.
- Vor dem Öffnen soll geprüft werden, ob für den Nutzer ein Codespace erstellt werden kann.
- Bereits vorhandene Codespaces sollen erkannt und wiederverwendet werden können.
- Der Nutzer soll einen neuen Codespace erstellen oder einen bestehenden auswählen können.
- Statusinformationen wie „wird erstellt", „läuft", „wird gestoppt" oder „Fehler" sollen angezeigt werden.
- Die App soll das Starten, Stoppen und Neustarten eines Codespaces ermöglichen.

### 4. Technische Darstellung der Entwicklungsumgebung

Prüfe zunächst die technische Machbarkeit der Codespaces-Integration auf Android.

GitHub Codespaces basiert grundsätzlich auf einer browserbasierten Visual-Studio-Code-Umgebung. Deshalb soll die App eine der folgenden Lösungen verwenden:

1. eine eingebettete, sichere WebView mit einer optimierten Codespaces-Oberfläche, oder
2. eine geeignete native beziehungsweise hybride Editor-Komponente, die mit dem entfernten Codespace kommuniziert.

Die Entwicklungsumgebung muss innerhalb der App erscheinen und darf nicht ungefragt in Chrome oder einem anderen externen Browser geöffnet werden.

Berücksichtige dabei:

- Touch-Bedienung
- virtuelle Tastatur
- externe Bluetooth-Tastatur
- Dateiexplorer
- Terminal
- Editor
- Tabs
- Suche
- Autovervollständigung
- Git-Status
- Commit und Push
- Logs und Fehlermeldungen
- Hoch- und Querformat
- unterschiedliche Bildschirmgrößen

### 5. Unterstützung von Coding-Agenten

Die App soll die Nutzung von Coding-Agenten wie Cline oder Kilo Code ermöglichen.

Prüfe dabei zuerst, ob diese Tools direkt in einem GitHub Codespace installiert und als VS-Code-Erweiterungen ausgeführt werden können.

Falls eine direkte Installation nicht möglich ist, implementiere eine vergleichbare Agenten-Integration über eine eigene Benutzeroberfläche.

Die App soll:

- die Installation beziehungsweise Aktivierung unterstützter Coding-Agenten ermöglichen
- API-Schlüssel sicher entgegennehmen
- API-Schlüssel verschlüsselt speichern
- mehrere Anbieter unterstützen, zum Beispiel OpenAI, Anthropic oder OpenRouter
- API-Schlüssel jederzeit ändern und löschen lassen
- niemals API-Schlüssel in Logs, Git-Repositories oder Fehlermeldungen ausgeben
- eine Auswahl des verwendeten Modells ermöglichen
- Tokenverbrauch und mögliche Kosten transparent anzeigen
- den Coding-Agenten auf Wunsch auf bestimmte Dateien oder Ordner beschränken
- Änderungen vor dem Anwenden anzeigen
- Änderungen akzeptieren, ablehnen oder rückgängig machen können

### 6. Entwicklungsfunktionen

Die App soll die Entwicklung folgender Projekte ermöglichen:

- Android-Apps
- Java- und Kotlin-Projekte
- Gradle-Projekte
- Webanwendungen
- Backend-Anwendungen
- Windows-Anwendungen, soweit diese im entfernten Codespace technisch gebaut werden können

Beachte: Eine Android-App kann Windows-Anwendungen nicht direkt nativ auf dem Android-Gerät kompilieren oder ausführen. Für Windows-Projekte soll daher der entfernte Codespace beziehungsweise ein geeigneter Build-Server verwendet werden.

### 7. Sicherheit

Implementiere mindestens folgende Sicherheitsmaßnahmen:

- OAuth beziehungsweise Device Flow statt Speicherung von GitHub-Passwörtern
- Android Keystore für sensible Daten
- verschlüsselte lokale Speicherung
- sichere WebView-Konfiguration
- keine unnötigen Berechtigungen
- Schutz vor JavaScript- und URL-Injection
- Prüfung erlaubter Domains
- sichere Behandlung abgelaufener Tokens
- verständliche Fehlermeldungen ohne geheime Daten
- Möglichkeit, alle lokalen Zugangsdaten und Sitzungen zu löschen

### 8. Benutzeroberfläche

Erstelle eine moderne, übersichtliche Android-Oberfläche nach Material Design.

Wichtige Ansichten:

1. Startbildschirm
2. GitHub-Anmeldung
3. Account-Auswahl und Account-Wechsel
4. Repository-Auswahl
5. Repository-Erstellung
6. Codespace-Auswahl und Status
7. integrierte Entwicklungsumgebung
8. Agenten- und API-Key-Einstellungen
9. App-Einstellungen
10. Hilfe- und Fehleransichten

Die App soll auch bei instabiler Internetverbindung verständliche Zustände anzeigen und keine Daten stillschweigend verlieren.

### 9. Projektanforderungen

Verwende vorzugsweise:

- Kotlin
- Jetpack Compose
- moderne Android-Architektur, zum Beispiel MVVM oder Clean Architecture
- Jetpack Navigation
- Kotlin Coroutines
- sichere lokale Datenspeicherung
- klar getrennte Schichten für UI, Authentifizierung, GitHub API, Codespaces und Agenten

Erstelle:

- vollständigen Quellcode
- Gradle-Konfiguration
- benötigte Android-Berechtigungen
- Konfigurationsdateien
- README mit Setup-Anleitung
- Anleitung zum Erstellen der APK
- Anleitung zum Einrichten der GitHub OAuth-App
- Dokumentation der benötigten GitHub-Berechtigungen
- Testkonzept
- Unit- und Integrationstests
- Fehlerbehandlung
- Beispielkonfiguration ohne echte API-Schlüssel

### 10. Vorgehensweise

Arbeite in folgenden Schritten:

1. Führe zunächst eine Machbarkeitsanalyse durch.
2. Benenne alle Einschränkungen von GitHub Codespaces, Android WebViews und VS-Code-Erweiterungen.
3. Schlage eine realistische Architektur vor.
4. Erstelle ein MVP mit:
   - GitHub-Anmeldung
   - Account-Wechsel
   - Repository-Auswahl
   - Repository-Erstellung
   - Codespace-Erstellung beziehungsweise Auswahl
   - integrierter Codespaces-Oberfläche
5. Implementiere danach die Agenten-Integration.
6. Ergänze Sicherheitsmaßnahmen und Tests.
7. Erstelle anschließend eine installierbare APK.
8. Dokumentiere genau, welche Funktionen vollständig funktionieren und welche nur über einen Workaround möglich sind.

Behaupte keine Funktion als vollständig implementiert, wenn sie technisch nur über einen Browser, eine WebView oder einen zusätzlichen Backend-Dienst realisierbar ist. Weise ausdrücklich darauf hin, wenn für die Umsetzung ein eigener Server, ein GitHub-Partnerzugang, zusätzliche API-Berechtigungen oder kostenpflichtige Dienste erforderlich sind.

---

## 2. Umgebungsanalyse — warum der Umzug in einen Codespace richtig ist

Am Rechner, an dem diese Analyse entstanden ist, wurde gemessen:

| Werkzeug | Befund |
| --- | --- |
| `java -version` | **1.8.0_503** |
| `JAVA_HOME` | leer |
| Android SDK (`ANDROID_HOME`, `~/AppData/Local/Android/Sdk`, `C:\Android\Sdk`) | **nicht vorhanden** |
| `gradle` | **nicht gefunden** |
| `adb` | nur als Nebendatei im scrcpy-Paket, kein SDK |
| Freier Speicher C: | 184 GB |
| Netzwerkzugriff auf `dl.google.com`, `api.adoptium.net`, `services.gradle.org`, Google Maven, Maven Central | **alle erreichbar** |

**Schlussfolgerung:** Auf dieser Maschine ist kein Android-Build möglich — es
fehlen JDK 17 (AGP 8.x braucht 17+), das Android SDK und Gradle. Die Toolchain
wäre zwar nachinstallierbar, wäre aber langsam und unzuverlässig.

**Ein GitHub Codespace löst genau das.** Ein Codespace ist eine Linux-VM mit
vorbereiteter Toolchain, dauerhaft verfügbar, mit großzweißig Gigabyte
Standardplattenplatz und ohne dieses ständige Installieren. Deshalb ist der
Umzug fachlich richtig, nicht nur bequem.

### 2.1 Was im Codespace fehlt oder zu tun ist

Ein Standard-`ubuntu`-Codespace bringt JDK, Python, Node und Docker mit —
**kein Android SDK**. Lege deshalb ein eigenes Devcontainer-Feature auf:

`.devcontainer/devcontainer.json`

```json
{
  "name": "Codespace IDE (Android)",
  "image": "mcr.microsoft.com/devcontainers/base:ubuntu-24.04",
  "features": {
    "ghcr.io/devcontainers/features/java:1": { "version": "17", "installMaven": "false", "installGradle": "false" },
    "ghcr.io/devcontainers/features/android:1": {}
  },
  "postCreateCommand": "bash .devcontainer/setup.sh",
  "customizations": {
    "vscode": {
      "extensions": ["jetbrains.kotlin", "mathiasfrohlich.android-studio-pack", "ms-vscode-ktlint"]
    }
  },
  "remoteUser": "codespace"
}
```

`.devcontainer/setup.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
mkdir -p "$ANDROID_HOME"

# Licenzen annehmen – ohne das schlägt jeder sdkmanager-Aufruf fehl.
yes | sdkmanager --licenses > /dev/null 2>&1 || true

sdkmanager "platform-tools" "platforms;android-35" "build-tools;35.0.0" || true
```

**Plattenplatz beachten:** Android SDK, Gradle-Distribution und
Gradle-/Maven-Caches belegen leicht 10–15 GB. Wenn der Codespace auf 32 GB
begrenzt ist, sollte im devcontainer ein Cache-Verzeichnis auf
`/workspaces/<name>/.gradle` gelegt werden, nicht auf `~/.gradle` im
Container-Overlay.

---

## 3. Machbarkeitsanalyse — die harten Befunde

Das ist der wichtigste Teil. Der Auftrag enthält eine unrealistische
Erwartung („innerhalb der App, nicht im Browser"). Diese Analyse sagt dir, wo
die Grenze verläuft, damit du sie nicht versehentlich überschreibst.

### 3.1 Codespaces-Lebenszyklus: vollständig über REST möglich — ✅ real

Der Codespace-Teil der App braucht **keine** WebView. Er ist reine REST-API und
funktioniert mit dem Token aus dem Device Flow, sofern der Scope `codespace`
erteilt wurde.

Geprüfte Endpunkte (GitHub REST API, Dokumentation bestätigt):

| Zweck | Endpunkt |
| --- | --- |
| Codespaces auflisten | `GET /user/codespaces` |
| Details | `GET /user/codespaces/{codespace_name}` |
| Anlegen | `POST /user/codespaces` |
| Anlegen für ein Repo | `POST /repos/{owner}/{repo}/codespaces` |
| Starten | `POST /user/codespaces/{codespace_name}/start` |
| Stoppen | `POST /user/codespaces/{codespace_name}/stop` |
| Löschen | `DELETE /user/codespaces/{codespace_name}` |
| Maschinentypen | `GET /user/codespaces/{codespace_name}/machines` |

`POST /user/codespaces` akzeptiert u. a.: `repository_id`, `ref` (d. h. der
Branch!), `geo`, `machine`, `devcontainer_path`, `multi_repo_permissions_opt_out`,
`working_directory`, `idle_timeout_minutes`, `display_name`.

**Wichtig für den Status:** Der Response enthält ein `state`-Feld mit Werten wie
`Available`, `Provisioning`, `Starting`, `Stopping`, `Stopped`, `Queued`,
`Updating`, `ShuttingDown`, `Unavailable`. Der Anwendungszustand „wird
erstellt / läuft / wird gestoppt / Fehler" wird **ausschließlich** aus diesem
Feld abgeleitet. Erfinde keine eigene Statuslogik — das Feld ist die Wahrheit.

**Die Web-URL kommt aus der API**, nicht aus einer selbstgebauten
Konstruktion. Jedes Codespace-Objekt hat ein `web_url`. Verwende das
unverändert. Eine selbst zusammengebaute URL wird falsch sein, sobald sich
das URL-Schema ändert.

### 3.2 „Kann der Nutzer einen Codespace erstellen?" — nur eingeschränkt prüfbar

Der Auftrag verlangt eine Vorabprüfung. Es gibt **kein** dediziertes
„darf ich Codespaces anlegen"-Endpoint. Was tatsächlich möglich ist:

- `GET /user/codespaces` zeigt bestehende Codespaces und damit implizit ein
  etwaiges Kontingent.
- Für Organisationen existiert
  `GET /orgs/{org}/settings/permissions/selected-actions`, mit dem sich die
  Codespaces-Berechtigung prüfen lässt.
- Der zuverlässigste Weg bleibt: Anlegen anstoßen und die API-Fehlermeldung
  ehrlich anzeigen (402 = Kontingent erschöpft, 403 = Berechtigung,
  404 = Repo unterstützt Codespaces nicht, Org-Policy verboten).

**Umsetzung:** Zeige eine „Prüfen"-Aktion, die das auflistet, was prüfbar ist,
und benenne danach klar, was erst der Versuch zeigen kann. Behaupte nicht,
eine Vorabprüfung gebe es.

**Kostenpflichtiger Dienst — vom Nutzer ausdrücklich gefordert zu nennen:**
Codespaces sind ein **kostenpflichtiger Dienst** mit monatlichem Kontingent
(bei privaten Konten in der Größenordnung 120 Kernstunden, kleine
Zweikern-Maschinen). Private Repositories in öffentlichen Tarifen können
zusätzlich Speicher kosten. Die App muss vor dem ersten Anlegen sichtbar
 machen, dass das Konto Guthaben benötigt, und darf es nicht verschweigen.

### 3.3 Der Editor in der WebView — das eigentliche Problem ⚠️

Das ist der Punkt, an dem der Auftrag überzogen ist. Zwei unabhängige
Blocker:

**Blocker A — GitHub blockt OAuth in eingebetteten WebViews.**
GitHub folgt hier RFC 8252: OAuth-Anmeldungen in eingebetteten
WebView-Benutzeragenten werden bewusst abgelehnt, weil der Host die Seite
kontrolliert (JavaScript-Injektion, Cookies, Tastatureingaben). Dasselbe gilt
für Google, Apple und Microsoft. Das ist keine Android-Eigenheit, sondern
Absicht des Anbieters.

*Konsequenz für die App:* Die Anmeldung der **App selbst** darf nicht über
eine WebView laufen. Deshalb ist Device Flow (Abschnitt 3.4) die richtige
Wahl — der Nutzer bestätigt den Code auf github.com im echten Browser, die App
bekommt nur den Code.

**Blocker B — das Token der App autorisiert den Editor nicht.**
Die Codespaces-Weboberfläche (`*.github.dev`) authentifiziert sich über eine
**github.com-Browsersitzung (Cookie)**. Das OAuth-Token, das deine App hält,
ist ein API-Token für REST-Aufrufe. Die VS-Code-Weboberfläche akzeptiert
**keinen** Bearer-Token und lässt sich damit nicht „einloggen".

*Das bedeutet konkret:* Die WebView hat **eine eigene, unabhängige Anmeldung
bei github.com**, die von der App-Anmeldung getrennt ist.

**Bewertete Lösungswege für Blocker B:**

| Variante | Bewertung |
| --- | --- |
| **1. Drittanbieter-Cookies aktivieren + WebView meldet sich selbst bei GitHub an.** | Funktioniert in der Praxis nur, wenn GitHub den WebView-Agenten nicht abweist. Ohne Garantie. Muss im MVP empirisch getestet und dann ehrlich als „Workaround" ausgewiesen werden. |
| **2. User-Agent auf einen Desktop-Browser setzen.** | Erhöht die Chance, von GitHub nicht als WebView abgewiesen zu werden. **Gleichzeitig** das, was Abschnitt 13 verbietet: es verschleiert, dass die Anmeldung nicht unter App-Kontrolle steht. Wenn du das tust, dokumentiere es als Sicherheits-relevanten Kompromiss, nicht als Detail. |
| **3. Chrome Custom Tabs / externer Browser.** | Der **von GitHub unterstützte** Weg. Funktioniert sicher. Verletzt aber die Vorgabe „nicht ungefragt extern". |

**Empfehlung:** Baue **1** als Standard, miss es ehrlich, halte **3** als
ausdrücklich benannten, vom Nutzer bewusst ausgelösten Ausgang („In
externem Browser öffnen"), und verstecke nicht, dass es den gibt. Wenn **1**
scheitert, ist das ein **befundetes Ergebnis**, kein Implementierungsfehler —
und genau so muss es im Abschlussbericht stehen.

### 3.4 Device Flow — die Details, die man falsch macht

Das Protokoll ist nicht schwierig, hat aber drei Fallen. Alle drei sind in
anderen Projekten schon als Bug aufgetreten:

**Endpunkte**

```
POST https://github.com/login/device/code
     client_id=<OAuth-App-Client-ID>
     scope=<leerzeichen-getrennt>

→ device_code, user_code, verification_uri, expires_in, interval

POST https://github.com/login/oauth/access_token
     client_id=<OAuth-App-Client-ID>
     device_code=<device_code>
     grant_type=urn:ietf:params:oauth:grant-type:device_code

→ access_token  (bei Fehler: error, error_description)
```

**Kein Client Secret.** Device Flow ist für öffentliche Clients, die App hält
kein Secret. Deshalb funktioniert der Flow ohne geheime Gegenstelle — und
deshalb ist er für eine verteilte App der richtige Weg.

**Fall 1 — `verification_uri_complete`.** GitHub liefert zusätzlich oft eine
fertige URL mit dem Code eingebettet. Die **musst du anzeigen** und
ANKlickbar machen. Zeigst du nur `verification_uri` und lässt den Nutzer den
Code abtippen, ist das ein vermeidbarer Abbruchgrund. Erreichbarkeit prüfen:
auf github.com öffnen und `verification_uri_complete` **nicht** verwenden, wenn
es leer ist.

**Fall 2 — der Takt.** `interval` aus der Antwort gilt als Mindestabstand. Wer
schneller fragt, bekommt `slow_down` und muss den Abstand **um 5 Sekunden
erhöhen**, dauerhaft. Pollt man trotzdem zu schnell, kann der Vorgang
unbegrenzt hängen bleiben. Genau dieser Fehler ist in einem anderen Projekt
Wochenlang unbemerkt geblieben, weil „noch nicht bestätigt" und „zu schnell
gefragt" im UI identisch aussahen.

**Fall 3 — Ablauf.** Nach `expires_in` abgelaufene `device_code`s enden mit
`expired_token`. Behandle ihn als eigenen Zustand („Code abgelaufen, neu
starten"), nicht als generischen Fehler.

**Anforderung an dich:** Jede dieser drei Antworten muss im UI **unterscheidbar**
sein. Baue dafür einen Test.

### 3.5 Scopes — und die Berechtigung, die wehtut

Für einen **OAuth App Token** (nicht Fine-Grained PAT) sind die Scopes
klassisch und grob:

| Scope | Wofür | Bewertung |
| --- | --- | --- |
| `read:user` | Konto anzeigen | minimal, unbedenklich |
| `repo` | Repos auflisten **und anlegen**, Contents lesen/schreiben | **weit gefasst**: umfasst Lese- und Schreibzugriff auf alle privaten Repositories |
| `codespace` | Codespace-Lebenszyklus | exakt das Nötige |
| `read:org` | Repositories der Organisation listen | nur falls Organisations-Repos unterstützt werden sollen |
| `workflow` | Workflow-Dateien ändern | **nicht anfordern**, solange die App das nicht tut |

**Die ehrliche Spannung:** Der Auftrag fordert „ausschließlich die notwendigen
Berechtigungen". `repo` ist das bei weitem größte Recht, das du für „Repo
anlegen" brauchst — und Fine-Grained-Permissions gibt es für OAuth Apps
**nicht**, nur für Personal Access Tokens. Du kannst also nicht beides haben.

**Lösung, die ich empfehle:** Device Flow **und** die Möglichkeit, stattdessen
einen **Fine-Grained PAT** einzufügen. Der Nutzer wählt die Authentifizierungsart.
Dokumentiere in der README beide Wege samt Berechtigungen. Das ist die einzige
Möglichkeit, dem Nutzer die minimalen Rechte tatsächlich zu geben.

### 3.6 Coding-Agenten: real im Codespace, aber nicht vom Gerät steuerbar

**Befund:** Cline und Kilo Code (ein Cline-Fork) sind **VS-Code-Erweiterungen**.
Sie laufen in einem Codespace genau so, wie sie in VS Code laufen. Installation
über den Extensions-View in der Weboberfläche oder über das Terminal im
Codespace (`code --install-extension <id>`). **Das ist real und funktioniert.**

**Die Einschränkung, die den Auftrag betrifft:** Diese Erweiterungen laufen in
der **Cloud**, nicht auf dem Android-Gerät. Ihre API-Schlüssel liegen folglich
im Secret-Storage des Codespace, nicht in deiner App.

Daraus folgt zwingend:

- Die App kann Agenten **anbieten, anleiten und ihren Zustand anzeigen**
  (installiert ja/nein, aktiv, konfiguriert oder nicht).
- Die App kann ihre **eigenen** API-Schlüssel verschlüsselt auf dem Gerät
  speichern — aber dann sind das Schlüssel für einen **anwendungsinternen**
  Agenten, nicht für Cline im Codespace.
- **Es gibt keine Codespaces-REST-API, um Befehle im Codespace auszuführen.**
  Du kannst der Erweiterung also keinen Schlüssel von außen zustecken und
  keine `.vscode/settings.json` ferngesteuert schreiben, ohne in das Repository
  zu schreiben — und ein Schlüssel im Repository ist vom Auftrag ausdrücklich
  verboten.

**Was das für die Anforderung bedeutet** (Abschnitt 1.5 verlangt API-Key-
Verwaltung, Modellauswahl, Kostenanzeige, Änderungsdiff, Akzeptieren/Ablehnen):

| Anforderung | Im Codespace real? |
| --- | --- |
| Installation/Aktivierung | ✅ ja, Extensions-View |
| Anbieter (OpenAI/Anthropic/OpenRouter) | ✅ die Erweiterung bringt sie mit |
| Modellauswahl | ✅ die Erweiterung |
| Änderungen ansehen/akzeptieren/ablehnen | ✅ die Erweiterung (Diff-Ansicht) |
| Schlüssel **in der App** sicher speichern | ✅ ja, für einen anwendungsinternen Agenten |
| Schlüssel **in den Codespace-Agenten** bringen | ❌ nein, kein Exec-API |
| Tokenverbrauch/Kosten **in der App** anzeigen | ❌ nein, die Nutzungsdaten entstehen im Codespace |

**Empfehlung:** Zwei klar getrennte Bereiche bauen und beide benennen —
(a) „Agenten im Codespace" mit Anleitung und Zustandsanzeige, (b) optional ein
**eigener, anwendungsinterner** Agent, für den die Schlüsselverwaltung auf dem
Gerät echt ist. Für (b) ist allerdings ein **eigener Server** oder zumindest
ein vom Gerät erreichbarer Inferenz-Endpunkt nötig, um Dateien zu lesen und zu
schreiben — das Gerät hat keinen Codespace-Zugriff von unten. Das musst du
entweder zusätzlich zu einem Server bauen oder als nicht realisierbar
ausweisen.

### 3.7 Bekannte Android-spezifische Fehler in der VS-Code-Weboberfläche

Für die Anforderungen „virtuelle Tastatur" und „Touch-Bedienung" gibt es einen
konkreten, dokumentierten Befund: In der browserbasierten VS-Code-Umgebung aus
einem Codespace werden auf Android **Enter und Escape der virtuellen Tastatur
in Quick-Input-Feldern ignoriert**. Betroffen sind dadurch unter anderem:

- die Command Palette
- das Anlegen von Branches
- Suchdialoge
- Anmeldeaufforderungen von Erweiterungen

Das Filtern, Bearbeiten und alle rein tappbaren Oberflächen funktionieren
dagegen normal. Eine **externe Bluetooth-Tastatur** umgeht es weitgehend, weil
sie ein echtes Esc liefert. Das ist relevant genug, um in der README und in der
App-UI (Reiter „IDE") einen sichtbaren Hinweis aufzunehmen.

Ebenfalls beobachtet: Fehler beim Laden von Erweiterungs-Webviews
(„Could not register service worker") treten in Chromium-Browsern und
vermutlich auch in WebViews auf. Wenn du Webviews von Erweiterungen testest,
sei auf das vorbereitet.

### 3.8 Windows-Projekte

Codespaces sind **Linux-Container**. Ein Windows-Projekt lässt sich dort nicht
bauen. Der Auftrag erkennt das an. Realistische Umsetzung:

- **Möglich:** ein GitHub-Actions-Workflow in einem Windows-Runner
  (`runs-on: windows-latest`), den die App per Contents-API anlegt.
- **Nicht möglich:** Windows-Build „im Codespace".
- **Kostenpflichtig und authentifizierungspflichtig:** Actions-Minuten.
  Selbst-hosted Windows-Runner sind für private Repos bezahlpflichtig.

Sage das in der Statusmatrix klar.

### 3.9 Einschränkungen — Übersicht

| # | Einschränkung | Auswirkung |
| --- | --- | --- |
| 1 | GitHub blockt OAuth in WebViews | App-Anmeldung nur per Device Flow |
| 2 | Codespace-Editor authentifiziert per Cookie, nicht per API-Token | Editor-Anmeldung ist von der App-Anmeldung getrennt |
| 3 | Keine Exec-API für Codespaces | Agentenschlüssel können nicht ferngesteuert werden |
| 4 | Codespaces sind kostenpflichtig, Kontingent | muss vor dem ersten Anlegen sichtbar sein |
| 5 | Kein offizieller „darf ich anlegen"-Check | nur Versuch + Fehlermeldung |
| 6 | `repo`-Scope umfasst alle privaten Repos | Feinrechte nur per PAT, nicht per OAuth App |
| 7 | Enter/Escape der virtuellen Tastatur defekt in Quick-Input | Bedienhinweis nötig, BT-Tastatur als Umgehung |
| 8 | Erweiterungs-Webviews können am Service Worker scheitern | betrifft Cline-Ansichten in der Weboberfläche |
| 9 | Codespace-URLs kommen aus der API | nie selbst konstruieren |
| 10 | Ein Codespace, ein Gerät, aber mehrere Nutzer | Session- und Cookie-Trennung pro Konto |

---

## 4. Realistische Architektur

Schichten, sauber getrennt, wie im Auftrag verlangt:

```
:app                    Compose-UI, Navigation, WebView-Host
:core:model             Datenklassen, sealed Results, Fehler
:core:secure            Keystore, verschlüsselte Ablage, Rotationslogik
:data:github            REST-Client, Repos, Branches, Codespaces
:data:auth              Device Flow, Token-Lebenszyklus, Kontoverwaltung
:data:agents            Anbieter, Schlüssel, Modelllisten, Kostenrechnung
:feature:*              je ein ViewModel + Screen (auth, repos, codespace, ide, agents, settings)
```

**Technische Grundsätze:**

- **Repository + Use-Case-Klassen + ViewModel.** Kein Android-Framework in
  `data`. `data` kennt kein `Context`.
- **Fehler als Typen, nicht als Strings.** `sealed class Fehler { TokenAbgelaufen,
  KeinNetz, Ratebegrenzt, Serverfehler(code), Unbekannt }` — damit die UI
  verstehen kann, ob ein erneuter Versuch hilft.
- **Alle Netzwerkzugriffe über Coroutines mit `Dispatchers.IO`**, mit Timeout
  und begrenztem Retry. Kein `runBlocking` im UI-Thread.
- **Ein `HttpClient` (OkHttp) ganz unten**, mit eigenem Interceptor, der
  **niemals** den `Authorization`-Header loggt. Das ist die einzige Stelle, an
  der das überhaupt passieren kann — also die Stelle, die zuerst zu prüfen ist.
- **Secrets nie im `savedInstanceState`, nie im `Intent`, nie in Logs.**
  Wenn ein Prozess abstürzt, müssen sie wieder da sein — aus dem Keystore, nicht
  aus dem Bundle.

### 4.1 Token-Speicherung

- **Schlüssel:** Android Keystore (`KeyGenParameterSpec`, `AES/GCM/NoPadding`,
  `setUserAuthenticationRequired(false)`).
- **Ablage:** `EncryptedSharedPreferences` (AndroidX Security) oder
  `Cipher`-verschlüsselte Datei. **Nie** unverschlüsselte
  SharedPreferences, **nie** eine `.properties`-Datei, **nie** DataStore im
  Klartext.
- **Kontowechsel:** Der Keystore-Schlüssel wird neu erzeugt, alle Sitzungsdaten
  werden gelöscht. Danach ist nachweisbar nichts mehr vom alten Konto da.
- **Abgelaufene Tokens:** `401` bedeutet **einmal** neu per Device Flow
  einloggen, nicht den Token stillschweigend weiterverwenden. Zweimal hintereinander
  `401` → abmelden und dem Nutzer einen Grund nennen.

---

## 5. GitHub-OAuth-App einrichten

1. GitHub → **Settings** → **Developer settings** → **OAuth Apps** →
   **New OAuth App**.
2. **Application name:** z. B. „Codespace IDE".
3. **Homepage URL:** beliebig, z. B. die Repository-URL. Pflichtfeld, wird aber
   vom Device Flow nicht benutzt.
4. **Authorization callback URL:** für Device Flow irrelevant, es muss aber ein
   gültiger Wert stehen (z. B. `https://github.com/login/oauth/callback`).
5. App speichern → **Client ID** notieren. **Ein Client Secret wird für den
   Device Flow nicht benötigt und darf nicht im Code stehen.**
6. In den App-Einstellungen der App hinterlegen. Für den Store:
   `local.properties` → `GITHUB_CLIENT_ID=…` (in `.gitignore`).
7. **Unbedingt prüfen, ob GitHub die „Device Flow"-Funktion für die App
   freigeschaltet hat** — sie ist ein eigener Schalter in den App-Einstellungen,
   nicht automatisch aktiv.

---

## 6. Android-Berechtigungen

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

Das ist alles. **Kein** Speicher, **keine** Kamera, **kein** Mikrofon, **keine**
Standortberechtigung. Werden weitere verlangt, muss das im Manifest begründert
sein. Insbesondere braucht die App **keinen** Zugriff auf den lokalen Speicher —
alles liegt entweder im Keystore oder in der Cloud.

---

## 7. WebView-Härtung (der sicherheitskritischste Teil)

Der Editor läuft im WebView. Der WebView ist damit praktisch ein Browser mit
deinen Rechten. Deshalb:

```kotlin
WebView(context).apply {
    settings.apply {
        javaScriptEnabled = true      // unvermeidbar für VS Code Web
        domStorageEnabled = true      // unvermeidbar
        databaseEnabled = true
        mediaPlaybackRequiresUserGesture = true
        // alles andere aus:
        allowFileAccess = false
        allowContentAccess = false
        allowFileAccessFromFileURLs = false
        allowUniversalAccessFromFileURLs = false
        javaScriptCanOpenWindowsAutomatically = false
        setGeolocationEnabled(false)
        setSupportMultipleWindows(false)
        mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        cacheMode = WebSettings.LOAD_DEFAULT
    }
    CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)
    webViewClient = object : WebViewClient() {
        override fun onReceivedSslError(v: WebView?, h: SslErrorHandler?, e: SslError?) {
            h?.cancel()  // niemals proceed()
        }
        override fun shouldInterceptRequest(v: WebView?, r: WebResourceRequest?) =
            if (erlaubt(r?.url)) null else WebResourceResponse("text/plain", "utf-8", null)
        override fun shouldOverrideUrlLoading(v: WebView?, r: WebResourceRequest?) =
            if (erlaubt(r?.url)) false else { true }  // nicht erlaubt → blockieren
    }
}
```

**Erlaubte Domains.** Baue eine **explizite Positivliste** und blockiere alles
andere. Erlaubt sind mindestens:

- `*.github.dev`
- `github.com`, `api.github.com`, `codeload.github.com`
- `*.githubusercontent.com`, `*.githubassets.com`
- `*.githubcopilot.com` (Agenten/OAuth der Erweiterungen)

Alles andere wird blockiert und **geloggt** (nur die URL, nie Inhalte).

**Drittanbieter-Cookies.** Für den Codespace-Login nötig. Sie sind zugleich das
größte Risiko der Architektur — dokumentiere das.

**Keine JS-Injektion von Geheimnissen.** Es ist verlockend, den Agentenschlüssel
per `evaluateJavascript` in die Seite zu schieben. **Nicht tun.** Damit landet der
Schlüssel im JavaScript-Kontext der Seite und ist für jede Erweiterung und für
jedes Skript in diesem Codespace lesbar. Genau das verbietet der Auftrag.

**Back-Navigation.** `onBackPressed` muss in der WebView zuerst die History
zurückgehen und erst dann den Screen verlassen.

---

## 8. UI-Spezifikation

Compose + Material 3 + Jetpack Navigation. Zehn Ziele:

| Route | Bildschirm |
| --- | --- |
| `start` | Start: Konto, letztes Repo, letzter Codespace, Schnellzugriff |
| `auth` | Anmeldung, Gerätecode, Fortschritt |
| `accounts` | Konto anzeigen, wechseln, abmelden, Sitzungsdaten löschen |
| `repos` | Liste mit Suche/Filter, Auswahl, Branch-Auswahl |
| `repo/new` | Erstellung inkl. README, `.gitignore`, Lizenz, Sichtbarkeit |
| `codespaces` | Liste, Status, anlegen, starten, stoppen, neu starten, löschen |
| `ide` | WebView-Editor, Ladezustand, Fehlerzustand, Ausstieg |
| `agents` | Anbieter, Schlüssel, Modelle, Kosten, Umfang, Diff |
| `settings` | Client-ID, Netzwerk, Kontingent-Hinweis, alle Daten löschen |
| `help` | Hilfe, bekannte Einschränkungen, Fehlerdiagnose |

**Verbindungslos.** Jede Netzscreen hat einen echten Leerzustand mit
Handlungsempfehlung. Nichts darf stillschweigend verschwinden. Fehlgeschlagene
Schreibvorgänge (Repo-Anlage, Codespace-Anlage) müssen sichtbar scheitern und
eine Wiederholung anbieten — **niemals** Erfolg vortäuschen.

**Rotation und Größen.** Zustand gehört ins `ViewModel`, nicht in die
Compose-`remember`. `rememberSaveable` nur für reine Eingabefelder. Die IDE ist
im Hochformat nutzbar, und Querformat darf sie nicht zerlegen.

---

## 9. Gradle- und Projektgerüst

Lege an (alle Versionsnummern bewusst modern, Stand 2026):

- `settings.gradle.kts` mit Plugin-Management und dependencyResolutionManagement
- `gradle/libs.versions.toml` — **eine** Quelle für alle Versionen
- AGP 8.x, Kotlin 2.x, Compose-BOM, `minSdk 26`, `targetSdk`/`compileSdk` 35
- `build.gradle.kts` mit **`buildConfig = true`**, damit `GITHUB_CLIENT_ID` aus
  `local.properties` in `BuildConfig` landet
- `.gitignore` mit `local.properties`, `*.jks`, `*.keystore`
- `proguard-rules.pro` mit Regeln für Retrofit/OkHttp/kotlinx-serialization —
  **und einem Test, der beweist, dass die release-Version funktioniert**
- `google-services.json` wird **nicht** gebraucht (kein Firebase)
- Package: `com.example.codespaceide` — **vor dem ersten Commit ändern**
- Minimum SDK 26: Für `EncryptedSharedPreferences` brauchst du eine Rückfalllösung
  für API 23–25. Prüfe das gegen die AndroidX-Doku für deine Version.

**Signing.** Ein Debug-APK ist ohne Keystore installierbar. Für eine
Release-APK brauchst du einen eigenen Keystore. Erzeug ihn **einmal**, sicher ihn
außerhalb des Repos, und schreibe **nie** die Passwörter ins Repo. Erwähne im
README, wie ein Release-Key erzeugt wird, ohne ihn zu erzeugen.

---

## 10. Testkonzept

Wichtigster Punkt: **Die meiste Logik ist ohne GitHub-Zugang testbar.**

| Ebene | Werkzeug | Beispiele |
| --- | --- | --- |
| Unit | JUnit5 / kotlin.test | Scopes, URL-Erzeugung, Zustandsableitung, Kostenrechnung |
| Unit | **MockWebServer** | Gerätfluss-Protokoll, `slow_down`, Ablauf, 401/403/429/5xx, Codespace-Statusübergänge |
| Unit | Robolectric | Keystore- und Ablageverhalten, ViewModel-Zustände |
| Instrumented | Compose UI Test | Navigation, Formularvalidierung, Zustände |
| Instrumented | Espresso | WebView-Erlaubtliste, SSL-Fehler |
| Sicherheit | eigener Test | kein Token in Log-Ausgaben; `HttpLoggingInterceptor` darf **nie** den Body loggen |

**Pflichttests, die den Auftrag direkt adressieren:**

1. Gerätefluss mit zu schnellem Polling muss `slow_down` korrekt behandeln.
2. `expired_token` muss als eigener Zustand erscheinen, nicht als allgemeiner Fehler.
3. Kontowechsel muss nachweisbar **alle** Sitzungsdaten entfernen.
4. Ein `401` darf nicht in einer Endlosschleife enden.
5. Die WebView-Erlaubtliste muss eine nicht erlaubte Domain blockieren.
6. `onReceivedSslError` muss abbrechen.
7. Ein Fehlerfall darf **nie** als Erfolg dargestellt werden.

---

## 11. Arbeitsplan

| Schritt | Inhalt | Fertig, wenn |
| --- | --- | --- |
| 0 | Repo anlegen, Devcontainer, Toolchain-Check | `sdkmanager --list` läuft, `./gradlew tasks` läuft |
| 1 | Gerüst, Navigation, Material-3-Design | App startet auf Emulator, leere Startseite |
| 2 | Keystore-Ablage + Unit-Tests | Tests grün, Token im Klartext nicht auffindbar |
| 3 | Gerätfluss + Kontoverwaltung | Anmeldung gegen echtes Konto möglich, Wechsel löscht alles |
| 4 | Repository-Liste/-Anlage inkl. MockWebServer-Tests | Anlage funktioniert, Fehler werden angezeigt |
| 5 | Codespace-API: Liste, Status, Anlegen, Start/Stopp | Statusübergänge korrekt in der UI |
| 6 | WebView-Scaffold + Härtung + Editor | Editor lädt **oder** der Fehler ist ehrlich dokumentiert |
| 7 | Agenten-Bereich nach Abschnitt 3.6 | beide Bereiche klar getrennt und benannt |
| 8 | Fehlerzustände, Offline-Verhalten, Hilfe | kein Pfad führt ins Leere |
| 9 | Tests, ProGuard, Debug-APK | `app-debug.apk` installierbar |
| 10 | README + Statusmatrix | jede Zeile der Matrix ist belegt |

**Reihenfolge nicht umstellen:** Schritt 6 ist experimentell. Wenn du vorher
Agenten und APK baust und dann feststellst, dass die WebView-Anmeldung
scheitert, war die Arbeit an anderer Stelle umsonst. Der Editor ist das
größte Risiko — finde es **früh** heraus, mit einem minimalen Prototyp, nicht
nach zehntausend Zeilen drumherum.

**Empfohlener erster Test für Schritt 6, noch vor dem ganzen Gerüst:** ein
winziges Projekt, das ausschließlich eine WebView mit einem Codespace-`web_url`
lädt und den Authentifizierungsweg beobachtet. Nichts anderes. Das beantwortet
Blocker B in einer Stunde statt in einer Woche.

---

## 12. Abnahmekriterien

1. `./gradlew assembleDebug` erzeugt eine installierbare APK ohne Warnung.
2. `bun`/`./gradlew test` läuft grün, ohne dass ein Token im Log steht.
3. Kein Geheimnis liegt im Repository oder in `local.properties` im Repo.
4. Der Kontowechsel hinterlässt nachweislich nichts.
5. **Jede Zeile der Statusmatrix in der README ist durch einen Test oder eine
   Messung belegt.** Keine Zeile darf auf Vermutung beruhen.

---

## 13. Ehrlichkeitsvertrag — bindend

Der Auftrag verlangt ausdrücklich, keine Funktion als vollständig zu
**behaupten**, wenn sie technisch nur über Browser, WebView oder Zusatzdienst
geht. Diese Formulierungen sind **unzulässig**, solange der Zustand nicht
gemessen ist:

| Nicht sagen | Sondern |
| --- | --- |
| „Die App meldet sich bei GitHub an." | „Die **App** meldet sich per Device Flow an. Der **Editor** im WebView hat eine eigene, davon getrennte Anmeldung bei github.com." |
| „Cline ist integriert." | „Cline lässt sich im Codespace installieren. Seine Schlüssel liegen in der Cloud; die App kann sie nicht setzen und nicht auslesen." |
| „Kosten werden angezeigt." | „Die App **rechnet** Kosten für den anwendungsinternen Agenten hoch. Die tatsächliche Abrechnung der Codespace-Nutzung erfolgt bei GitHub und ist für die App nicht sichtbar." |
| „Windows-Projekte werden gebaut." | „Windows-Builds laufen über einen GitHub-Actions-Runner, nicht im Codespace. Actions-Minuten sind ein kostenpflichtiger Dienst." |
| „Der Editor funktioniert." | Nur, wenn es **empirisch** verifiziert wurde — mit beschriebenem Testweg und Gerät/Emulator. |
| „Ein Check prüft, ob ein Codespace angelegt werden darf." | „Es gibt keinen solchen Endpunkt. Die App listet Bestehendes und zeigt beim Anlegen den echten Fehler." |

**Pauschale Formulierungen sind verboten**, wenn keine Messung dahintersteht.
Das gilt auch für Sicherheits- und Performanceaussagen.

## 13.1 Ehrlichkeitsvertrag in Codeform

Wenn du eine Einschränkung nicht lösen kannst, ist die **falsche**, aber
**nützliche** Umsetzung:

1. Funktion so bauen, wie sie gebaut werden muss.
2. **Direkt daneben** im UI benennen, was der Nutzer wissen muss.
3. In der README unter „Bekannte Einschränkungen“ dieselbe Aussage.
4. Im Abschlussbericht als nicht voll funktionsfähig ausweisen.

Ein sichtbarer Hinweis ist ein fertiges Feature. Eine verschwiegene
Einschränkung ist ein unfertiges.

---

## 14. Fragen, die du dem Nutzer stellen solltest

Diese Punkte kannst du nicht entscheiden. Frage **früh**, nicht am Ende:

1. **Client-ID:** Hast du schon eine OAuth-App angelegt, oder soll die
   README dich dazu anleiten?
2. **Authentifizierungsart:** Device Flow (empfohlen) **oder** Fine-Grained PAT
   (weniger Rechte, aber manuelles Kopieren)? Der Auftrag will minimale Rechte
   und schnelles Anmelden — das schließt sich hier aus.
3. **Editor-Anmeldung:** Wenn die WebView-Anmeldung scheitert — akzeptierst du
   den Weg über Custom Tabs mit einem erklärten Ausstieg, oder gilt die
   Vorgabe „kein externer Browser“ als unverhandelbar?
4. **Agenten:** Reichen Anleitung und Zustandsanzeige für Codespace-Agenten, oder
   wird ein eigener anwendungsinterner Agent mit eigenem Server gewünscht?
5. **Kosten:** Codespaces verbrauchen Guthaben. Soll die App vor dem ersten
   Codespace eine deutliche Kostenwarnung zeigen?

---

## 15. Was du **nicht** mitmachst

- Keine Umgehung von GitHubs OAuth-Sperre in WebViews durch Tarnung als
  Desktop-Browser, **außer** es wird als Sicherheitsrisiko benannt und der
  Nutzer hat es ausdrücklich abgesegnet.
- Kein Schlüssel im Repository, auch nicht verschlüsselt mit einem
  Schlüssel, der im selben Repository liegt.
- Kein Token im Logging, auch nicht „nur im Debug".
- Kein Feature als fertig melden, das nicht gemessen wurde.
- Keine erfundenen Codespace-URLs. Immer `web_url` aus der API.