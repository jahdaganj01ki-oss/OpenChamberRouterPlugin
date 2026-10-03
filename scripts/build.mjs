/**
 * Baut die drei Einstiegspunkte. OpenChamber fuehrt nichts zusammen – es laedt
 * genau das, was hier liegt.
 *
 *   page/main.js     IIFE, weil die Seite in einem sandboxed iframe laeuft
 *   panel/main.js    IIFE, aus demselben Grund
 *   service/main.mjs ESM, laeuft als Node-Prozess beim Host
 *
 * Der Build prueft sich am Ende selbst. Das ist nicht uebertrieben: es ist
 * bereits passiert, dass eine aeltere Datei ausgeliefert wurde, in der genau
 * eine Zeile fehlte. Die Seite blieb dadurch leer an einer Stelle, ohne dass
 * irgendetwas eine Fehlermeldung erzeugt haette – man konnte nur schwer
 * glauben, was man sah. Ein Build, der sein Ergebnis nicht prueft, ist die
 * wahrscheinlichste Ursache fuer „das habe ich doch gebaut".
 */

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Alle Quelltexte unter src/, sortiert – damit der Stempel stabil bleibt. */
const quellen = []
const sammle = (dir) => {
  for (const eintrag of readdirSync(dir, { withFileTypes: true })) {
    const voll = join(dir, eintrag.name)
    if (eintrag.isDirectory()) sammle(voll)
    else if (eintrag.name.endsWith('.ts')) quellen.push(voll)
  }
}
sammle(join(root, 'src'))

quellen.sort()

/**
 * Kurzer Fingerabdruck aller Quellen. Die Seite zeigt ihn an – damit laesst
 * sich sagen, ob sie den Stand faehrt, den man gerade gebaut hat, oder einen
 * von vorgestern.
 */
const buildId = createHash('sha256')
for (const q of quellen) buildId.update(readFileSync(q))
const BUILD_ID = buildId.digest('hex').slice(0, 8)

const targets = [
  { entry: 'src/page/main.ts', outfile: 'page/main.js', format: 'iife', target: 'browser' },
  { entry: 'src/panel/main.ts', outfile: 'panel/main.js', format: 'iife', target: 'browser' },
  { entry: 'src/service/main.ts', outfile: 'service/main.mjs', format: 'esm', target: 'node' },
]

const bun = process.platform === 'win32' ? 'bun.exe' : 'bun'
let failed = false

// Erst der Typecheck. Ein falscher Feldname an einer UI-Kit-Komponente faellt
// im Bundle erst zur Laufzeit auf – dann ist die Seite schlicht leer.
const tsc = spawnSync(
  process.execPath,
  [join(root, 'node_modules', 'typescript', 'bin', 'tsc'), '--noEmit'],
  { stdio: 'inherit', cwd: root },
)
if (tsc.status !== 0) {
  console.error('FEHLER im Typecheck. Nichts gebaut.')
  process.exit(1)
}

for (const t of targets) {
  const args = [
    'build',
    join(root, t.entry),
    '--outfile',
    join(root, t.outfile),
    '--format',
    t.format,
    '--target',
    t.target,
    '--minify',
    '--define',
    `__BUILD_ID__="${BUILD_ID}"`,
  ]
  const result = spawnSync(bun, args, { stdio: 'inherit', cwd: root })
  if (result.status !== 0) {
    console.error(`FEHLER beim Bauen von ${t.entry}`)
    failed = true
  }
}

if (failed) process.exit(1)

// ---------------------------------------------------------------------------
// Selbstpruefung: ist das Ergebnis juenger als alles, was hineingeflossen ist?
// ---------------------------------------------------------------------------

const aeltesteQuelle = quellen.reduce(
  (max, q) => Math.max(max, statSync(q).mtimeMs),
  0,
)

for (const t of targets) {
  const pfad = join(root, t.outfile)

  if (!existsSync(pfad)) {
    console.error(`${t.outfile} wurde nicht geschrieben.`)
    failed = true
    continue
  }

  const gebaut = statSync(pfad).mtimeMs
  if (gebaut < aeltesteQuelle) {
    const aelter = quellen
      .filter((q) => statSync(q).mtimeMs > gebaut)
      .map((q) => relative(root, q))
    console.error(
      `${t.outfile} ist aelter als ${aelter.join(', ')}. ` +
        'Ein alter Stand wuerde ausgeliefert.',
    )
    failed = true
    continue
  }

  const groesse = statSync(pfad).size
  console.log(
    `${t.outfile.padEnd(18)} ${(groesse / 1024).toFixed(1).padStart(6)} KB  ` +
      `Build ${BUILD_ID}`,
  )
}

if (failed) {
  console.error('Der Build hat sich selbst nicht bestanden. Bitte nicht freigeben.')
  process.exit(1)
}

console.log(`Fertig. Build ${BUILD_ID}`)
